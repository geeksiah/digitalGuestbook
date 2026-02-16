"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const prisma_js_1 = __importDefault(require("../utils/prisma.js"));
const errorHandler_js_1 = require("../middleware/errorHandler.js");
const auth_js_1 = require("../middleware/auth.js");
const payoutAutomation_js_1 = require("../services/payoutAutomation.js");
const pushCampaigns_js_1 = require("../services/pushCampaigns.js");
const ownerNotifications_js_1 = require("../services/ownerNotifications.js");
const featureFlags_js_1 = require("../utils/featureFlags.js");
const zod_1 = require("zod");
const router = (0, express_1.Router)();
// ============================================
// DASHBOARD STATS
// ============================================
/**
 * GET /api/admin/dashboard/stats
 * Get dashboard statistics
 */
router.get('/dashboard/stats', auth_js_1.authenticateAdmin, (0, errorHandler_js_1.asyncHandler)(async (req, res) => {
    const [totalEvents, activeEvents, totalRsvps, totalPayouts, totalPayoutAmount,] = await Promise.all([
        prisma_js_1.default.event.count(),
        prisma_js_1.default.event.count({ where: { phase: { in: ['PLANNING', 'ACTIVE'] } } }),
        prisma_js_1.default.rSVP.count(),
        prisma_js_1.default.payoutRequest.count({ where: { status: 'PENDING' } }),
        prisma_js_1.default.payoutRequest.aggregate({
            where: { status: 'PENDING' },
            _sum: { requestedAmount: true },
        }),
    ]);
    res.json({
        stats: {
            totalEvents,
            activeEvents,
            totalRsvps,
            totalPendingPayouts: totalPayouts,
            totalPendingPayoutAmount: totalPayoutAmount._sum.requestedAmount || 0,
        },
    });
}));
/**
 * GET /api/admin/events/pending-approvals
 */
router.get('/events/pending-approvals', auth_js_1.authenticateAdmin, (0, errorHandler_js_1.asyncHandler)(async (_req, res) => {
    const events = await prisma_js_1.default.event.findMany({
        where: {
            approvalStatus: 'PENDING_REVIEW',
        },
        include: {
            Owner: {
                select: {
                    id: true,
                    name: true,
                    email: true,
                },
            },
        },
        orderBy: {
            approvalSubmittedAt: 'asc',
        },
    });
    res.json({ events });
}));
/**
 * POST /api/admin/events/:eventId/approve
 */
router.post('/events/:eventId/approve', auth_js_1.authenticateAdmin, (0, errorHandler_js_1.asyncHandler)(async (req, res) => {
    if (!featureFlags_js_1.featureFlags.ownerEventApproval) {
        throw new errorHandler_js_1.AppError('Event approval workflow is disabled', 400);
    }
    const { eventId } = req.params;
    const adminId = req.admin.id;
    const event = await prisma_js_1.default.event.findUnique({
        where: { id: eventId },
        select: {
            id: true,
            ownerId: true,
            approvalStatus: true,
            name: true,
            slug: true,
        },
    });
    if (!event)
        throw new errorHandler_js_1.AppError('Event not found', 404);
    const updated = await prisma_js_1.default.event.update({
        where: { id: event.id },
        data: {
            approvalStatus: 'APPROVED',
            approvalReviewedAt: new Date(),
            approvalReviewedByAdminId: adminId,
            approvalRejectionReason: null,
        },
    });
    if (event.ownerId) {
        await (0, ownerNotifications_js_1.sendPushToOwners)([event.ownerId], {
            title: 'Event approved',
            body: `${event.name} is now approved.`,
            deepLink: `/app/events/${event.id}`,
            type: 'EVENT_APPROVAL',
            data: {
                eventId: event.id,
                status: 'APPROVED',
            },
            isMarketing: false,
        });
    }
    await prisma_js_1.default.auditLog.create({
        data: {
            adminId,
            eventId: event.id,
            action: 'OWNER_EVENT_APPROVED',
            entityType: 'EVENT',
            entityId: event.id,
            details: JSON.stringify({
                previousStatus: event.approvalStatus,
            }),
        },
    });
    res.json({ event: updated });
}));
/**
 * POST /api/admin/events/:eventId/reject
 */
