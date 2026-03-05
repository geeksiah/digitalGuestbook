"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const zod_1 = require("zod");
const errorHandler_js_1 = require("../middleware/errorHandler.js");
const prisma_js_1 = __importDefault(require("../utils/prisma.js"));
const PrismaVotingRepository_js_1 = require("../modules/voting/core/PrismaVotingRepository.js");
const VotingService_js_1 = require("../modules/voting/core/VotingService.js");
const WebVotingAdapter_js_1 = require("../modules/voting/channels/WebVotingAdapter.js");
const VoterIdentityService_js_1 = require("../modules/voting/core/VoterIdentityService.js");
const router = (0, express_1.Router)();
const repository = new PrismaVotingRepository_js_1.PrismaVotingRepository(prisma_js_1.default);
const votingService = new VotingService_js_1.VotingService(repository);
const webAdapter = new WebVotingAdapter_js_1.WebVotingAdapter(votingService);
const identityService = new VoterIdentityService_js_1.VoterIdentityService();
const resolveMediaUrl = (mediaPath) => {
    if (!mediaPath)
        return null;
    const normalized = String(mediaPath).trim();
    if (!normalized)
        return null;
    if (normalized.startsWith('http://') || normalized.startsWith('https://'))
        return normalized;
    const supabase = String(process.env.SUPABASE_URL || '').replace(/\/+$/, '');
    if (supabase) {
        return `${supabase}/storage/v1/object/public/media/${normalized.replace(/^\/+/, '')}`;
    }
    return normalized;
};
router.get('/public/event/:slug', (0, errorHandler_js_1.asyncHandler)(async (req, res) => {
    const { slug } = req.params;
    const event = await repository.getEventBySlug(slug);
    if (!event)
        throw new errorHandler_js_1.AppError('Event not found', 404);
    const config = await repository.getVotingConfig(event.id);
    if (!config || !config.isEnabled)
        throw new errorHandler_js_1.AppError('Voting is not enabled for this event', 404);
    const contests = await repository.listContests(event.id, true);
    const contestPayload = await Promise.all(contests.map(async (contest) => {
        const options = await repository.listOptions(event.id, contest.id, true);
        return {
            ...contest,
            options: options.map((option) => ({
                ...option,
                imageUrl: resolveMediaUrl(option.imagePath),
            })),
            nominationFormFields: (() => {
                if (!contest.nominationFormFieldsJson)
                    return [];
                try {
                    return JSON.parse(contest.nominationFormFieldsJson);
                }
                catch {
                    return [];
                }
            })(),
        };
    }));
    res.json({
        event,
        config,
        contests: contestPayload,
    });
}));
const freeVoteSchema = zod_1.z.object({
    eventId: zod_1.z.string().uuid(),
    contestId: zod_1.z.string().uuid(),
    optionId: zod_1.z.string().uuid(),
    voterKey: zod_1.z.string().min(8).optional(),
    phone: zod_1.z.string().min(5).optional(),
    scope: zod_1.z.enum(['EVENT', 'CONTEST']).optional(),
});
router.post('/free-vote', (0, errorHandler_js_1.asyncHandler)(async (req, res) => {
    const input = freeVoteSchema.parse(req.body || {});
    const config = await repository.getVotingConfig(input.eventId);
    if (!config)
        throw new errorHandler_js_1.AppError('Voting config is missing', 400);
    const voterKey = input.voterKey ||
        (input.phone
            ? identityService.deriveVoterKey({
                eventId: input.eventId,
                scopeKey: config.freeVoteScope,
                msisdnNormalized: identityService.normalizeMsisdn(input.phone),
            })
            : '');
    if (!voterKey)
        throw new errorHandler_js_1.AppError('voterKey or phone is required', 400);
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
}));
const electionVoteSchema = zod_1.z.object({
    eventId: zod_1.z.string().uuid(),
    contestId: zod_1.z.string().uuid(),
    optionId: zod_1.z.string().uuid(),
    voterKey: zod_1.z.string().min(8).optional(),
    phone: zod_1.z.string().min(5).optional(),
});
router.post('/election-vote', (0, errorHandler_js_1.asyncHandler)(async (req, res) => {
    const input = electionVoteSchema.parse(req.body || {});
    const voterKey = input.voterKey ||
        (input.phone
            ? identityService.deriveVoterKey({
                eventId: input.eventId,
                scopeKey: input.contestId,
                msisdnNormalized: identityService.normalizeMsisdn(input.phone),
            })
            : '');
    if (!voterKey)
        throw new errorHandler_js_1.AppError('voterKey or phone is required', 400);
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
}));
const paidVoteIntentSchema = zod_1.z.object({
    eventId: zod_1.z.string().uuid(),
    contestId: zod_1.z.string().uuid(),
    optionId: zod_1.z.string().uuid(),
    quantity: zod_1.z.number().int().min(1).max(10000),
    paymentGatewayId: zod_1.z.string().uuid(),
    voterKey: zod_1.z.string().min(8).optional(),
    phone: zod_1.z.string().min(5).optional(),
});
router.post('/paid-vote-intents', (0, errorHandler_js_1.asyncHandler)(async (req, res) => {
    const input = paidVoteIntentSchema.parse(req.body || {});
    const voterKey = input.voterKey ||
        (input.phone
            ? identityService.deriveVoterKey({
                eventId: input.eventId,
                scopeKey: input.contestId,
                msisdnNormalized: identityService.normalizeMsisdn(input.phone),
            })
            : '');
    if (!voterKey)
        throw new errorHandler_js_1.AppError('voterKey or phone is required', 400);
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
}));
const applyGrantSchema = zod_1.z.object({
    paymentIntentId: zod_1.z.string().uuid(),
});
router.post('/paid-vote-grants/apply', (0, errorHandler_js_1.asyncHandler)(async (req, res) => {
    const input = applyGrantSchema.parse(req.body || {});
    const result = await votingService.applyPaidVoteGrant({ paymentIntentId: input.paymentIntentId });
    res.json({
        success: true,
        idempotent: result.idempotent,
        voteGrantId: result.voteGrant.id,
    });
}));
router.get('/results/:eventId/:contestId', (0, errorHandler_js_1.asyncHandler)(async (req, res) => {
    const { eventId, contestId } = req.params;
    const results = await votingService.getResults(eventId, contestId);
    res.json({ results });
}));
exports.default = router;
//# sourceMappingURL=v2-voting.js.map