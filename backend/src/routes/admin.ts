import { Router } from 'express';
import prisma from '../utils/prisma.js';
import { asyncHandler, AppError } from '../middleware/errorHandler.js';
import { authenticateAdmin } from '../middleware/auth.js';

const router = Router();

// All routes require admin authentication
router.use(authenticateAdmin);

/**
 * GET /api/admin/dashboard
 * Get admin dashboard stats
 */
router.get('/dashboard', asyncHandler(async (req, res) => {
  const [
    totalEvents,
    activeEvents,
    totalRsvps,
    pendingRsvps,
    totalMedia,
  ] = await Promise.all([
    prisma.event.count({ where: { isArchived: false } }),
    prisma.event.count({ 
      where: { 
        isArchived: false,
        date: { lte: new Date() },
        OR: [
          { endDate: { gte: new Date() } },
          { endDate: null },
        ],
      } 
    }),
    prisma.rSVP.count(),
    prisma.rSVP.count({ where: { status: 'PENDING' } }),
    prisma.mediaAsset.count(),
  ]);

  res.json({
    stats: {
      totalEvents,
      activeEvents,
      totalRsvps,
      pendingRsvps,
      totalMedia,
    },
  });
}));

/**
 * GET /api/admin/audit-logs
 * Get audit logs with pagination
 */
router.get('/audit-logs', asyncHandler(async (req, res) => {
  const { page = '1', limit = '50', eventId, action } = req.query;
  
  const skip = (parseInt(page as string) - 1) * parseInt(limit as string);
  const take = parseInt(limit as string);

  const where: any = {};
  if (eventId) where.eventId = eventId;
  if (action) where.action = action;

  const [logs, total] = await Promise.all([
    prisma.auditLog.findMany({
      where,
      orderBy: { createdAt: 'desc' },
      skip,
      take,
      include: {
        event: { select: { name: true, slug: true } },
        admin: { select: { name: true, email: true } },
      },
    }),
    prisma.auditLog.count({ where }),
  ]);

  res.json({
    logs,
    pagination: {
      page: parseInt(page as string),
      limit: parseInt(limit as string),
      total,
      pages: Math.ceil(total / take),
    },
  });
}));

/**
 * GET /api/admin/admins
 * List all admins (superadmin only)
 */
router.get('/admins', asyncHandler(async (req, res) => {
  if (req.admin?.role !== 'superadmin') {
    throw new AppError('Access denied', 403);
  }

  const admins = await prisma.admin.findMany({
    select: {
      id: true,
      email: true,
      name: true,
      role: true,
      createdAt: true,
    },
    orderBy: { createdAt: 'desc' },
  });

  res.json({ admins });
}));

// ============================================
// PAYOUT MANAGEMENT
// ============================================

/**
 * GET /api/admin/payouts
 * Get all payout requests with filtering
 */
router.get('/payouts', asyncHandler(async (req, res) => {
  const { status, eventId, page = '1', limit = '20' } = req.query;
  
  const skip = (parseInt(page as string) - 1) * parseInt(limit as string);
  const take = parseInt(limit as string);

  const where: any = {};
  if (status) where.status = status;
  if (eventId) where.eventId = eventId;

  const [payouts, total] = await Promise.all([
    prisma.payoutRequest.findMany({
      where,
      orderBy: { createdAt: 'desc' },
      skip,
      take,
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
    }),
    prisma.payoutRequest.count({ where }),
  ]);

  // Get summary stats
  const [pendingCount, pendingAmount, processedToday] = await Promise.all([
    prisma.payoutRequest.count({ where: { status: 'pending' } }),
    prisma.payoutRequest.aggregate({
      where: { status: 'pending' },
      _sum: { requestedAmount: true },
    }),
    prisma.payoutRequest.count({
      where: {
        status: 'completed',
        processedAt: { gte: new Date(new Date().setHours(0, 0, 0, 0)) },
      },
    }),
  ]);

  res.json({
    payouts,
    summary: {
      pendingCount,
      pendingAmount: pendingAmount._sum.requestedAmount || 0,
      processedToday,
    },
    pagination: {
      page: parseInt(page as string),
      limit: parseInt(limit as string),
      total,
      pages: Math.ceil(total / take),
    },
  });
}));

/**
 * GET /api/admin/payouts/:id
 * Get payout details with wallet info
 */
router.get('/payouts/:id', asyncHandler(async (req, res) => {
  const payout = await prisma.payoutRequest.findUnique({
    where: { id: req.params.id },
    include: {
      event: {
        select: {
          id: true,
          name: true,
          slug: true,
          ownerName: true,
          ownerEmail: true,
          ownerPhone: true,
          payoutWallet: true,
        },
      },
    },
  });

  if (!payout) {
    throw new AppError('Payout request not found', 404);
  }

  // Get event balance
  const transactions = await prisma.transaction.findMany({
    where: { eventId: payout.eventId },
  });

  let availableBalance = 0;
  for (const tx of transactions) {
    if (tx.type === 'ticket_sale' && tx.status === 'completed') {
      availableBalance += tx.netAmount;
    } else if (tx.type === 'refund') {
      availableBalance -= Math.abs(tx.netAmount);
    } else if (tx.type === 'payout') {
      availableBalance -= Math.abs(tx.netAmount);
    }
  }

  res.json({ payout, availableBalance });
}));