router.post('/events/:eventId/reject', auth_js_1.authenticateAdmin, (0, errorHandler_js_1.asyncHandler)(async (req, res) => {
    if (!featureFlags_js_1.featureFlags.ownerEventApproval) {
        throw new errorHandler_js_1.AppError('Event approval workflow is disabled', 400);
    }
    const { eventId } = req.params;
    const adminId = req.admin.id;
    const reason = String(req.body?.reason || '').trim();
    if (!reason) {
        throw new errorHandler_js_1.AppError('Rejection reason is required', 400);
    }
    const event = await prisma_js_1.default.event.findUnique({
        where: { id: eventId },
        select: {
            id: true,
            ownerId: true,
            approvalStatus: true,
            name: true,
        },
    });
    if (!event)
        throw new errorHandler_js_1.AppError('Event not found', 404);
    const updated = await prisma_js_1.default.event.update({
        where: { id: event.id },
        data: {
            approvalStatus: 'REJECTED',
            approvalReviewedAt: new Date(),
            approvalReviewedByAdminId: adminId,
            approvalRejectionReason: reason,
        },
    });
    if (event.ownerId) {
        await (0, ownerNotifications_js_1.sendPushToOwners)([event.ownerId], {
            title: 'Event needs updates',
            body: `${event.name} was rejected. Open details to review feedback.`,
            deepLink: `/app/events/${event.id}/approval`,
            type: 'EVENT_APPROVAL',
            data: {
                eventId: event.id,
                status: 'REJECTED',
                reason,
            },
            isMarketing: false,
        });
    }
    await prisma_js_1.default.auditLog.create({
        data: {
            adminId,
            eventId: event.id,
            action: 'OWNER_EVENT_REJECTED',
            entityType: 'EVENT',
            entityId: event.id,
            details: JSON.stringify({
                previousStatus: event.approvalStatus,
                reason,
            }),
        },
    });
    res.json({ event: updated });
}));
const pushCampaignSchema = zod_1.z.object({
    title: zod_1.z.string().min(2),
    body: zod_1.z.string().min(2),
    deepLink: zod_1.z.string().optional(),
    audienceType: zod_1.z.enum(['ALL_OWNERS', 'ACTIVE_OWNERS', 'PENDING_APPROVAL_OWNERS', 'CUSTOM_OWNER_IDS']),
    ownerIds: zod_1.z.array(zod_1.z.string()).optional(),
    scheduleAt: zod_1.z.coerce.date().optional(),
});
/**
 * GET /api/admin/push-campaigns
 */
router.get('/push-campaigns', auth_js_1.authenticateAdmin, (0, errorHandler_js_1.asyncHandler)(async (_req, res) => {
    if (!featureFlags_js_1.featureFlags.ownerMarketingCampaigns) {
        throw new errorHandler_js_1.AppError('Marketing campaigns are disabled', 400);
    }
    const campaigns = await prisma_js_1.default.pushCampaign.findMany({
        include: {
            audiences: true,
            _count: {
                select: {
                    deliveries: true,
                },
            },
        },
        orderBy: {
            createdAt: 'desc',
        },
    });
    res.json({ campaigns });
}));
/**
 * POST /api/admin/push-campaigns
 */
router.post('/push-campaigns', auth_js_1.authenticateAdmin, (0, errorHandler_js_1.asyncHandler)(async (req, res) => {
    if (!featureFlags_js_1.featureFlags.ownerMarketingCampaigns) {
        throw new errorHandler_js_1.AppError('Marketing campaigns are disabled', 400);
    }
    const adminId = req.admin.id;
    const input = pushCampaignSchema.parse(req.body || {});
    const audiencePayload = input.ownerIds && input.ownerIds.length > 0 ? JSON.stringify(input.ownerIds) : null;
    const campaign = await prisma_js_1.default.pushCampaign.create({
        data: {
            title: input.title,
            body: input.body,
            deepLink: input.deepLink || null,
            status: input.scheduleAt ? 'SCHEDULED' : 'DRAFT',
            scheduledAt: input.scheduleAt || null,
            createdByAdminId: adminId,
            audiences: {
                create: {
                    audienceType: input.audienceType,
                    audienceQuery: audiencePayload,
                },
            },
        },
        include: {
            audiences: true,
        },
    });
    res.status(201).json({ campaign });
}));
/**
 * POST /api/admin/push-campaigns/:id/send-now
 */
router.post('/push-campaigns/:id/send-now', auth_js_1.authenticateAdmin, (0, errorHandler_js_1.asyncHandler)(async (req, res) => {
    if (!featureFlags_js_1.featureFlags.ownerMarketingCampaigns) {
        throw new errorHandler_js_1.AppError('Marketing campaigns are disabled', 400);
    }
    const dispatch = await (0, pushCampaigns_js_1.dispatchCampaign)(req.params.id);
    res.json({ dispatch });
}));
/**
 * POST /api/admin/push-campaigns/:id/schedule
 */
