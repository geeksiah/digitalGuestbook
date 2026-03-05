import { z } from 'zod';
import prisma from '../../../utils/prisma.js';
import { AppError } from '../../../middleware/errorHandler.js';
import { UssdCreditsService } from '../credits/UssdCreditsService.js';
import { VoterIdentityService } from '../core/VoterIdentityService.js';
import { VotingService } from '../core/VotingService.js';
import { UssdRenderer } from '../ussd/UssdRenderer.js';
import { UssdStateMachine } from '../ussd/UssdStateMachine.js';
import type { IVotingChannelAdapter } from './IVotingChannelAdapter.js';

const basePayloadSchema = z.object({
  network: z.string().min(1),
  sessionid: z.string().min(1),
  mode: z.string().min(1),
  userdata: z.string(),
  username: z.string().min(1),
  trafficid: z.string().min(1),
  other: z.string().optional(),
  msisdn: z.string().optional(),
  phonenumber: z.string().optional(),
});

type FrogRequestPayload = z.infer<typeof basePayloadSchema>;

export type FrogAdapterResponse = {
  network: string;
  sessionid: string;
  mode: 'MORE' | 'END';
  userdata: string;
  username: string;
  trafficid: string;
  other?: string;
  msisdn?: string;
  phonenumber?: string;
};

const normalizeMode = (mode: string): 'START' | 'MORE' | 'END' => {
  const upper = String(mode || '').trim().toUpperCase();
  if (upper === 'START') return 'START';
  if (upper === 'END') return 'END';
  return 'MORE';
};

type SessionContext = {
  selectedContestId?: string;
  selectedOptionId?: string;
  optionsPage?: number;
};

export class FrogUssdV2Adapter implements IVotingChannelAdapter<unknown, FrogAdapterResponse> {
  private readonly renderer = new UssdRenderer();
  private readonly machine = new UssdStateMachine();

  constructor(
    private readonly votingService: VotingService,
    private readonly creditsService: UssdCreditsService,
    private readonly identityService: VoterIdentityService
  ) {}

