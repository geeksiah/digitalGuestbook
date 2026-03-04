"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const zod_1 = require("zod");
const auth_js_1 = require("../middleware/auth.js");
const errorHandler_js_1 = require("../middleware/errorHandler.js");
const prisma_js_1 = __importDefault(require("../utils/prisma.js"));
const router = (0, express_1.Router)();
router.use(auth_js_1.authenticateOwnerAccount);
const DEFAULT_VOTING_TEMPLATE_ID = 'default-voting';
const parseJson = (value, fallback) => {
    if (!value)
        return fallback;
    try {
        return JSON.parse(value);
    }
    catch {
        return fallback;
    }
};
const nominationFieldSchema = zod_1.z.object({
    id: zod_1.z.string().min(1).max(64),
    label: zod_1.z.string().min(1).max(120),
    type: zod_1.z.enum(['text', 'textarea', 'email', 'phone', 'number', 'select']),
    required: zod_1.z.boolean().optional(),
    placeholder: zod_1.z.string().max(200).optional().nullable(),
    options: zod_1.z.array(zod_1.z.string().max(120)).optional(),
});
const ensureOwnerEvent = async (eventId, ownerId) => {
    const event = await prisma_js_1.default.event.findFirst({
        where: { id: eventId, ownerId },
        select: {
            id: true,
            name: true,
            ownerId: true,
            votingPageTemplateId: true,
            votingConfig: true,
        },
    });
    if (!event)
        throw new errorHandler_js_1.AppError('Event not found', 404);
    return event;
};
const assignDefaultVotingTemplateIfNeeded = async (eventId, currentVotingPageTemplateId) => {
    if (currentVotingPageTemplateId)
        return;
    const hardDefault = await prisma_js_1.default.template.findFirst({
        where: {
            id: DEFAULT_VOTING_TEMPLATE_ID,
            type: 'VOTING',
        },
        select: { id: true },
    });
    const defaultVotingTemplate = hardDefault ??
        (await prisma_js_1.default.template.findFirst({
            where: {
                type: 'VOTING',
                isDefault: true,
            },
            orderBy: { createdAt: 'asc' },
            select: { id: true },
        }));
    if (!defaultVotingTemplate)
        return;
    await prisma_js_1.default.event.updateMany({
        where: {
            id: eventId,
            votingPageTemplateId: null,
        },
        data: {
            votingPageTemplateId: defaultVotingTemplate.id,
        },
    });
};
const configSchema = zod_1.z.object({
    mode: zod_1.z.enum(['AWARDS', 'ELECTION']).optional(),
    isEnabled: zod_1.z.boolean().optional(),
    allowFreeVotes: zod_1.z.boolean().optional(),
    allowPaidVotes: zod_1.z.boolean().optional(),
    allowPublicNominations: zod_1.z.boolean().optional(),
    requireOtpForElection: zod_1.z.boolean().optional(),
    voteUnitPrice: zod_1.z.number().nonnegative().optional(),
    currency: zod_1.z.string().min(3).max(3).optional(),
    maxVotesPerPurchase: zod_1.z.number().int().min(1).max(10000).optional(),
    freeVoteLabel: zod_1.z.string().max(120).optional().nullable(),
    paidVoteLabel: zod_1.z.string().max(120).optional().nullable(),
    settingsJson: zod_1.z.record(zod_1.z.unknown()).optional(),
});
const contestSchema = zod_1.z.object({
    title: zod_1.z.string().min(2).max(160),
    description: zod_1.z.string().max(2000).optional().nullable(),
    mode: zod_1.z.enum(['AWARDS', 'ELECTION']).optional(),
    isActive: zod_1.z.boolean().optional(),
    allowPublicNominations: zod_1.z.boolean().optional(),
    nominationFormFields: zod_1.z.array(nominationFieldSchema).optional(),
    startsAt: zod_1.z.string().datetime().optional().nullable(),
    endsAt: zod_1.z.string().datetime().optional().nullable(),
    sortOrder: zod_1.z.number().int().optional(),
    metadataJson: zod_1.z.record(zod_1.z.unknown()).optional(),
});
const optionSchema = zod_1.z.object({
    name: zod_1.z.string().min(2).max(160),
    description: zod_1.z.string().max(2000).optional().nullable(),
    imagePath: zod_1.z.string().optional().nullable(),
    sortOrder: zod_1.z.number().int().optional(),
    isActive: zod_1.z.boolean().optional(),
    metadataJson: zod_1.z.record(zod_1.z.unknown()).optional(),
});
const nominationReviewSchema = zod_1.z.object({
    status: zod_1.z.enum(['APPROVED', 'REJECTED']),
    reviewNotes: zod_1.z.string().max(1000).optional().nullable(),
    createNomineeOnApprove: zod_1.z.boolean().optional(),
});
router.get('/events/:eventId/voting/config', (0, errorHandler_js_1.asyncHandler)(async (req, res) => {
    const ownerId = String(req.ownerId || '');
    const { eventId } = req.params;
    const event = await ensureOwnerEvent(eventId, ownerId);
    let config = event.votingConfig;
    if (!config) {
        config = await prisma_js_1.default.votingEventConfig.create({
            data: {
                eventId,
            },
        });
    }
    if (config.isEnabled) {
        await assignDefaultVotingTemplateIfNeeded(eventId, event.votingPageTemplateId);
    }
    res.json({ config });
}));
router.put('/events/:eventId/voting/config', (0, errorHandler_js_1.asyncHandler)(async (req, res) => {
    const ownerId = String(req.ownerId || '');
    const { eventId } = req.params;
    await ensureOwnerEvent(eventId, ownerId);
    const input = configSchema.parse(req.body || {});
    const config = await prisma_js_1.default.votingEventConfig.upsert({
        where: { eventId },
        update: {
            mode: input.mode ?? undefined,
            isEnabled: input.isEnabled ?? undefined,
            allowFreeVotes: input.allowFreeVotes ?? undefined,
            allowPaidVotes: input.allowPaidVotes ?? undefined,
            allowPublicNominations: input.allowPublicNominations ?? undefined,
            requireOtpForElection: input.requireOtpForElection ?? undefined,
            voteUnitPrice: input.voteUnitPrice ?? undefined,
            currency: input.currency?.toUpperCase() ?? undefined,
            maxVotesPerPurchase: input.maxVotesPerPurchase ?? undefined,
            freeVoteLabel: input.freeVoteLabel === undefined ? undefined : input.freeVoteLabel,
            paidVoteLabel: input.paidVoteLabel === undefined ? undefined : input.paidVoteLabel,
            settingsJson: input.settingsJson === undefined
                ? undefined
                : input.settingsJson
                    ? JSON.stringify(input.settingsJson)
                    : null,
        },
        create: {
            eventId,
            mode: input.mode || 'AWARDS',
            isEnabled: input.isEnabled ?? true,
            allowFreeVotes: input.allowFreeVotes ?? true,
            allowPaidVotes: input.allowPaidVotes ?? false,
            allowPublicNominations: input.allowPublicNominations ?? false,
            requireOtpForElection: input.requireOtpForElection ?? true,
            voteUnitPrice: input.voteUnitPrice ?? 1,
            currency: input.currency?.toUpperCase() || 'USD',
            maxVotesPerPurchase: input.maxVotesPerPurchase ?? 100,
            freeVoteLabel: input.freeVoteLabel ?? null,
            paidVoteLabel: input.paidVoteLabel ?? null,
            settingsJson: input.settingsJson ? JSON.stringify(input.settingsJson) : null,
        },
    });
    if (config.isEnabled) {
        await assignDefaultVotingTemplateIfNeeded(eventId, null);
    }
    res.json({ config });
}));
router.get('/events/:eventId/voting/contests', (0, errorHandler_js_1.asyncHandler)(async (req, res) => {
    const ownerId = String(req.ownerId || '');
    const { eventId } = req.params;
    const event = await ensureOwnerEvent(eventId, ownerId);
    const contests = await prisma_js_1.default.votingContest.findMany({
        where: { eventId: event.id },
        include: {
            options: {
                where: { isActive: true },
                orderBy: { sortOrder: 'asc' },
            },
            _count: {
                select: {
                    voteRecords: true,
                    voteGrants: true,
                    nominations: true,
                },
            },
        },
        orderBy: { sortOrder: 'asc' },
    });
    const contestsWithParsedFields = contests.map((contest) => ({
        ...contest,
        nominationFormFields: parseJson(contest.nominationFormFieldsJson, []),
    }));
    res.json({
        event: {
            id: event.id,
            name: event.name,
        },
        config: event.votingConfig,
        contests: contestsWithParsedFields,
    });
}));
router.post('/events/:eventId/voting/contests', (0, errorHandler_js_1.asyncHandler)(async (req, res) => {
    const ownerId = String(req.ownerId || '');
    const { eventId } = req.params;
    await ensureOwnerEvent(eventId, ownerId);
    const input = contestSchema.parse(req.body || {});
    const created = await prisma_js_1.default.votingContest.create({
        data: {
            eventId,
            title: input.title,
            description: input.description ?? null,
            mode: input.mode || 'AWARDS',
            isActive: input.isActive ?? true,
            allowPublicNominations: input.allowPublicNominations ?? false,
            nominationFormFieldsJson: input.nominationFormFields ? JSON.stringify(input.nominationFormFields) : null,
            startsAt: input.startsAt ? new Date(input.startsAt) : null,
            endsAt: input.endsAt ? new Date(input.endsAt) : null,
            sortOrder: input.sortOrder ?? 0,
            metadataJson: input.metadataJson ? JSON.stringify(input.metadataJson) : null,
        },
    });
    res.status(201).json({ contest: created });
}));
router.patch('/events/:eventId/voting/contests/:contestId', (0, errorHandler_js_1.asyncHandler)(async (req, res) => {
    const ownerId = String(req.ownerId || '');
    const { eventId, contestId } = req.params;
    await ensureOwnerEvent(eventId, ownerId);
    const input = contestSchema.partial().parse(req.body || {});
    const contest = await prisma_js_1.default.votingContest.findFirst({
        where: { id: contestId, eventId },
        select: { id: true },
    });
    if (!contest)
        throw new errorHandler_js_1.AppError('Contest not found', 404);
    const updated = await prisma_js_1.default.votingContest.update({
        where: { id: contest.id },
        data: {
            title: input.title ?? undefined,
            description: input.description === undefined ? undefined : input.description,
            mode: input.mode ?? undefined,
            isActive: input.isActive ?? undefined,
            allowPublicNominations: input.allowPublicNominations ?? undefined,
            nominationFormFieldsJson: input.nominationFormFields === undefined
                ? undefined
                : input.nominationFormFields
                    ? JSON.stringify(input.nominationFormFields)
                    : null,
            startsAt: input.startsAt === undefined ? undefined : input.startsAt ? new Date(input.startsAt) : null,
            endsAt: input.endsAt === undefined ? undefined : input.endsAt ? new Date(input.endsAt) : null,
            sortOrder: input.sortOrder ?? undefined,
            metadataJson: input.metadataJson === undefined
                ? undefined
                : input.metadataJson
                    ? JSON.stringify(input.metadataJson)
                    : null,
        },
    });
    res.json({ contest: updated });
}));
router.delete('/events/:eventId/voting/contests/:contestId', (0, errorHandler_js_1.asyncHandler)(async (req, res) => {
    const ownerId = String(req.ownerId || '');
    const { eventId, contestId } = req.params;
    await ensureOwnerEvent(eventId, ownerId);
    const contest = await prisma_js_1.default.votingContest.findFirst({
        where: { id: contestId, eventId },
        select: { id: true },
    });
    if (!contest)
        throw new errorHandler_js_1.AppError('Contest not found', 404);
    await prisma_js_1.default.votingContest.delete({ where: { id: contest.id } });
    res.json({ message: 'Contest deleted' });
}));
router.get('/events/:eventId/voting/contests/:contestId/options', (0, errorHandler_js_1.asyncHandler)(async (req, res) => {
    const ownerId = String(req.ownerId || '');
    const { eventId, contestId } = req.params;
    await ensureOwnerEvent(eventId, ownerId);
    const contest = await prisma_js_1.default.votingContest.findFirst({
        where: { id: contestId, eventId },
        select: { id: true, title: true },
    });
    if (!contest)
        throw new errorHandler_js_1.AppError('Contest not found', 404);
    const options = await prisma_js_1.default.votingOption.findMany({
        where: { contestId: contest.id, eventId },
        orderBy: { sortOrder: 'asc' },
    });
    res.json({ contest, options });
}));
router.post('/events/:eventId/voting/contests/:contestId/options', (0, errorHandler_js_1.asyncHandler)(async (req, res) => {
    const ownerId = String(req.ownerId || '');
    const { eventId, contestId } = req.params;
    await ensureOwnerEvent(eventId, ownerId);
    const input = optionSchema.parse(req.body || {});
    const contest = await prisma_js_1.default.votingContest.findFirst({
        where: { id: contestId, eventId },
        select: { id: true },
    });
    if (!contest)
        throw new errorHandler_js_1.AppError('Contest not found', 404);
    const option = await prisma_js_1.default.votingOption.create({
        data: {
            eventId,
            contestId: contest.id,
            name: input.name,
            description: input.description ?? null,
            imagePath: input.imagePath ?? null,
            sortOrder: input.sortOrder ?? 0,
            isActive: input.isActive ?? true,
            metadataJson: input.metadataJson ? JSON.stringify(input.metadataJson) : null,
        },
    });
    res.status(201).json({ option });
}));
router.patch('/events/:eventId/voting/options/:optionId', (0, errorHandler_js_1.asyncHandler)(async (req, res) => {
    const ownerId = String(req.ownerId || '');
    const { eventId, optionId } = req.params;
    await ensureOwnerEvent(eventId, ownerId);
    const input = optionSchema.partial().parse(req.body || {});
    const option = await prisma_js_1.default.votingOption.findFirst({
        where: { id: optionId, eventId },
        select: { id: true },
    });
    if (!option)
        throw new errorHandler_js_1.AppError('Nominee not found', 404);
    const updated = await prisma_js_1.default.votingOption.update({
        where: { id: option.id },
        data: {
            name: input.name ?? undefined,
            description: input.description === undefined ? undefined : input.description,
            imagePath: input.imagePath === undefined ? undefined : input.imagePath,
            sortOrder: input.sortOrder ?? undefined,
            isActive: input.isActive ?? undefined,
            metadataJson: input.metadataJson === undefined
                ? undefined
                : input.metadataJson
                    ? JSON.stringify(input.metadataJson)
                    : null,
        },
    });
    res.json({ option: updated });
}));
router.delete('/events/:eventId/voting/options/:optionId', (0, errorHandler_js_1.asyncHandler)(async (req, res) => {
    const ownerId = String(req.ownerId || '');
    const { eventId, optionId } = req.params;
    await ensureOwnerEvent(eventId, ownerId);
    const option = await prisma_js_1.default.votingOption.findFirst({
        where: { id: optionId, eventId },
        select: { id: true },
    });
    if (!option)
        throw new errorHandler_js_1.AppError('Nominee not found', 404);
    await prisma_js_1.default.votingOption.delete({ where: { id: option.id } });
    res.json({ message: 'Nominee deleted' });
}));
router.get('/events/:eventId/voting/nominations', (0, errorHandler_js_1.asyncHandler)(async (req, res) => {
    const ownerId = String(req.ownerId || '');
    const { eventId } = req.params;
    await ensureOwnerEvent(eventId, ownerId);
    const status = String(req.query.status || '').trim().toUpperCase();
    const contestId = String(req.query.contestId || '').trim();
    const limit = Math.min(200, Math.max(1, Number(req.query.limit || 100)));
    const nominations = await prisma_js_1.default.votingNomination.findMany({
        where: {
            eventId,
            ...(contestId ? { contestId } : {}),
            ...(status && ['PENDING', 'APPROVED', 'REJECTED'].includes(status)
                ? { status: status }
                : {}),
        },
        include: {
            contest: {
                select: {
                    id: true,
                    title: true,
                    mode: true,
                },
            },
            approvedOption: {
                select: {
                    id: true,
                    name: true,
                },
            },
        },
        orderBy: { createdAt: 'desc' },
        take: limit,
    });
    res.json({ nominations });
}));
router.patch('/events/:eventId/voting/nominations/:nominationId/review', (0, errorHandler_js_1.asyncHandler)(async (req, res) => {
    const ownerId = String(req.ownerId || '');
    const { eventId, nominationId } = req.params;
    await ensureOwnerEvent(eventId, ownerId);
    const input = nominationReviewSchema.parse(req.body || {});
    const nomination = await prisma_js_1.default.votingNomination.findFirst({
        where: { id: nominationId, eventId },
    });
    if (!nomination)
        throw new errorHandler_js_1.AppError('Nomination not found', 404);
    if (nomination.status !== 'PENDING') {
        throw new errorHandler_js_1.AppError('Only pending nominations can be reviewed', 409);
    }
    const reviewed = await prisma_js_1.default.$transaction(async (tx) => {
        let approvedOptionId = null;
        if (input.status === 'APPROVED' && input.createNomineeOnApprove !== false) {
            const createdOption = await tx.votingOption.create({
                data: {
                    eventId,
                    contestId: nomination.contestId,
                    name: nomination.nomineeName,
                    description: nomination.nomineeDescription || undefined,
                    isActive: true,
                    metadataJson: JSON.stringify({
                        source: 'PUBLIC_NOMINATION',
                        nominationId: nomination.id,
                        submitterName: nomination.submitterName,
                        submitterEmail: nomination.submitterEmail,
                    }),
                },
            });
            approvedOptionId = createdOption.id;
        }
        return tx.votingNomination.update({
            where: { id: nomination.id },
            data: {
                status: input.status,
                reviewedAt: new Date(),
                reviewedByOwnerId: ownerId,
                reviewNotes: input.reviewNotes === undefined ? null : input.reviewNotes,
                approvedOptionId,
            },
            include: {
                approvedOption: {
                    select: {
                        id: true,
                        name: true,
                    },
                },
            },
        });
    });
    res.json({ nomination: reviewed });
}));
router.get('/events/:eventId/voting/analytics', (0, errorHandler_js_1.asyncHandler)(async (req, res) => {
    const ownerId = String(req.ownerId || '');
    const { eventId } = req.params;
    await ensureOwnerEvent(eventId, ownerId);
    const [records, contests, options, voteRevenue, paidIntentsCount, nominationStats] = await Promise.all([
        prisma_js_1.default.voteRecord.findMany({
            where: { eventId },
            select: {
                contestId: true,
                optionId: true,
                voterKey: true,
                voteType: true,
                voteCount: true,
                createdAt: true,
            },
            orderBy: { createdAt: 'asc' },
        }),
        prisma_js_1.default.votingContest.findMany({
            where: { eventId },
            select: { id: true, title: true, mode: true },
            orderBy: { sortOrder: 'asc' },
        }),
        prisma_js_1.default.votingOption.findMany({
            where: { eventId },
            select: {
                id: true,
                contestId: true,
                name: true,
                totalVotes: true,
                freeVotes: true,
                paidVotes: true,
            },
            orderBy: [{ totalVotes: 'desc' }, { sortOrder: 'asc' }],
        }),
        prisma_js_1.default.transaction.aggregate({
            where: {
                eventId,
                paymentIntent: {
                    purpose: 'VOTE',
                },
                status: 'COMPLETED',
            },
            _sum: { grossAmount: true },
            _count: true,
        }),
        prisma_js_1.default.paymentIntent.count({
            where: {
                eventId,
                purpose: 'VOTE',
            },
        }),
        prisma_js_1.default.votingNomination.groupBy({
            by: ['status'],
            where: { eventId },
            _count: { _all: true },
        }),
    ]);
    const totalVotes = records.reduce((sum, record) => sum + record.voteCount, 0);
    const uniqueVoters = new Set(records.map((record) => record.voterKey)).size;
    const freeVotes = records
        .filter((record) => record.voteType === 'FREE')
        .reduce((sum, record) => sum + record.voteCount, 0);
    const paidVotes = records
        .filter((record) => record.voteType === 'PAID')
        .reduce((sum, record) => sum + record.voteCount, 0);
    const paidRevenue = Number(voteRevenue._sum.grossAmount || 0);
    const paidPurchaseCount = voteRevenue._count;
    const conversionRate = uniqueVoters > 0 ? Number(((paidPurchaseCount / uniqueVoters) * 100).toFixed(2)) : 0;
    const paidIntentConversionRate = paidIntentsCount > 0 ? Number(((paidPurchaseCount / paidIntentsCount) * 100).toFixed(2)) : 0;
    const nominationTotals = nominationStats.reduce((acc, item) => {
        const count = item._count._all || 0;
        if (item.status === 'PENDING')
            acc.pending += count;
        if (item.status === 'APPROVED')
            acc.approved += count;
        if (item.status === 'REJECTED')
            acc.rejected += count;
        acc.total += count;
        return acc;
    }, { total: 0, pending: 0, approved: 0, rejected: 0 });
    const perContestMetrics = contests.map((contest) => {
        const contestRecords = records.filter((record) => record.contestId === contest.id);
        const contestVotes = contestRecords.reduce((sum, record) => sum + record.voteCount, 0);
        const contestUniqueVoters = new Set(contestRecords.map((record) => record.voterKey)).size;
        const contestFreeVotes = contestRecords
            .filter((record) => record.voteType === 'FREE')
            .reduce((sum, record) => sum + record.voteCount, 0);
        const contestPaidVotes = contestRecords
            .filter((record) => record.voteType === 'PAID')
            .reduce((sum, record) => sum + record.voteCount, 0);
        return {
            contestId: contest.id,
            title: contest.title,
            mode: contest.mode,
            totalVotes: contestVotes,
            uniqueVoters: contestUniqueVoters,
            freeVotes: contestFreeVotes,
            paidVotes: contestPaidVotes,
        };
    });
    const perNomineeMetrics = options.map((option) => ({
        optionId: option.id,
        contestId: option.contestId,
        name: option.name,
        totalVotes: option.totalVotes,
        freeVotes: option.freeVotes,
        paidVotes: option.paidVotes,
    }));
    const now = Date.now();
    const daySeriesMap = new Map();
    const hourSeriesMap = new Map();
    const nomineeGrowth = new Map();
    for (const record of records) {
        const day = record.createdAt.toISOString().slice(0, 10);
        const hour = `${record.createdAt.toISOString().slice(0, 13)}:00:00Z`;
        const dayBucket = daySeriesMap.get(day) || { day, votes: 0, freeVotes: 0, paidVotes: 0 };
        dayBucket.votes += record.voteCount;
        if (record.voteType === 'FREE')
            dayBucket.freeVotes += record.voteCount;
        if (record.voteType === 'PAID')
            dayBucket.paidVotes += record.voteCount;
        daySeriesMap.set(day, dayBucket);
        const hourBucket = hourSeriesMap.get(hour) || { hour, votes: 0 };
        hourBucket.votes += record.voteCount;
        hourSeriesMap.set(hour, hourBucket);
        const growth = nomineeGrowth.get(record.optionId) || { recent: 0, previous: 0 };
        const ageMs = now - record.createdAt.getTime();
        if (ageMs <= 24 * 60 * 60 * 1000) {
            growth.recent += record.voteCount;
        }
        else if (ageMs <= 48 * 60 * 60 * 1000) {
            growth.previous += record.voteCount;
        }
        nomineeGrowth.set(record.optionId, growth);
    }
    const topNominees = options
        .slice()
        .sort((a, b) => b.totalVotes - a.totalVotes)
        .slice(0, 10)
        .map((option) => {
        const growth = nomineeGrowth.get(option.id) || { recent: 0, previous: 0 };
        return {
            optionId: option.id,
            contestId: option.contestId,
            name: option.name,
            totalVotes: option.totalVotes,
            growthDelta: growth.recent - growth.previous,
        };
    });
    res.json({
        totals: {
            totalVotes,
            uniqueVoters,
            freeVotes,
            paidVotes,
            paidRevenue,
            paidPurchaseCount,
            conversionRate,
            paidIntentConversionRate,
            nominations: nominationTotals,
        },
        perContest: perContestMetrics,
        perNominee: perNomineeMetrics,
        timeSeries: {
            byDay: Array.from(daySeriesMap.values()).sort((a, b) => a.day.localeCompare(b.day)),
            byHour: Array.from(hourSeriesMap.values()).sort((a, b) => a.hour.localeCompare(b.hour)),
        },
        leaderboard: topNominees,
    });
}));
exports.default = router;
//# sourceMappingURL=voting-owner.js.map