router.post('/push-campaigns/:id/schedule', auth_js_1.authenticateAdmin, (0, errorHandler_js_1.asyncHandler)(async (req, res) => {
    if (!featureFlags_js_1.featureFlags.ownerMarketingCampaigns) {
        throw new errorHandler_js_1.AppError('Marketing campaigns are disabled', 400);
    }
    const scheduledAt = zod_1.z.coerce.date().parse(req.body?.scheduledAt);
    const campaign = await prisma_js_1.default.pushCampaign.update({
        where: { id: req.params.id },
        data: {
            status: 'SCHEDULED',
            scheduledAt,
        },
    });
    res.json({ campaign });
}));
/**
 * GET /api/admin/push-campaigns/:id/report
 */
router.get('/push-campaigns/:id/report', auth_js_1.authenticateAdmin, (0, errorHandler_js_1.asyncHandler)(async (req, res) => {
    if (!featureFlags_js_1.featureFlags.ownerMarketingCampaigns) {
        throw new errorHandler_js_1.AppError('Marketing campaigns are disabled', 400);
    }
    const campaign = await prisma_js_1.default.pushCampaign.findUnique({
        where: { id: req.params.id },
        include: {
            audiences: true,
            deliveries: true,
        },
    });
    if (!campaign)
        throw new errorHandler_js_1.AppError('Campaign not found', 404);
    const report = campaign.deliveries.reduce((acc, delivery) => {
        acc.total += 1;
        const key = String(delivery.status || 'UNKNOWN');
        acc.byStatus[key] = (acc.byStatus[key] || 0) + 1;
        return acc;
    }, { total: 0, byStatus: {} });
    res.json({ campaign, report });
}));
// ============================================
// SALES MANAGEMENT
// ============================================
/**
 * GET /api/admin/sales
 * Get ticket sales across all events
 */