/**
 * POST /api/admin/payouts/:id/process
 * Process (approve) a payout request
 */
router.post('/payouts/:id/process', asyncHandler(async (req, res) => {
  const { transactionRef, notes } = req.body;

  const payout = await prisma.payoutRequest.findUnique({
    where: { id: req.params.id },
    include: { event: { include: { payoutWallet: true } } },
  });

  if (!payout) {
    throw new AppError('Payout request not found', 404);
  }

  if (payout.status !== 'pending') {
    throw new AppError('Payout is not in pending status', 400);
  }

  // Update payout status
  const updatedPayout = await prisma.payoutRequest.update({
    where: { id: req.params.id },
    data: {
      status: 'completed',
      processedAt: new Date(),
      processedBy: req.admin?.id,
      transactionRef,
      notes: notes || payout.notes,
    },
  });

  // Create transaction record for the payout
  await prisma.transaction.create({
    data: {
      eventId: payout.eventId,
      type: 'payout',
      grossAmount: payout.requestedAmount,
      platformFee: 0,
      processingFee: 0,
      netAmount: -payout.requestedAmount, // Negative because it's an outflow
      currency: payout.currency,
      paymentMethod: payout.payoutMethod,
      paymentRef: transactionRef,
      status: 'completed',
    },
  });

  // Create audit log
  await prisma.auditLog.create({
    data: {
      eventId: payout.eventId,
      adminId: req.admin?.id,
      action: 'PAYOUT_PROCESSED',
      entityType: 'PAYOUT',
      entityId: payout.id,
      details: JSON.stringify({
        amount: payout.requestedAmount,
        currency: payout.currency,
        method: payout.payoutMethod,
        transactionRef,
      }),
    },
  });

  res.json({ payout: updatedPayout, message: 'Payout processed successfully' });
}));

/**
 * POST /api/admin/payouts/:id/reject
 * Reject a payout request
 */
router.post('/payouts/:id/reject', asyncHandler(async (req, res) => {
  const { reason } = req.body;

  if (!reason) {
    throw new AppError('Rejection reason is required', 400);
  }

  const payout = await prisma.payoutRequest.findUnique({
    where: { id: req.params.id },
  });

  if (!payout) {
    throw new AppError('Payout request not found', 404);
  }

  if (payout.status !== 'pending') {
    throw new AppError('Payout is not in pending status', 400);
  }

  const updatedPayout = await prisma.payoutRequest.update({
    where: { id: req.params.id },
    data: {
      status: 'rejected',
      processedAt: new Date(),
      processedBy: req.admin?.id,
      rejectionReason: reason,
    },
  });

  // Create audit log
  await prisma.auditLog.create({
    data: {
      eventId: payout.eventId,
      adminId: req.admin?.id,
      action: 'PAYOUT_REJECTED',
      entityType: 'PAYOUT',
      entityId: payout.id,
      details: JSON.stringify({
        amount: payout.requestedAmount,
        reason,
      }),
    },
  });

  res.json({ payout: updatedPayout, message: 'Payout request rejected' });
}));

/**
 * GET /api/admin/wallets
 * Get all configured payout wallets
 */
router.get('/wallets', asyncHandler(async (req, res) => {
  const wallets = await prisma.payoutWallet.findMany({
    include: {
      event: {
        select: {
          id: true,
          name: true,
          slug: true,
          ownerName: true,
          ownerEmail: true,
          rsvpMode: true,
        },
      },
    },
    orderBy: { createdAt: 'desc' },
  });

  // Mask sensitive data
  const maskedWallets = wallets.map(w => ({
    ...w,
    accountNumber: w.accountNumber ? `****${w.accountNumber.slice(-4)}` : null,
    routingNumber: w.routingNumber ? `****${w.routingNumber.slice(-4)}` : null,
    mobileNumber: w.mobileNumber ? `****${w.mobileNumber.slice(-4)}` : null,
  }));

  res.json({ wallets: maskedWallets });
}));

/**
 * PUT /api/admin/wallets/:id/verify
 * Verify a payout wallet
 */
router.put('/wallets/:id/verify', asyncHandler(async (req, res) => {
  const wallet = await prisma.payoutWallet.update({
    where: { id: req.params.id },
    data: {
      isVerified: true,
      verifiedAt: new Date(),
    },
  });

  res.json({ wallet, message: 'Wallet verified successfully' });
}));

// ============================================
// REEL JOB MANAGEMENT
// ============================================

/**
 * GET /api/admin/reel-jobs
 * Get all reel generation jobs
 */
router.get('/reel-jobs', asyncHandler(async (req, res) => {
  const { status, eventId } = req.query;

  const where: any = {};
  if (status) where.status = status;
  if (eventId) where.eventId = eventId;

  const jobs = await prisma.reelJob.findMany({
    where,
    orderBy: { createdAt: 'desc' },
    include: {
      event: { select: { id: true, name: true, slug: true } },
    },
  });

  res.json({ jobs });
}));

export default router;
