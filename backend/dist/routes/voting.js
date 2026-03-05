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
const notifications_js_1 = require("../services/notifications.js");
const prisma_js_1 = __importDefault(require("../utils/prisma.js"));
const errorHandler_js_1 = require("../middleware/errorHandler.js");
const paymentCore_js_1 = require("../services/paymentCore.js");
const walletPolicy_js_1 = require("../utils/walletPolicy.js");
const supabaseStorage_js_1 = require("../services/supabaseStorage.js");
const router = (0, express_1.Router)();
const VOTING_SESSION_SECRET = process.env.VOTING_SESSION_SECRET || process.env.JWT_SECRET || 'eventpeepo-vote-session-secret';
const EMBED_TOKEN_SECRET = process.env.VOTING_EMBED_SECRET || process.env.JWT_SECRET || 'eventpeepo-vote-embed-secret';
const SESSION_TTL_SECONDS = Math.max(300, Number(process.env.VOTING_SESSION_TTL_SECONDS || 86400));
const OTP_TTL_SECONDS = Math.max(60, Number(process.env.VOTING_OTP_TTL_SECONDS || 300));
const EMBED_TOKEN_TTL_SECONDS = Math.max(60, Number(process.env.VOTING_EMBED_TOKEN_TTL_SECONDS || 300));
const NOMINATION_PHOTO_FIELD_KEY = '__nomineeImagePath';
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
    if (normalized.startsWith('http://') || normalized.startsWith('https://')) {
        return normalized;
    }
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
const nominationPhotoUpload = (0, multer_1.default)({
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
const parseNominationFields = (value) => parseJson(value, [])
    .filter((field) => field && typeof field.id === 'string' && typeof field.label === 'string')
    .map((field) => ({
    ...field,
    id: String(field.id).trim(),
    label: String(field.label).trim(),
    type: (field.type || 'text'),
    required: Boolean(field.required),
    placeholder: field.placeholder || null,
    options: Array.isArray(field.options) ? field.options.map((option) => String(option)) : undefined,
}));
const base64UrlEncode = (value) => Buffer.from(value, 'utf8').toString('base64url');
const signValue = (payload, secret) => (0, crypto_1.createHmac)('sha256', secret).update(payload).digest('base64url');
const issueSignedToken = (payload, secret) => {
    const encoded = base64UrlEncode(JSON.stringify(payload));
    const signature = signValue(encoded, secret);
    return `${encoded}.${signature}`;
};
const verifySignedToken = (token, secret) => {
    const raw = String(token || '').trim();
    if (!raw)
        return null;
    const [encoded, signature] = raw.split('.');
    if (!encoded || !signature)
        return null;
    const expected = signValue(encoded, secret);
    if (expected !== signature)
        return null;
    try {
        const payload = JSON.parse(Buffer.from(encoded, 'base64url').toString('utf8'));
        return payload;
    }
    catch {
        return null;
    }
};
const hashIp = (ip) => (0, crypto_1.createHash)('sha256').update(ip).digest('hex');
const hashUa = (ua) => (0, crypto_1.createHash)('sha256').update(ua).digest('hex');
const hashOtp = (code) => (0, crypto_1.createHash)('sha256').update(code).digest('hex');
const hashElectionKey = (value) => (0, crypto_1.createHash)('sha256').update(value).digest('hex');
const normalizeHost = (value) => String(value || '').trim().toLowerCase().replace(/^https?:\/\//, '').replace(/\/.*$/, '');
const normalizePhone = (phone) => phone.replace(/[^\d+]/g, '');
const resolveEmbedToken = (req, explicitToken) => String(explicitToken ||
    req.get('x-voting-embed-token') ||
    req.query?.embedToken ||
    req.query?.token ||
    '').trim() || null;
const validateEmbedTokenForEvent = (event, token) => {
    if (!token)
        return null;
    const payload = verifySignedToken(token, EMBED_TOKEN_SECRET);
    if (!payload)
        throw new errorHandler_js_1.AppError('Invalid embed token', 401);
    const nowSeconds = Math.floor(Date.now() / 1000);
    if (payload.exp <= nowSeconds)
        throw new errorHandler_js_1.AppError('Embed token has expired', 401);
    if (payload.eventId !== event.id || payload.slug !== event.slug) {
        throw new errorHandler_js_1.AppError('Embed token is not valid for this event', 403);
    }
    return payload;
};
const getOrCreateVoterSession = async (eventId, req, providedToken, originHost) => {
    const nowSeconds = Math.floor(Date.now() / 1000);
    const tokenPayload = verifySignedToken(providedToken, VOTING_SESSION_SECRET);
    if (tokenPayload && tokenPayload.eventId === eventId && tokenPayload.exp > nowSeconds) {
        const existing = await prisma_js_1.default.voterSession.findFirst({
            where: {
                eventId,
                voterKey: tokenPayload.voterKey,
            },
        });
        if (existing) {
            await prisma_js_1.default.voterSession.update({
                where: { id: existing.id },
                data: {
                    lastSeenAt: new Date(),
                    originHost: originHost || undefined,
                },
            });
            return {
                session: existing,
                token: providedToken || '',
                isNew: false,
            };
        }
    }
    const voterKey = (0, crypto_1.randomUUID)();
    const ip = String(req.ip || req.socket?.remoteAddress || 'unknown');
    const userAgent = String(req.get('user-agent') || 'unknown');
    const exp = nowSeconds + SESSION_TTL_SECONDS;
    const token = issueSignedToken({
        eventId,
        voterKey,
        exp,
    }, VOTING_SESSION_SECRET);
    const session = await prisma_js_1.default.voterSession.create({
        data: {
            eventId,
            voterKey,
            ipHash: hashIp(ip),
            userAgentHash: hashUa(userAgent),
            originHost: originHost || null,
            sessionTokenHash: (0, crypto_1.createHash)('sha256').update(token).digest('hex'),
        },
    });
    return { session, token, isNew: true };
};
const ensureVotingContext = async (slug) => {
    const event = await prisma_js_1.default.event.findUnique({
        where: { slug },
        select: {
            id: true,
            slug: true,
            name: true,
            defaultCurrency: true,
            ownerId: true,
            Owner: {
                select: {
                    wallets: {
                        where: { isActive: true },
                        select: {
                            id: true,
                            walletType: true,
                            isActive: true,
                            isVerified: true,
                            currency: true,
                            paystackSubaccount: true,
                            paystackRecipientCode: true,
                        },
                    },
                },
            },
            eventPaymentGateways: {
                where: { isActive: true },
                include: {
                    paymentGateway: {
                        select: {
                            id: true,
                            name: true,
                            gateway: true,
                            currency: true,
                        },
                    },
                },
                orderBy: { sortOrder: 'asc' },
            },
            votingConfig: true,
            votingContests: {
                where: { isActive: true },
                orderBy: { sortOrder: 'asc' },
                select: {
                    id: true,
                    title: true,
                    mode: true,
                    allowPublicNominations: true,
                    nominationFormFieldsJson: true,
                    metadataJson: true,
                },
            },
        },
    });
    if (!event)
        throw new errorHandler_js_1.AppError('Event not found', 404);
    if (!event.votingConfig || !event.votingConfig.isEnabled) {
        throw new errorHandler_js_1.AppError('Voting is not enabled for this event', 404);
    }
    if (!event.ownerId)
        throw new errorHandler_js_1.AppError('Event owner is not configured', 400);
    const votingConfig = event.votingConfig;
    return {
        ...event,
        votingConfig,
    };
};
router.get('/public/:slug', (0, errorHandler_js_1.asyncHandler)(async (req, res) => {
    const { slug } = req.params;
    const event = await ensureVotingContext(slug);
    const embedToken = resolveEmbedToken(req);
    const embedPayload = validateEmbedTokenForEvent(event, embedToken);
    const providedToken = String(req.query.sessionToken || req.get('x-voter-session') || '').trim() || null;
    const { session, token } = await getOrCreateVoterSession(event.id, req, providedToken, embedPayload?.originHost || null);
    const walletState = (0, walletPolicy_js_1.resolveOwnerWalletState)((event.Owner?.wallets || []));
    const visibleGateways = (0, walletPolicy_js_1.filterEventGatewaysForOwner)({
        eventGateways: event.eventPaymentGateways,
        walletState,
    });
    const contestsWithOptions = await prisma_js_1.default.votingContest.findMany({
        where: {
            eventId: event.id,
            isActive: true,
        },
        include: {
            options: {
                where: { isActive: true },
                orderBy: { sortOrder: 'asc' },
            },
        },
        orderBy: { sortOrder: 'asc' },
    });
    const contests = contestsWithOptions.map((contest) => ({
        ...contest,
        options: contest.options.map((option) => ({
            ...option,
            imageUrl: resolveMediaUrl(option.imagePath),
        })),
        nominationFormFields: parseNominationFields(contest.nominationFormFieldsJson),
    }));
    res.json({
        event: {
            id: event.id,
            slug: event.slug,
            name: event.name,
        },
        config: event.votingConfig,
        contests,
        paymentGateways: visibleGateways.map((gateway) => ({
            id: gateway.paymentGateway.id,
            name: gateway.paymentGateway.name,
            gateway: gateway.paymentGateway.gateway,
            currency: gateway.paymentGateway.currency,
        })),
        voterSession: {
            id: session.id,
            voterKey: session.voterKey,
            token,
            otpVerified: Boolean(session.otpVerifiedAt),
        },
    });
}));
router.get('/public/:slug/nomination-form', (0, errorHandler_js_1.asyncHandler)(async (req, res) => {
    const { slug } = req.params;
    const event = await ensureVotingContext(slug);
    const nominationEnabled = Boolean(event.votingConfig.allowPublicNominations);
    const contests = event.votingContests
        .filter((contest) => contest.allowPublicNominations)
        .map((contest) => ({
        id: contest.id,
        title: contest.title,
        mode: contest.mode,
        nominationFormFields: parseNominationFields(contest.nominationFormFieldsJson),
        categories: (() => {
            const metadata = parseJson(contest.metadataJson, {});
            const list = Array.isArray(metadata.categories) ? metadata.categories : [];
            return list
                .filter((entry) => entry?.isActive !== false)
                .map((entry) => ({
                id: String(entry.id || ''),
                label: String(entry.label || ''),
                description: entry.description ? String(entry.description) : null,
            }))
                .filter((entry) => entry.id && entry.label);
        })(),
    }));
    res.json({
        event: {
            id: event.id,
            slug: event.slug,
            name: event.name,
        },
        enabled: nominationEnabled,
        supportsPhotoUpload: true,
        contests,
    });
}));
router.post('/public/:slug/nominations/photo', nominationPhotoUpload.single('photo'), (0, errorHandler_js_1.asyncHandler)(async (req, res) => {
    const { slug } = req.params;
    const event = await ensureVotingContext(slug);
    if (!event.votingConfig.allowPublicNominations) {
        throw new errorHandler_js_1.AppError('Public nominations are disabled for this event', 400);
    }
    const file = req.file;
    if (!file)
        throw new errorHandler_js_1.AppError('Photo file is required', 400);
    const optimized = await (0, sharp_1.default)(file.buffer)
        .rotate()
        .resize(1400, 1400, { fit: 'inside', withoutEnlargement: true })
        .webp({ quality: 84 })
        .toBuffer();
    const assetPath = `events/${event.id}/voting/nominations/${Date.now()}-${(0, crypto_1.randomUUID)()}.webp`;
    const uploaded = await (0, supabaseStorage_js_1.uploadToSupabase)(supabaseStorage_js_1.BUCKETS.MEDIA, assetPath, optimized, {
        contentType: 'image/webp',
        cacheControl: '31536000, immutable',
        metadata: {
            eventId: event.id,
            purpose: 'voting_nomination_photo',
        },
    });
    res.status(201).json({
        imagePath: uploaded.path,
        imageUrl: uploaded.publicUrl || resolveMediaUrl(uploaded.path),
    });
}));
const submitNominationSchema = zod_1.z.object({
    contestId: zod_1.z.string().uuid(),
    categoryId: zod_1.z.string().optional().nullable(),
    nomineeName: zod_1.z.string().min(2).max(160),
    nomineeDescription: zod_1.z.string().max(2000).optional().nullable(),
    nomineeImagePath: zod_1.z.string().max(1024).optional().nullable(),
    submitterName: zod_1.z.string().min(2).max(160),
    submitterEmail: zod_1.z.string().email().optional().nullable(),
    submitterPhone: zod_1.z.string().max(40).optional().nullable(),
    customFields: zod_1.z.record(zod_1.z.unknown()).optional(),
    sessionToken: zod_1.z.string().optional(),
    embedToken: zod_1.z.string().optional(),
});
router.post('/public/:slug/nominations', (0, errorHandler_js_1.asyncHandler)(async (req, res) => {
    const { slug } = req.params;
    const input = submitNominationSchema.parse(req.body || {});
    const event = await ensureVotingContext(slug);
    const embedPayload = validateEmbedTokenForEvent(event, resolveEmbedToken(req, input.embedToken || null));
    if (!event.votingConfig.allowPublicNominations) {
        throw new errorHandler_js_1.AppError('Public nominations are disabled for this event', 400);
    }
    const contest = await prisma_js_1.default.votingContest.findFirst({
        where: {
            id: input.contestId,
            eventId: event.id,
            isActive: true,
        },
        select: {
            id: true,
            title: true,
            allowPublicNominations: true,
            nominationFormFieldsJson: true,
            metadataJson: true,
        },
    });
    if (!contest)
        throw new errorHandler_js_1.AppError('Voting contest not found', 404);
    if (!contest.allowPublicNominations) {
        throw new errorHandler_js_1.AppError('Public nominations are disabled for this contest', 400);
    }
    const { session, token } = await getOrCreateVoterSession(event.id, req, input.sessionToken, embedPayload?.originHost || null);
    const definitionList = parseNominationFields(contest.nominationFormFieldsJson);
    const customFields = input.customFields || {};
    const normalizedFields = {};
    const contestMetadata = parseJson(contest.metadataJson, {});
    const categories = Array.isArray(contestMetadata.categories) ? contestMetadata.categories : [];
    if (categories.length > 0) {
        const categoryId = String(input.categoryId || '').trim();
        if (!categoryId) {
            throw new errorHandler_js_1.AppError('Please select a nomination category', 400);
        }
        const match = categories.find((entry) => String(entry.id) === categoryId && entry.isActive !== false);
        if (!match) {
            throw new errorHandler_js_1.AppError('Selected nomination category is invalid', 400);
        }
        normalizedFields.categoryId = categoryId;
    }
    for (const definition of definitionList) {
        const key = definition.id;
        const rawValue = customFields[key];
        const value = rawValue === undefined || rawValue === null ? '' : String(rawValue).trim();
        if (definition.required && !value) {
            throw new errorHandler_js_1.AppError(`Custom field "${definition.label}" is required`, 400);
        }
        if (!value)
            continue;
        if (definition.type === 'email') {
            const isValid = /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value);
            if (!isValid)
                throw new errorHandler_js_1.AppError(`"${definition.label}" must be a valid email`, 400);
            normalizedFields[key] = value.toLowerCase();
            continue;
        }
        if (definition.type === 'number') {
            const parsed = Number(value);
            if (!Number.isFinite(parsed))
                throw new errorHandler_js_1.AppError(`"${definition.label}" must be numeric`, 400);
            normalizedFields[key] = parsed;
            continue;
        }
        if (definition.type === 'select' && Array.isArray(definition.options) && definition.options.length > 0) {
            if (!definition.options.includes(value)) {
                throw new errorHandler_js_1.AppError(`"${definition.label}" has an invalid value`, 400);
            }
            normalizedFields[key] = value;
            continue;
        }
        normalizedFields[key] = value;
    }
    const nominationImagePath = String(input.nomineeImagePath || '').trim();
    if (nominationImagePath) {
        normalizedFields[NOMINATION_PHOTO_FIELD_KEY] = nominationImagePath;
    }
    const nomination = await prisma_js_1.default.votingNomination.create({
        data: {
            eventId: event.id,
            contestId: contest.id,
            nomineeName: input.nomineeName.trim(),
            nomineeDescription: input.nomineeDescription?.trim() || null,
            submitterName: input.submitterName.trim(),
            submitterEmail: input.submitterEmail?.trim().toLowerCase() || null,
            submitterPhone: input.submitterPhone ? normalizePhone(input.submitterPhone) : null,
            customFieldsJson: Object.keys(normalizedFields).length ? JSON.stringify(normalizedFields) : null,
            ipHash: session.ipHash,
            userAgentHash: session.userAgentHash,
        },
    });
    res.status(201).json({
        success: true,
        nominationId: nomination.id,
        status: nomination.status,
        nomineeImagePath: nominationImagePath || null,
        voterSessionToken: token,
        message: 'Nomination submitted successfully and is pending review',
    });
}));
const freeVoteSchema = zod_1.z.object({
    slug: zod_1.z.string().min(1),
    contestId: zod_1.z.string().uuid(),
    optionId: zod_1.z.string().uuid(),
    sessionToken: zod_1.z.string().optional(),
    embedToken: zod_1.z.string().optional(),
});
router.post('/free-vote', (0, errorHandler_js_1.asyncHandler)(async (req, res) => {
    const input = freeVoteSchema.parse(req.body || {});
    const event = await ensureVotingContext(input.slug);
    const embedPayload = validateEmbedTokenForEvent(event, resolveEmbedToken(req, input.embedToken || null));
    if (!event.votingConfig.allowFreeVotes) {
        throw new errorHandler_js_1.AppError('Free voting is disabled for this event', 400);
    }
    const { session, token } = await getOrCreateVoterSession(event.id, req, input.sessionToken, embedPayload?.originHost || null);
    const contest = await prisma_js_1.default.votingContest.findFirst({
        where: {
            id: input.contestId,
            eventId: event.id,
            isActive: true,
        },
    });
    if (!contest)
        throw new errorHandler_js_1.AppError('Voting contest not found', 404);
    const option = await prisma_js_1.default.votingOption.findFirst({
        where: {
            id: input.optionId,
            contestId: contest.id,
            eventId: event.id,
            isActive: true,
        },
    });
    if (!option)
        throw new errorHandler_js_1.AppError('Voting nominee not found', 404);
    const electionMode = contest.mode === 'ELECTION' || event.votingConfig.mode === 'ELECTION';
    const electionVoterKey = electionMode
        ? session.verifiedPhone
            ? hashElectionKey(session.verifiedPhone)
            : null
        : null;
    if (electionMode && event.votingConfig.requireOtpForElection && !electionVoterKey) {
        throw new errorHandler_js_1.AppError('OTP verification is required before voting in election mode', 400);
    }
    await prisma_js_1.default.$transaction(async (tx) => {
        if (electionMode && electionVoterKey) {
            const existingElectionGrant = await tx.voteGrant.findFirst({
                where: {
                    eventId: event.id,
                    contestId: contest.id,
                    electionVoterKey,
                },
            });
            if (existingElectionGrant) {
                throw new errorHandler_js_1.AppError('Only one vote is allowed for this election contest', 409);
            }
        }
        await tx.voteGrant.create({
            data: {
                eventId: event.id,
                contestId: contest.id,
                voterKey: session.voterKey,
                electionVoterKey,
                voteType: 'FREE',
                voteCount: 1,
            },
        });
        await tx.voteRecord.create({
            data: {
                eventId: event.id,
                contestId: contest.id,
                optionId: option.id,
                voterKey: session.voterKey,
                voteType: 'FREE',
                voteCount: 1,
            },
        });
        await tx.votingOption.update({
            where: { id: option.id },
            data: {
                freeVotes: { increment: 1 },
                totalVotes: { increment: 1 },
            },
        });
    }).catch((error) => {
        if (error instanceof errorHandler_js_1.AppError)
            throw error;
        if (error?.code === 'P2002') {
            throw new errorHandler_js_1.AppError('Free vote already recorded for this contest', 409);
        }
        throw error;
    });
    res.status(201).json({
        success: true,
        voterSessionToken: token,
        message: 'Free vote recorded successfully',
    });
}));
const votePaymentIntentSchema = zod_1.z.object({
    slug: zod_1.z.string().min(1),
    contestId: zod_1.z.string().uuid(),
    optionId: zod_1.z.string().uuid(),
    voteCount: zod_1.z.number().int().min(1).max(1000),
    paymentGatewayId: zod_1.z.string().uuid(),
    sessionToken: zod_1.z.string().optional(),
    embedToken: zod_1.z.string().optional(),
});
router.post('/payment-intent', (0, errorHandler_js_1.asyncHandler)(async (req, res) => {
    const input = votePaymentIntentSchema.parse(req.body || {});
    const event = await ensureVotingContext(input.slug);
    const embedPayload = validateEmbedTokenForEvent(event, resolveEmbedToken(req, input.embedToken || null));
    if (!event.votingConfig.allowPaidVotes) {
        throw new errorHandler_js_1.AppError('Paid voting is disabled for this event', 400);
    }
    const contest = await prisma_js_1.default.votingContest.findFirst({
        where: {
            id: input.contestId,
            eventId: event.id,
            isActive: true,
        },
    });
    if (!contest)
        throw new errorHandler_js_1.AppError('Voting contest not found', 404);
    const option = await prisma_js_1.default.votingOption.findFirst({
        where: {
            id: input.optionId,
            contestId: contest.id,
            eventId: event.id,
            isActive: true,
        },
    });
    if (!option)
        throw new errorHandler_js_1.AppError('Voting nominee not found', 404);
    const { session, token } = await getOrCreateVoterSession(event.id, req, input.sessionToken, embedPayload?.originHost || null);
    const electionMode = contest.mode === 'ELECTION' || event.votingConfig.mode === 'ELECTION';
    const electionVoterKey = electionMode
        ? session.verifiedPhone
            ? hashElectionKey(session.verifiedPhone)
            : null
        : null;
    if (electionMode && event.votingConfig.requireOtpForElection && !electionVoterKey) {
        throw new errorHandler_js_1.AppError('OTP verification is required before voting in election mode', 400);
    }
    const existingPaidGrant = await prisma_js_1.default.voteGrant.findFirst({
        where: {
            eventId: event.id,
            contestId: contest.id,
            voterKey: session.voterKey,
            voteType: 'PAID',
        },
        select: { id: true },
    });
    if (existingPaidGrant) {
        throw new errorHandler_js_1.AppError('Paid vote already recorded for this contest', 409);
    }
    if (electionMode && electionVoterKey) {
        const existingElectionGrant = await prisma_js_1.default.voteGrant.findFirst({
            where: {
                eventId: event.id,
                contestId: contest.id,
                electionVoterKey,
            },
            select: { id: true },
        });
        if (existingElectionGrant) {
            throw new errorHandler_js_1.AppError('Only one vote is allowed for this election contest', 409);
        }
    }
    if (input.voteCount > event.votingConfig.maxVotesPerPurchase) {
        throw new errorHandler_js_1.AppError(`Maximum ${event.votingConfig.maxVotesPerPurchase} votes per purchase`, 400);
    }
    const baseAmount = Number((event.votingConfig.voteUnitPrice * input.voteCount).toFixed(2));
    if (baseAmount <= 0)
        throw new errorHandler_js_1.AppError('Computed vote amount is invalid', 400);
    const idempotencySeed = JSON.stringify({
        eventId: event.id,
        contestId: contest.id,
        optionId: option.id,
        voterKey: session.voterKey,
        voteCount: input.voteCount,
        gatewayId: input.paymentGatewayId,
    });
    const idempotencyKey = String(req.get('Idempotency-Key') || '').trim() ||
        (0, crypto_1.createHash)('sha256').update(idempotencySeed).digest('hex');
    const { intent, nextAction } = await (0, paymentCore_js_1.createPaymentIntent)({
        eventId: event.id,
        purpose: 'VOTE',
        amount: baseAmount,
        currency: event.defaultCurrency || event.votingConfig.currency || 'USD',
        paymentGatewayId: input.paymentGatewayId,
        metadata: {
            contestId: contest.id,
            optionId: option.id,
            voteCount: input.voteCount,
            voterKey: session.voterKey,
            electionVoterKey: electionVoterKey || undefined,
        },
        idempotencyKey,
    });
    res.status(201).json({
        success: true,
        paymentIntentId: intent.id,
        amount: intent.amount,
        currency: intent.currency,
        voterSessionToken: token,
        nextAction,
    });
}));
const otpRequestSchema = zod_1.z.object({
    slug: zod_1.z.string().min(1),
    phone: zod_1.z.string().min(5),
    sessionToken: zod_1.z.string().optional(),
    embedToken: zod_1.z.string().optional(),
});
router.post('/otp/request', (0, errorHandler_js_1.asyncHandler)(async (req, res) => {
    const input = otpRequestSchema.parse(req.body || {});
    const event = await ensureVotingContext(input.slug);
    const embedPayload = validateEmbedTokenForEvent(event, resolveEmbedToken(req, input.embedToken || null));
    if (event.votingConfig.mode !== 'ELECTION' && !event.votingConfig.requireOtpForElection) {
        throw new errorHandler_js_1.AppError('OTP is only supported in election mode', 400);
    }
    const { session, token } = await getOrCreateVoterSession(event.id, req, input.sessionToken, embedPayload?.originHost || null);
    const normalizedPhone = normalizePhone(input.phone);
    if (!normalizedPhone)
        throw new errorHandler_js_1.AppError('Phone number is required for OTP', 400);
    const code = String(Math.floor(100000 + Math.random() * 900000));
    await prisma_js_1.default.voterSession.update({
        where: { id: session.id },
        data: {
            verifiedPhone: normalizedPhone,
            otpCodeHash: hashOtp(code),
            otpExpiresAt: new Date(Date.now() + OTP_TTL_SECONDS * 1000),
            otpVerifiedAt: null,
            lastSeenAt: new Date(),
        },
    });
    const smsResult = await (0, notifications_js_1.sendSMS)(normalizedPhone, `Your EventPeepo voting OTP is ${code}. It expires in ${Math.ceil(OTP_TTL_SECONDS / 60)} minutes.`);
    if (!smsResult?.success) {
        throw new errorHandler_js_1.AppError('Failed to send OTP SMS. Please try again later.', 500);
    }
    const maskedPhone = `${normalizedPhone.slice(0, 3)}****${normalizedPhone.slice(-2)}`;
    res.json({
        success: true,
        voterSessionToken: token,
        maskedPhone,
        expiresInSeconds: OTP_TTL_SECONDS,
    });
}));
const otpVerifySchema = zod_1.z.object({
    slug: zod_1.z.string().min(1),
    code: zod_1.z.string().min(4).max(8),
    sessionToken: zod_1.z.string().optional(),
    embedToken: zod_1.z.string().optional(),
});
router.post('/otp/verify', (0, errorHandler_js_1.asyncHandler)(async (req, res) => {
    const input = otpVerifySchema.parse(req.body || {});
    const event = await ensureVotingContext(input.slug);
    const embedPayload = validateEmbedTokenForEvent(event, resolveEmbedToken(req, input.embedToken || null));
    const { session, token } = await getOrCreateVoterSession(event.id, req, input.sessionToken, embedPayload?.originHost || null);
    if (!session.otpCodeHash || !session.otpExpiresAt) {
        throw new errorHandler_js_1.AppError('OTP has not been requested for this session', 400);
    }
    if (session.otpExpiresAt.getTime() < Date.now()) {
        throw new errorHandler_js_1.AppError('OTP has expired. Request a new code.', 400);
    }
    const isValid = session.otpCodeHash === hashOtp(input.code);
    if (!isValid)
        throw new errorHandler_js_1.AppError('Invalid OTP code', 400);
    await prisma_js_1.default.voterSession.update({
        where: { id: session.id },
        data: {
            otpVerifiedAt: new Date(),
            lastSeenAt: new Date(),
        },
    });
    res.json({
        success: true,
        voterSessionToken: token,
        verified: true,
    });
}));
router.get('/public/:slug/nominees', (0, errorHandler_js_1.asyncHandler)(async (req, res) => {
    const { slug } = req.params;
    const contestId = String(req.query.contestId || '').trim() || null;
    const event = await ensureVotingContext(slug);
    const contests = await prisma_js_1.default.votingContest.findMany({
        where: {
            eventId: event.id,
            isActive: true,
            ...(contestId ? { id: contestId } : {}),
        },
        include: {
            options: {
                where: { isActive: true },
                orderBy: [{ totalVotes: 'desc' }, { name: 'asc' }],
                include: {
                    approvedNominations: {
                        where: { status: 'APPROVED' },
                        select: { id: true },
                    },
                },
            },
        },
        orderBy: { sortOrder: 'asc' },
    });
    const categories = contests.map((contest) => {
        const totalVotes = contest.options.reduce((sum, option) => sum + option.totalVotes, 0);
        return {
            contestId: contest.id,
            title: contest.title,
            mode: contest.mode,
            totalVotes,
            nominees: contest.options.map((option) => ({
                optionId: option.id,
                name: option.name,
                description: option.description,
                imagePath: option.imagePath,
                imageUrl: resolveMediaUrl(option.imagePath),
                totalVotes: option.totalVotes,
                freeVotes: option.freeVotes,
                paidVotes: option.paidVotes,
                voteSharePercent: totalVotes > 0 ? Number(((option.totalVotes / totalVotes) * 100).toFixed(2)) : 0,
                approvalStatus: option.approvedNominations.length > 0 ? 'APPROVED' : 'ADMIN_ADDED',
            })),
        };
    });
    res.json({
        event: {
            id: event.id,
            slug: event.slug,
            name: event.name,
        },
        categories,
    });
}));
router.get('/public/:slug/leaderboard', (0, errorHandler_js_1.asyncHandler)(async (req, res) => {
    const { slug } = req.params;
    const contestId = String(req.query.contestId || '').trim() || null;
    const event = await ensureVotingContext(slug);
    const contests = await prisma_js_1.default.votingContest.findMany({
        where: {
            eventId: event.id,
            isActive: true,
            ...(contestId ? { id: contestId } : {}),
        },
        include: {
            options: {
                where: { isActive: true },
                orderBy: [{ totalVotes: 'desc' }, { sortOrder: 'asc' }],
            },
        },
        orderBy: { sortOrder: 'asc' },
    });
    const now = Date.now();
    const last24h = new Date(now - 24 * 60 * 60 * 1000);
    const prev24h = new Date(now - 48 * 60 * 60 * 1000);
    const recentRecords = await prisma_js_1.default.voteRecord.findMany({
        where: {
            eventId: event.id,
            contestId: contestId || undefined,
            createdAt: { gte: prev24h },
        },
        select: {
            optionId: true,
            voteCount: true,
            createdAt: true,
        },
    });
    const responseContests = contests.map((contest) => {
        const contestTotal = contest.options.reduce((sum, option) => sum + option.totalVotes, 0) || 1;
        const ranked = contest.options.map((option, index) => {
            const recent = recentRecords
                .filter((record) => record.optionId === option.id && record.createdAt >= last24h)
                .reduce((sum, record) => sum + record.voteCount, 0);
            const previous = recentRecords
                .filter((record) => record.optionId === option.id && record.createdAt < last24h)
                .reduce((sum, record) => sum + record.voteCount, 0);
            return {
                optionId: option.id,
                name: option.name,
                description: option.description,
                imagePath: option.imagePath,
                imageUrl: resolveMediaUrl(option.imagePath),
                rank: index + 1,
                totalVotes: option.totalVotes,
                freeVotes: option.freeVotes,
                paidVotes: option.paidVotes,
                voteSharePercent: Number(((option.totalVotes / contestTotal) * 100).toFixed(2)),
                trendDelta: recent - previous,
            };
        });
        return {
            contestId: contest.id,
            title: contest.title,
            mode: contest.mode,
            totals: {
                totalVotes: contest.options.reduce((sum, option) => sum + option.totalVotes, 0),
                freeVotes: contest.options.reduce((sum, option) => sum + option.freeVotes, 0),
                paidVotes: contest.options.reduce((sum, option) => sum + option.paidVotes, 0),
            },
            rankings: ranked,
        };
    });
    res.json({
        event: {
            id: event.id,
            slug: event.slug,
            name: event.name,
        },
        contests: responseContests,
    });
}));
const embedTokenSchema = zod_1.z.object({
    slug: zod_1.z.string().min(1),
});
router.post('/embed/token', (0, errorHandler_js_1.asyncHandler)(async (req, res) => {
    const input = embedTokenSchema.parse(req.body || {});
    const event = await prisma_js_1.default.event.findUnique({
        where: { slug: input.slug },
        select: {
            id: true,
            slug: true,
            domains: {
                where: {
                    status: { in: ['VERIFIED', 'ACTIVE'] },
                },
                select: { host: true },
            },
        },
    });
    if (!event)
        throw new errorHandler_js_1.AppError('Event not found', 404);
    const origin = String(req.get('origin') || req.body?.origin || '').trim();
    if (!origin)
        throw new errorHandler_js_1.AppError('Origin header is required for embed token', 400);
    const originHost = normalizeHost(origin);
    if (!originHost)
        throw new errorHandler_js_1.AppError('Invalid embed origin', 400);
    const allowedHosts = new Set(event.domains.map((domain) => normalizeHost(domain.host)));
    if (!allowedHosts.has(originHost)) {
        throw new errorHandler_js_1.AppError('Embed origin is not verified for this event', 403);
    }
    const exp = Math.floor(Date.now() / 1000) + EMBED_TOKEN_TTL_SECONDS;
    const token = issueSignedToken({
        eventId: event.id,
        slug: event.slug,
        originHost,
        exp,
    }, EMBED_TOKEN_SECRET);
    res.json({
        token,
        expiresAt: new Date(exp * 1000).toISOString(),
        ttlSeconds: EMBED_TOKEN_TTL_SECONDS,
    });
}));
exports.default = router;
//# sourceMappingURL=voting.js.map