router.get('/sales', auth_js_1.authenticateAdmin, (0, errorHandler_js_1.asyncHandler)(async (req, res) => {
    const { eventId, status, type, startDate, endDate, page = 1, limit = 50 } = req.query;
    const pageNumber = Math.max(1, Number(page) || 1);
    const pageLimit = Math.max(1, Math.min(200, Number(limit) || 50));
    const parseDate = (value, asEndOfDay = false) => {
        if (!value)
            return null;
        const d = new Date(value);
        if (Number.isNaN(d.getTime()))
            return null;
        if (asEndOfDay) {
            d.setHours(23, 59, 59, 999);
        }
        return d;
    };
    const start = parseDate(typeof startDate === 'string' ? startDate : undefined, false);
    const end = parseDate(typeof endDate === 'string' ? endDate : undefined, true);
    // Legacy RSVP ticket sales filter (kept for compatibility with existing pages)
    const rsvpWhere = {
        ticketType: { not: null },
        amountPaid: { not: null },
    };
    if (eventId)
        rsvpWhere.eventId = eventId;
    if (status && ['PAID', 'PENDING', 'FAILED', 'REFUNDED'].includes(String(status).toUpperCase())) {
        rsvpWhere.paymentStatus = String(status).toUpperCase();
    }
    if (start)
        rsvpWhere.submittedAt = { ...rsvpWhere.submittedAt, gte: start };
    if (end)
        rsvpWhere.submittedAt = { ...rsvpWhere.submittedAt, lte: end };
    const statusMap = {
        PAID: 'completed',
        PENDING: 'pending',
        FAILED: 'failed',
        REFUNDED: 'refunded',
    };
    const normalizedStatus = status ? String(status).toUpperCase() : '';
    const txStatus = normalizedStatus ? (statusMap[normalizedStatus] || String(status).toLowerCase()) : undefined;
    const txWhere = {};
    if (eventId)
        txWhere.eventId = eventId;
    if (txStatus)
        txWhere.status = txStatus;
    if (type)
        txWhere.type = String(type);
    if (start)
        txWhere.createdAt = { ...txWhere.createdAt, gte: start };
    if (end)
        txWhere.createdAt = { ...txWhere.createdAt, lte: end };
    const [rsvps, totalRsvps, transactions, totalTransactions] = await Promise.all([
        prisma_js_1.default.rSVP.findMany({
            where: rsvpWhere,
            include: {
                event: { select: { id: true, name: true, slug: true } },
                invitation: { select: { accessCode: true } },
            },
            orderBy: { submittedAt: 'desc' },
            skip: (pageNumber - 1) * pageLimit,
            take: pageLimit,
        }),
        prisma_js_1.default.rSVP.count({ where: rsvpWhere }),
        prisma_js_1.default.transaction.findMany({
            where: txWhere,
            include: {
                event: { select: { id: true, name: true, slug: true } },
            },
            orderBy: { createdAt: 'desc' },
            skip: (pageNumber - 1) * pageLimit,
            take: pageLimit,
        }),
        prisma_js_1.default.transaction.count({ where: txWhere }),
    ]);
    const sales = rsvps.filter((r) => r.ticketType && r.amountPaid);
    const stats = {
        totalSales: sales.length,
        totalRevenue: sales.reduce((sum, s) => sum + (s.amountPaid || 0), 0),
        byStatus: {
            PAID: sales.filter((s) => s.paymentStatus === 'PAID').length,
            PENDING: sales.filter((s) => s.paymentStatus === 'PENDING').length,
            FAILED: sales.filter((s) => s.paymentStatus === 'FAILED').length,
            REFUNDED: sales.filter((s) => s.paymentStatus === 'REFUNDED').length,
        },
    };
    const initBucket = () => ({ count: 0, gross: 0, adminRevenue: 0, ownerNet: 0, processingFees: 0 });
    const byType = {};
    const byStatus = {};
    const byCurrency = {};
    const adminRevenueTransactions = [];
    const completedTransactions = transactions.filter((t) => t.status === 'completed');
    for (const tx of transactions) {
        if (!byType[tx.type])
            byType[tx.type] = initBucket();
        if (!byCurrency[tx.currency])
            byCurrency[tx.currency] = initBucket();
        byType[tx.type].count += 1;
        byType[tx.type].gross += tx.grossAmount || 0;
        byType[tx.type].adminRevenue += tx.platformFee || 0;
        byType[tx.type].ownerNet += tx.netAmount || 0;
        byType[tx.type].processingFees += tx.processingFee || 0;
        byCurrency[tx.currency].count += 1;
        byCurrency[tx.currency].gross += tx.grossAmount || 0;
        byCurrency[tx.currency].adminRevenue += tx.platformFee || 0;
        byCurrency[tx.currency].ownerNet += tx.netAmount || 0;
        byCurrency[tx.currency].processingFees += tx.processingFee || 0;
        byStatus[tx.status] = (byStatus[tx.status] || 0) + 1;
        if ((tx.platformFee || 0) > 0 && tx.status === 'completed') {
            adminRevenueTransactions.push(tx.id);
        }
    }
    const ticketTransactions = transactions.filter((t) => t.type === 'ticket_sale');
    const giftTransactions = transactions.filter((t) => ['gift_cash', 'gift_package_sale'].includes(t.type));
    const sum = (list, selector) => list.reduce((acc, item) => acc + selector(item), 0);
    const analytics = {
        totals: {
            transactionCount: transactions.length,
            completedTransactionCount: completedTransactions.length,
            ticketTransactionCount: ticketTransactions.length,
            giftTransactionCount: giftTransactions.length,
            grossRevenue: sum(transactions, (t) => t.grossAmount || 0),
            ticketRevenue: sum(ticketTransactions, (t) => t.grossAmount || 0),
            giftRevenue: sum(giftTransactions, (t) => t.grossAmount || 0),
            adminRevenue: sum(completedTransactions, (t) => t.platformFee || 0),
            ownerNet: sum(completedTransactions, (t) => t.netAmount || 0),
            processingFees: sum(completedTransactions, (t) => t.processingFee || 0),
            adminRevenueTransactionCount: adminRevenueTransactions.length,
        },
        byType,
        byStatus,
        byCurrency: Object.entries(byCurrency).map(([currency, values]) => ({ currency, ...values })),
    };
    res.json({
        sales,
        stats,
        transactions,
        analytics,
        pagination: { page: pageNumber, limit: pageLimit, total: totalRsvps },
        transactionPagination: { page: pageNumber, limit: pageLimit, total: totalTransactions },
    });
}));
// ============================================
// PAYOUT MANAGEMENT
// ============================================
/**
 * GET /api/admin/payouts
 * Get all payout requests with filtering and analytics
 */
