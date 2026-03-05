import { AppError } from '../../../middleware/errorHandler.js';
import { createPaymentIntent } from '../../../services/paymentCore.js';
import { mapPrismaUniquenessError } from './PrismaVotingRepository.js';
import type { IVotingRepository } from './IVotingRepository.js';
import type {
  CastFreeAwardVoteInput,
  CastVoteInput,
  CreatePaidVoteIntentInput,
  VotingConfigInput,
} from './types.js';

const parseMetadataJson = <T>(value: string | null | undefined, fallback: T): T => {
  if (!value) return fallback;
  try {
    return JSON.parse(value) as T;
  } catch {
    return fallback;
  }
};

export class VotingService {
  constructor(private readonly repository: IVotingRepository) {}

  async configureVoting(eventId: string, config: VotingConfigInput) {
    const event = await this.repository.getEventById(eventId);
    if (!event) throw new AppError('Event not found', 404);

    const startsAt = config.startsAt ?? null;
    const endsAt = config.endsAt ?? null;
    if (startsAt && endsAt && startsAt > endsAt) {
      throw new AppError('Voting start date must be before end date', 400);
    }

    const currency = String(config.currency || event.defaultCurrency || 'USD').toUpperCase();
    return this.repository.upsertVotingConfig(eventId, {
      ...config,
      currency,
    });
  }

  async listContests(eventId: string) {
    const event = await this.repository.getEventById(eventId);
    if (!event) throw new AppError('Event not found', 404);
    return this.repository.listContests(eventId, true);
  }

  async listOptions(eventId: string, contestId: string) {
    const contest = await this.repository.findContest(eventId, contestId);
    if (!contest || !contest.isActive) throw new AppError('Contest not found', 404);
    return this.repository.listOptions(eventId, contestId, true);
  }

  async castElectionVote(input: CastVoteInput) {
    const config = await this.repository.getVotingConfig(input.eventId);
    if (!config?.isEnabled) throw new AppError('Voting is not enabled for this event', 400);
    if (config.mode !== 'ELECTION') throw new AppError('Election mode is not enabled for this event', 400);

    const contest = await this.repository.findContest(input.eventId, input.contestId);
    if (!contest || !contest.isActive) throw new AppError('Contest not found', 404);

    const option = await this.repository.findOption(input.eventId, contest.id, input.optionId);
    if (!option || !option.isActive) throw new AppError('Nominee not found', 404);

    return this.repository.withTransaction(async (txRepo) => {
      try {
        const grant = await txRepo.createVoteGrant({
          eventId: input.eventId,
          contestId: contest.id,
          voterKey: input.voterKey,
          voteType: 'ELECTION',
          voteCount: 1,
        });

        const record = await txRepo.createVoteRecord({
          eventId: input.eventId,
          contestId: contest.id,
          optionId: option.id,
          voterKey: input.voterKey,
          voteType: 'ELECTION',
          voteCount: 1,
          channel: input.channel,
          voteGrantId: grant.id,
        });

        await txRepo.incrementOptionVotes(option.id, { total: 1 });
        return record;
      } catch (error) {
        mapPrismaUniquenessError(error, 'Election vote already recorded for this voter');
      }
    });
  }

  async castFreeAwardVote(input: CastFreeAwardVoteInput) {
    const config = await this.repository.getVotingConfig(input.eventId);
    if (!config?.isEnabled) throw new AppError('Voting is not enabled for this event', 400);
    if (config.mode !== 'AWARDS') throw new AppError('Free award votes are not available in election mode', 400);
    if (!config.allowFreeVotes) throw new AppError('Free voting is disabled', 400);

    const contest = await this.repository.findContest(input.eventId, input.contestId);
    if (!contest || !contest.isActive) throw new AppError('Contest not found', 404);

    const option = await this.repository.findOption(input.eventId, contest.id, input.optionId);
    if (!option || !option.isActive) throw new AppError('Nominee not found', 404);

    const scope = input.scope;
    return this.repository.withTransaction(async (txRepo) => {
      try {
        const grant = await txRepo.createVoteGrant({
          eventId: input.eventId,
          contestId: contest.id,
          voterKey: input.voterKey,
          voteType: 'FREE',
          voteCount: 1,
        });

        const record = await txRepo.createVoteRecord({
          eventId: input.eventId,
          contestId: contest.id,
          optionId: option.id,
          voterKey: input.voterKey,
          voteType: 'FREE',
          voteCount: 1,
          channel: input.channel,
          voteGrantId: grant.id,
        });

        if (scope === 'EVENT') {
          await txRepo.createFreeVoteUsage({
            eventId: input.eventId,
            contestId: contest.id,
            optionId: option.id,
            voterKey: input.voterKey,
            voteRecordId: record.id,
          });
        }

        await txRepo.incrementOptionVotes(option.id, { total: 1, free: 1 });
        return record;
      } catch (error) {
        mapPrismaUniquenessError(
          error,
          scope === 'EVENT'
            ? 'Free vote already used for this event'
            : 'Free vote already used for this contest'
        );
      }
    });
  }

