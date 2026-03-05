"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const crypto_1 = require("crypto");
const express_1 = require("express");
const multer_1 = __importDefault(require("multer"));
const sharp_1 = __importDefault(require("sharp"));
const zod_1 = require("zod");
const auth_js_1 = require("../middleware/auth.js");
const errorHandler_js_1 = require("../middleware/errorHandler.js");
const prisma_js_1 = __importDefault(require("../utils/prisma.js"));
const supabaseStorage_js_1 = require("../services/supabaseStorage.js");
const PrismaVotingRepository_js_1 = require("../modules/voting/core/PrismaVotingRepository.js");
const VotingService_js_1 = require("../modules/voting/core/VotingService.js");
const router = (0, express_1.Router)();
const votingService = new VotingService_js_1.VotingService(new PrismaVotingRepository_js_1.PrismaVotingRepository(prisma_js_1.default));
router.use((req, res, next) => {
    if (req.baseUrl.includes('/api/v2/admin-voting')) {
        return (0, auth_js_1.authenticateAdmin)(req, res, next);
    }
    return (0, auth_js_1.authenticateOwnerAccount)(req, res, next);
});
const imageUpload = (0, multer_1.default)({
    storage: multer_1.default.memoryStorage(),
    limits: { fileSize: 8 * 1024 * 1024 },
    fileFilter: (_req, file, cb) => {
        if (!String(file.mimetype || '').startsWith('image/')) {
            cb(new errorHandler_js_1.AppError('Please upload an image file', 400));
            return;
        }
        cb(null, true);
    },
});
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
const resolveMediaUrl = (mediaPath) => {
    if (!mediaPath)
        return null;
    const normalized = String(mediaPath).trim();
    if (!normalized)
        return null;
    if (normalized.startsWith('http://') || normalized.startsWith('https://'))
        return normalized;
    try {
        return (0, supabaseStorage_js_1.getPublicUrl)(supabaseStorage_js_1.BUCKETS.MEDIA, normalized);
    }
    catch {
        try {
            return (0, supabaseStorage_js_1.buildPublicUrl)(supabaseStorage_js_1.BUCKETS.MEDIA, normalized);
        }
        catch {
            return normalized;
        }
    }
};
const getActorIds = (req) => ({
    ownerId: String(req.ownerId || '').trim() || null,
    adminId: String(req.admin?.id || '').trim() || null,
});
const ensureManagedEvent = async (eventId, ownerId, adminId) => {
    const event = adminId
        ? await prisma_js_1.default.event.findUnique({
            where: { id: eventId },
            select: {
                id: true,
                ownerId: true,
                name: true,
                defaultCurrency: true,
                votingConfig: true,
            },
        })
        : await prisma_js_1.default.event.findFirst({
            where: {
                id: eventId,
                ownerId: ownerId || undefined,
            },
            select: {
                id: true,
                ownerId: true,
                name: true,
                defaultCurrency: true,
                votingConfig: true,
            },
        });
    if (!event)
        throw new errorHandler_js_1.AppError('Event not found', 404);
    return event;
};
const nominationFieldSchema = zod_1.z.object({
    id: zod_1.z.string().min(1).max(64),
    label: zod_1.z.string().min(1).max(120),
    type: zod_1.z.enum(['text', 'textarea', 'email', 'phone', 'number', 'select']),
    required: zod_1.z.boolean().optional(),
    placeholder: zod_1.z.string().max(200).optional().nullable(),
    options: zod_1.z.array(zod_1.z.string().max(120)).optional(),
});
const categorySchema = zod_1.z.object({
    id: zod_1.z.string().min(1).max(64).optional(),
    label: zod_1.z.string().min(1).max(120),
    description: zod_1.z.string().max(300).optional().nullable(),
    isActive: zod_1.z.boolean().optional(),
});
const contestSchema = zod_1.z.object({
    title: zod_1.z.string().min(2).max(160),
    description: zod_1.z.string().max(2000).optional().nullable(),
    mode: zod_1.z.enum(['AWARDS', 'ELECTION']).optional(),
    isActive: zod_1.z.boolean().optional(),
    allowPublicNominations: zod_1.z.boolean().optional(),
    nominationFormFields: zod_1.z.array(nominationFieldSchema).optional(),
    categories: zod_1.z.array(categorySchema).optional(),
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
const configSchema = zod_1.z.object({
    mode: zod_1.z.enum(['AWARDS', 'ELECTION']).optional(),
    isEnabled: zod_1.z.boolean().optional(),
    isPublished: zod_1.z.boolean().optional(),
    allowFreeVotes: zod_1.z.boolean().optional(),
    allowPaidVotes: zod_1.z.boolean().optional(),
    allowPublicNominations: zod_1.z.boolean().optional(),
    requireOtpForElection: zod_1.z.boolean().optional(),
    freeVoteScope: zod_1.z.enum(['EVENT', 'CONTEST']).optional(),
    voteUnitPrice: zod_1.z.number().nonnegative().optional(),
    currency: zod_1.z.string().regex(/^[A-Za-z]{3}$/).optional(),
    maxVotesPerPurchase: zod_1.z.number().int().min(1).max(10000).optional(),
    freeVoteLabel: zod_1.z.string().max(120).optional().nullable(),
    paidVoteLabel: zod_1.z.string().max(120).optional().nullable(),
    startsAt: zod_1.z.string().datetime().optional().nullable(),
    endsAt: zod_1.z.string().datetime().optional().nullable(),
    settingsJson: zod_1.z.record(zod_1.z.unknown()).optional(),
});
const reviewSchema = zod_1.z.object({
    status: zod_1.z.enum(['APPROVED', 'REJECTED']),
    reviewNotes: zod_1.z.string().max(1000).optional().nullable(),
    createNomineeOnApprove: zod_1.z.boolean().optional(),
});
const withCategories = (contest) => {
    const metadata = parseJson(contest.metadataJson, {});
    const categories = Array.isArray(metadata.categories) ? metadata.categories : [];
    const nominationFormFields = parseJson(contest.nominationFormFieldsJson, []);
    return {
        categories,
        nominationFormFields,
    };
};
router.get('/events/:eventId/config', (0, errorHandler_js_1.asyncHandler)(async (req, res) => {
    const { eventId } = req.params;
    const { ownerId, adminId } = getActorIds(req);
    const event = await ensureManagedEvent(eventId, ownerId, adminId);
    const config = event.votingConfig || (await votingService.configureVoting(event.id, { currency: event.defaultCurrency }));
    res.json({ config });
}));
router.put('/events/:eventId/config', (0, errorHandler_js_1.asyncHandler)(async (req, res) => {
    const { eventId } = req.params;
    const { ownerId, adminId } = getActorIds(req);
    const event = await ensureManagedEvent(eventId, ownerId, adminId);
    const input = configSchema.parse(req.body || {});
    const config = await votingService.configureVoting(event.id, {
        ...input,
        currency: event.defaultCurrency || input.currency,
        startsAt: input.startsAt === undefined ? undefined : input.startsAt ? new Date(input.startsAt) : null,
        endsAt: input.endsAt === undefined ? undefined : input.endsAt ? new Date(input.endsAt) : null,
    });
    res.json({ config });
}));
router.get('/events/:eventId/contests', (0, errorHandler_js_1.asyncHandler)(async (req, res) => {
    const { eventId } = req.params;
    const { ownerId, adminId } = getActorIds(req);
    await ensureManagedEvent(eventId, ownerId, adminId);
    const contests = await prisma_js_1.default.votingContest.findMany({
        where: { eventId },
        include: {
            options: {
                orderBy: { sortOrder: 'asc' },
            },
        },
        orderBy: { sortOrder: 'asc' },
    });
    res.json({
        contests: contests.map((contest) => {
            const extras = withCategories(contest);
            return {
                ...contest,
                ...extras,
                options: contest.options.map((option) => ({
                    ...option,
                    imageUrl: resolveMediaUrl(option.imagePath),
                })),
            };
        }),
    });
}));
router.post('/events/:eventId/contests', (0, errorHandler_js_1.asyncHandler)(async (req, res) => {
    const { eventId } = req.params;
    const { ownerId, adminId } = getActorIds(req);
    await ensureManagedEvent(eventId, ownerId, adminId);
    const input = contestSchema.parse(req.body || {});
    const metadata = {
        ...(input.metadataJson || {}),
        categories: (input.categories || []).map((item) => ({
            id: item.id || (0, crypto_1.randomUUID)(),
            label: item.label,
            description: item.description || null,
            isActive: item.isActive ?? true,
        })),
    };
    const contest = await prisma_js_1.default.votingContest.create({
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
            metadataJson: JSON.stringify(metadata),
        },
    });
    res.status(201).json({ contest });
}));
router.patch('/events/:eventId/contests/:contestId', (0, errorHandler_js_1.asyncHandler)(async (req, res) => {
    const { eventId, contestId } = req.params;
    const { ownerId, adminId } = getActorIds(req);
    await ensureManagedEvent(eventId, ownerId, adminId);
    const input = contestSchema.partial().parse(req.body || {});
    const contest = await prisma_js_1.default.votingContest.findFirst({
        where: { id: contestId, eventId },
    });
    if (!contest)
        throw new errorHandler_js_1.AppError('Contest not found', 404);
    const currentMetadata = parseJson(contest.metadataJson, {});
    const nextMetadata = input.categories === undefined && input.metadataJson === undefined
        ? undefined
        : {
            ...currentMetadata,
            ...(input.metadataJson || {}),
            ...(input.categories
                ? {
                    categories: input.categories.map((item) => ({
                        id: item.id || (0, crypto_1.randomUUID)(),
                        label: item.label,
                        description: item.description || null,
                        isActive: item.isActive ?? true,
                    })),
                }
                : {}),
        };
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
            metadataJson: nextMetadata === undefined ? undefined : JSON.stringify(nextMetadata),
        },
    });
    res.json({ contest: updated });
}));
router.delete('/events/:eventId/contests/:contestId', (0, errorHandler_js_1.asyncHandler)(async (req, res) => {
    const { eventId, contestId } = req.params;
    const { ownerId, adminId } = getActorIds(req);
    await ensureManagedEvent(eventId, ownerId, adminId);
    const contest = await prisma_js_1.default.votingContest.findFirst({ where: { id: contestId, eventId }, select: { id: true } });
    if (!contest)
        throw new errorHandler_js_1.AppError('Contest not found', 404);
    await prisma_js_1.default.votingContest.delete({ where: { id: contest.id } });
    res.json({ message: 'Contest deleted' });
}));
router.get('/events/:eventId/contests/:contestId/categories', (0, errorHandler_js_1.asyncHandler)(async (req, res) => {
    const { eventId, contestId } = req.params;
    const { ownerId, adminId } = getActorIds(req);
    await ensureManagedEvent(eventId, ownerId, adminId);
    const contest = await prisma_js_1.default.votingContest.findFirst({ where: { id: contestId, eventId } });
    if (!contest)
        throw new errorHandler_js_1.AppError('Contest not found', 404);
    const { categories } = withCategories(contest);
    res.json({ categories });
}));
router.post('/events/:eventId/contests/:contestId/categories', (0, errorHandler_js_1.asyncHandler)(async (req, res) => {
    const { eventId, contestId } = req.params;
    const { ownerId, adminId } = getActorIds(req);
    await ensureManagedEvent(eventId, ownerId, adminId);
    const input = categorySchema.parse(req.body || {});
    const contest = await prisma_js_1.default.votingContest.findFirst({ where: { id: contestId, eventId } });
    if (!contest)
        throw new errorHandler_js_1.AppError('Contest not found', 404);
    const metadata = parseJson(contest.metadataJson, {});
    const categories = Array.isArray(metadata.categories) ? metadata.categories : [];
    categories.push({
        id: input.id || (0, crypto_1.randomUUID)(),
        label: input.label,
        description: input.description || null,
        isActive: input.isActive ?? true,
    });
    const updated = await prisma_js_1.default.votingContest.update({
        where: { id: contest.id },
        data: {
            metadataJson: JSON.stringify({
                ...metadata,
                categories,
            }),
        },
    });
    res.status(201).json({ categories: withCategories(updated).categories });
}));
router.patch('/events/:eventId/contests/:contestId/categories/:categoryId', (0, errorHandler_js_1.asyncHandler)(async (req, res) => {
    const { eventId, contestId, categoryId } = req.params;
    const { ownerId, adminId } = getActorIds(req);
    await ensureManagedEvent(eventId, ownerId, adminId);
    const input = categorySchema.partial().parse(req.body || {});
    const contest = await prisma_js_1.default.votingContest.findFirst({ where: { id: contestId, eventId } });
    if (!contest)
        throw new errorHandler_js_1.AppError('Contest not found', 404);
    const metadata = parseJson(contest.metadataJson, {});
    const categories = Array.isArray(metadata.categories) ? [...metadata.categories] : [];
    const idx = categories.findIndex((category) => String(category.id) === categoryId);
    if (idx < 0)
        throw new errorHandler_js_1.AppError('Category not found', 404);
    categories[idx] = {
        ...categories[idx],
        ...(input.label !== undefined ? { label: input.label } : {}),
        ...(input.description !== undefined ? { description: input.description } : {}),
        ...(input.isActive !== undefined ? { isActive: input.isActive } : {}),
    };
    const updated = await prisma_js_1.default.votingContest.update({
        where: { id: contest.id },
        data: {
            metadataJson: JSON.stringify({ ...metadata, categories }),
        },
    });
    res.json({ categories: withCategories(updated).categories });
}));
router.delete('/events/:eventId/contests/:contestId/categories/:categoryId', (0, errorHandler_js_1.asyncHandler)(async (req, res) => {
    const { eventId, contestId, categoryId } = req.params;
    const { ownerId, adminId } = getActorIds(req);
    await ensureManagedEvent(eventId, ownerId, adminId);
    const contest = await prisma_js_1.default.votingContest.findFirst({ where: { id: contestId, eventId } });
    if (!contest)
        throw new errorHandler_js_1.AppError('Contest not found', 404);
    const metadata = parseJson(contest.metadataJson, {});
    const categories = Array.isArray(metadata.categories) ? metadata.categories : [];
    const nextCategories = categories.filter((category) => String(category.id) !== categoryId);
    const updated = await prisma_js_1.default.votingContest.update({
        where: { id: contest.id },
        data: {
            metadataJson: JSON.stringify({ ...metadata, categories: nextCategories }),
        },
    });
    res.json({ categories: withCategories(updated).categories });
}));
router.get('/events/:eventId/contests/:contestId/nomination-fields', (0, errorHandler_js_1.asyncHandler)(async (req, res) => {
    const { eventId, contestId } = req.params;
    const { ownerId, adminId } = getActorIds(req);
    await ensureManagedEvent(eventId, ownerId, adminId);
    const contest = await prisma_js_1.default.votingContest.findFirst({
        where: { id: contestId, eventId },
        select: { nominationFormFieldsJson: true },
    });
    if (!contest)
        throw new errorHandler_js_1.AppError('Contest not found', 404);
    res.json({ fields: parseJson(contest.nominationFormFieldsJson, []) });
}));
router.post('/events/:eventId/contests/:contestId/nomination-fields', (0, errorHandler_js_1.asyncHandler)(async (req, res) => {
    const { eventId, contestId } = req.params;
    const { ownerId, adminId } = getActorIds(req);
    await ensureManagedEvent(eventId, ownerId, adminId);
    const input = nominationFieldSchema.parse(req.body || {});
    const contest = await prisma_js_1.default.votingContest.findFirst({ where: { id: contestId, eventId } });
    if (!contest)
        throw new errorHandler_js_1.AppError('Contest not found', 404);
    const fields = parseJson(contest.nominationFormFieldsJson, []);
    if (fields.some((item) => String(item.id) === input.id)) {
        throw new errorHandler_js_1.AppError('Field id already exists', 409);
    }
    fields.push(input);
    const updated = await prisma_js_1.default.votingContest.update({
        where: { id: contest.id },
        data: { nominationFormFieldsJson: JSON.stringify(fields) },
    });
    res.status(201).json({ fields: parseJson(updated.nominationFormFieldsJson, []) });
}));
router.patch('/events/:eventId/contests/:contestId/nomination-fields/:fieldId', (0, errorHandler_js_1.asyncHandler)(async (req, res) => {
    const { eventId, contestId, fieldId } = req.params;
    const { ownerId, adminId } = getActorIds(req);
    await ensureManagedEvent(eventId, ownerId, adminId);
    const input = nominationFieldSchema.partial().parse(req.body || {});
    const contest = await prisma_js_1.default.votingContest.findFirst({ where: { id: contestId, eventId } });
    if (!contest)
        throw new errorHandler_js_1.AppError('Contest not found', 404);
    const fields = parseJson(contest.nominationFormFieldsJson, []);
    const idx = fields.findIndex((item) => String(item.id) === fieldId);
    if (idx < 0)
        throw new errorHandler_js_1.AppError('Field not found', 404);
    fields[idx] = { ...fields[idx], ...input };
    const updated = await prisma_js_1.default.votingContest.update({
        where: { id: contest.id },
        data: { nominationFormFieldsJson: JSON.stringify(fields) },
    });
    res.json({ fields: parseJson(updated.nominationFormFieldsJson, []) });
}));
router.delete('/events/:eventId/contests/:contestId/nomination-fields/:fieldId', (0, errorHandler_js_1.asyncHandler)(async (req, res) => {
    const { eventId, contestId, fieldId } = req.params;
    const { ownerId, adminId } = getActorIds(req);
    await ensureManagedEvent(eventId, ownerId, adminId);
    const contest = await prisma_js_1.default.votingContest.findFirst({ where: { id: contestId, eventId } });
    if (!contest)
        throw new errorHandler_js_1.AppError('Contest not found', 404);
    const fields = parseJson(contest.nominationFormFieldsJson, []);
    const filtered = fields.filter((item) => String(item.id) !== fieldId);
    const updated = await prisma_js_1.default.votingContest.update({
        where: { id: contest.id },
        data: { nominationFormFieldsJson: JSON.stringify(filtered) },
    });
    res.json({ fields: parseJson(updated.nominationFormFieldsJson, []) });
}));
router.get('/events/:eventId/contests/:contestId/options', (0, errorHandler_js_1.asyncHandler)(async (req, res) => {
    const { eventId, contestId } = req.params;
    const { ownerId, adminId } = getActorIds(req);
    await ensureManagedEvent(eventId, ownerId, adminId);
    const options = await prisma_js_1.default.votingOption.findMany({
        where: { eventId, contestId },
        orderBy: { sortOrder: 'asc' },
    });
    res.json({
        options: options.map((option) => ({
            ...option,
            imageUrl: resolveMediaUrl(option.imagePath),
        })),
    });
}));
router.post('/events/:eventId/options/upload-image', imageUpload.single('image'), (0, errorHandler_js_1.asyncHandler)(async (req, res) => {
    const { eventId } = req.params;
    const { ownerId, adminId } = getActorIds(req);
    const event = await ensureManagedEvent(eventId, ownerId, adminId);
    const file = req.file;
    if (!file)
        throw new errorHandler_js_1.AppError('Image file is required', 400);
    const optimized = await (0, sharp_1.default)(file.buffer)
        .rotate()
        .resize(1400, 1400, { fit: 'inside', withoutEnlargement: true })
        .webp({ quality: 84 })
        .toBuffer();
    const assetPath = `events/${event.id}/voting/options/${Date.now()}-${(0, crypto_1.randomUUID)()}.webp`;
    const uploaded = await (0, supabaseStorage_js_1.uploadToSupabase)(supabaseStorage_js_1.BUCKETS.MEDIA, assetPath, optimized, {
        contentType: 'image/webp',
        cacheControl: '31536000, immutable',
        metadata: {
            eventId: event.id,
            purpose: 'voting_option_image',
        },
    });
    res.status(201).json({
        imagePath: uploaded.path,
        imageUrl: uploaded.publicUrl || resolveMediaUrl(uploaded.path),
    });
}));
router.post('/events/:eventId/contests/:contestId/options', (0, errorHandler_js_1.asyncHandler)(async (req, res) => {
    const { eventId, contestId } = req.params;
    const { ownerId, adminId } = getActorIds(req);
    await ensureManagedEvent(eventId, ownerId, adminId);
    const input = optionSchema.parse(req.body || {});
    const contest = await prisma_js_1.default.votingContest.findFirst({ where: { id: contestId, eventId }, select: { id: true } });
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
    res.status(201).json({
        option: {
            ...option,
            imageUrl: resolveMediaUrl(option.imagePath),
        },
    });
}));
router.patch('/events/:eventId/options/:optionId', (0, errorHandler_js_1.asyncHandler)(async (req, res) => {
    const { eventId, optionId } = req.params;
    const { ownerId, adminId } = getActorIds(req);
    await ensureManagedEvent(eventId, ownerId, adminId);
    const input = optionSchema.partial().parse(req.body || {});
    const option = await prisma_js_1.default.votingOption.findFirst({ where: { id: optionId, eventId }, select: { id: true } });
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
    res.json({
        option: {
            ...updated,
            imageUrl: resolveMediaUrl(updated.imagePath),
        },
    });
}));
router.delete('/events/:eventId/options/:optionId', (0, errorHandler_js_1.asyncHandler)(async (req, res) => {
    const { eventId, optionId } = req.params;
    const { ownerId, adminId } = getActorIds(req);
    await ensureManagedEvent(eventId, ownerId, adminId);
    const option = await prisma_js_1.default.votingOption.findFirst({ where: { id: optionId, eventId }, select: { id: true } });
    if (!option)
        throw new errorHandler_js_1.AppError('Nominee not found', 404);
    await prisma_js_1.default.votingOption.delete({ where: { id: option.id } });
    res.json({ message: 'Nominee deleted' });
}));
router.get('/events/:eventId/nominations', (0, errorHandler_js_1.asyncHandler)(async (req, res) => {
    const { eventId } = req.params;
    const { ownerId, adminId } = getActorIds(req);
    await ensureManagedEvent(eventId, ownerId, adminId);
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
                select: { id: true, title: true, metadataJson: true },
            },
            approvedOption: {
                select: { id: true, name: true, imagePath: true },
            },
        },
        orderBy: { createdAt: 'desc' },
        take: limit,
    });
    const mapped = nominations.map((item) => {
        const customFields = parseJson(item.customFieldsJson, {});
        const categoryId = typeof customFields.categoryId === 'string' ? customFields.categoryId : null;
        const contestMeta = parseJson(item.contest?.metadataJson, {});
        const categories = Array.isArray(contestMeta.categories) ? contestMeta.categories : [];
        const category = categories.find((entry) => String(entry.id) === categoryId) || null;
        const nomineeImagePath = typeof customFields.__nomineeImagePath === 'string' ? customFields.__nomineeImagePath : null;
        return {
            ...item,
            categoryId,
            category,
            nomineeImagePath,
            nomineeImageUrl: resolveMediaUrl(nomineeImagePath),
        };
    });
    res.json({ nominations: mapped });
}));
router.patch('/events/:eventId/nominations/:nominationId/review', (0, errorHandler_js_1.asyncHandler)(async (req, res) => {
    const { eventId, nominationId } = req.params;
    const { ownerId, adminId } = getActorIds(req);
    await ensureManagedEvent(eventId, ownerId, adminId);
    const input = reviewSchema.parse(req.body || {});
    const nomination = await prisma_js_1.default.votingNomination.findFirst({
        where: { id: nominationId, eventId },
    });
    if (!nomination)
        throw new errorHandler_js_1.AppError('Nomination not found', 404);
    if (nomination.status !== 'PENDING')
        throw new errorHandler_js_1.AppError('Nomination already reviewed', 409);
    const reviewed = await prisma_js_1.default.$transaction(async (tx) => {
        let approvedOptionId = null;
        if (input.status === 'APPROVED' && input.createNomineeOnApprove !== false) {
            const customFields = parseJson(nomination.customFieldsJson, {});
            const nomineeImagePath = typeof customFields.__nomineeImagePath === 'string' ? customFields.__nomineeImagePath : null;
            const createdOption = await tx.votingOption.create({
                data: {
                    eventId,
                    contestId: nomination.contestId,
                    name: nomination.nomineeName,
                    description: nomination.nomineeDescription || undefined,
                    imagePath: nomineeImagePath || undefined,
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
                reviewedByOwnerId: ownerId || null,
                reviewNotes: input.reviewNotes || null,
                approvedOptionId,
            },
            include: {
                approvedOption: true,
            },
        });
    });
    res.json({ nomination: reviewed });
}));
exports.default = router;
//# sourceMappingURL=v2-admin-voting.js.map