router.get('/payouts', auth_js_1.authenticateAdmin, (0, errorHandler_js_1.asyncHandler)(async (req, res) => {
    const { status, eventId, startDate, endDate, page = 1, limit = 50 } = req.query;
    const where = {};
    if (status)
        where.status = status;
    if (eventId)
        where.eventId = eventId;
    if (startDate)
        where.createdAt = { ...where.createdAt, gte: new Date(startDate) };
    if (endDate) {
        where.createdAt = where.createdAt || {};
        where.createdAt.lte = new Date(endDate);
    }
    const [payouts, total, stats] = await Promise.all([
        prisma_js_1.default.payoutRequest.findMany({
            where,
            include: {
                event: {
                    select: {
                        id: true,
                        name: true,
                        slug: true,
                        ownerName: true,
                        ownerEmail: true,
                    }
                },
            },
            orderBy: { createdAt: 'desc' },
            skip: (Number(page) - 1) * Number(limit),
            take: Number(limit),
        }),
        prisma_js_1.default.payoutRequest.count({ where }),
        prisma_js_1.default.payoutRequest.aggregate({
            where: { status: 'PENDING' },
            _sum: { requestedAmount: true },
            _count: true,
        }),
    ]);
    // Calculate additional stats
    const allPayouts = await prisma_js_1.default.payoutRequest.findMany({ where });
    const analytics = {
        totalPending: allPayouts.filter((p) => p.status === 'PENDING').length,
        totalPendingAmount: allPayouts
            .filter((p) => p.status === 'PENDING')
            .reduce((sum, p) => sum + (p.requestedAmount || 0), 0),
        totalFulfilled: allPayouts.filter((p) => p.status === 'FULFILLED').length,
        totalFulfilledAmount: allPayouts
            .filter((p) => p.status === 'FULFILLED')
            .reduce((sum, p) => sum + (p.requestedAmount || 0), 0),
        totalProcessing: allPayouts.filter((p) => p.status === 'PROCESSING').length,
        totalProcessingAmount: allPayouts
            .filter((p) => p.status === 'PROCESSING')
            .reduce((sum, p) => sum + (p.requestedAmount || 0), 0),
        totalDelayed: allPayouts.filter((p) => p.status === 'DELAYED').length,
        totalDelayedAmount: allPayouts
            .filter((p) => p.status === 'DELAYED')
            .reduce((sum, p) => sum + (p.requestedAmount || 0), 0),
        totalRejected: allPayouts.filter((p) => p.status === 'REJECTED').length,
        totalRejectedAmount: allPayouts
            .filter((p) => p.status === 'REJECTED')
            .reduce((sum, p) => sum + (p.requestedAmount || 0), 0),
        byStatus: {
            PENDING: allPayouts.filter((p) => p.status === 'PENDING').length,
            PROCESSING: allPayouts.filter((p) => p.status === 'PROCESSING').length,
            FULFILLED: allPayouts.filter((p) => p.status === 'FULFILLED').length,
            DELAYED: allPayouts.filter((p) => p.status === 'DELAYED').length,
            REJECTED: allPayouts.filter((p) => p.status === 'REJECTED').length,
        },
        byLedgerStatus: allPayouts.reduce((acc, payout) => {
            const key = payout.ledgerStatus || 'UNKNOWN';
            acc[key] = (acc[key] || 0) + 1;
            return acc;
        }, {}),
    };
    res.json({
        payouts,
        analytics,
        pagination: { page: Number(page), limit: Number(limit), total }
    });
}));
/**
 * GET /api/admin/payouts/:id
 * Get payout request details
 */
router.get('/payouts/:id', auth_js_1.authenticateAdmin, (0, errorHandler_js_1.asyncHandler)(async (req, res) => {
    const { id } = req.params;
    const payout = await prisma_js_1.default.payoutRequest.findUnique({
        where: { id },
        include: {
            event: {
                select: {
                    id: true,
                    name: true,
                    slug: true,
                    ownerName: true,
                    ownerEmail: true,
                    ownerPhone: true,
                },
            },
        },
    });
    if (!payout) {
        throw new errorHandler_js_1.AppError('Payout request not found', 404);
    }
    res.json({ payout });
}));
/**
 * POST /api/admin/payouts/:id/process
 * Process a payout request
 */