  async handleRequest(rawInput: unknown): Promise<FrogAdapterResponse> {
    const payload = basePayloadSchema.parse(rawInput);
    const mode = normalizeMode(payload.mode);
    const phoneField = payload.msisdn ? 'msisdn' : payload.phonenumber ? 'phonenumber' : null;
    const rawPhone = payload.msisdn || payload.phonenumber;
    if (!phoneField || !rawPhone) {
      throw new AppError('msisdn or phonenumber is required', 400);
    }
    const msisdnNormalized = this.identityService.normalizeMsisdn(rawPhone);

    const channelBinding = await prisma.ussdChannelBinding.findFirst({
      where: {
        isActive: true,
        ussdChannel: {
          provider: 'WIGAL_FROG',
          status: 'ACTIVE',
          codeLabel: payload.username,
        },
      },
      include: {
        ussdChannel: true,
      },
      orderBy: { createdAt: 'asc' },
    });

    if (!channelBinding) {
      return this.reply(payload, phoneField, {
        mode: 'END',
        userdata: this.renderer.renderLines(['USSD channel not linked to an active event.']),
      });
    }

    const session = await prisma.ussdSession.upsert({
      where: { providerSessionId: payload.sessionid },
      create: {
        providerSessionId: payload.sessionid,
        lastTrafficId: payload.trafficid,
        msisdnNormalized,
        ussdChannelId: channelBinding.ussdChannelId,
        eventId: channelBinding.eventId,
        state: 'WELCOME',
        contextJson: null,
        responseJson: null,
        expiresAt: new Date(Date.now() + 5 * 60 * 1000),
      },
      update: {
        msisdnNormalized,
        ussdChannelId: channelBinding.ussdChannelId,
        eventId: channelBinding.eventId,
        expiresAt: new Date(Date.now() + 5 * 60 * 1000),
      },
    });

    const duplicateTraffic = await prisma.ussdTrafficLog.findFirst({
      where: {
        ussdSessionId: session.id,
        trafficId: payload.trafficid,
      },
    });
    if (duplicateTraffic) {
      const response = JSON.parse(duplicateTraffic.responseJson) as FrogAdapterResponse;
      return response;
    }

    const wallet = await this.creditsService.ensureWalletForEvent(channelBinding.eventId);
    const consumeResult = await this.creditsService.consumeCredits(
      wallet.id,
      1,
      `${payload.sessionid}:${payload.trafficid}`,
      { network: payload.network, mode }
    );
    if (consumeResult.status === 'insufficient') {
      const response = this.reply(payload, phoneField, {
        mode: 'END',
        userdata: this.renderer.renderLines(['USSD credit is finished. Please top up and retry.']),
      });
      await this.storeTraffic(session.id, payload.trafficid, payload, response);
      return response;
    }

    const contests = await this.votingService.listContests(channelBinding.eventId);
    const contestOptions = await Promise.all(
      contests.map(async (contest) => ({
        id: contest.id,
        title: contest.title,
        options: (await this.votingService.listOptions(channelBinding.eventId, contest.id)).map((option) => ({
          id: option.id,
          name: option.name,
          totalVotes: option.totalVotes,
        })),
      }))
    );

    const parsedContext = this.parseSessionContext(session.contextJson);
    const state = (session.state || 'WELCOME') as
      | 'WELCOME'
      | 'SELECT_CONTEST'
      | 'SELECT_OPTION'
      | 'CONFIRM'
      | 'SUCCESS'
      | 'LEADERBOARD';

    const machineResult = this.machine.step({
      mode,
      userInput: mode === 'START' ? '' : payload.userdata,
      state,
      context: parsedContext,
      contests: contestOptions,
    });

    if (machineResult.nextState === 'SUCCESS' && machineResult.shouldEnd) {
      const selectedContestId = machineResult.contextUpdates.selectedContestId || parsedContext.selectedContestId;
      const selectedOptionId = machineResult.contextUpdates.selectedOptionId || parsedContext.selectedOptionId;
      if (selectedContestId && selectedOptionId) {
        const voterKey = this.identityService.deriveVoterKey({
          eventId: channelBinding.eventId,
          scopeKey: selectedContestId,
          msisdnNormalized,
        });
        const config = await prisma.votingEventConfig.findUnique({
          where: { eventId: channelBinding.eventId },
          select: {
            mode: true,
            freeVoteScope: true,
          },
        });

        if (config?.mode === 'ELECTION') {
          await this.votingService.castElectionVote({
            eventId: channelBinding.eventId,
            contestId: selectedContestId,
            optionId: selectedOptionId,
            voterKey,
            channel: 'USSD',
          });
        } else {
          await this.votingService.castFreeAwardVote({
            eventId: channelBinding.eventId,
            contestId: selectedContestId,
            optionId: selectedOptionId,
            voterKey,
            scope: config?.freeVoteScope || 'CONTEST',
            channel: 'USSD',
          });
        }
      }
    }

    const response = this.reply(payload, phoneField, {
      mode: machineResult.shouldEnd ? 'END' : 'MORE',
      userdata: this.renderer.renderLines(machineResult.responseLines),
    });

    await prisma.ussdSession.update({
      where: { id: session.id },
      data: {
        state: machineResult.nextState,
        contextJson: JSON.stringify(machineResult.contextUpdates || {}),
        responseJson: JSON.stringify(response),
        lastTrafficId: payload.trafficid,
        expiresAt: new Date(Date.now() + 5 * 60 * 1000),
      },
    });
    await this.storeTraffic(session.id, payload.trafficid, payload, response);
    return response;
  }

  private parseSessionContext(rawContext: string | null): SessionContext {
    if (!rawContext) return {};
    try {
      const parsed = JSON.parse(rawContext) as SessionContext;
      return parsed && typeof parsed === 'object' ? parsed : {};
    } catch {
      return {};
    }
  }

  private async storeTraffic(
    sessionId: string,
    trafficId: string,
    requestPayload: FrogRequestPayload,
    response: FrogAdapterResponse
  ) {
    try {
      await prisma.ussdTrafficLog.create({
        data: {
          ussdSessionId: sessionId,
          trafficId,
          requestJson: JSON.stringify(requestPayload),
          responseJson: JSON.stringify(response),
        },
      });
    } catch (error) {
      const maybe = error as { code?: string };
      if (maybe.code !== 'P2002') throw error;
    }
  }

  private reply(
    payload: FrogRequestPayload,
    phoneField: 'msisdn' | 'phonenumber',
    input: { mode: 'MORE' | 'END'; userdata: string }
  ): FrogAdapterResponse {
    const response: FrogAdapterResponse = {
      network: payload.network,
      sessionid: payload.sessionid,
      mode: input.mode,
      userdata: input.userdata,
      username: payload.username,
      trafficid: payload.trafficid,
      ...(payload.other ? { other: payload.other } : {}),
      ...(phoneField === 'msisdn'
        ? { msisdn: payload.msisdn || payload.phonenumber || '' }
        : { phonenumber: payload.phonenumber || payload.msisdn || '' }),
    };
    return response;
  }
}

