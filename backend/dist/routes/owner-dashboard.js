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
exports.default = router;
//# sourceMappingURL=owner-dashboard.js.map