router.post('/payouts/:id/process', auth_js_1.authenticateAdmin, (0, errorHandler_js_1.asyncHandler)(async (req, res) => {
    const { id } = req.params;
    const { transactionRef, notes, processedAt } = req.body;
    const payout = await prisma_js_1.default.payoutRequest.findUnique({
        where: { id },
        include: {
            event: {
                select: {
                    id: true,
                    name: true,
                    slug: true,
                    ownerName: true,
                    ownerEmail: true,
                    ownerPhone: true,
                    emailNotifications: true,
                    smsNotifications: true,
                    whatsappNotifications: true,
                },
            },
        },
    });
    if (!payout) {
        throw new errorHandler_js_1.AppError('Payout request not found', 404);
    }
    if (['FULFILLED', 'REJECTED'].includes(payout.status)) {
        throw new errorHandler_js_1.AppError('This payout request has already been finalized', 400);
    }
    // Determine new status based on body (default to PROCESSING)
    const newStatus = req.body.status || 'PROCESSING'; // PROCESSING | FULFILLED | DELAYED
    if (!['PROCESSING', 'FULFILLED', 'DELAYED'].includes(newStatus)) {
        throw new errorHandler_js_1.AppError('Invalid status. Must be PROCESSING, FULFILLED, or DELAYED', 400);
    }
    const shouldAutoTransfer = payout.payoutMethod === 'paystack'
        && newStatus === 'PROCESSING'
        && req.body.autoTransfer !== false
        && ['PENDING', 'DELAYED'].includes(payout.status);
    if (shouldAutoTransfer) {
        const automated = await (0, payoutAutomation_js_1.queuePaystackTransferForPayout)(id, req.admin.id);
        return res.json({
            payout: automated,
            automation: {
                initiated: true,
                message: 'Paystack transfer initiated. Final status will reconcile via webhook.',
            },
        });
    }
    const updated = await prisma_js_1.default.payoutRequest.update({
        where: { id },
        data: {
            status: newStatus,
            ledgerStatus: newStatus === 'FULFILLED' ? 'TRANSFER_SUCCESS' : newStatus === 'DELAYED' ? 'MANUAL_REVIEW' : 'TRANSFER_PENDING',
            processedAt: processedAt ? new Date(processedAt) : new Date(),
            processedBy: req.admin.id,
            transactionRef: transactionRef || null,
            gateway: payout.payoutMethod === 'paystack' ? 'paystack' : 'manual',
            notes: req.body.notes || notes || null,
        },
        include: {
            event: {
                select: {
                    id: true,
                    name: true,
                    slug: true,
                    ownerName: true,
                    ownerEmail: true,
                    ownerPhone: true,
                    emailNotifications: true,
                    smsNotifications: true,
                    whatsappNotifications: true,
                },
            },
        },
    });
    // Send notification to event owner
    const { sendEmail, sendSMS, sendWhatsApp } = await import('../services/notifications.js');
    const event = updated.event;
    const ownerName = event.ownerName || 'Event Owner';
    // Determine notification message based on status
    let emailSubject = '';
    let emailTitle = '';
    let emailMessage = '';
    let smsBody = '';
    let whatsappTitle = '';
    let whatsappMessage = '';
    if (newStatus === 'PROCESSING') {
        emailSubject = `Payout Processing: $${updated.requestedAmount.toFixed(2)}`;
        emailTitle = 'Payout Processing';
        emailMessage = `Your payout request for <strong>${event.name}</strong> is now being processed.`;
        smsBody = `Payout processing for ${event.name}: $${updated.requestedAmount.toFixed(2)} ${updated.currency}.`;
        whatsappTitle = '*Payout Processing*';
        whatsappMessage = `Your payout request for *${event.name}* is now being processed.\n\nAmount: $${updated.requestedAmount.toFixed(2)} ${updated.currency}\nMethod: ${updated.payoutMethod}`;
    }
    else if (newStatus === 'FULFILLED') {
        emailSubject = `Payout Fulfilled: $${updated.requestedAmount.toFixed(2)}`;
        emailTitle = 'Payout Fulfilled';
        emailMessage = `Your payout request for <strong>${event.name}</strong> has been fulfilled successfully.`;
        smsBody = `Payout fulfilled for ${event.name}: $${updated.requestedAmount.toFixed(2)} ${updated.currency}. Transaction Ref: ${updated.transactionRef || 'N/A'}`;
        whatsappTitle = '*Payout Fulfilled*';
        whatsappMessage = `Your payout request for *${event.name}* has been fulfilled.\n\nAmount: $${updated.requestedAmount.toFixed(2)} ${updated.currency}\nMethod: ${updated.payoutMethod}\n${updated.transactionRef ? `Transaction Ref: ${updated.transactionRef}\n` : ''}Thank you!`;
    }
    else if (newStatus === 'DELAYED') {
        emailSubject = `Payout Delayed: $${updated.requestedAmount.toFixed(2)}`;
        emailTitle = 'Payout Delayed';
        emailMessage = `Your payout request for <strong>${event.name}</strong> has been delayed.`;
        smsBody = `Payout delayed for ${event.name}: $${updated.requestedAmount.toFixed(2)} ${updated.currency}.`;
        whatsappTitle = '*Payout Delayed*';
        whatsappMessage = `Your payout request for *${event.name}* has been delayed.\n\nAmount: $${updated.requestedAmount.toFixed(2)} ${updated.currency}\nMethod: ${updated.payoutMethod}`;
    }
    const emailBody = `
    <div style="font-family: sans-serif; max-width: 600px; margin: 0 auto;">
      <h2>${emailTitle}</h2>
      <p>Dear ${ownerName},</p>
      <p>${emailMessage}</p>
      <p><strong>Amount:</strong> $${updated.requestedAmount.toFixed(2)} ${updated.currency}</p>
      <p><strong>Method:</strong> ${updated.payoutMethod}</p>
      ${updated.transactionRef ? `<p><strong>Transaction Reference:</strong> ${updated.transactionRef}</p>` : ''}
      ${updated.notes ? `<p><strong>Notes:</strong> ${updated.notes}</p>` : ''}
      <p>Thank you for using our platform.</p>
    </div>
  `;
    const whatsappBody = `${whatsappTitle}\n\n${whatsappMessage}${updated.notes ? `\n\nNotes: ${updated.notes}` : ''}`;
    if (event.ownerEmail && event.emailNotifications) {
        sendEmail(event.ownerEmail, emailSubject, emailBody).catch(err => console.error('[Notification] Failed to send payout processed email:', err));
    }
    if (event.ownerPhone && event.smsNotifications) {
        sendSMS(event.ownerPhone, smsBody).catch(err => console.error('[Notification] Failed to send payout processed SMS:', err));
    }
    if (event.ownerPhone && event.whatsappNotifications) {
        sendWhatsApp(event.ownerPhone, whatsappBody).catch(err => console.error('[Notification] Failed to send payout processed WhatsApp:', err));
    }
    // Create audit log
    await prisma_js_1.default.auditLog.create({
        data: {
            adminId: req.admin.id,
            eventId: payout.eventId,
            action: 'PAYOUT_PROCESSED',
            entityType: 'PAYOUT',
            entityId: updated.id,
            details: JSON.stringify({
                requestedAmount: updated.requestedAmount,
                currency: updated.currency,
                payoutMethod: updated.payoutMethod,
                transactionRef: updated.transactionRef,
            }),
        },
    });
    res.json({ payout: updated });
}));
/**
 * POST /api/admin/payouts/:id/reject
 * Reject a payout request
 */
