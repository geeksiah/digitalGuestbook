"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const prisma_js_1 = __importDefault(require("../utils/prisma.js"));
const errorHandler_js_1 = require("../middleware/errorHandler.js");
const auth_js_1 = require("../middleware/auth.js");
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
// ============================================
// SALES MANAGEMENT
// ============================================
/**
 * GET /api/admin/sales
 * Get ticket sales across all events
 */
router.get('/sales', auth_js_1.authenticateAdmin, (0, errorHandler_js_1.asyncHandler)(async (req, res) => {
    const { eventId, status, startDate, endDate, page = 1, limit = 50 } = req.query;
    const where = {
        ticketType: { not: null },
        amountPaid: { not: null },
    };
    if (eventId)
        where.eventId = eventId;
    if (status)
        where.paymentStatus = status;
    if (startDate)
        where.submittedAt = { gte: new Date(startDate) };
    if (endDate) {
        where.submittedAt = where.submittedAt || {};
        where.submittedAt.lte = new Date(endDate);
    }
    const [rsvps, total] = await Promise.all([
        prisma_js_1.default.rSVP.findMany({
            where,
            include: {
                event: { select: { id: true, name: true, slug: true } },
                invitation: { select: { accessCode: true } },
            },
            orderBy: { submittedAt: 'desc' },
            skip: (Number(page) - 1) * Number(limit),
            take: Number(limit),
        }),
        prisma_js_1.default.rSVP.count({ where }),
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
    res.json({ sales, stats, pagination: { page: Number(page), limit: Number(limit), total } });
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
        totalProcessed: allPayouts.filter((p) => p.status === 'PROCESSED').length,
        totalProcessedAmount: allPayouts
            .filter((p) => p.status === 'PROCESSED')
            .reduce((sum, p) => sum + (p.requestedAmount || 0), 0),
        totalRejected: allPayouts.filter((p) => p.status === 'REJECTED').length,
        totalRejectedAmount: allPayouts
            .filter((p) => p.status === 'REJECTED')
            .reduce((sum, p) => sum + (p.requestedAmount || 0), 0),
        byStatus: {
            PENDING: allPayouts.filter((p) => p.status === 'PENDING').length,
            PROCESSED: allPayouts.filter((p) => p.status === 'PROCESSED').length,
            REJECTED: allPayouts.filter((p) => p.status === 'REJECTED').length,
            CANCELLED: allPayouts.filter((p) => p.status === 'CANCELLED').length,
        },
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
    const payout = await prisma_js_1.default.payoutRequest.findUnique({ where: { id } });
    if (!payout) {
        throw new errorHandler_js_1.AppError('Payout request not found', 404);
    }
    if (payout.status !== 'PENDING') {
        throw new errorHandler_js_1.AppError('Only pending payouts can be processed', 400);
    }
    const updated = await prisma_js_1.default.payoutRequest.update({
        where: { id },
        data: {
            status: 'PROCESSED',
            processedAt: processedAt ? new Date(processedAt) : new Date(),
            processedBy: req.adminId,
            transactionRef: transactionRef || null,
            notes: notes || null,
        },
        include: {
            event: {
                select: {
                    id: true,
                    name: true,
                    slug: true,
                    ownerName: true,
                    ownerEmail: true,
                },
            },
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
    const payout = await prisma_js_1.default.payoutRequest.findUnique({ where: { id } });
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
            processedAt: new Date(),
            processedBy: req.adminId,
            notes: reason || null,
        },
        include: {
            event: {
                select: {
                    id: true,
                    name: true,
                    slug: true,
                    ownerName: true,
                    ownerEmail: true,
                },
            },
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
            PROCESSED: payouts.filter((p) => p.status === 'PROCESSED').length,
            REJECTED: payouts.filter((p) => p.status === 'REJECTED').length,
            CANCELLED: payouts.filter((p) => p.status === 'CANCELLED').length,
        },
        amounts: {
            totalPending: payouts
                .filter(p => p.status === 'PENDING')
                .reduce((sum, p) => sum + (p.requestedAmount || 0), 0),
            totalProcessed: payouts
                .filter((p) => p.status === 'PROCESSED')
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
    };
    res.json({ analytics });
}));
exports.default = router;
//# sourceMappingURL=admin.js.map