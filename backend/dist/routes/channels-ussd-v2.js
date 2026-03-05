"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const zod_1 = require("zod");
const errorHandler_js_1 = require("../middleware/errorHandler.js");
const auth_js_1 = require("../middleware/auth.js");
const prisma_js_1 = __importDefault(require("../utils/prisma.js"));
const PrismaVotingRepository_js_1 = require("../modules/voting/core/PrismaVotingRepository.js");
const VotingService_js_1 = require("../modules/voting/core/VotingService.js");
const UssdCreditsService_js_1 = require("../modules/voting/credits/UssdCreditsService.js");
const VoterIdentityService_js_1 = require("../modules/voting/core/VoterIdentityService.js");
const FrogUssdV2Adapter_js_1 = require("../modules/voting/channels/FrogUssdV2Adapter.js");
const router = (0, express_1.Router)();
const votingService = new VotingService_js_1.VotingService(new PrismaVotingRepository_js_1.PrismaVotingRepository(prisma_js_1.default));
const creditsService = new UssdCreditsService_js_1.UssdCreditsService();
const frogAdapter = new FrogUssdV2Adapter_js_1.FrogUssdV2Adapter(votingService, creditsService, new VoterIdentityService_js_1.VoterIdentityService());
const callbackSchema = zod_1.z.object({
    network: zod_1.z.string().min(1),
    sessionid: zod_1.z.string().min(1),
    mode: zod_1.z.string().min(1),
    userdata: zod_1.z.string(),
    username: zod_1.z.string().min(1),
    trafficid: zod_1.z.string().min(1),
    other: zod_1.z.string().optional(),
    msisdn: zod_1.z.string().optional(),
    phonenumber: zod_1.z.string().optional(),
});
router.post('/frog/v2', (0, errorHandler_js_1.asyncHandler)(async (req, res) => {
    const allowlist = String(process.env.WIGAL_IP_ALLOWLIST || '')
        .split(',')
        .map((item) => item.trim())
        .filter(Boolean);
    if (allowlist.length > 0) {
        const forwarded = String(req.headers['x-forwarded-for'] || '').split(',')[0].trim();
        const remoteIp = forwarded || req.ip || req.socket.remoteAddress || '';
        if (remoteIp && !allowlist.includes(remoteIp)) {
            throw new errorHandler_js_1.AppError('USSD callback source is not allowed', 403);
        }
    }
    const payload = callbackSchema.parse(req.body || {});
    const response = await frogAdapter.handleRequest(payload);
    res.json(response);
}));
router.get('/channels', auth_js_1.authenticateAdminOrOwnerAccount, (0, errorHandler_js_1.asyncHandler)(async (req, res) => {
    const ownerId = String(req.ownerId || '').trim() || undefined;
    const channels = await prisma_js_1.default.ussdChannel.findMany({
        where: ownerId ? { OR: [{ ownerId }, { ownerId: null }] } : {},
        include: {
            bindings: {
                where: { isActive: true },
                select: {
                    id: true,
                    eventId: true,
                    ownerId: true,
                    isActive: true,
                    event: {
                        select: {
                            id: true,
                            name: true,
                            slug: true,
                        },
                    },
                },
            },
        },
        orderBy: [{ status: 'asc' }, { createdAt: 'desc' }],
    });
    res.json({ channels });
}));
const createChannelSchema = zod_1.z.object({
    codeLabel: zod_1.z.string().min(1).max(120),
    shortcode: zod_1.z.string().max(50).optional().nullable(),
    ownerId: zod_1.z.string().uuid().optional().nullable(),
    status: zod_1.z.enum(['ACTIVE', 'INACTIVE']).optional(),
});
router.post('/channels', auth_js_1.authenticateAdmin, (0, errorHandler_js_1.asyncHandler)(async (req, res) => {
    const input = createChannelSchema.parse(req.body || {});
    const channel = await prisma_js_1.default.ussdChannel.create({
        data: {
            provider: 'WIGAL_FROG',
            codeLabel: input.codeLabel.trim(),
            shortcode: input.shortcode || null,
            ownerId: input.ownerId || null,
            status: input.status || 'ACTIVE',
        },
    });
    res.status(201).json({ channel });
}));
const bindChannelSchema = zod_1.z.object({
    ussdChannelId: zod_1.z.string().uuid(),
    eventId: zod_1.z.string().uuid(),
    isActive: zod_1.z.boolean().optional(),
});
router.post('/bindings', auth_js_1.authenticateAdminOrOwnerAccount, (0, errorHandler_js_1.asyncHandler)(async (req, res) => {
    const input = bindChannelSchema.parse(req.body || {});
    const ownerId = String(req.ownerId || '').trim() || null;
    const adminId = String(req.admin?.id || '').trim() || null;
    const event = adminId
        ? await prisma_js_1.default.event.findUnique({
            where: { id: input.eventId },
            select: { id: true, ownerId: true, defaultCurrency: true },
        })
        : await prisma_js_1.default.event.findFirst({
            where: { id: input.eventId, ownerId: ownerId || undefined },
            select: { id: true, ownerId: true, defaultCurrency: true },
        });
    if (!event)
        throw new errorHandler_js_1.AppError('Event not found', 404);
    const channel = await prisma_js_1.default.ussdChannel.findUnique({
        where: { id: input.ussdChannelId },
        select: { id: true, ownerId: true, status: true },
    });
    if (!channel)
        throw new errorHandler_js_1.AppError('USSD channel not found', 404);
    if (!adminId && channel.ownerId && channel.ownerId !== ownerId) {
        throw new errorHandler_js_1.AppError('Not authorized to bind this USSD channel', 403);
    }
    const binding = await prisma_js_1.default.ussdChannelBinding.upsert({
        where: {
            ussdChannelId_eventId: {
                ussdChannelId: channel.id,
                eventId: event.id,
            },
        },
        create: {
            ussdChannelId: channel.id,
            ownerId: event.ownerId || ownerId,
            eventId: event.id,
            isActive: input.isActive ?? true,
        },
        update: {
            ownerId: event.ownerId || ownerId,
            isActive: input.isActive ?? true,
        },
        include: {
            ussdChannel: true,
            event: {
                select: { id: true, name: true, slug: true },
            },
        },
    });
    await creditsService.ensureWalletForEvent(event.id);
    res.status(201).json({ binding });
}));
const toggleBindingSchema = zod_1.z.object({
    isActive: zod_1.z.boolean(),
});
router.patch('/bindings/:bindingId', auth_js_1.authenticateAdminOrOwnerAccount, (0, errorHandler_js_1.asyncHandler)(async (req, res) => {
    const { bindingId } = req.params;
    const { isActive } = toggleBindingSchema.parse(req.body || {});
    const ownerId = String(req.ownerId || '').trim() || null;
    const adminId = String(req.admin?.id || '').trim() || null;
    const binding = await prisma_js_1.default.ussdChannelBinding.findUnique({
        where: { id: bindingId },
        include: {
            event: {
                select: { ownerId: true },
            },
        },
    });
    if (!binding)
        throw new errorHandler_js_1.AppError('Binding not found', 404);
    if (!adminId && binding.event.ownerId !== ownerId) {
        throw new errorHandler_js_1.AppError('Not authorized', 403);
    }
    const updated = await prisma_js_1.default.ussdChannelBinding.update({
        where: { id: binding.id },
        data: { isActive },
    });
    res.json({ binding: updated });
}));
router.get('/wallets/:eventId', auth_js_1.authenticateAdminOrOwnerAccount, (0, errorHandler_js_1.asyncHandler)(async (req, res) => {
    const { eventId } = req.params;
    const ownerId = String(req.ownerId || '').trim() || null;
    const adminId = String(req.admin?.id || '').trim() || null;
    const event = adminId
        ? await prisma_js_1.default.event.findUnique({ where: { id: eventId }, select: { id: true, ownerId: true } })
        : await prisma_js_1.default.event.findFirst({
            where: { id: eventId, ownerId: ownerId || undefined },
            select: { id: true, ownerId: true },
        });
    if (!event)
        throw new errorHandler_js_1.AppError('Event not found', 404);
    const wallet = await creditsService.ensureWalletForEvent(event.id);
    const ledger = await prisma_js_1.default.ussdCreditLedgerEntry.findMany({
        where: { walletId: wallet.id },
        orderBy: { createdAt: 'desc' },
        take: 100,
    });
    res.json({ wallet, ledger });
}));
const manualTopupSchema = zod_1.z.object({
    units: zod_1.z.number().int().min(1),
    reference: zod_1.z.string().min(1).max(120),
    note: zod_1.z.string().max(300).optional().nullable(),
});
router.post('/wallets/:eventId/topups/manual', auth_js_1.authenticateAdminOrOwnerAccount, (0, errorHandler_js_1.asyncHandler)(async (req, res) => {
    const { eventId } = req.params;
    const ownerId = String(req.ownerId || '').trim() || null;
    const adminId = String(req.admin?.id || '').trim() || null;
    const input = manualTopupSchema.parse(req.body || {});
    const event = adminId
        ? await prisma_js_1.default.event.findUnique({ where: { id: eventId }, select: { id: true, ownerId: true } })
        : await prisma_js_1.default.event.findFirst({
            where: { id: eventId, ownerId: ownerId || undefined },
            select: { id: true, ownerId: true },
        });
    if (!event)
        throw new errorHandler_js_1.AppError('Event not found', 404);
    const wallet = await creditsService.ensureWalletForEvent(event.id);
    const result = await creditsService.topupCredits({
        walletId: wallet.id,
        units: input.units,
        reference: input.reference,
        metadata: {
            source: 'MANUAL',
            note: input.note || null,
        },
    });
    res.status(201).json({
        success: true,
        idempotent: result.idempotent,
        wallet: result.wallet,
    });
}));
exports.default = router;
//# sourceMappingURL=channels-ussd-v2.js.map