router.post('/payouts/:id/reject', auth_js_1.authenticateAdmin, (0, errorHandler_js_1.asyncHandler)(async (req, res) => {
    const { id } = req.params;
    const { reason } = req.body;
    const payout = await prisma_js_1.default.payoutRequest.findUnique({
        where: { id },
        include: {
            event: {
                select: {
                    id: true,
                    name: true,
                    slug: true,
                    ownerName: true,
                    ownerEmail: true,
                    ownerPhone: true,
                    emailNotifications: true,
                    smsNotifications: true,
                    whatsappNotifications: true,
                },
            },
        },
    });
    if (!payout) {
        throw new errorHandler_js_1.AppError('Payout request not found', 404);
    }
    if (payout.status !== 'PENDING') {
        throw new errorHandler_js_1.AppError('Only pending payouts can be rejected', 400);
    }
    const updated = await prisma_js_1.default.payoutRequest.update({
        where: { id },
        data: {
            status: 'REJECTED',
            ledgerStatus: 'REJECTED',
            processedAt: new Date(),
            processedBy: req.admin.id,
            notes: reason || null,
            rejectionReason: reason || null,
        },
        include: {
            event: {
                select: {
                    id: true,
                    name: true,
                    slug: true,
                    ownerName: true,
                    ownerEmail: true,
                    ownerPhone: true,
                    emailNotifications: true,
                    smsNotifications: true,
                    whatsappNotifications: true,
                },
            },
        },
    });
    // Send notification to event owner
    const { sendEmail, sendSMS, sendWhatsApp } = await import('../services/notifications.js');
    const event = updated.event;
    const ownerName = event.ownerName || 'Event Owner';
    const emailSubject = `Payout Request Rejected: $${updated.requestedAmount.toFixed(2)}`;
    const emailBody = `
    <div style="font-family: sans-serif; max-width: 600px; margin: 0 auto;">
      <h2>Payout Request Rejected</h2>
      <p>Dear ${ownerName},</p>
      <p>Your payout request for <strong>${event.name}</strong> has been rejected.</p>
      <p><strong>Amount:</strong> $${updated.requestedAmount.toFixed(2)} ${updated.currency}</p>
      ${reason ? `<p><strong>Reason:</strong> ${reason}</p>` : ''}
      <p>If you have questions, please contact support.</p>
    </div>
  `;
    const smsBody = `Payout request rejected for ${event.name}: $${updated.requestedAmount.toFixed(2)}. ${reason ? `Reason: ${reason}` : ''}`;
    const whatsappBody = `*Payout Request Rejected*\n\nYour payout request for *${event.name}* has been rejected.\n\nAmount: $${updated.requestedAmount.toFixed(2)} ${updated.currency}\n${reason ? `Reason: ${reason}\n` : ''}Please contact support if you have questions.`;
    if (event.ownerEmail && event.emailNotifications) {
        sendEmail(event.ownerEmail, emailSubject, emailBody).catch(err => console.error('[Notification] Failed to send payout rejected email:', err));
    }
    if (event.ownerPhone && event.smsNotifications) {
        sendSMS(event.ownerPhone, smsBody).catch(err => console.error('[Notification] Failed to send payout rejected SMS:', err));
    }
    if (event.ownerPhone && event.whatsappNotifications) {
        sendWhatsApp(event.ownerPhone, whatsappBody).catch(err => console.error('[Notification] Failed to send payout rejected WhatsApp:', err));
    }
    // Create audit log
    await prisma_js_1.default.auditLog.create({
        data: {
            adminId: req.admin.id,
            eventId: payout.eventId,
            action: 'PAYOUT_REJECTED',
            entityType: 'PAYOUT',
            entityId: updated.id,
            details: JSON.stringify({
                requestedAmount: updated.requestedAmount,
                currency: updated.currency,
                reason: reason || null,
            }),
        },
    });
    res.json({ payout: updated });
}));
/**
 * GET /api/admin/payouts/analytics
 * Get payout analytics and statistics
 */
