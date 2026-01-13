"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const prisma_js_1 = __importDefault(require("../utils/prisma.js"));
const errorHandler_js_1 = require("../middleware/errorHandler.js");
const auth_js_1 = require("../middleware/auth.js");
const phase_js_1 = require("../utils/phase.js");
const zod_1 = require("zod");
const router = (0, express_1.Router)();
// All routes require owner authentication
router.use(auth_js_1.authenticateOwnerAccount);
/**
 * GET /api/owner-dashboard/events
 * Get all events for the logged-in owner
 */
router.get('/events', (0, errorHandler_js_1.asyncHandler)(async (req, res) => {
    const ownerId = req.ownerId;
    const events = await prisma_js_1.default.event.findMany({
        where: { ownerId },
        orderBy: { date: 'desc' },
        include: {
            _count: {
                select: {
                    rsvps: true,
                    invitations: true,
                    checkIns: true,
                    mediaAssets: true,
                    transactions: true,
                },
            },
            ticketTypes: {
                select: {
                    id: true,
                    name: true,
                    price: true,
                    currency: true,
                    quantitySold: true,
                    quantityTotal: true,
                },
            },
        },
    });
    // Calculate current phase for each event
    const eventsWithPhase = events.map((event) => ({
        ...event,
        currentPhase: (0, phase_js_1.calculateEventPhase)(event),
    }));
    res.json({ events: eventsWithPhase });
}));
/**
 * GET /api/owner-dashboard/events/:eventId
 * Get single event details
 */
router.get('/events/:eventId', (0, errorHandler_js_1.asyncHandler)(async (req, res) => {
    const ownerId = req.ownerId;
    const { eventId } = req.params;
    const event = await prisma_js_1.default.event.findFirst({
        where: {
            id: eventId,
            ownerId, // Ensure owner owns this event
        },
        include: {
            _count: {
                select: {
                    rsvps: true,
                    invitations: true,
                    checkIns: true,
                    mediaAssets: true,
                    transactions: true,
                },
            },
            ticketTypes: {
                select: {
                    id: true,
                    name: true,
                    description: true,
                    price: true,
                    currency: true,
                    quantitySold: true,
                    quantityTotal: true,
                    isActive: true,
                },
            },
        },
    });
    if (!event) {
        throw new errorHandler_js_1.AppError('Event not found', 404);
    }
    res.json({
        event: {
            ...event,
            currentPhase: (0, phase_js_1.calculateEventPhase)(event),
        },
    });
}));
/**
 * GET /api/owner-dashboard/stats
 * Get overall statistics for the owner
 */
router.get('/stats', (0, errorHandler_js_1.asyncHandler)(async (req, res) => {
    const ownerId = req.ownerId;
    const events = await prisma_js_1.default.event.findMany({
        where: { ownerId },
        include: {
            _count: {
                select: {
                    rsvps: true,
                    invitations: true,
                    checkIns: true,
                    mediaAssets: true,
                },
            },
            transactions: {
                select: {
                    grossAmount: true,
                    netAmount: true,
                    currency: true,
                    status: true,
                    type: true,
                },
            },
        },
    });
    // Calculate totals
    const totalEvents = events.length;
    const totalRsvps = events.reduce((sum, e) => sum + e._count.rsvps, 0);
    const totalCheckIns = events.reduce((sum, e) => sum + e._count.checkIns, 0);
    const totalMedia = events.reduce((sum, e) => sum + e._count.mediaAssets, 0);
    // Calculate revenue
    const allTransactions = events.flatMap(e => e.transactions);
    const completedTransactions = allTransactions.filter(t => t.status === 'completed' && t.type === 'ticket_sale');
    const revenueByCurrency = {};
    completedTransactions.forEach(t => {
        if (!revenueByCurrency[t.currency]) {
            revenueByCurrency[t.currency] = { gross: 0, net: 0 };
        }
        revenueByCurrency[t.currency].gross += t.grossAmount;
        revenueByCurrency[t.currency].net += t.netAmount;
    });
    res.json({
        stats: {
            totalEvents,
            totalRsvps,
            totalCheckIns,
            totalMedia,
            revenueByCurrency,
        },
    });
}));
/**
 * GET /api/owner-dashboard/events/:eventId/rsvps
 * Get RSVPs for a specific event (owner must own the event)
 */
