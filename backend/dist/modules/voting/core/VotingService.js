"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.VotingService = void 0;
const errorHandler_js_1 = require("../../../middleware/errorHandler.js");
const paymentCore_js_1 = require("../../../services/paymentCore.js");
const PrismaVotingRepository_js_1 = require("./PrismaVotingRepository.js");
const parseMetadataJson = (value, fallback) => {
    if (!value)
        return fallback;
    try {
        return JSON.parse(value);
    }
    catch {
        return fallback;
    }
};
const hasManualIdVerification = (settingsJson) => {
    const settings = settingsJson && typeof settingsJson === 'object' && !Array.isArray(settingsJson)
        ? settingsJson
        : {};
    const verification = settings.verification && typeof settings.verification === 'object' && !Array.isArray(settings.verification)
        ? settings.verification
        : {};
    return Boolean(verification.manualIdEnabled);
};
const countManualIdEntries = (settingsJson) => {
    const settings = settingsJson && typeof settingsJson === 'object' && !Array.isArray(settingsJson)
        ? settingsJson
        : {};
    const verification = settings.verification && typeof settings.verification === 'object' && !Array.isArray(settings.verification)
        ? settings.verification
        : {};
    const entries = Array.isArray(verification.manualIdEntries) ? verification.manualIdEntries : [];
    return entries.length;
};
class VotingService {
    repository;
    constructor(repository) {
        this.repository = repository;
    }
    async configureVoting(eventId, config) {
        const event = await this.repository.getEventById(eventId);
        if (!event)
            throw new errorHandler_js_1.AppError('Event not found', 404);
        const startsAt = config.startsAt ?? null;
        const endsAt = config.endsAt ?? null;
        if (startsAt && endsAt && startsAt > endsAt) {
            throw new errorHandler_js_1.AppError('Voting start date must be before end date', 400);
        }
        const currency = String(config.currency || event.defaultCurrency || 'USD').toUpperCase();
        const normalizedMode = config.mode;
        const electionRules = normalizedMode === 'ELECTION'
            ? {
                allowPaidVotes: false,
                maxVotesPerPurchase: 1,
            }
            : {};
        if (normalizedMode === 'ELECTION') {
            const requiresPhoneOtp = Boolean(config.requireOtpForElection);
            const requiresManualId = hasManualIdVerification(config.settingsJson);
            if (!requiresPhoneOtp && !requiresManualId) {
                throw new errorHandler_js_1.AppError('Election mode requires at least one voter verification method: phone OTP, manual voter IDs, or both', 400);
            }
        }
        if (hasManualIdVerification(config.settingsJson) && countManualIdEntries(config.settingsJson) === 0) {
            throw new errorHandler_js_1.AppError('Manual voter ID verification requires at least one approved voter ID entry', 400);
        }
        return this.repository.upsertVotingConfig(eventId, {
            ...config,
            currency,
            ...electionRules,
        });
    }
    async listContests(eventId) {
        const event = await this.repository.getEventById(eventId);
        if (!event)
            throw new errorHandler_js_1.AppError('Event not found', 404);
        return this.repository.listContests(eventId, true);
    }
    async listOptions(eventId, contestId) {
        const contest = await this.repository.findContest(eventId, contestId);
        if (!contest || !contest.isActive)
            throw new errorHandler_js_1.AppError('Contest not found', 404);
        return this.repository.listOptions(eventId, contestId, true);
    }
    async castElectionVote(input) {
        const config = await this.repository.getVotingConfig(input.eventId);
        if (!config?.isEnabled)
            throw new errorHandler_js_1.AppError('Voting is not enabled for this event', 400);
        if (config.mode !== 'ELECTION')
            throw new errorHandler_js_1.AppError('Election mode is not enabled for this event', 400);
        const contest = await this.repository.findContest(input.eventId, input.contestId);
        if (!contest || !contest.isActive)
            throw new errorHandler_js_1.AppError('Contest not found', 404);
        const option = await this.repository.findOption(input.eventId, contest.id, input.optionId);
        if (!option || !option.isActive)
            throw new errorHandler_js_1.AppError('Nominee not found', 404);
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
            }
            catch (error) {
                (0, PrismaVotingRepository_js_1.mapPrismaUniquenessError)(error, 'Election vote already recorded for this voter');
            }
        });
    }
    async castFreeAwardVote(input) {
        const config = await this.repository.getVotingConfig(input.eventId);
        if (!config?.isEnabled)
            throw new errorHandler_js_1.AppError('Voting is not enabled for this event', 400);
        if (config.mode !== 'AWARDS')
            throw new errorHandler_js_1.AppError('Free award votes are not available in election mode', 400);
        if (!config.allowFreeVotes)
            throw new errorHandler_js_1.AppError('Free voting is disabled', 400);
        const contest = await this.repository.findContest(input.eventId, input.contestId);
        if (!contest || !contest.isActive)
            throw new errorHandler_js_1.AppError('Contest not found', 404);
        const option = await this.repository.findOption(input.eventId, contest.id, input.optionId);
        if (!option || !option.isActive)
            throw new errorHandler_js_1.AppError('Nominee not found', 404);
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
            }
            catch (error) {
                (0, PrismaVotingRepository_js_1.mapPrismaUniquenessError)(error, scope === 'EVENT'
                    ? 'Free vote already used for this event'
                    : 'Free vote already used for this contest');
            }
        });
    }
    async createPaidVoteIntent(input) {
        const config = await this.repository.getVotingConfig(input.eventId);
        if (!config?.isEnabled)
            throw new errorHandler_js_1.AppError('Voting is not enabled for this event', 400);
        if (config.mode === 'ELECTION')
            throw new errorHandler_js_1.AppError('Paid votes are not allowed in election mode', 400);
        if (!config.allowPaidVotes)
            throw new errorHandler_js_1.AppError('Paid votes are disabled', 400);
        if (input.quantity < 1)
            throw new errorHandler_js_1.AppError('Quantity must be at least 1', 400);
        if (input.quantity > config.maxVotesPerPurchase) {
            throw new errorHandler_js_1.AppError(`Maximum ${config.maxVotesPerPurchase} votes per purchase`, 400);
        }
        const contest = await this.repository.findContest(input.eventId, input.contestId);
        if (!contest || !contest.isActive)
            throw new errorHandler_js_1.AppError('Contest not found', 404);
        const option = await this.repository.findOption(input.eventId, contest.id, input.optionId);
        if (!option || !option.isActive)
            throw new errorHandler_js_1.AppError('Nominee not found', 404);
        const event = await this.repository.getEventById(input.eventId);
        if (!event)
            throw new errorHandler_js_1.AppError('Event not found', 404);
        const amount = Number((config.voteUnitPrice * input.quantity).toFixed(2));
        if (!Number.isFinite(amount) || amount <= 0)
            throw new errorHandler_js_1.AppError('Invalid vote amount', 400);
        return (0, paymentCore_js_1.createPaymentIntent)({
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
    async applyPaidVoteGrant(input) {
        const existing = await this.repository.findVoteGrantByPaymentIntent(input.paymentIntentId);
        if (existing) {
            return { voteGrant: existing, idempotent: true };
        }
        const paymentIntent = await this.repository.findPaymentIntent(input.paymentIntentId);
        if (!paymentIntent)
            throw new errorHandler_js_1.AppError('Payment intent not found', 404);
        if (paymentIntent.status !== 'SUCCEEDED')
            throw new errorHandler_js_1.AppError('Payment is not confirmed', 409);
        const metadata = parseMetadataJson(paymentIntent.metadataJson, {});
        const contestId = String(metadata.contestId || '').trim();
        const optionId = String(metadata.optionId || '').trim();
        const voterKey = String(metadata.voterKey || '').trim();
        const quantity = Number(metadata.voteCount || 0);
        const channelRaw = String(metadata.source || 'WEB').toUpperCase();
        const channel = channelRaw === 'USSD' ? 'USSD' : 'WEB';
        if (!contestId || !optionId || !voterKey || !Number.isFinite(quantity) || quantity < 1) {
            throw new errorHandler_js_1.AppError('Payment metadata is missing voting payload', 400);
        }
        const contest = await this.repository.findContest(paymentIntent.eventId, contestId);
        if (!contest || !contest.isActive)
            throw new errorHandler_js_1.AppError('Contest not found', 404);
        const option = await this.repository.findOption(paymentIntent.eventId, contest.id, optionId);
        if (!option || !option.isActive)
            throw new errorHandler_js_1.AppError('Nominee not found', 404);
        const voteGrant = await this.repository.withTransaction(async (txRepo) => {
            const secondExisting = await txRepo.findVoteGrantByPaymentIntent(input.paymentIntentId);
            if (secondExisting)
                return secondExisting;
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
    async getResults(eventId, contestId) {
        const contest = await this.repository.findContest(eventId, contestId);
        if (!contest || !contest.isActive)
            throw new errorHandler_js_1.AppError('Contest not found', 404);
        return this.repository.getResults(eventId, contestId);
    }
}
exports.VotingService = VotingService;
//# sourceMappingURL=VotingService.js.map