router.get('/payouts/analytics', auth_js_1.authenticateAdmin, (0, errorHandler_js_1.asyncHandler)(async (req, res) => {
    const { startDate, endDate, eventId } = req.query;
    const where = {};
    if (eventId)
        where.eventId = eventId;
    if (startDate || endDate) {
        where.createdAt = {};
        if (startDate)
            where.createdAt.gte = new Date(startDate);
        if (endDate)
            where.createdAt.lte = new Date(endDate);
    }
    const payouts = await prisma_js_1.default.payoutRequest.findMany({
        where,
        include: {
            event: {
                select: {
                    id: true,
                    name: true,
                },
            },
        },
    });
    const analytics = {
        total: payouts.length,
        byStatus: {
            PENDING: payouts.filter((p) => p.status === 'PENDING').length,
            PROCESSING: payouts.filter((p) => p.status === 'PROCESSING').length,
            FULFILLED: payouts.filter((p) => p.status === 'FULFILLED').length,
            DELAYED: payouts.filter((p) => p.status === 'DELAYED').length,
            REJECTED: payouts.filter((p) => p.status === 'REJECTED').length,
        },
        amounts: {
            totalPending: payouts
                .filter(p => p.status === 'PENDING')
                .reduce((sum, p) => sum + (p.requestedAmount || 0), 0),
            totalProcessing: payouts
                .filter((p) => p.status === 'PROCESSING')
                .reduce((sum, p) => sum + (p.requestedAmount || 0), 0),
            totalFulfilled: payouts
                .filter((p) => p.status === 'FULFILLED')
                .reduce((sum, p) => sum + (p.requestedAmount || 0), 0),
            totalDelayed: payouts
                .filter((p) => p.status === 'DELAYED')
                .reduce((sum, p) => sum + (p.requestedAmount || 0), 0),
            totalRejected: payouts
                .filter((p) => p.status === 'REJECTED')
                .reduce((sum, p) => sum + (p.requestedAmount || 0), 0),
        },
        averagePayout: payouts.length > 0
            ? payouts.reduce((sum, p) => sum + (p.requestedAmount || 0), 0) / payouts.length
            : 0,
        byEvent: payouts.reduce((acc, p) => {
            const eventName = p.event?.name || 'Unknown';
            if (!acc[eventName]) {
                acc[eventName] = { count: 0, total: 0 };
            }
            acc[eventName].count++;
            acc[eventName].total += p.requestedAmount || 0;
            return acc;
        }, {}),
        byLedgerStatus: payouts.reduce((acc, payout) => {
            const key = payout.ledgerStatus || 'UNKNOWN';
            acc[key] = (acc[key] || 0) + 1;
            return acc;
        }, {}),
    };
    res.json({ analytics });
}));
exports.default = router;
//# sourceMappingURL=admin.js.map