router.get('/events/:eventId/rsvps', (0, errorHandler_js_1.asyncHandler)(async (req, res) => {
    const ownerId = req.ownerId;
    const { eventId } = req.params;
    const { status } = req.query;
    // Verify owner owns this event
    const event = await prisma_js_1.default.event.findFirst({
        where: { id: eventId, ownerId },
        select: { id: true },
    });
    if (!event) {
        throw new errorHandler_js_1.AppError('Event not found', 404);
    }
    const where = { eventId };
    if (status && status !== 'all') {
        where.status = status;
    }
    const rsvps = await prisma_js_1.default.rSVP.findMany({
        where,
        include: {
            invitation: {
                select: {
                    id: true,
                    accessCode: true,
                    token: true,
                    qrCodeData: true,
                    isCheckedIn: true,
                },
            },
        },
        orderBy: { submittedAt: 'desc' },
    });
    res.json({ rsvps });
}));
/**
 * GET /api/owner-dashboard/events/:eventId/media
 * Get media for a specific event (owner must own the event)
 */
router.get('/events/:eventId/media', (0, errorHandler_js_1.asyncHandler)(async (req, res) => {
    const ownerId = req.ownerId;
    const { eventId } = req.params;
    const { type } = req.query;
    // Verify owner owns this event
    const event = await prisma_js_1.default.event.findFirst({
        where: { id: eventId, ownerId },
        select: { id: true },
    });
    if (!event) {
        throw new errorHandler_js_1.AppError('Event not found', 404);
    }
    const where = { eventId };
    if (type) {
        where.type = type;
    }
    const { downloadFile, BUCKETS, getPublicUrl } = await import('../services/supabaseStorage.js');
    const media = await prisma_js_1.default.mediaAsset.findMany({
        where,
        orderBy: { createdAt: 'desc' },
    });
    // Transform media to include proper URLs
    const mediaWithUrls = media.map(asset => {
        let fileUrl = asset.filePath;
        if (!asset.filePath.startsWith('http://') && !asset.filePath.startsWith('https://')) {
            try {
                fileUrl = getPublicUrl(BUCKETS.MEDIA, asset.filePath);
            }
            catch {
                fileUrl = asset.filePath.startsWith('/') ? asset.filePath : `/${asset.filePath}`;
            }
        }
        let thumbnailUrl = asset.thumbnailPath;
        if (asset.thumbnailPath && !asset.thumbnailPath.startsWith('http://') && !asset.thumbnailPath.startsWith('https://')) {
            try {
                thumbnailUrl = getPublicUrl(BUCKETS.MEDIA, asset.thumbnailPath);
            }
            catch {
                thumbnailUrl = asset.thumbnailPath.startsWith('/') ? asset.thumbnailPath : `/${asset.thumbnailPath}`;
            }
        }
        return {
            ...asset,
            filePath: fileUrl,
            thumbnailPath: thumbnailUrl,
        };
    });
    res.json({ media: mediaWithUrls });
}));
/**
 * GET /api/owner-dashboard/events/:eventId/checkins
 * Get check-ins for a specific event (owner must own the event)
 */
router.get('/events/:eventId/checkins', (0, errorHandler_js_1.asyncHandler)(async (req, res) => {
    const ownerId = req.ownerId;
    const { eventId } = req.params;
    // Verify owner owns this event
    const event = await prisma_js_1.default.event.findFirst({
        where: { id: eventId, ownerId },
        select: { id: true },
    });
    if (!event) {
        throw new errorHandler_js_1.AppError('Event not found', 404);
    }
    const checkIns = await prisma_js_1.default.checkIn.findMany({
        where: { eventId },
        include: {
            invitation: {
                select: {
                    guestName: true,
                    guestCount: true,
                    accessCode: true,
                },
            },
        },
        orderBy: { checkedInAt: 'desc' },
    });
    res.json({ checkIns });
}));
/**
 * GET /api/owner-dashboard/events/:eventId/tickets
 * Get tickets for a specific event (owner must own the event)
 */
router.get('/events/:eventId/tickets', (0, errorHandler_js_1.asyncHandler)(async (req, res) => {
    const ownerId = req.ownerId;
    const { eventId } = req.params;
    // Verify owner owns this event
    const event = await prisma_js_1.default.event.findFirst({
        where: { id: eventId, ownerId },
        select: { id: true },
    });
    if (!event) {
        throw new errorHandler_js_1.AppError('Event not found', 404);
    }
    const tickets = await prisma_js_1.default.ticketType.findMany({
        where: { eventId },
        orderBy: { sortOrder: 'asc' },
    });
    res.json({ tickets });
}));
/**
 * GET /api/owner-dashboard/wallet
 * Get wallet configuration for the logged-in owner
 */