  async createPaidVoteIntent(input: CreatePaidVoteIntentInput) {
    const config = await this.repository.getVotingConfig(input.eventId);
    if (!config?.isEnabled) throw new AppError('Voting is not enabled for this event', 400);
    if (config.mode === 'ELECTION') throw new AppError('Paid votes are not allowed in election mode', 400);
    if (!config.allowPaidVotes) throw new AppError('Paid votes are disabled', 400);
    if (input.quantity < 1) throw new AppError('Quantity must be at least 1', 400);
    if (input.quantity > config.maxVotesPerPurchase) {
      throw new AppError(`Maximum ${config.maxVotesPerPurchase} votes per purchase`, 400);
    }

    const contest = await this.repository.findContest(input.eventId, input.contestId);
    if (!contest || !contest.isActive) throw new AppError('Contest not found', 404);

    const option = await this.repository.findOption(input.eventId, contest.id, input.optionId);
    if (!option || !option.isActive) throw new AppError('Nominee not found', 404);

    const event = await this.repository.getEventById(input.eventId);
    if (!event) throw new AppError('Event not found', 404);

    const amount = Number((config.voteUnitPrice * input.quantity).toFixed(2));
    if (!Number.isFinite(amount) || amount <= 0) throw new AppError('Invalid vote amount', 400);

    return createPaymentIntent({
      eventId: input.eventId,
      purpose: 'VOTE',
      amount,
      currency: config.currency || event.defaultCurrency || 'USD',
      paymentGatewayId: input.paymentGatewayId,
      metadata: {
        contestId: contest.id,
        optionId: option.id,
        voteCount: input.quantity,
        voterKey: input.buyerIdentity.voterKey,
        source: input.channel,
        purpose: 'VOTE_PURCHASE',
      },
    });
  }

  async applyPaidVoteGrant(input: { paymentIntentId: string }) {
    const existing = await this.repository.findVoteGrantByPaymentIntent(input.paymentIntentId);
    if (existing) {
      return { voteGrant: existing, idempotent: true };
    }

    const paymentIntent = await this.repository.findPaymentIntent(input.paymentIntentId);
    if (!paymentIntent) throw new AppError('Payment intent not found', 404);
    if (paymentIntent.status !== 'SUCCEEDED') throw new AppError('Payment is not confirmed', 409);

    const metadata = parseMetadataJson<Record<string, unknown>>(paymentIntent.metadataJson, {});
    const contestId = String(metadata.contestId || '').trim();
    const optionId = String(metadata.optionId || '').trim();
    const voterKey = String(metadata.voterKey || '').trim();
    const quantity = Number(metadata.voteCount || 0);
    const channelRaw = String(metadata.source || 'WEB').toUpperCase();
    const channel = channelRaw === 'USSD' ? 'USSD' : 'WEB';

    if (!contestId || !optionId || !voterKey || !Number.isFinite(quantity) || quantity < 1) {
      throw new AppError('Payment metadata is missing voting payload', 400);
    }

    const contest = await this.repository.findContest(paymentIntent.eventId, contestId);
    if (!contest || !contest.isActive) throw new AppError('Contest not found', 404);
    const option = await this.repository.findOption(paymentIntent.eventId, contest.id, optionId);
    if (!option || !option.isActive) throw new AppError('Nominee not found', 404);

    const voteGrant = await this.repository.withTransaction(async (txRepo) => {
      const secondExisting = await txRepo.findVoteGrantByPaymentIntent(input.paymentIntentId);
      if (secondExisting) return secondExisting;

      const grant = await txRepo.createVoteGrant({
        eventId: paymentIntent.eventId,
        contestId: contest.id,
        voterKey,
        voteType: 'PAID',
        voteCount: quantity,
        paymentIntentId: input.paymentIntentId,
        metadataJson: JSON.stringify({
          source: channel,
        }),
      });

      await txRepo.createVoteRecord({
        eventId: paymentIntent.eventId,
        contestId: contest.id,
        optionId: option.id,
        voterKey,
        voteType: 'PAID',
        voteCount: quantity,
        channel,
        voteGrantId: grant.id,
        paymentIntentId: input.paymentIntentId,
      });

      await txRepo.incrementOptionVotes(option.id, {
        total: quantity,
        paid: quantity,
      });
      return grant;
    });

    return { voteGrant, idempotent: false };
  }

  async getResults(eventId: string, contestId: string) {
    const contest = await this.repository.findContest(eventId, contestId);
    if (!contest || !contest.isActive) throw new AppError('Contest not found', 404);
    return this.repository.getResults(eventId, contestId);
  }
}

