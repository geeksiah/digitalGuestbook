import { Router } from 'express';
import { z } from 'zod';
import { asyncHandler, AppError } from '../middleware/errorHandler.js';
import prisma from '../utils/prisma.js';
import { PrismaVotingRepository } from '../modules/voting/core/PrismaVotingRepository.js';
import { VotingService } from '../modules/voting/core/VotingService.js';
import { WebVotingAdapter } from '../modules/voting/channels/WebVotingAdapter.js';
import { VoterIdentityService } from '../modules/voting/core/VoterIdentityService.js';

const router = Router();
const repository = new PrismaVotingRepository(prisma);
const votingService = new VotingService(repository);
const webAdapter = new WebVotingAdapter(votingService);
const identityService = new VoterIdentityService();

const resolveMediaUrl = (mediaPath: string | null | undefined) => {
  if (!mediaPath) return null;
  const normalized = String(mediaPath).trim();
  if (!normalized) return null;
  if (normalized.startsWith('http://') || normalized.startsWith('https://')) return normalized;
  const supabase = String(process.env.SUPABASE_URL || '').replace(/\/+$/, '');
  if (supabase) {
    return `${supabase}/storage/v1/object/public/media/${normalized.replace(/^\/+/, '')}`;
  }
  return normalized;
};

router.get(
  '/public/event/:slug',
  asyncHandler(async (req, res) => {
    const { slug } = req.params;
    const event = await repository.getEventBySlug(slug);
    if (!event) throw new AppError('Event not found', 404);

    const config = await repository.getVotingConfig(event.id);
    if (!config || !config.isEnabled) throw new AppError('Voting is not enabled for this event', 404);

    const contests = await repository.listContests(event.id, true);
    const contestPayload = await Promise.all(
      contests.map(async (contest) => {
        const options = await repository.listOptions(event.id, contest.id, true);
        return {
          ...contest,
          options: options.map((option) => ({
            ...option,
            imageUrl: resolveMediaUrl(option.imagePath),
          })),
          nominationFormFields: (() => {
            if (!contest.nominationFormFieldsJson) return [];
            try {
              return JSON.parse(contest.nominationFormFieldsJson);
            } catch {
              return [];
            }
          })(),
        };
      })
    );

    res.json({
      event,
      config,
      contests: contestPayload,
    });
  })
);

const freeVoteSchema = z.object({
  eventId: z.string().uuid(),
  contestId: z.string().uuid(),
  optionId: z.string().uuid(),
  voterKey: z.string().min(8).optional(),
  phone: z.string().min(5).optional(),
  scope: z.enum(['EVENT', 'CONTEST']).optional(),
});

router.post(
  '/free-vote',
  asyncHandler(async (req, res) => {
    const input = freeVoteSchema.parse(req.body || {});
    const config = await repository.getVotingConfig(input.eventId);
    if (!config) throw new AppError('Voting config is missing', 400);

    const voterKey =
      input.voterKey ||
      (input.phone
        ? identityService.deriveVoterKey({
            eventId: input.eventId,
            scopeKey: config.freeVoteScope,
            msisdnNormalized: identityService.normalizeMsisdn(input.phone),
          })
        : '');
    if (!voterKey) throw new AppError('voterKey or phone is required', 400);

    const result = await webAdapter.handleRequest({
      eventId: input.eventId,
      contestId: input.contestId,
      optionId: input.optionId,
      voterKey,
      scope: input.scope || config.freeVoteScope || 'CONTEST',
    });

    res.status(201).json({
      success: true,
      vote: result,
    });
  })
);

const electionVoteSchema = z.object({
  eventId: z.string().uuid(),
  contestId: z.string().uuid(),
  optionId: z.string().uuid(),
  voterKey: z.string().min(8).optional(),
  phone: z.string().min(5).optional(),
});

router.post(
  '/election-vote',
  asyncHandler(async (req, res) => {
    const input = electionVoteSchema.parse(req.body || {});
    const voterKey =
      input.voterKey ||
      (input.phone
        ? identityService.deriveVoterKey({
            eventId: input.eventId,
            scopeKey: input.contestId,
            msisdnNormalized: identityService.normalizeMsisdn(input.phone),
          })
        : '');
    if (!voterKey) throw new AppError('voterKey or phone is required', 400);

    const result = await webAdapter.handleRequest({
      eventId: input.eventId,
      contestId: input.contestId,
      optionId: input.optionId,
      voterKey,
    });

    res.status(201).json({
      success: true,
      vote: result,
    });
  })
);

const paidVoteIntentSchema = z.object({
  eventId: z.string().uuid(),
  contestId: z.string().uuid(),
  optionId: z.string().uuid(),
  quantity: z.number().int().min(1).max(10000),
  paymentGatewayId: z.string().uuid(),
  voterKey: z.string().min(8).optional(),
  phone: z.string().min(5).optional(),
});

router.post(
  '/paid-vote-intents',
  asyncHandler(async (req, res) => {
    const input = paidVoteIntentSchema.parse(req.body || {});
    const voterKey =
      input.voterKey ||
      (input.phone
        ? identityService.deriveVoterKey({
            eventId: input.eventId,
            scopeKey: input.contestId,
            msisdnNormalized: identityService.normalizeMsisdn(input.phone),
          })
        : '');
    if (!voterKey) throw new AppError('voterKey or phone is required', 400);

    const result = await votingService.createPaidVoteIntent({
      eventId: input.eventId,
      contestId: input.contestId,
      optionId: input.optionId,
      quantity: input.quantity,
      paymentGatewayId: input.paymentGatewayId,
      channel: 'WEB',
      buyerIdentity: { voterKey },
    });

    res.status(201).json({
      success: true,
      paymentIntentId: result.intent.id,
      amount: result.intent.amount,
      currency: result.intent.currency,
      nextAction: result.nextAction,
    });
  })
);

const applyGrantSchema = z.object({
  paymentIntentId: z.string().uuid(),
});

router.post(
  '/paid-vote-grants/apply',
  asyncHandler(async (req, res) => {
    const input = applyGrantSchema.parse(req.body || {});
    const result = await votingService.applyPaidVoteGrant({ paymentIntentId: input.paymentIntentId });
    res.json({
      success: true,
      idempotent: result.idempotent,
      voteGrantId: result.voteGrant.id,
    });
  })
);

router.get(
  '/results/:eventId/:contestId',
  asyncHandler(async (req, res) => {
    const { eventId, contestId } = req.params;
    const results = await votingService.getResults(eventId, contestId);
    res.json({ results });
  })
);

export default router;