router.get('/wallet', (0, errorHandler_js_1.asyncHandler)(async (req, res) => {
    const ownerId = req.ownerId;
    const owner = await prisma_js_1.default.owner.findUnique({
        where: { id: ownerId },
        include: { wallet: true },
    });
    if (!owner) {
        throw new errorHandler_js_1.AppError('Owner not found', 404);
    }
    res.json({ wallet: owner.wallet || null });
}));
/**
 * POST /api/owner-dashboard/wallet
 * Create or update wallet configuration for the logged-in owner
 */
router.post('/wallet', (0, errorHandler_js_1.asyncHandler)(async (req, res) => {
    const ownerId = req.ownerId;
    const owner = await prisma_js_1.default.owner.findUnique({
        where: { id: ownerId },
    });
    if (!owner) {
        throw new errorHandler_js_1.AppError('Owner not found', 404);
    }
    const walletSchema = zod_1.z.object({
        // Bank Account Details
        bankName: zod_1.z.string().optional(),
        accountName: zod_1.z.string().optional(),
        accountNumber: zod_1.z.string().optional(),
        routingNumber: zod_1.z.string().optional(),
        swiftCode: zod_1.z.string().optional(),
        // Mobile Money
        mobileProvider: zod_1.z.enum(['mpesa', 'mtn', 'airtel']).optional(),
        mobileNumber: zod_1.z.string().optional(),
        // Digital Wallets
        paypalEmail: zod_1.z.string().email().optional(),
        stripeAccountId: zod_1.z.string().optional(),
        paystackSubaccount: zod_1.z.string().optional(),
        // Payout Preferences
        preferredMethod: zod_1.z.enum(['bank', 'mobile', 'paypal', 'stripe', 'paystack']).default('bank'),
        currency: zod_1.z.string().default('USD'),
        autoPayoutEnabled: zod_1.z.boolean().optional(),
        autoPayoutThreshold: zod_1.z.number().optional(),
    });
    const data = walletSchema.parse(req.body);
    const wallet = await prisma_js_1.default.ownerWallet.upsert({
        where: { ownerId },
        create: {
            ownerId,
            ...data,
        },
        update: data,
    });
    // Create audit log (owner actions don't require audit log in current schema)
    // Audit logs are primarily for admin actions
    res.json({ wallet, message: 'Wallet configuration saved successfully' });
}));
/**
 * GET /api/owner-dashboard/payouts
 * Get all payout requests for the logged-in owner with totals
 */
router.get('/payouts', (0, errorHandler_js_1.asyncHandler)(async (req, res) => {
    const ownerId = req.ownerId;
    // Get all events owned by this owner
    const events = await prisma_js_1.default.event.findMany({
        where: { ownerId },
        select: {
            id: true,
            name: true,
            slug: true,
        },
    });
    const eventIds = events.map(e => e.id);
    // Get all payout requests for these events
    const payouts = await prisma_js_1.default.payoutRequest.findMany({
        where: {
            eventId: { in: eventIds },
        },
        include: {
            event: {
                select: {
                    id: true,
                    name: true,
                    slug: true,
                },
            },
        },
        orderBy: { createdAt: 'desc' },
    });
    // Calculate totals per event and overall
    const eventTotals = await Promise.all(events.map(async (event) => {
        // Get all transactions for this event
        const transactions = await prisma_js_1.default.transaction.findMany({
            where: {
                eventId: event.id,
                type: 'ticket_sale',
                status: 'completed',
            },
        });
        // Calculate total net amount (available for payout)
        const totalNet = transactions.reduce((sum, t) => sum + (t.netAmount || 0), 0);
        // Get all payout requests for this event
        const eventPayouts = payouts.filter(p => p.eventId === event.id);
        // Calculate fulfilled payout amount (status: FULFILLED)
        const fulfilledAmount = eventPayouts
            .filter(p => p.status === 'FULFILLED')
            .reduce((sum, p) => sum + (p.requestedAmount || 0), 0);
        // Calculate pending/processing payout amount
        const pendingAmount = eventPayouts
            .filter(p => p.status === 'PENDING' || p.status === 'PROCESSING' || p.status === 'DELAYED')
            .reduce((sum, p) => sum + (p.requestedAmount || 0), 0);
        // Available balance = totalNet - fulfilledAmount - pendingAmount
        const availableBalance = totalNet - fulfilledAmount - pendingAmount;
        return {
            eventId: event.id,
            eventName: event.name,
            eventSlug: event.slug,
            totalNet,
            fulfilledAmount,
            pendingAmount,
            availableBalance,
            payoutCount: eventPayouts.length,
        };
    }));
    // Calculate overall totals
    const overallTotals = {
        totalNet: eventTotals.reduce((sum, e) => sum + e.totalNet, 0),
        fulfilledAmount: eventTotals.reduce((sum, e) => sum + e.fulfilledAmount, 0),
        pendingAmount: eventTotals.reduce((sum, e) => sum + e.pendingAmount, 0),
        availableBalance: eventTotals.reduce((sum, e) => sum + e.availableBalance, 0),
        totalPayoutCount: payouts.length,
    };
    res.json({
        payouts,
        eventTotals,
        overallTotals,
    });
}));
/**
 * POST /api/owner-dashboard/payouts
 * Create a new payout request
 */
