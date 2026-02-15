"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const crypto_1 = require("crypto");
const dns_1 = require("dns");
const prisma_js_1 = __importDefault(require("../utils/prisma.js"));
const errorHandler_js_1 = require("../middleware/errorHandler.js");
const auth_js_1 = require("../middleware/auth.js");
const phase_js_1 = require("../utils/phase.js");
const zod_1 = require("zod");
const notifications_js_1 = require("../services/notifications.js");
const invitation_js_1 = require("../services/invitation.js");
const paystack_js_1 = require("../services/paystack.js");
const payoutAutomation_js_1 = require("../services/payoutAutomation.js");
const router = (0, express_1.Router)();
// All routes require owner authentication
router.use(auth_js_1.authenticateOwnerAccount);
const normalizeDomainHost = (rawHost) => rawHost.trim().toLowerCase().replace(/^https?:\/\//, '').replace(/\/+$/, '');
const isValidDomainHost = (host) => /^(?:[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?\.)+[a-z]{2,}$/i.test(host);
const getInvitePublicUrl = (token) => {
    const frontend = (process.env.FRONTEND_URL || process.env.SITE_URL || '').replace(/\/+$/, '');
    if (frontend)
        return `${frontend}/invite/${token}`;
    return `/invite/${token}`;
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
    if (!['APPROVED', 'REJECTED'].includes(status)) {
        throw new errorHandler_js_1.AppError('Invalid status. Must be APPROVED or REJECTED', 400);
    }
    const event = await prisma_js_1.default.event.findFirst({
        where: { id: eventId, ownerId },
        select: { id: true, invitationOnly: true },
    });
    if (!event) {
        throw new errorHandler_js_1.AppError('Event not found', 404);
    }
    const rsvp = await prisma_js_1.default.rSVP.findFirst({
        where: { id: rsvpId, eventId },
    });
    if (!rsvp) {
        throw new errorHandler_js_1.AppError('RSVP not found', 404);
    }
    if (rsvp.status !== 'PENDING') {
        throw new errorHandler_js_1.AppError('RSVP has already been reviewed', 400);
    }
    const updatedRsvp = await prisma_js_1.default.rSVP.update({
        where: { id: rsvp.id },
        data: {
            status,
            reviewedAt: new Date(),
        },
    });
    let invitation = null;
    if (status === 'APPROVED' && rsvp.attendance === 'YES') {
        invitation = await (0, invitation_js_1.generateInvitationPass)(rsvp.id);
        if (invitation) {
            (0, notifications_js_1.sendInvitationNotifications)(invitation.id).catch((err) => console.error('[Owner RSVP Review] Failed to send invitation notifications:', err));
        }
    }
    await prisma_js_1.default.auditLog.create({
        data: {
            eventId,
            action: status === 'APPROVED' ? 'RSVP_APPROVED_BY_OWNER' : 'RSVP_REJECTED_BY_OWNER',
            entityType: 'RSVP',
            entityId: rsvp.id,
            details: JSON.stringify({
                ownerId,
                guestName: rsvp.primaryName,
            }),
        },
    });
    res.json({
        rsvp: updatedRsvp,
        invitation,
        message: status === 'APPROVED' ? 'RSVP approved successfully' : 'RSVP rejected successfully',
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
    res.json({
        domains,
        dnsTarget: process.env.DOMAIN_CNAME_TARGET || 'cname.eventpeepo.com',
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
            txtValue: domain.verificationToken,
            cnameName: host.startsWith('www.') ? host : `www.${host}`,
            cnameValue: process.env.DOMAIN_CNAME_TARGET || 'cname.eventpeepo.com',
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
    let txtMatch = false;
    let cnameMatch = false;
    try {
        const txtRecords = await dns_1.promises.resolveTxt(`_eventpeepo.${domain.host}`);
        txtMatch = txtRecords.flat().map((v) => v.trim()).includes(domain.verificationToken);
    }
    catch {
        txtMatch = false;
    }
    try {
        const cnameHost = domain.host.startsWith('www.') ? domain.host : `www.${domain.host}`;
        const cnameRecords = await dns_1.promises.resolveCname(cnameHost);
        cnameMatch = cnameRecords.some((record) => record.toLowerCase().replace(/\.$/, '') === cnameTarget.replace(/\.$/, ''));
    }
    catch {
        cnameMatch = false;
    }
    const verified = txtMatch && cnameMatch;
    const status = verified ? (domain.isPrimary ? 'ACTIVE' : 'VERIFIED') : 'FAILED';
    const updated = await prisma_js_1.default.eventDomain.update({
        where: { id: domain.id },
        data: {
            status,
            verificationNotes: verified ? null : 'TXT and/or CNAME records do not match yet',
        },
    });
    await prisma_js_1.default.auditLog.create({
        data: {
            eventId,
            action: 'EVENT_DOMAIN_VERIFIED_BY_OWNER',
            entityType: 'EVENT_DOMAIN',
            entityId: domain.id,
            details: JSON.stringify({ ownerId, host: domain.host, status, txtMatch, cnameMatch }),
        },
    });
    res.json({
        domain: updated,
        verification: { verified, txtMatch, cnameMatch },
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
    if (!['VERIFIED', 'ACTIVE'].includes(domain.status)) {
        throw new errorHandler_js_1.AppError('Only verified domains can be made primary', 400);
    }
    await prisma_js_1.default.eventDomain.updateMany({ where: { eventId }, data: { isPrimary: false } });
    const updated = await prisma_js_1.default.eventDomain.update({
        where: { id: domain.id },
        data: { isPrimary: true, status: 'ACTIVE' },
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
    await prisma_js_1.default.eventDomain.delete({ where: { id: domain.id } });
    if (domain.isPrimary) {
        const fallback = await prisma_js_1.default.eventDomain.findFirst({
            where: { eventId, status: { in: ['VERIFIED', 'ACTIVE'] } },
            orderBy: { createdAt: 'asc' },
        });
        if (fallback) {
            await prisma_js_1.default.eventDomain.update({
                where: { id: fallback.id },
                data: { isPrimary: true, status: 'ACTIVE' },
            });
        }
    }
    await prisma_js_1.default.auditLog.create({
        data: {
            eventId,
            action: 'EVENT_DOMAIN_DELETED_BY_OWNER',
            entityType: 'EVENT_DOMAIN',
            entityId: domain.id,
            details: JSON.stringify({ ownerId, host: domain.host }),
        },
    });
    res.json({ message: 'Domain removed successfully' });
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
/**
 * POST /api/owner-dashboard/events/:eventId/rsvp-invites/batch
 * Create and send invite batch
 */
router.post('/events/:eventId/rsvp-invites/batch', (0, errorHandler_js_1.asyncHandler)(async (req, res) => {
    const ownerId = req.ownerId;
    const { eventId } = req.params;
    const invitesInput = Array.isArray(req.body?.invites) ? req.body.invites : [];
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
    const created = [];
    const failed = [];
    for (const input of invitesInput) {
        const inviteePhone = String(input?.phone || '').trim();
        const inviteeName = input?.name ? String(input.name).trim() : null;
        const inviteeEmail = input?.email ? String(input.email).trim() : null;
        if (!inviteePhone) {
            failed.push({ phone: '', reason: 'Phone number is required' });
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
                expiresAt,
                status: 'SENT',
                sentByOwnerId: ownerId,
            },
        });
        const inviteUrl = getInvitePublicUrl(invite.token);
        try {
            const delivery = await (0, notifications_js_1.sendWhatsAppRsvpInvite)(inviteePhone, {
                eventName: event.name,
                inviteUrl,
                token: invite.token,
            });
            if (!delivery.success) {
                failed.push({
                    phone: inviteePhone,
                    reason: ('error' in delivery && delivery.error) ? delivery.error : 'Failed to send WhatsApp invite',
                });
                continue;
            }
            created.push(invite);
        }
        catch (error) {
            failed.push({ phone: inviteePhone, reason: error?.message || 'Failed to send WhatsApp invite' });
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
            }),
        },
    });
    res.status(201).json({
        message: 'Invite batch processed',
        sentCount: created.length,
        failedCount: failed.length,
        invites: created,
        failed,
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
    const delivery = await (0, notifications_js_1.sendWhatsAppRsvpInvite)(invite.inviteePhone, {
        eventName: event.name,
        inviteUrl,
        token: invite.token,
        reminder: true,
    });
    if (!delivery.success) {
        throw new errorHandler_js_1.AppError(('error' in delivery && delivery.error) ? delivery.error : 'Failed to resend invite', 500);
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
        ? await prisma_js_1.default.transaction.findMany({
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
    res.json({
        wallet: owner.wallet || null,
        paystackAutomationReady: Boolean(owner.wallet?.paystackSubaccount && owner.wallet?.paystackRecipientCode),
    });
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
        include: { wallet: true },
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
    let paystackSubaccount = owner.wallet?.paystackSubaccount || undefined;
    let paystackRecipientCode = owner.wallet?.paystackRecipientCode || undefined;
    const walletCurrency = (input.currency || owner.wallet?.currency || 'NGN').toUpperCase();
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
    await prisma_js_1.default.auditLog.create({
        data: {
            action: 'OWNER_PAYSTACK_CONNECTED',
            entityType: 'OWNER_WALLET',
            entityId: wallet.id,
            details: JSON.stringify({
                ownerId,
                bankCode,
                country: input.country || null,
                currency: wallet.currency,
                paystackSubaccount,
                paystackRecipientCode,
            }),
        },
    });
    res.json({
        wallet,
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
        const transactions = await prisma_js_1.default.transaction.findMany({
            where: {
                eventId: event.id,
                type: { in: ['ticket_sale', 'gift_cash'] },
                status: 'completed',
            },
        });
        const payoutEligibleTransactions = transactions.filter((tx) => {
            // Cash gifts paid with Paystack split are settled directly to owner subaccounts.
            return !(tx.type === 'gift_cash' && (tx.paymentMethod || '').toLowerCase() === 'paystack');
        });
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
    const transactions = await prisma_js_1.default.transaction.findMany({
        where: {
            eventId: data.eventId,
            type: { in: ['ticket_sale', 'gift_cash'] },
            status: 'completed',
        },
    });
    const payoutEligibleTransactions = transactions.filter((tx) => {
        return !(tx.type === 'gift_cash' && (tx.paymentMethod || '').toLowerCase() === 'paystack');
    });
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