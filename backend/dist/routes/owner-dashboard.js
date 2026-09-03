"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const crypto_1 = require("crypto");
const customDomainHosting_js_1 = require("../services/customDomainHosting.js");
const customDomainDns_js_1 = require("../services/customDomainDns.js");
const prisma_js_1 = __importDefault(require("../utils/prisma.js"));
const errorHandler_js_1 = require("../middleware/errorHandler.js");
const auth_js_1 = require("../middleware/auth.js");
const phase_js_1 = require("../utils/phase.js");
const featureFlags_js_1 = require("../utils/featureFlags.js");
const siteUrl_js_1 = require("../utils/siteUrl.js");
const zod_1 = require("zod");
const notifications_js_1 = require("../services/notifications.js");
const invitation_js_1 = require("../services/invitation.js");
const ownerNotifications_js_1 = require("../services/ownerNotifications.js");
const paystack_js_1 = require("../services/paystack.js");
const payoutAutomation_js_1 = require("../services/payoutAutomation.js");
const walletPolicy_js_1 = require("../utils/walletPolicy.js");
const router = (0, express_1.Router)();
// All routes require owner authentication
router.use(auth_js_1.authenticateOwnerAccount);
const normalizeDomainHost = (rawHost) => rawHost
    .trim()
    .toLowerCase()
    .replace(/^https?:\/\//, '')
    .split('/')[0]
    .split(':')[0]
    .replace(/^www\./, '')
    .replace(/\.$/, '');
const isValidDomainHost = (host) => /^(?:[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?\.)+[a-z]{2,}$/i.test(host);
// Invite links are opened from an email or a chat app, so they must always be
// absolute. `/invite/:token` is a platform route, not an event route, so it
// stays on the app host even when the event has its own domain.
const getInvitePublicUrl = (token) => (0, siteUrl_js_1.buildSiteUrl)(`/invite/${token}`);
const eventCreateSchema = zod_1.z.object({
    name: zod_1.z.string().min(2, 'Event name is required'),
    slug: zod_1.z
        .string()
        .min(2, 'Slug is required')
        .regex(/^[a-z0-9-]+$/, 'Slug must contain lowercase letters, numbers, and hyphens'),
    description: zod_1.z.string().optional(),
    date: zod_1.z.coerce.date(),
    endDate: zod_1.z.coerce.date().optional(),
    timezone: zod_1.z.string().optional(),
    venue: zod_1.z.string().optional(),
    ownerName: zod_1.z.string().optional(),
    ownerEmail: zod_1.z.string().email().optional(),
    ownerPhone: zod_1.z.string().optional(),
    organizationName: zod_1.z.string().optional(),
    defaultCurrency: zod_1.z
        .string()
        .trim()
        .toUpperCase()
        .regex(/^[A-Z]{3}$/, 'Default currency must be a 3-letter code')
        .default('USD'),
});
const eventUpdateSchema = zod_1.z.object({
    name: zod_1.z.string().min(2).optional(),
    description: zod_1.z.string().nullable().optional(),
    date: zod_1.z.coerce.date().optional(),
    endDate: zod_1.z.coerce.date().nullable().optional(),
    timezone: zod_1.z.string().optional(),
    venue: zod_1.z.string().nullable().optional(),
    ownerName: zod_1.z.string().nullable().optional(),
    ownerEmail: zod_1.z.string().email().nullable().optional(),
    ownerPhone: zod_1.z.string().nullable().optional(),
    organizationName: zod_1.z.string().nullable().optional(),
    defaultCurrency: zod_1.z
        .string()
        .trim()
        .toUpperCase()
        .regex(/^[A-Z]{3}$/, 'Default currency must be a 3-letter code')
        .optional(),
});
const rsvpStatusSchema = zod_1.z.object({
    status: zod_1.z.enum(['PENDING', 'APPROVED', 'REJECTED']),
    reason: zod_1.z.string().max(400).optional(),
});
const INVITE_CHANNELS = ['whatsapp', 'sms', 'email'];
/**
 * Invite channels are stored in one string column so any combination works
 * without a migration: "whatsapp", "sms,email", and so on. "both" is the
 * legacy value for WhatsApp + email and is still accepted.
 */
const parseInviteChannels = (value) => {
    const raw = String(value || 'whatsapp').toLowerCase();
    if (raw === 'both')
        return ['whatsapp', 'email'];
    const parsed = raw
        .split(',')
        .map((part) => part.trim())
        .filter((part) => INVITE_CHANNELS.includes(part));
    return parsed.length ? Array.from(new Set(parsed)) : ['whatsapp'];
};
const inviteValidateSchema = zod_1.z.object({
    invites: zod_1.z.array(zod_1.z.object({
        name: zod_1.z.string().trim().optional(),
        phone: zod_1.z.string().trim().optional(),
        email: zod_1.z.string().trim().optional(),
    })),
    // Accepts one channel, a comma-separated set, or the legacy "both".
    channel: zod_1.z.string().optional().default('whatsapp'),
});
const normalizePhone = (value) => String(value || '').replace(/[^\d+]/g, '');
const normalizeEmail = (value) => String(value || '').trim().toLowerCase();
const isValidEmail = (value) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value);
const transitionRsvpStatus = async ({ eventId, ownerId, rsvpId, status, reason, }) => {
    const event = await prisma_js_1.default.event.findFirst({
        where: { id: eventId, ownerId },
        select: { id: true },
    });
    if (!event)
        throw new errorHandler_js_1.AppError('Event not found', 404);
    const rsvp = await prisma_js_1.default.rSVP.findFirst({
        where: { id: rsvpId, eventId },
    });
    if (!rsvp)
        throw new errorHandler_js_1.AppError('RSVP not found', 404);
    const fromStatus = String(rsvp.status || 'PENDING').toUpperCase();
    if (fromStatus === status) {
        return { rsvp, invitation: null, transitioned: false };
    }
    const updatedRsvp = await prisma_js_1.default.rSVP.update({
        where: { id: rsvp.id },
        data: {
            status,
            reviewedAt: new Date(),
        },
    });
    await prisma_js_1.default.rSVPStatusAudit.create({
        data: {
            rsvpId: rsvp.id,
            eventId,
            fromStatus,
            toStatus: status,
            reason: reason || null,
            changedByOwnerId: ownerId,
        },
    });
    let invitation = null;
    if (status === 'APPROVED' && rsvp.attendance === 'YES') {
        invitation = await (0, invitation_js_1.generateInvitationPass)(rsvp.id);
        if (invitation) {
            (0, notifications_js_1.sendInvitationNotifications)(invitation.id).catch((error) => console.error('[Owner RSVP transition] Invitation send failed:', error));
        }
    }
    await prisma_js_1.default.auditLog.create({
        data: {
            eventId,
            action: `RSVP_STATUS_CHANGED_BY_OWNER_${status}`,
            entityType: 'RSVP',
            entityId: rsvp.id,
            details: JSON.stringify({
                ownerId,
                fromStatus,
                toStatus: status,
                reason: reason || null,
            }),
        },
    });
    return { rsvp: updatedRsvp, invitation, transitioned: true };
};
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
                    giftOrders: true,
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
 * POST /api/owner-dashboard/events
 * Owner creates a new event (pending admin approval when FF is enabled)
 */
router.post('/events', (0, errorHandler_js_1.asyncHandler)(async (req, res) => {
    const ownerId = req.ownerId;
    const data = eventCreateSchema.parse(req.body || {});
    const approvalStatus = featureFlags_js_1.featureFlags.ownerEventApproval ? 'PENDING_REVIEW' : 'APPROVED';
    const approvalSubmittedAt = featureFlags_js_1.featureFlags.ownerEventApproval ? new Date() : null;
    const event = await prisma_js_1.default.event.create({
        data: {
            ownerId,
            name: data.name,
            slug: data.slug,
            description: data.description || null,
            date: data.date,
            endDate: data.endDate || null,
            timezone: data.timezone || 'UTC',
            venue: data.venue || null,
            ownerName: data.ownerName || null,
            ownerEmail: data.ownerEmail || null,
            ownerPhone: data.ownerPhone || null,
            organizationName: data.organizationName || null,
            defaultCurrency: data.defaultCurrency || 'USD',
            approvalStatus,
            approvalSubmittedAt,
            approvalReviewedAt: null,
            approvalReviewedByAdminId: null,
            approvalRejectionReason: null,
        },
    });
    await prisma_js_1.default.auditLog.create({
        data: {
            eventId: event.id,
            action: 'OWNER_EVENT_CREATED',
            entityType: 'EVENT',
            entityId: event.id,
            details: JSON.stringify({
                ownerId,
                approvalStatus: event.approvalStatus,
            }),
        },
    });
    if (featureFlags_js_1.featureFlags.ownerEventApproval) {
        const admins = await prisma_js_1.default.admin.findMany({
            select: { id: true },
        });
        for (const admin of admins) {
            await prisma_js_1.default.auditLog.create({
                data: {
                    adminId: admin.id,
                    eventId: event.id,
                    action: 'OWNER_EVENT_SUBMITTED_FOR_APPROVAL',
                    entityType: 'EVENT',
                    entityId: event.id,
                    details: JSON.stringify({
                        ownerId,
                    }),
                },
            });
        }
    }
    res.status(201).json({ event });
}));
/**
 * GET /api/owner-dashboard/events/check-slug?slug=xxx
 * Check if a slug is available
 */
router.get('/events/check-slug', (0, errorHandler_js_1.asyncHandler)(async (req, res) => {
    const slug = String(req.query.slug || '').trim().toLowerCase().replace(/[^a-z0-9-]/g, '');
    if (!slug || slug.length < 2) {
        return res.json({ available: false, slug, reason: 'Slug must be at least 2 characters' });
    }
    const existing = await prisma_js_1.default.event.findFirst({
        where: { slug },
        select: { id: true },
    });
    res.json({ available: !existing, slug });
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
                    giftOrders: true,
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
            domains: {
                orderBy: [{ isPrimary: 'desc' }, { createdAt: 'asc' }],
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
 * PATCH /api/owner-dashboard/events/:eventId
 * Edit owner event while pending/rejected (or anytime if approval feature disabled)
 */
router.patch('/events/:eventId', (0, errorHandler_js_1.asyncHandler)(async (req, res) => {
    const ownerId = req.ownerId;
    const { eventId } = req.params;
    const event = await prisma_js_1.default.event.findFirst({
        where: { id: eventId, ownerId },
        select: {
            id: true,
            approvalStatus: true,
        },
    });
    if (!event)
        throw new errorHandler_js_1.AppError('Event not found', 404);
    if (featureFlags_js_1.featureFlags.ownerEventApproval
        && event.approvalStatus === 'APPROVED') {
        throw new errorHandler_js_1.AppError('Approved events cannot be edited from owner quick edit', 400);
    }
    const payload = eventUpdateSchema.parse(req.body || {});
    const shouldResubmit = featureFlags_js_1.featureFlags.ownerEventApproval;
    const updated = await prisma_js_1.default.event.update({
        where: { id: event.id },
        data: {
            ...payload,
            approvalStatus: shouldResubmit ? 'PENDING_REVIEW' : event.approvalStatus,
            approvalSubmittedAt: shouldResubmit ? new Date() : undefined,
            approvalReviewedAt: shouldResubmit ? null : undefined,
            approvalReviewedByAdminId: shouldResubmit ? null : undefined,
            approvalRejectionReason: shouldResubmit ? null : undefined,
        },
    });
    await prisma_js_1.default.auditLog.create({
        data: {
            eventId: event.id,
            action: 'OWNER_EVENT_UPDATED',
            entityType: 'EVENT',
            entityId: event.id,
            details: JSON.stringify({
                ownerId,
                approvalStatus: updated.approvalStatus,
            }),
        },
    });
    res.json({ event: updated });
}));
/**
 * GET /api/owner-dashboard/events/:eventId/approval
 */
router.get('/events/:eventId/approval', (0, errorHandler_js_1.asyncHandler)(async (req, res) => {
    const ownerId = req.ownerId;
    const { eventId } = req.params;
    const event = await prisma_js_1.default.event.findFirst({
        where: { id: eventId, ownerId },
        select: {
            id: true,
            approvalStatus: true,
            approvalSubmittedAt: true,
            approvalReviewedAt: true,
            approvalRejectionReason: true,
            approvalReviewedByAdmin: {
                select: {
                    id: true,
                    name: true,
                    email: true,
                },
            },
            updatedAt: true,
        },
    });
    if (!event)
        throw new errorHandler_js_1.AppError('Event not found', 404);
    res.json({
        approval: {
            status: event.approvalStatus,
            submittedAt: event.approvalSubmittedAt,
            reviewedAt: event.approvalReviewedAt,
            rejectionReason: event.approvalRejectionReason,
            reviewedBy: event.approvalReviewedByAdmin,
            updatedAt: event.updatedAt,
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
                    giftOrders: true,
                },
            },
            transactions: {
                select: {
                    grossAmount: true,
                    netAmount: true,
                    currency: true,
                    status: true,
                    type: true,
                    paymentMethod: true,
                },
            },
            giftOrders: {
                select: {
                    totalAmount: true,
                    currency: true,
                    status: true,
                },
            },
        },
    });
    // Calculate totals
    const totalEvents = events.length;
    const totalRsvps = events.reduce((sum, e) => sum + e._count.rsvps, 0);
    const totalCheckIns = events.reduce((sum, e) => sum + e._count.checkIns, 0);
    const totalMedia = events.reduce((sum, e) => sum + e._count.mediaAssets, 0);
    const totalGiftOrders = events.reduce((sum, e) => sum + e._count.giftOrders, 0);
    // Calculate revenue
    const allTransactions = events.flatMap(e => e.transactions);
    const completedTransactions = allTransactions.filter((t) => t.status === 'completed' && ['ticket_sale', 'gift_cash'].includes(t.type));
    const revenueByCurrency = {};
    completedTransactions.forEach(t => {
        if (!revenueByCurrency[t.currency]) {
            revenueByCurrency[t.currency] = { gross: 0, net: 0 };
        }
        revenueByCurrency[t.currency].gross += t.grossAmount;
        revenueByCurrency[t.currency].net += t.netAmount;
    });
    const giftingByCurrency = {};
    allTransactions
        .filter((t) => t.status === 'completed' && t.type === 'gift_cash')
        .forEach((t) => {
        if (!giftingByCurrency[t.currency]) {
            giftingByCurrency[t.currency] = { gross: 0, net: 0, orders: 0 };
        }
        giftingByCurrency[t.currency].gross += t.grossAmount;
        giftingByCurrency[t.currency].net += t.netAmount;
        giftingByCurrency[t.currency].orders += 1;
    });
    const autoSettledCashByCurrency = {};
    allTransactions
        .filter((t) => t.status === 'completed'
        && t.type === 'gift_cash'
        && (t.paymentMethod || '').toLowerCase() === 'paystack')
        .forEach((t) => {
        if (!autoSettledCashByCurrency[t.currency]) {
            autoSettledCashByCurrency[t.currency] = { gross: 0, net: 0, orders: 0 };
        }
        autoSettledCashByCurrency[t.currency].gross += t.grossAmount;
        autoSettledCashByCurrency[t.currency].net += t.netAmount;
        autoSettledCashByCurrency[t.currency].orders += 1;
    });
    res.json({
        stats: {
            totalEvents,
            totalRsvps,
            totalCheckIns,
            totalMedia,
            totalGiftOrders,
            revenueByCurrency,
            giftingByCurrency,
            autoSettledCashByCurrency,
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
 * POST /api/owner-dashboard/events/:eventId/rsvps/:rsvpId/review
 * Owner review RSVP (approve/reject)
 */
router.post('/events/:eventId/rsvps/:rsvpId/review', (0, errorHandler_js_1.asyncHandler)(async (req, res) => {
    const ownerId = req.ownerId;
    const { eventId, rsvpId } = req.params;
    const status = String(req.body?.status || '').toUpperCase();
    if (!['APPROVED', 'REJECTED', 'PENDING'].includes(status)) {
        throw new errorHandler_js_1.AppError('Invalid status. Must be PENDING, APPROVED, or REJECTED', 400);
    }
    const transition = await transitionRsvpStatus({
        eventId,
        ownerId,
        rsvpId,
        status: status,
        reason: req.body?.reason ? String(req.body.reason) : undefined,
    });
    res.json({
        rsvp: transition.rsvp,
        invitation: transition.invitation,
        message: transition.transitioned
            ? `RSVP status updated to ${status}`
            : `RSVP already ${status}`,
    });
}));
/**
 * PATCH /api/owner-dashboard/events/:eventId/rsvps/:rsvpId/status
 * Reversible RSVP tri-state transitions with audit trail
 */
router.patch('/events/:eventId/rsvps/:rsvpId/status', (0, errorHandler_js_1.asyncHandler)(async (req, res) => {
    const ownerId = req.ownerId;
    const { eventId, rsvpId } = req.params;
    const input = rsvpStatusSchema.parse(req.body || {});
    const transition = await transitionRsvpStatus({
        eventId,
        ownerId,
        rsvpId,
        status: input.status,
        reason: input.reason,
    });
    res.json({
        rsvp: transition.rsvp,
        invitation: transition.invitation,
        transitioned: transition.transitioned,
    });
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
 * GET /api/owner-dashboard/events/:eventId/domains
 * Get custom domains for an owner event
 */
router.get('/events/:eventId/domains', (0, errorHandler_js_1.asyncHandler)(async (req, res) => {
    const ownerId = req.ownerId;
    const { eventId } = req.params;
    const event = await prisma_js_1.default.event.findFirst({
        where: { id: eventId, ownerId },
        select: { id: true },
    });
    if (!event)
        throw new errorHandler_js_1.AppError('Event not found', 404);
    const domains = await prisma_js_1.default.eventDomain.findMany({
        where: { eventId },
        orderBy: [{ isPrimary: 'desc' }, { createdAt: 'asc' }],
    });
    const reconciledDomains = await Promise.all(domains.map(async (domain) => {
        if (domain.status !== 'VERIFIED')
            return domain;
        const hosting = await (0, customDomainHosting_js_1.checkCustomDomainOnNetlify)(domain.host);
        if (!hosting.configured)
            return domain;
        return prisma_js_1.default.eventDomain.update({
            where: { id: domain.id },
            data: { status: 'ACTIVE', verificationNotes: null },
        });
    }));
    res.json({
        domains: reconciledDomains,
        dnsTarget: process.env.DOMAIN_CNAME_TARGET || 'cname.eventpeepo.com',
        apexTarget: process.env.DOMAIN_APEX_IP || '75.2.60.5',
    });
}));
/**
 * POST /api/owner-dashboard/events/:eventId/domains
 * Add custom domain for owner event
 */
router.post('/events/:eventId/domains', (0, errorHandler_js_1.asyncHandler)(async (req, res) => {
    const ownerId = req.ownerId;
    const { eventId } = req.params;
    const host = normalizeDomainHost(String(req.body?.host || ''));
    const isPrimary = Boolean(req.body?.isPrimary);
    if (!isValidDomainHost(host)) {
        throw new errorHandler_js_1.AppError('Please provide a valid domain host', 400);
    }
    const event = await prisma_js_1.default.event.findFirst({
        where: { id: eventId, ownerId },
        select: { id: true },
    });
    if (!event)
        throw new errorHandler_js_1.AppError('Event not found', 404);
    const existing = await prisma_js_1.default.eventDomain.findUnique({ where: { host } });
    if (existing)
        throw new errorHandler_js_1.AppError('Domain is already connected to another event', 400);
    if (isPrimary) {
        await prisma_js_1.default.eventDomain.updateMany({ where: { eventId }, data: { isPrimary: false } });
    }
    const domain = await prisma_js_1.default.eventDomain.create({
        data: {
            eventId,
            host,
            isPrimary,
            verificationToken: (0, crypto_1.randomBytes)(16).toString('hex'),
            status: 'PENDING_VERIFICATION',
        },
    });
    await prisma_js_1.default.auditLog.create({
        data: {
            eventId,
            action: 'EVENT_DOMAIN_ADDED_BY_OWNER',
            entityType: 'EVENT_DOMAIN',
            entityId: domain.id,
            details: JSON.stringify({ ownerId, host }),
        },
    });
    res.status(201).json({
        domain,
        verification: {
            txtName: `_eventpeepo.${host}`,
            txtHost: '_eventpeepo',
            txtValue: domain.verificationToken,
            cnameName: `www.${host}`,
            cnameHost: 'www',
            cnameValue: process.env.DOMAIN_CNAME_TARGET || 'cname.eventpeepo.com',
            apexName: host,
            apexHost: '@',
            apexValue: process.env.DOMAIN_APEX_IP || '75.2.60.5',
        },
    });
}));
/**
 * POST /api/owner-dashboard/events/:eventId/domains/:domainId/verify
 * Verify domain DNS
 */
router.post('/events/:eventId/domains/:domainId/verify', (0, errorHandler_js_1.asyncHandler)(async (req, res) => {
    const ownerId = req.ownerId;
    const { eventId, domainId } = req.params;
    const cnameTarget = (process.env.DOMAIN_CNAME_TARGET || 'cname.eventpeepo.com').toLowerCase();
    const apexTarget = process.env.DOMAIN_APEX_IP || '75.2.60.5';
    const event = await prisma_js_1.default.event.findFirst({
        where: { id: eventId, ownerId },
        select: { id: true },
    });
    if (!event)
        throw new errorHandler_js_1.AppError('Event not found', 404);
    const domain = await prisma_js_1.default.eventDomain.findFirst({
        where: { id: domainId, eventId },
    });
    if (!domain)
        throw new errorHandler_js_1.AppError('Domain not found', 404);
    const dnsVerification = await (0, customDomainDns_js_1.verifyCustomDomainDns)(domain.host, domain.verificationToken, cnameTarget, apexTarget);
    const verified = dnsVerification.verified;
    const hosting = verified
        ? await (0, customDomainHosting_js_1.provisionCustomDomainOnNetlify)(domain.host)
        : null;
    const status = verified
        ? (hosting?.configured ? 'ACTIVE' : 'VERIFIED')
        : 'FAILED';
    const dnsNote = (0, customDomainDns_js_1.buildDomainVerificationNote)(dnsVerification);
    const verificationNotes = dnsNote || (hosting && !hosting.configured ? hosting.error || null : null);
    const updated = await prisma_js_1.default.eventDomain.update({
        where: { id: domain.id },
        data: {
            status,
            verificationNotes,
        },
    });
    await prisma_js_1.default.auditLog.create({
        data: {
            eventId,
            action: 'EVENT_DOMAIN_VERIFIED_BY_OWNER',
            entityType: 'EVENT_DOMAIN',
            entityId: domain.id,
            details: JSON.stringify({
                ownerId,
                host: domain.host,
                status,
                txtMatch: dnsVerification.txtMatch,
                cnameMatch: dnsVerification.cnameMatch,
                apexMatch: dnsVerification.apexMatch,
                hosting,
            }),
        },
    });
    res.json({
        domain: updated,
        verification: {
            ...dnsVerification,
            hosting,
        },
    });
}));
/**
 * PATCH /api/owner-dashboard/events/:eventId/domains/:domainId/primary
 */
router.patch('/events/:eventId/domains/:domainId/primary', (0, errorHandler_js_1.asyncHandler)(async (req, res) => {
    const ownerId = req.ownerId;
    const { eventId, domainId } = req.params;
    const event = await prisma_js_1.default.event.findFirst({
        where: { id: eventId, ownerId },
        select: { id: true },
    });
    if (!event)
        throw new errorHandler_js_1.AppError('Event not found', 404);
    const domain = await prisma_js_1.default.eventDomain.findFirst({
        where: { id: domainId, eventId },
    });
    if (!domain)
        throw new errorHandler_js_1.AppError('Domain not found', 404);
    if (domain.status !== 'ACTIVE') {
        throw new errorHandler_js_1.AppError('Only fully active HTTPS domains can be made primary', 400);
    }
    await prisma_js_1.default.eventDomain.updateMany({ where: { eventId }, data: { isPrimary: false } });
    const updated = await prisma_js_1.default.eventDomain.update({
        where: { id: domain.id },
        data: { isPrimary: true },
    });
    await prisma_js_1.default.auditLog.create({
        data: {
            eventId,
            action: 'EVENT_DOMAIN_SET_PRIMARY_BY_OWNER',
            entityType: 'EVENT_DOMAIN',
            entityId: domain.id,
            details: JSON.stringify({ ownerId, host: domain.host }),
        },
    });
    res.json({ domain: updated });
}));
/**
 * DELETE /api/owner-dashboard/events/:eventId/domains/:domainId
 */
router.delete('/events/:eventId/domains/:domainId', (0, errorHandler_js_1.asyncHandler)(async (req, res) => {
    const ownerId = req.ownerId;
    const { eventId, domainId } = req.params;
    const event = await prisma_js_1.default.event.findFirst({
        where: { id: eventId, ownerId },
        select: { id: true },
    });
    if (!event)
        throw new errorHandler_js_1.AppError('Event not found', 404);
    const domain = await prisma_js_1.default.eventDomain.findFirst({
        where: { id: domainId, eventId },
    });
    if (!domain)
        throw new errorHandler_js_1.AppError('Domain not found', 404);
    let hostingCleanup = null;
    if ((0, customDomainHosting_js_1.isNetlifyDomainAutomationConfigured)()) {
        hostingCleanup = await (0, customDomainHosting_js_1.removeCustomDomainFromNetlify)(domain.host);
        if (!hostingCleanup.aliasesRemoved) {
            throw new errorHandler_js_1.AppError(hostingCleanup.error || 'Failed to remove domain from Netlify', 502);
        }
    }
    else if (['VERIFIED', 'ACTIVE'].includes(domain.status)) {
        throw new errorHandler_js_1.AppError('Netlify cleanup is not configured. Configure NETLIFY_SITE_ID and NETLIFY_AUTH_TOKEN before removing this hosted domain.', 503);
    }
    await prisma_js_1.default.eventDomain.delete({ where: { id: domain.id } });
    if (domain.isPrimary) {
        const fallback = await prisma_js_1.default.eventDomain.findFirst({
            where: { eventId, status: 'ACTIVE' },
            orderBy: { createdAt: 'asc' },
        });
        if (fallback) {
            await prisma_js_1.default.eventDomain.update({
                where: { id: fallback.id },
                data: { isPrimary: true },
            });
        }
    }
    await prisma_js_1.default.auditLog.create({
        data: {
            eventId,
            action: 'EVENT_DOMAIN_DELETED_BY_OWNER',
            entityType: 'EVENT_DOMAIN',
            entityId: domain.id,
            details: JSON.stringify({ ownerId, host: domain.host, hostingCleanup }),
        },
    });
    res.json({ message: 'Domain removed successfully', hostingCleanup });
}));
/**
 * GET /api/owner-dashboard/events/:eventId/rsvp-invites
 * List RSVP invite statuses
 */
router.get('/events/:eventId/rsvp-invites', (0, errorHandler_js_1.asyncHandler)(async (req, res) => {
    const ownerId = req.ownerId;
    const { eventId } = req.params;
    const event = await prisma_js_1.default.event.findFirst({
        where: { id: eventId, ownerId },
        select: { id: true },
    });
    if (!event)
        throw new errorHandler_js_1.AppError('Event not found', 404);
    const invites = await prisma_js_1.default.rsvpInvite.findMany({
        where: { eventId },
        include: {
            rsvp: {
                select: {
                    id: true,
                    attendance: true,
                    status: true,
                    guestCount: true,
                },
            },
        },
        orderBy: { createdAt: 'desc' },
    });
    res.json({ invites });
}));
const buildInviteValidation = (invitesInput, channel = 'whatsapp') => {
    const rows = [];
    const seen = new Set();
    const channels = parseInviteChannels(channel);
    const needsPhone = channels.includes('whatsapp') || channels.includes('sms');
    const needsEmail = channels.includes('email');
    invitesInput.forEach((invite, index) => {
        const normalizedPhone = normalizePhone(invite.phone);
        const normalizedEmail = invite.email ? normalizeEmail(invite.email) : null;
        const key = `${normalizedPhone || ''}::${normalizedEmail || ''}`;
        const errors = [];
        if (needsPhone && !normalizedPhone)
            errors.push('Phone number is required');
        if (needsEmail && !normalizedEmail)
            errors.push('Email is required');
        if (normalizedPhone && normalizedPhone.replace(/[^\d]/g, '').length < 6) {
            errors.push('Phone number format is invalid');
        }
        if (invite.email && (!normalizedEmail || !isValidEmail(normalizedEmail))) {
            errors.push('Email format is invalid');
        }
        const duplicate = seen.has(key);
        if (!duplicate)
            seen.add(key);
        rows.push({
            index,
            name: invite.name ? String(invite.name).trim() : null,
            phone: String(invite.phone || '').trim(),
            email: invite.email ? String(invite.email).trim() : null,
            valid: errors.length === 0 && !duplicate,
            errors,
            duplicate,
            normalizedPhone,
            normalizedEmail,
        });
    });
    return rows;
};
/**
 * POST /api/owner-dashboard/events/:eventId/rsvp-invites/validate
 * Validate invite payload and return dedupe preview
 */
router.post('/events/:eventId/rsvp-invites/validate', (0, errorHandler_js_1.asyncHandler)(async (req, res) => {
    const ownerId = req.ownerId;
    const { eventId } = req.params;
    const input = inviteValidateSchema.parse(req.body || {});
    const event = await prisma_js_1.default.event.findFirst({
        where: { id: eventId, ownerId },
        select: { id: true },
    });
    if (!event)
        throw new errorHandler_js_1.AppError('Event not found', 404);
    const rows = buildInviteValidation(input.invites, input.channel);
    const summary = rows.reduce((acc, row) => {
        if (row.valid)
            acc.valid += 1;
        if (!row.valid && row.errors.length)
            acc.invalid += 1;
        if (row.duplicate)
            acc.duplicates += 1;
        return acc;
    }, { total: rows.length, valid: 0, invalid: 0, duplicates: 0 });
    res.json({ summary, rows });
}));
/**
 * POST /api/owner-dashboard/events/:eventId/rsvp-invites/batch
 * Create and send invite batch
 */
router.post('/events/:eventId/rsvp-invites/batch', (0, errorHandler_js_1.asyncHandler)(async (req, res) => {
    const ownerId = req.ownerId;
    const { eventId } = req.params;
    const validateInput = inviteValidateSchema.parse(req.body || {});
    const invitesInput = validateInput.invites;
    const channel = validateInput.channel || 'whatsapp';
    const expiresInHours = Number(req.body?.expiresInHours || 240);
    if (!invitesInput.length) {
        throw new errorHandler_js_1.AppError('invites must be a non-empty array', 400);
    }
    const event = await prisma_js_1.default.event.findFirst({
        where: { id: eventId, ownerId },
        select: {
            id: true,
            name: true,
            slug: true,
        },
    });
    if (!event)
        throw new errorHandler_js_1.AppError('Event not found', 404);
    const channels = parseInviteChannels(channel);
    const sendViaWhatsApp = channels.includes('whatsapp');
    const sendViaSms = channels.includes('sms');
    const sendViaEmail = channels.includes('email');
    const storedChannel = channels.join(',');
    const created = [];
    const failed = [];
    const skipped = [];
    const rows = buildInviteValidation(invitesInput, channel);
    for (const row of rows) {
        if (!row.valid) {
            skipped.push({
                index: row.index,
                phone: row.phone || row.email || '',
                reason: row.duplicate ? 'Duplicate invite in batch' : row.errors.join(', ') || 'Invalid invite',
            });
            continue;
        }
        const inviteePhone = row.phone || null;
        const inviteeName = row.name;
        const inviteeEmail = row.email;
        // Check for existing invite by phone or email
        const existsWhere = { eventId, status: { in: ['SENT', 'OPENED', 'RESPONDED'] } };
        if (inviteePhone) {
            existsWhere.inviteePhone = inviteePhone;
        }
        else if (inviteeEmail) {
            existsWhere.inviteeEmail = inviteeEmail;
        }
        const exists = await prisma_js_1.default.rsvpInvite.findFirst({
            where: existsWhere,
            select: { id: true },
        });
        if (exists) {
            skipped.push({
                index: row.index,
                phone: inviteePhone || inviteeEmail || '',
                reason: 'Invite already exists for this contact',
            });
            continue;
        }
        const token = (0, crypto_1.randomBytes)(20).toString('hex');
        const expiresAt = new Date(Date.now() + Math.max(expiresInHours, 1) * 60 * 60 * 1000);
        const invite = await prisma_js_1.default.rsvpInvite.create({
            data: {
                eventId,
                token,
                inviteeName,
                inviteePhone,
                inviteeEmail,
                channel: storedChannel,
                expiresAt,
                status: 'SENT',
                sentByOwnerId: ownerId,
            },
        });
        const inviteUrl = getInvitePublicUrl(invite.token);
        const deliveryErrors = [];
        try {
            if (sendViaWhatsApp && inviteePhone) {
                const waDelivery = await (0, notifications_js_1.sendWhatsAppRsvpInvite)(inviteePhone, {
                    eventName: event.name,
                    inviteUrl,
                    token: invite.token,
                });
                if (!waDelivery.success) {
                    deliveryErrors.push(('error' in waDelivery && waDelivery.error) ? waDelivery.error : 'WhatsApp send failed');
                }
            }
            if (sendViaSms && inviteePhone) {
                const smsDelivery = await (0, notifications_js_1.sendSmsRsvpInvite)(inviteePhone, {
                    eventName: event.name,
                    inviteUrl,
                    token: invite.token,
                    inviteeName: inviteeName || undefined,
                });
                if (!smsDelivery.success) {
                    deliveryErrors.push(smsDelivery.error || 'SMS send failed');
                }
            }
            if (sendViaEmail && inviteeEmail) {
                const emailDelivery = await (0, notifications_js_1.sendEmailRsvpInvite)(inviteeEmail, {
                    eventName: event.name,
                    inviteUrl,
                    token: invite.token,
                    inviteeName: inviteeName || undefined,
                });
                if (!emailDelivery.success) {
                    deliveryErrors.push(emailDelivery.error || 'Email send failed');
                }
            }
            // Only a total failure counts: one channel getting through is a success.
            const attemptedChannels = (sendViaWhatsApp && inviteePhone ? 1 : 0)
                + (sendViaSms && inviteePhone ? 1 : 0)
                + (sendViaEmail && inviteeEmail ? 1 : 0);
            if (deliveryErrors.length > 0 && deliveryErrors.length >= attemptedChannels) {
                failed.push({
                    index: row.index,
                    phone: inviteePhone || inviteeEmail || '',
                    reason: deliveryErrors.join('; '),
                });
                continue;
            }
            created.push(invite);
        }
        catch (error) {
            failed.push({
                index: row.index,
                phone: inviteePhone || inviteeEmail || '',
                reason: error?.message || 'Failed to send invite',
            });
        }
    }
    await prisma_js_1.default.auditLog.create({
        data: {
            eventId,
            action: 'RSVP_INVITE_BATCH_SENT_BY_OWNER',
            entityType: 'RSVP_INVITE',
            details: JSON.stringify({
                ownerId,
                sentCount: created.length,
                failedCount: failed.length,
                skippedCount: skipped.length,
            }),
        },
    });
    res.status(201).json({
        message: 'Invite batch processed',
        totalCount: rows.length,
        sentCount: created.length,
        failedCount: failed.length,
        skippedCount: skipped.length,
        invites: created,
        failed,
        skipped,
    });
}));
/**
 * POST /api/owner-dashboard/events/:eventId/rsvp-invites/:inviteId/resend
 * Resend a single invite
 */
router.post('/events/:eventId/rsvp-invites/:inviteId/resend', (0, errorHandler_js_1.asyncHandler)(async (req, res) => {
    const ownerId = req.ownerId;
    const { eventId, inviteId } = req.params;
    const event = await prisma_js_1.default.event.findFirst({
        where: { id: eventId, ownerId },
        select: { id: true, name: true },
    });
    if (!event)
        throw new errorHandler_js_1.AppError('Event not found', 404);
    const invite = await prisma_js_1.default.rsvpInvite.findFirst({
        where: { id: inviteId, eventId },
    });
    if (!invite)
        throw new errorHandler_js_1.AppError('Invite not found', 404);
    const inviteUrl = getInvitePublicUrl(invite.token);
    const resendChannels = parseInviteChannels(invite.channel);
    let delivered = false;
    let lastError = '';
    if (resendChannels.includes('whatsapp') && invite.inviteePhone) {
        const waDelivery = await (0, notifications_js_1.sendWhatsAppRsvpInvite)(invite.inviteePhone, {
            eventName: event.name,
            inviteUrl,
            token: invite.token,
            reminder: true,
        });
        if (waDelivery.success)
            delivered = true;
        else
            lastError = ('error' in waDelivery && waDelivery.error) ? waDelivery.error : 'WhatsApp send failed';
    }
    if (resendChannels.includes('sms') && invite.inviteePhone) {
        const smsDelivery = await (0, notifications_js_1.sendSmsRsvpInvite)(invite.inviteePhone, {
            eventName: event.name,
            inviteUrl,
            token: invite.token,
            reminder: true,
            inviteeName: invite.inviteeName || undefined,
        });
        if (smsDelivery.success)
            delivered = true;
        else
            lastError = smsDelivery.error || 'SMS send failed';
    }
    if (resendChannels.includes('email') && invite.inviteeEmail) {
        const emailDelivery = await (0, notifications_js_1.sendEmailRsvpInvite)(invite.inviteeEmail, {
            eventName: event.name,
            inviteUrl,
            token: invite.token,
            reminder: true,
            inviteeName: invite.inviteeName || undefined,
        });
        if (emailDelivery.success)
            delivered = true;
        else
            lastError = emailDelivery.error || 'Email send failed';
    }
    if (!delivered) {
        throw new errorHandler_js_1.AppError(lastError || 'Failed to resend invite', 500);
    }
    const updated = await prisma_js_1.default.rsvpInvite.update({
        where: { id: invite.id },
        data: {
            status: 'SENT',
            updatedAt: new Date(),
        },
    });
    await prisma_js_1.default.auditLog.create({
        data: {
            eventId,
            action: 'RSVP_INVITE_RESENT_BY_OWNER',
            entityType: 'RSVP_INVITE',
            entityId: invite.id,
            details: JSON.stringify({ ownerId, inviteePhone: invite.inviteePhone }),
        },
    });
    res.json({ invite: updated, message: 'Invite resent successfully' });
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
 * GET /api/owner-dashboard/events/:eventId/gift-orders
 * Get gift orders for a specific event
 */
router.get('/events/:eventId/gift-orders', (0, errorHandler_js_1.asyncHandler)(async (req, res) => {
    const ownerId = req.ownerId;
    const { eventId } = req.params;
    const event = await prisma_js_1.default.event.findFirst({
        where: { id: eventId, ownerId },
        select: { id: true },
    });
    if (!event) {
        throw new errorHandler_js_1.AppError('Event not found', 404);
    }
    const orders = await prisma_js_1.default.giftOrder.findMany({
        where: { eventId },
        include: {
            items: {
                include: {
                    giftPackage: {
                        select: { id: true, name: true },
                    },
                },
            },
        },
        orderBy: { createdAt: 'desc' },
    });
    const paymentRefs = orders
        .map((order) => order.paymentReference)
        .filter((ref) => Boolean(ref));
    const transactions = paymentRefs.length
        ? await prisma_js_1.default.transactionLegacy.findMany({
            where: {
                eventId,
                paymentRef: { in: paymentRefs },
                status: 'completed',
                type: { in: ['gift_cash', 'gift_package_sale'] },
            },
            select: {
                paymentRef: true,
                type: true,
                grossAmount: true,
                platformFee: true,
                netAmount: true,
            },
        })
        : [];
    const txByRef = new Map();
    transactions.forEach((tx) => {
        if (!tx.paymentRef)
            return;
        const current = txByRef.get(tx.paymentRef) || [];
        current.push(tx);
        txByRef.set(tx.paymentRef, current);
    });
    const ordersWithEarnings = orders.map((order) => {
        const txs = order.paymentReference ? txByRef.get(order.paymentReference) || [] : [];
        const ownerNetAmount = txs
            .filter((tx) => tx.type === 'gift_cash')
            .reduce((sum, tx) => sum + tx.netAmount, 0);
        const platformFeeAmount = txs
            .filter((tx) => tx.type === 'gift_cash')
            .reduce((sum, tx) => sum + tx.platformFee, 0);
        const packageAmount = txs
            .filter((tx) => tx.type === 'gift_package_sale')
            .reduce((sum, tx) => sum + tx.grossAmount, 0);
        return {
            ...order,
            ownerNetAmount,
            platformFeeAmount,
            packageAmount,
        };
    });
    res.json({ orders: ordersWithEarnings });
}));
/**
 * GET /api/owner-dashboard/notification-preferences
 */
router.get('/notification-preferences', (0, errorHandler_js_1.asyncHandler)(async (req, res) => {
    const ownerId = req.ownerId;
    const preference = await (0, ownerNotifications_js_1.getOrCreateOwnerNotificationPreference)(ownerId);
    res.json({ preferences: preference });
}));
/**
 * PATCH /api/owner-dashboard/notification-preferences
 */
router.patch('/notification-preferences', (0, errorHandler_js_1.asyncHandler)(async (req, res) => {
    const ownerId = req.ownerId;
    const input = zod_1.z
        .object({
        notificationsEnabled: zod_1.z.boolean().optional(),
        marketingEnabled: zod_1.z.boolean().optional(),
        emailEnabled: zod_1.z.boolean().optional(),
        smsEnabled: zod_1.z.boolean().optional(),
        pushEnabled: zod_1.z.boolean().optional(),
        notifyRsvp: zod_1.z.boolean().optional(),
        notifyCheckIn: zod_1.z.boolean().optional(),
        notifyGift: zod_1.z.boolean().optional(),
        notifyTicketSold: zod_1.z.boolean().optional(),
        notifyMarketing: zod_1.z.boolean().optional(),
        soundEnabled: zod_1.z.boolean().optional(),
        hapticsEnabled: zod_1.z.boolean().optional(),
    })
        .parse(req.body || {});
    const preferences = await (0, ownerNotifications_js_1.updateOwnerNotificationPreference)(ownerId, input);
    res.json({ preferences });
}));
/**
 * POST /api/owner-dashboard/devices/register
 */
router.post('/devices/register', (0, errorHandler_js_1.asyncHandler)(async (req, res) => {
    const ownerId = req.ownerId;
    const input = zod_1.z
        .object({
        platform: zod_1.z.string().min(2),
        oneSignalPlayerId: zod_1.z.string().optional(),
        appVersion: zod_1.z.string().optional(),
        deviceModel: zod_1.z.string().optional(),
        osVersion: zod_1.z.string().optional(),
    })
        .parse(req.body || {});
    const device = await (0, ownerNotifications_js_1.registerOwnerDevice)(ownerId, input);
    res.status(201).json({ device });
}));
/**
 * POST /api/owner-dashboard/devices/unregister
 */
router.post('/devices/unregister', (0, errorHandler_js_1.asyncHandler)(async (req, res) => {
    const ownerId = req.ownerId;
    const input = zod_1.z
        .object({
        oneSignalPlayerId: zod_1.z.string().optional(),
    })
        .parse(req.body || {});
    await (0, ownerNotifications_js_1.unregisterOwnerDevice)(ownerId, input.oneSignalPlayerId);
    res.json({ message: 'Device unregistered' });
}));
/**
 * GET /api/owner-dashboard/notifications
 */
router.get('/notifications', (0, errorHandler_js_1.asyncHandler)(async (req, res) => {
    const ownerId = req.ownerId;
    const page = Math.max(1, Number(req.query.page || 1));
    const limit = Math.min(100, Math.max(1, Number(req.query.limit || 30)));
    const [notifications, total, unread] = await Promise.all([
        prisma_js_1.default.ownerNotification.findMany({
            where: { ownerId },
            orderBy: { createdAt: 'desc' },
            skip: (page - 1) * limit,
            take: limit,
        }),
        prisma_js_1.default.ownerNotification.count({ where: { ownerId } }),
        prisma_js_1.default.ownerNotification.count({ where: { ownerId, isRead: false } }),
    ]);
    res.json({
        notifications,
        unreadCount: unread,
        pagination: {
            page,
            limit,
            total,
        },
    });
}));
/**
 * PATCH /api/owner-dashboard/notifications/:id/read
 */
router.patch('/notifications/:id/read', (0, errorHandler_js_1.asyncHandler)(async (req, res) => {
    const ownerId = req.ownerId;
    const id = req.params.id;
    const notification = await prisma_js_1.default.ownerNotification.findFirst({
        where: { id, ownerId },
    });
    if (!notification)
        throw new errorHandler_js_1.AppError('Notification not found', 404);
    const updated = await prisma_js_1.default.ownerNotification.update({
        where: { id },
        data: {
            isRead: true,
            readAt: new Date(),
        },
    });
    res.json({ notification: updated });
}));
/**
 * GET /api/owner-dashboard/support-content
 */
router.get('/support-content', (0, errorHandler_js_1.asyncHandler)(async (_req, res) => {
    const settings = await prisma_js_1.default.systemSettings.findUnique({
        where: { id: 'default' },
        select: {
            supportEmail: true,
            supportWhatsAppNumber: true,
            faqContentJson: true,
        },
    });
    let faq = [];
    if (settings?.faqContentJson) {
        try {
            const parsed = JSON.parse(settings.faqContentJson);
            if (Array.isArray(parsed)) {
                faq = parsed
                    .map((item) => ({
                    question: String(item?.question || ''),
                    answer: String(item?.answer || ''),
                }))
                    .filter((item) => item.question && item.answer);
            }
        }
        catch {
            faq = [];
        }
    }
    res.json({
        supportEmail: settings?.supportEmail || null,
        supportWhatsAppNumber: settings?.supportWhatsAppNumber || null,
        faq,
    });
}));
const resolveLegacyPreferredMethod = (walletType) => {
    if (walletType === 'stripe')
        return 'stripe';
    if (walletType === 'paypal')
        return 'paypal';
    if (walletType === 'paystack')
        return 'paystack';
    return 'bank';
};
const buildLegacyWallet = (ownerWallet, ownerPayoutWallets) => {
    const state = (0, walletPolicy_js_1.resolveOwnerWalletState)(ownerPayoutWallets);
    const preferred = state.manualWallet ||
        state.verifiedAutomatedWallets[0] ||
        state.automatedWallets[0] ||
        null;
    if (!preferred && !ownerWallet)
        return null;
    return {
        ...(ownerWallet || {}),
        preferredMethod: preferred
            ? resolveLegacyPreferredMethod((0, walletPolicy_js_1.normalizeWalletType)(preferred.walletType))
            : ownerWallet?.preferredMethod || 'bank',
        currency: preferred?.currency || ownerWallet?.currency || 'USD',
        isVerified: typeof preferred?.isVerified === 'boolean' ? preferred.isVerified : Boolean(ownerWallet?.isVerified),
        paystackSubaccount: preferred?.paystackSubaccount || ownerWallet?.paystackSubaccount || null,
        paystackRecipientCode: preferred?.paystackRecipientCode || ownerWallet?.paystackRecipientCode || null,
    };
};
/**
 * GET /api/owner-dashboard/wallet
 * Get wallet configuration for the logged-in owner
 */
router.get('/wallet', (0, errorHandler_js_1.asyncHandler)(async (req, res) => {
    const ownerId = req.ownerId;
    const [owner, gateways, manualTransactions, manualPayouts] = await Promise.all([
        prisma_js_1.default.owner.findUnique({
            where: { id: ownerId },
            include: { wallet: true, wallets: true },
        }),
        prisma_js_1.default.paymentGateway.findMany({
            where: { isActive: true },
            select: {
                gateway: true,
                stripePublicKey: true,
                stripeSecretKey: true,
                paystackPublicKey: true,
                paystackSecretKey: true,
                flutterwavePublicKey: true,
                flutterwaveSecretKey: true,
                customGatewayApiKey: true,
                customGatewayApiSecret: true,
                customGatewayApiUrl: true,
                mtnMomoApiKey: true,
                mtnMomoApiSecret: true,
                mtnMomoSubscriptionKey: true,
                telecelCashApiKey: true,
                telecelCashApiSecret: true,
                telecelCashMerchantId: true,
                airteltigoCashApiKey: true,
                airteltigoCashApiSecret: true,
                airteltigoCashMerchantId: true,
            },
        }),
        prisma_js_1.default.transactionLegacy.aggregate({
            where: {
                event: { ownerId },
                status: 'completed',
                payoutRouting: 'ADMIN_MANUAL',
            },
            _sum: {
                grossAmount: true,
                netAmount: true,
            },
            _count: {
                _all: true,
            },
        }),
        prisma_js_1.default.payoutRequest.aggregate({
            where: {
                event: { ownerId },
                status: { in: ['PROCESSING', 'FULFILLED'] },
            },
            _sum: {
                requestedAmount: true,
            },
        }),
    ]);
    if (!owner) {
        throw new errorHandler_js_1.AppError('Owner not found', 404);
    }
    const walletState = (0, walletPolicy_js_1.resolveOwnerWalletState)(owner.wallets);
    const paystackWallet = walletState.walletByType.get('paystack');
    const owed = Number(manualTransactions._sum.netAmount || 0);
    const settled = Number(manualPayouts._sum.requestedAmount || 0);
    const outstanding = Math.max(0, owed - settled);
    res.json({
        countryCode: owner.countryCode || null,
        walletMode: walletState.mode,
        availableWalletTypes: (0, walletPolicy_js_1.getAvailableWalletTypes)({
            paymentGateways: gateways,
            countryCode: owner.countryCode,
        }),
        wallets: owner.wallets || [],
        wallet: buildLegacyWallet(owner.wallet, owner.wallets),
        paystackAutomationReady: Boolean(paystackWallet?.paystackSubaccount && paystackWallet?.paystackRecipientCode),
        manualSettlement: {
            transactionCount: manualTransactions._count._all || 0,
            amountReceived: Number(manualTransactions._sum.grossAmount || 0),
            amountOwed: owed,
            amountSettled: settled,
            outstandingBalance: outstanding,
        },
    });
}));
/**
 * POST /api/owner-dashboard/wallet
 * Add/update owner payout wallet (manual/offline/automated)
 */
router.post('/wallet', (0, errorHandler_js_1.asyncHandler)(async (req, res) => {
    const ownerId = req.ownerId;
    const owner = await prisma_js_1.default.owner.findUnique({
        where: { id: ownerId },
        include: { wallet: true, wallets: true },
    });
    if (!owner)
        throw new errorHandler_js_1.AppError('Owner not found', 404);
    const walletSchema = zod_1.z.object({
        walletId: zod_1.z.string().uuid().optional(),
        walletType: zod_1.z.enum(['manual', 'offline', 'stripe', 'paypal', 'paystack', 'flutterwave']).optional(),
        preferredMethod: zod_1.z.enum(['bank', 'mobile', 'paypal', 'stripe', 'paystack']).optional(),
        label: zod_1.z.string().max(120).optional(),
        currency: zod_1.z.string().trim().regex(/^[A-Za-z]{3}$/).transform((v) => v.toUpperCase()).optional(),
        countryCode: zod_1.z.string().trim().regex(/^[A-Za-z]{2}$/).transform((v) => v.toUpperCase()).optional(),
        providerAccountId: zod_1.z.string().optional(),
        paystackSubaccount: zod_1.z.string().optional(),
        paystackRecipientCode: zod_1.z.string().optional(),
        paypalEmail: zod_1.z.string().email().optional(),
        stripeAccountId: zod_1.z.string().optional(),
        bankName: zod_1.z.string().optional(),
        accountName: zod_1.z.string().optional(),
        accountNumber: zod_1.z.string().optional(),
        routingNumber: zod_1.z.string().optional(),
        swiftCode: zod_1.z.string().optional(),
        mobileProvider: zod_1.z.string().optional(),
        mobileNumber: zod_1.z.string().optional(),
        detailsJson: zod_1.z.string().optional(),
        isVerified: zod_1.z.boolean().optional(),
        isActive: zod_1.z.boolean().optional(),
    });
    const input = walletSchema.parse(req.body || {});
    const legacyWalletType = input.preferredMethod
        ? (input.preferredMethod === 'paypal' || input.preferredMethod === 'stripe' || input.preferredMethod === 'paystack'
            ? input.preferredMethod
            : 'manual')
        : undefined;
    const walletType = (0, walletPolicy_js_1.normalizeWalletType)(input.walletType || legacyWalletType || '');
    if (!walletType) {
        throw new errorHandler_js_1.AppError('walletType or preferredMethod is required', 400);
    }
    const nextCountryCode = input.countryCode || owner.countryCode || 'US';
    const gateways = await prisma_js_1.default.paymentGateway.findMany({
        where: { isActive: true },
        select: {
            gateway: true,
            stripePublicKey: true,
            stripeSecretKey: true,
            paystackPublicKey: true,
            paystackSecretKey: true,
            flutterwavePublicKey: true,
            flutterwaveSecretKey: true,
            customGatewayApiKey: true,
            customGatewayApiSecret: true,
            customGatewayApiUrl: true,
            mtnMomoApiKey: true,
            mtnMomoApiSecret: true,
            mtnMomoSubscriptionKey: true,
            telecelCashApiKey: true,
            telecelCashApiSecret: true,
            telecelCashMerchantId: true,
            airteltigoCashApiKey: true,
            airteltigoCashApiSecret: true,
            airteltigoCashMerchantId: true,
        },
    });
    const availableWalletTypes = (0, walletPolicy_js_1.getAvailableWalletTypes)({
        paymentGateways: gateways,
        countryCode: nextCountryCode,
    });
    if (!(0, walletPolicy_js_1.isManualWalletType)(walletType) && !availableWalletTypes.includes(walletType)) {
        throw new errorHandler_js_1.AppError(`Wallet type "${walletType}" is not available in ${nextCountryCode}`, 400);
    }
    const activeWallets = owner.wallets.filter((wallet) => wallet.isActive);
    const activeManualWallet = activeWallets.find((wallet) => (0, walletPolicy_js_1.isManualWalletType)(wallet.walletType));
    const activeAutomatedWallets = activeWallets.filter((wallet) => !(0, walletPolicy_js_1.isManualWalletType)(wallet.walletType));
    const isEditingCurrentManual = Boolean(input.walletId && activeManualWallet?.id === input.walletId);
    if ((0, walletPolicy_js_1.isManualWalletType)(walletType) && activeAutomatedWallets.length > 0) {
        throw new errorHandler_js_1.AppError('Manual/offline wallet cannot be enabled while automated wallets are active', 400);
    }
    if (!(0, walletPolicy_js_1.isManualWalletType)(walletType) && activeManualWallet && !isEditingCurrentManual) {
        throw new errorHandler_js_1.AppError('Disable manual/offline wallet before adding automated wallets', 400);
    }
    let details = {};
    if (input.detailsJson) {
        try {
            details = JSON.parse(input.detailsJson);
        }
        catch {
            throw new errorHandler_js_1.AppError('detailsJson must be valid JSON', 400);
        }
    }
    if (input.paypalEmail)
        details.paypalEmail = input.paypalEmail;
    if (input.stripeAccountId)
        details.stripeAccountId = input.stripeAccountId;
    if (input.bankName)
        details.bankName = input.bankName;
    if (input.accountName)
        details.accountName = input.accountName;
    if (input.accountNumber)
        details.accountNumber = input.accountNumber;
    if (input.routingNumber)
        details.routingNumber = input.routingNumber;
    if (input.swiftCode)
        details.swiftCode = input.swiftCode;
    if (input.mobileProvider)
        details.mobileProvider = input.mobileProvider;
    if (input.mobileNumber)
        details.mobileNumber = input.mobileNumber;
    const defaultCurrency = input.currency || owner.wallet?.currency || 'USD';
    let walletRecord;
    if (input.walletId) {
        const existing = await prisma_js_1.default.ownerPayoutWallet.findFirst({
            where: { id: input.walletId, ownerId },
        });
        if (!existing)
            throw new errorHandler_js_1.AppError('Wallet not found', 404);
        walletRecord = await prisma_js_1.default.ownerPayoutWallet.update({
            where: { id: existing.id },
            data: {
                walletType,
                label: input.label ?? undefined,
                currency: defaultCurrency,
                countryCode: nextCountryCode,
                providerAccountId: input.providerAccountId ?? undefined,
                paystackSubaccount: input.paystackSubaccount ?? undefined,
                paystackRecipientCode: input.paystackRecipientCode ?? undefined,
                detailsJson: Object.keys(details).length > 0 ? JSON.stringify(details) : undefined,
                isVerified: input.isVerified ?? undefined,
                isActive: input.isActive ?? true,
                verifiedAt: input.isVerified === true ? new Date() : undefined,
            },
        });
    }
    else if ((0, walletPolicy_js_1.isManualWalletType)(walletType) && activeManualWallet) {
        walletRecord = await prisma_js_1.default.ownerPayoutWallet.update({
            where: { id: activeManualWallet.id },
            data: {
                walletType,
                label: input.label ?? undefined,
                currency: defaultCurrency,
                countryCode: nextCountryCode,
                detailsJson: Object.keys(details).length > 0 ? JSON.stringify(details) : undefined,
                isActive: input.isActive ?? true,
            },
        });
    }
    else {
        walletRecord = await prisma_js_1.default.ownerPayoutWallet.create({
            data: {
                ownerId,
                walletType,
                label: input.label || null,
                currency: defaultCurrency,
                countryCode: nextCountryCode,
                providerAccountId: input.providerAccountId || null,
                paystackSubaccount: input.paystackSubaccount || null,
                paystackRecipientCode: input.paystackRecipientCode || null,
                detailsJson: Object.keys(details).length > 0 ? JSON.stringify(details) : null,
                isVerified: Boolean(input.isVerified),
                verifiedAt: input.isVerified ? new Date() : null,
                isActive: input.isActive ?? true,
            },
        });
    }
    if ((0, walletPolicy_js_1.isManualWalletType)(walletType)) {
        await prisma_js_1.default.ownerPayoutWallet.updateMany({
            where: {
                ownerId,
                id: { not: walletRecord.id },
                walletType: { in: ['manual', 'offline'] },
            },
            data: { isActive: false },
        });
    }
    const legacyPreferredMethod = resolveLegacyPreferredMethod(walletType);
    await prisma_js_1.default.ownerWallet.upsert({
        where: { ownerId },
        create: {
            ownerId,
            preferredMethod: legacyPreferredMethod,
            currency: walletRecord.currency,
            paystackSubaccount: walletRecord.paystackSubaccount || null,
            paystackRecipientCode: walletRecord.paystackRecipientCode || null,
            isVerified: Boolean(walletRecord.isVerified),
            verifiedAt: walletRecord.isVerified ? new Date() : null,
        },
        update: {
            preferredMethod: legacyPreferredMethod,
            currency: walletRecord.currency,
            paystackSubaccount: walletRecord.paystackSubaccount || null,
            paystackRecipientCode: walletRecord.paystackRecipientCode || null,
            isVerified: Boolean(walletRecord.isVerified),
            verifiedAt: walletRecord.isVerified ? new Date() : null,
        },
    });
    await prisma_js_1.default.owner.update({
        where: { id: ownerId },
        data: { countryCode: nextCountryCode },
    });
    const latestOwner = await prisma_js_1.default.owner.findUnique({
        where: { id: ownerId },
        include: { wallet: true, wallets: true },
    });
    const state = (0, walletPolicy_js_1.resolveOwnerWalletState)((latestOwner?.wallets || []));
    res.json({
        wallet: buildLegacyWallet(latestOwner?.wallet, latestOwner?.wallets || []),
        wallets: latestOwner?.wallets || [],
        walletMode: state.mode,
        message: 'Wallet saved successfully',
    });
}));
router.delete('/wallet/:walletId', (0, errorHandler_js_1.asyncHandler)(async (req, res) => {
    const ownerId = req.ownerId;
    const walletId = req.params.walletId;
    const wallet = await prisma_js_1.default.ownerPayoutWallet.findFirst({
        where: { id: walletId, ownerId },
    });
    if (!wallet)
        throw new errorHandler_js_1.AppError('Wallet not found', 404);
    await prisma_js_1.default.ownerPayoutWallet.update({
        where: { id: wallet.id },
        data: { isActive: false },
    });
    const owner = await prisma_js_1.default.owner.findUnique({
        where: { id: ownerId },
        include: { wallet: true, wallets: true },
    });
    const state = (0, walletPolicy_js_1.resolveOwnerWalletState)((owner?.wallets || []));
    res.json({
        wallet: buildLegacyWallet(owner?.wallet, owner?.wallets || []),
        wallets: owner?.wallets || [],
        walletMode: state.mode,
        message: 'Wallet removed successfully',
    });
}));
/**
 * GET /api/owner-dashboard/wallet/paystack/banks
 * List banks from Paystack for easy owner setup
 */
router.get('/wallet/paystack/banks', (0, errorHandler_js_1.asyncHandler)(async (req, res) => {
    const country = String(req.query.country || 'ghana').trim().toLowerCase();
    const currency = String(req.query.currency || '').trim().toUpperCase() || undefined;
    const banks = await (0, paystack_js_1.getPaystackBanks)({ country, currency });
    res.json({ banks });
}));
/**
 * POST /api/owner-dashboard/wallet/paystack/connect
 * Verify bank account and create/update Paystack subaccount for automated split payouts
 */
router.post('/wallet/paystack/connect', (0, errorHandler_js_1.asyncHandler)(async (req, res) => {
    const ownerId = req.ownerId;
    const owner = await prisma_js_1.default.owner.findUnique({
        where: { id: ownerId },
        include: { wallet: true, wallets: true },
    });
    if (!owner) {
        throw new errorHandler_js_1.AppError('Owner not found', 404);
    }
    const connectSchema = zod_1.z.object({
        bankCode: zod_1.z.string().min(2, 'Bank code is required'),
        accountNumber: zod_1.z.string().min(6, 'Account number is required'),
        businessName: zod_1.z.string().optional(),
        currency: zod_1.z.string().optional(),
        country: zod_1.z.string().optional(),
        setAsPreferred: zod_1.z.boolean().optional(),
        percentageCharge: zod_1.z.number().min(0).max(100).optional(),
    });
    const input = connectSchema.parse(req.body);
    const ownerCountryCode = (input.country || owner.countryCode || '').trim().toUpperCase();
    if (!ownerCountryCode) {
        throw new errorHandler_js_1.AppError('Owner country is required before connecting Paystack', 400);
    }
    const state = (0, walletPolicy_js_1.resolveOwnerWalletState)(owner.wallets);
    if (state.manualWallet) {
        throw new errorHandler_js_1.AppError('Disable manual/offline wallet before connecting Paystack', 400);
    }
    const accountNumber = input.accountNumber.replace(/\s+/g, '');
    const bankCode = input.bankCode.trim();
    const businessName = input.businessName?.trim() ||
        owner.company?.trim() ||
        owner.name?.trim() ||
        owner.email;
    const resolvedAccount = await (0, paystack_js_1.resolvePaystackAccount)(accountNumber, bankCode);
    const payload = {
        businessName,
        bankCode,
        accountNumber,
        percentageCharge: input.percentageCharge ?? 0,
        primaryContactName: owner.name,
        primaryContactEmail: owner.email,
        description: `EventPeepo owner payout destination (${owner.id})`,
    };
    const existingPaystackWallet = (owner.wallets || []).find((wallet) => wallet.isActive && (0, walletPolicy_js_1.normalizeWalletType)(wallet.walletType) === 'paystack');
    let paystackSubaccount = existingPaystackWallet?.paystackSubaccount || owner.wallet?.paystackSubaccount || undefined;
    let paystackRecipientCode = existingPaystackWallet?.paystackRecipientCode || owner.wallet?.paystackRecipientCode || undefined;
    const walletCurrency = (input.currency || existingPaystackWallet?.currency || owner.wallet?.currency || 'NGN').toUpperCase();
    if (paystackSubaccount) {
        try {
            const updated = await (0, paystack_js_1.updatePaystackSubaccount)(paystackSubaccount, payload);
            paystackSubaccount = updated.subaccount_code || paystackSubaccount;
        }
        catch {
            const created = await (0, paystack_js_1.createPaystackSubaccount)(payload);
            paystackSubaccount = created.subaccount_code;
        }
    }
    else {
        const created = await (0, paystack_js_1.createPaystackSubaccount)(payload);
        paystackSubaccount = created.subaccount_code;
    }
    try {
        const recipient = await (0, paystack_js_1.createPaystackTransferRecipient)({
            name: resolvedAccount.account_name || businessName,
            accountNumber,
            bankCode,
            currency: walletCurrency,
            type: 'nuban',
            description: `EventPeepo owner transfer recipient (${owner.id})`,
        });
        paystackRecipientCode = recipient.recipient_code;
    }
    catch (error) {
        if (!paystackRecipientCode) {
            throw error;
        }
    }
    const payoutWallet = existingPaystackWallet
        ? await prisma_js_1.default.ownerPayoutWallet.update({
            where: { id: existingPaystackWallet.id },
            data: {
                walletType: 'paystack',
                currency: walletCurrency,
                countryCode: ownerCountryCode,
                isActive: true,
                isVerified: true,
                verifiedAt: new Date(),
                paystackSubaccount,
                paystackRecipientCode,
                detailsJson: JSON.stringify({
                    bankCode,
                    bankName: resolvedAccount.bank_name || null,
                    accountName: resolvedAccount.account_name || null,
                    accountNumber: resolvedAccount.account_number || accountNumber,
                }),
            },
        })
        : await prisma_js_1.default.ownerPayoutWallet.create({
            data: {
                ownerId,
                walletType: 'paystack',
                currency: walletCurrency,
                countryCode: ownerCountryCode,
                isActive: true,
                isVerified: true,
                verifiedAt: new Date(),
                paystackSubaccount: paystackSubaccount || null,
                paystackRecipientCode: paystackRecipientCode || null,
                detailsJson: JSON.stringify({
                    bankCode,
                    bankName: resolvedAccount.bank_name || null,
                    accountName: resolvedAccount.account_name || null,
                    accountNumber: resolvedAccount.account_number || accountNumber,
                }),
            },
        });
    const wallet = await prisma_js_1.default.ownerWallet.upsert({
        where: { ownerId },
        create: {
            ownerId,
            bankName: resolvedAccount.bank_name || owner.wallet?.bankName || null,
            accountName: resolvedAccount.account_name,
            accountNumber,
            routingNumber: bankCode,
            paystackSubaccount,
            paystackRecipientCode,
            paystackRecipientType: 'nuban',
            paystackRecipientName: resolvedAccount.account_name,
            paystackRecipientBankCode: bankCode,
            paystackRecipientUpdatedAt: new Date(),
            preferredMethod: input.setAsPreferred === false ? (owner.wallet?.preferredMethod || 'bank') : 'paystack',
            currency: walletCurrency,
            isVerified: true,
            verifiedAt: new Date(),
        },
        update: {
            bankName: resolvedAccount.bank_name || owner.wallet?.bankName || undefined,
            accountName: resolvedAccount.account_name,
            accountNumber,
            routingNumber: bankCode,
            paystackSubaccount,
            paystackRecipientCode,
            paystackRecipientType: 'nuban',
            paystackRecipientName: resolvedAccount.account_name,
            paystackRecipientBankCode: bankCode,
            paystackRecipientUpdatedAt: new Date(),
            preferredMethod: input.setAsPreferred === false ? undefined : 'paystack',
            currency: walletCurrency,
            isVerified: true,
            verifiedAt: new Date(),
        },
    });
    await prisma_js_1.default.owner.update({
        where: { id: ownerId },
        data: { countryCode: ownerCountryCode },
    });
    await prisma_js_1.default.auditLog.create({
        data: {
            action: 'OWNER_PAYSTACK_CONNECTED',
            entityType: 'OWNER_WALLET',
            entityId: payoutWallet.id,
            details: JSON.stringify({
                ownerId,
                bankCode,
                country: ownerCountryCode,
                currency: payoutWallet.currency,
                paystackSubaccount,
                paystackRecipientCode,
            }),
        },
    });
    const latestOwner = await prisma_js_1.default.owner.findUnique({
        where: { id: ownerId },
        include: { wallet: true, wallets: true },
    });
    res.json({
        wallet: buildLegacyWallet(latestOwner?.wallet, latestOwner?.wallets || []),
        payoutWallet,
        paystack: {
            subaccountCode: paystackSubaccount,
            recipientCode: paystackRecipientCode,
            accountName: resolvedAccount.account_name,
            accountNumber: resolvedAccount.account_number,
        },
        message: 'Paystack auto-payout account connected successfully',
    });
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
        const transactions = await prisma_js_1.default.transactionLegacy.findMany({
            where: {
                eventId: event.id,
                type: { in: ['ticket_sale', 'gift_cash'] },
                status: 'completed',
            },
        });
        const payoutEligibleTransactions = transactions.filter((tx) => (tx.payoutRouting !== 'OWNER_AUTOMATED'));
        const totalCurrency = payoutEligibleTransactions[0]?.currency || transactions[0]?.currency || 'USD';
        // Calculate total net amount (available for payout)
        const totalNet = payoutEligibleTransactions.reduce((sum, t) => sum + (t.netAmount || 0), 0);
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
            currency: totalCurrency,
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
        currency: zod_1.z.string().optional(),
        payoutMethod: zod_1.z.enum(['bank', 'mobile', 'paypal', 'stripe', 'paystack']).optional(),
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
    if (wallet.preferredMethod === 'paystack' && !wallet.paystackRecipientCode) {
        throw new errorHandler_js_1.AppError('Paystack payouts require a connected receiving account. Please reconnect Paystack in Wallet settings.', 400);
    }
    // Enforce wallet configuration as source of truth for secure payouts.
    // Calculate available balance for this event
    const transactions = await prisma_js_1.default.transactionLegacy.findMany({
        where: {
            eventId: data.eventId,
            type: { in: ['ticket_sale', 'gift_cash'] },
            status: 'completed',
        },
    });
    const payoutEligibleTransactions = transactions.filter((tx) => (tx.payoutRouting !== 'OWNER_AUTOMATED'));
    const totalNet = payoutEligibleTransactions.reduce((sum, t) => sum + (t.netAmount || 0), 0);
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
        throw new errorHandler_js_1.AppError(`Requested amount (${wallet.currency} ${data.requestedAmount.toFixed(2)}) exceeds available balance (${wallet.currency} ${availableBalance.toFixed(2)})`, 400);
    }
    // Create payout request
    const payout = await prisma_js_1.default.payoutRequest.create({
        data: {
            eventId: data.eventId,
            requestedAmount: data.requestedAmount,
            currency: wallet.currency,
            payoutMethod: wallet.preferredMethod,
            notes: data.notes,
            status: 'PENDING',
            ledgerStatus: 'REQUESTED',
            gateway: wallet.preferredMethod === 'paystack' ? 'paystack' : 'manual',
            requestedByOwnerId: ownerId,
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
    await prisma_js_1.default.auditLog.create({
        data: {
            eventId: data.eventId,
            action: 'OWNER_PAYOUT_REQUEST_CREATED',
            entityType: 'PAYOUT',
            entityId: payout.id,
            details: JSON.stringify({
                ownerId,
                requestedAmount: payout.requestedAmount,
                currency: payout.currency,
                payoutMethod: payout.payoutMethod,
            }),
        },
    });
    let resultPayout = payout;
    let automation = {
        attempted: false,
        initiated: false,
        message: null,
    };
    if (wallet.preferredMethod === 'paystack') {
        automation.attempted = true;
        try {
            resultPayout = await (0, payoutAutomation_js_1.queuePaystackTransferForPayout)(payout.id, null);
            automation.initiated = true;
            automation.message = 'Paystack transfer has been initiated and will reconcile automatically via webhook.';
        }
        catch (error) {
            resultPayout = await prisma_js_1.default.payoutRequest.update({
                where: { id: payout.id },
                data: {
                    status: 'DELAYED',
                    ledgerStatus: 'MANUAL_REVIEW',
                    failureMessage: error?.message || 'Failed to queue transfer',
                },
            });
            automation.initiated = false;
            automation.message = 'Automatic transfer could not be started. This payout is queued for manual review.';
        }
    }
    res.status(201).json({ payout: resultPayout, automation });
}));
exports.default = router;
//# sourceMappingURL=owner-dashboard.js.map