router.post('/payouts', (0, errorHandler_js_1.asyncHandler)(async (req, res) => {
    const ownerId = req.ownerId;
    const payoutSchema = zod_1.z.object({
        eventId: zod_1.z.string().uuid(),
        requestedAmount: zod_1.z.number().positive(),
        currency: zod_1.z.string().default('USD'),
        payoutMethod: zod_1.z.enum(['bank', 'mobile', 'paypal', 'stripe', 'paystack']),
        notes: zod_1.z.string().optional(),
    });
    const data = payoutSchema.parse(req.body);
    // Verify event belongs to owner
    const event = await prisma_js_1.default.event.findFirst({
        where: {
            id: data.eventId,
            ownerId,
        },
    });
    if (!event) {
        throw new errorHandler_js_1.AppError('Event not found or you do not have access', 404);
    }
    // Get wallet configuration to verify payout method
    const wallet = await prisma_js_1.default.ownerWallet.findUnique({
        where: { ownerId },
    });
    if (!wallet) {
        throw new errorHandler_js_1.AppError('Wallet configuration required. Please set up your wallet first.', 400);
    }
    // Check if preferred method matches request
    if (wallet.preferredMethod !== data.payoutMethod) {
        // Allow override but warn (optional check)
    }
    // Calculate available balance for this event
    const transactions = await prisma_js_1.default.transaction.findMany({
        where: {
            eventId: data.eventId,
            type: 'ticket_sale',
            status: 'completed',
        },
    });
    const totalNet = transactions.reduce((sum, t) => sum + (t.netAmount || 0), 0);
    // Get existing payout requests for this event
    const existingPayouts = await prisma_js_1.default.payoutRequest.findMany({
        where: {
            eventId: data.eventId,
            status: { in: ['PENDING', 'PROCESSING', 'FULFILLED', 'DELAYED'] },
        },
    });
    const fulfilledAmount = existingPayouts
        .filter(p => p.status === 'FULFILLED')
        .reduce((sum, p) => sum + (p.requestedAmount || 0), 0);
    const pendingAmount = existingPayouts
        .filter(p => p.status === 'PENDING' || p.status === 'PROCESSING' || p.status === 'DELAYED')
        .reduce((sum, p) => sum + (p.requestedAmount || 0), 0);
    const availableBalance = totalNet - fulfilledAmount - pendingAmount;
    if (data.requestedAmount > availableBalance) {
        throw new errorHandler_js_1.AppError(`Requested amount (${data.currency} ${data.requestedAmount.toFixed(2)}) exceeds available balance (${data.currency} ${availableBalance.toFixed(2)})`, 400);
    }
    // Create payout request
    const payout = await prisma_js_1.default.payoutRequest.create({
        data: {
            eventId: data.eventId,
            requestedAmount: data.requestedAmount,
            currency: data.currency,
            payoutMethod: data.payoutMethod,
            notes: data.notes,
            status: 'PENDING',
        },
        include: {
            event: {
                select: {
                    id: true,
                    name: true,
                    slug: true,
                },
            },
        },
    });
    res.status(201).json({ payout });
}));
exports.default = router;
//# sourceMappingURL=owner-dashboard.js.map