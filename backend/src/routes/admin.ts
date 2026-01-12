import { Router } from 'express';
import prisma from '../utils/prisma.js';
import { asyncHandler, AppError } from '../middleware/errorHandler.js';
import { authenticateAdmin } from '../middleware/auth.js';

const router = Router();

// ============================================
// DASHBOARD STATS
// ============================================

/**
 * GET /api/admin/dashboard/stats
 * Get dashboard statistics
 */
router.get('/dashboard/stats', authenticateAdmin, asyncHandler(async (req, res) => {
  const [
    totalEvents,
    activeEvents,
    totalRsvps,
    totalPayouts,
    totalPayoutAmount,
  ] = await Promise.all([
    prisma.event.count(),
    prisma.event.count({ where: { phase: { in: ['PLANNING', 'ACTIVE'] } } }),
    prisma.rSVP.count(),
    prisma.payoutRequest.count({ where: { status: 'PENDING' } }),
    prisma.payoutRequest.aggregate({
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
router.get('/sales', authenticateAdmin, asyncHandler(async (req, res) => {
  const { eventId, status, startDate, endDate, page = 1, limit = 50 } = req.query;
  
  const where: any = {
    ticketType: { not: null },
    amountPaid: { not: null },
  };
  
  if (eventId) where.eventId = eventId;
  if (status) where.paymentStatus = status;
  if (startDate) where.submittedAt = { gte: new Date(startDate as string) };
  if (endDate) {
    where.submittedAt = where.submittedAt || {};
    where.submittedAt.lte = new Date(endDate as string);
  }
  
  const [rsvps, total] = await Promise.all([
    prisma.rSVP.findMany({
      where,
      include: {
        event: { select: { id: true, name: true, slug: true } },
        invitation: { select: { accessCode: true } },
      },
      orderBy: { submittedAt: 'desc' },
      skip: (Number(page) - 1) * Number(limit),
      take: Number(limit),
    }),
    prisma.rSVP.count({ where }),
  ]);
  
  const sales = rsvps.filter((r: any) => r.ticketType && r.amountPaid);
  const stats = {
    totalSales: sales.length,
    totalRevenue: sales.reduce((sum: number, s: any) => sum + (s.amountPaid || 0), 0),
    byStatus: {
      PAID: sales.filter((s: any) => s.paymentStatus === 'PAID').length,
      PENDING: sales.filter((s: any) => s.paymentStatus === 'PENDING').length,
      FAILED: sales.filter((s: any) => s.paymentStatus === 'FAILED').length,
      REFUNDED: sales.filter((s: any) => s.paymentStatus === 'REFUNDED').length,
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
router.get('/payouts', authenticateAdmin, asyncHandler(async (req, res) => {
  const { status, eventId, startDate, endDate, page = 1, limit = 50 } = req.query;

  const where: any = {};
  if (status) where.status = status;
  if (eventId) where.eventId = eventId;
  if (startDate) where.createdAt = { ...where.createdAt, gte: new Date(startDate as string) };
  if (endDate) {
    where.createdAt = where.createdAt || {};
    where.createdAt.lte = new Date(endDate as string);
  }
  
  const [payouts, total, stats] = await Promise.all([
    prisma.payoutRequest.findMany({
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
    prisma.payoutRequest.count({ where }),
    prisma.payoutRequest.aggregate({
      where: { status: 'PENDING' },
      _sum: { requestedAmount: true },
      _count: true,
    }),
  ]);
  
  // Calculate additional stats
  const allPayouts = await prisma.payoutRequest.findMany({ where });
  const analytics = {
    totalPending: allPayouts.filter((p: any) => p.status === 'PENDING').length,
    totalPendingAmount: allPayouts
      .filter((p: any) => p.status === 'PENDING')
      .reduce((sum: number, p: any) => sum + (p.requestedAmount || 0), 0),
    totalProcessed: allPayouts.filter((p: any) => p.status === 'PROCESSED').length,
    totalProcessedAmount: allPayouts
      .filter((p: any) => p.status === 'PROCESSED')
      .reduce((sum: number, p: any) => sum + (p.requestedAmount || 0), 0),
    totalRejected: allPayouts.filter((p: any) => p.status === 'REJECTED').length,
    totalRejectedAmount: allPayouts
      .filter((p: any) => p.status === 'REJECTED')
      .reduce((sum: number, p: any) => sum + (p.requestedAmount || 0), 0),
    byStatus: {
      PENDING: allPayouts.filter((p: any) => p.status === 'PENDING').length,
      PROCESSED: allPayouts.filter((p: any) => p.status === 'PROCESSED').length,
      REJECTED: allPayouts.filter((p: any) => p.status === 'REJECTED').length,
      CANCELLED: allPayouts.filter((p: any) => p.status === 'CANCELLED').length,
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
router.get('/payouts/:id', authenticateAdmin, asyncHandler(async (req, res) => {
  const { id } = req.params;
  
  const payout = await prisma.payoutRequest.findUnique({
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
    throw new AppError('Payout request not found', 404);
  }
  
  res.json({ payout });
}));

/**
 * POST /api/admin/payouts/:id/process
 * Process a payout request
 */
router.post('/payouts/:id/process', authenticateAdmin, asyncHandler(async (req, res) => {
  const { id } = req.params;
  const { transactionRef, notes, processedAt } = req.body;
  
  const payout = await prisma.payoutRequest.findUnique({ 
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
    throw new AppError('Payout request not found', 404);
  }
  
  if (payout.status !== 'PENDING') {
    throw new AppError('Only pending payouts can be processed', 400);
  }
  
  const updated = await prisma.payoutRequest.update({
    where: { id },
    data: {
      status: 'PROCESSED',
      processedAt: processedAt ? new Date(processedAt) : new Date(),
      processedBy: req.admin!.id,
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
  const event = updated.event as any;
  const ownerName = event.ownerName || 'Event Owner';
  
  const emailSubject = `Payout Processed: $${updated.requestedAmount.toFixed(2)}`;
  const emailBody = `
    <div style="font-family: sans-serif; max-width: 600px; margin: 0 auto;">
      <h2>Payout Processed</h2>
      <p>Dear ${ownerName},</p>
      <p>Your payout request for <strong>${event.name}</strong> has been processed successfully.</p>
      <p><strong>Amount:</strong> $${updated.requestedAmount.toFixed(2)} ${updated.currency}</p>
      <p><strong>Method:</strong> ${updated.payoutMethod}</p>
      ${updated.transactionRef ? `<p><strong>Transaction Reference:</strong> ${updated.transactionRef}</p>` : ''}
      ${updated.notes ? `<p><strong>Notes:</strong> ${updated.notes}</p>` : ''}
      <p>Thank you for using our platform.</p>
    </div>
  `;
  
  const smsBody = `Payout processed for ${event.name}: $${updated.requestedAmount.toFixed(2)} ${updated.currency}. Transaction Ref: ${updated.transactionRef || 'N/A'}`;
  const whatsappBody = `*Payout Processed*\n\nYour payout request for *${event.name}* has been processed.\n\nAmount: $${updated.requestedAmount.toFixed(2)} ${updated.currency}\nMethod: ${updated.payoutMethod}\n${updated.transactionRef ? `Transaction Ref: ${updated.transactionRef}\n` : ''}Thank you!`;
  
  if (event.ownerEmail && event.emailNotifications) {
    sendEmail(event.ownerEmail, emailSubject, emailBody).catch(err => 
      console.error('[Notification] Failed to send payout processed email:', err)
    );
  }
  
  if (event.ownerPhone && event.smsNotifications) {
    sendSMS(event.ownerPhone, smsBody).catch(err => 
      console.error('[Notification] Failed to send payout processed SMS:', err)
    );
  }
  
  if (event.ownerPhone && event.whatsappNotifications) {
    sendWhatsApp(event.ownerPhone, whatsappBody).catch(err => 
      console.error('[Notification] Failed to send payout processed WhatsApp:', err)
    );
  }
  
  // Create audit log
  await prisma.auditLog.create({
    data: {
      adminId: req.admin!.id,
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
router.post('/payouts/:id/reject', authenticateAdmin, asyncHandler(async (req, res) => {
  const { id } = req.params;
  const { reason } = req.body;
  
  const payout = await prisma.payoutRequest.findUnique({ 
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
    throw new AppError('Payout request not found', 404);
  }
  
  if (payout.status !== 'PENDING') {
    throw new AppError('Only pending payouts can be rejected', 400);
  }
  
  const updated = await prisma.payoutRequest.update({
    where: { id },
    data: {
      status: 'REJECTED',
      processedAt: new Date(),
      processedBy: req.admin!.id,
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
  const event = updated.event as any;
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
    sendEmail(event.ownerEmail, emailSubject, emailBody).catch(err => 
      console.error('[Notification] Failed to send payout rejected email:', err)
    );
  }
  
  if (event.ownerPhone && event.smsNotifications) {
    sendSMS(event.ownerPhone, smsBody).catch(err => 
      console.error('[Notification] Failed to send payout rejected SMS:', err)
    );
  }
  
  if (event.ownerPhone && event.whatsappNotifications) {
    sendWhatsApp(event.ownerPhone, whatsappBody).catch(err => 
      console.error('[Notification] Failed to send payout rejected WhatsApp:', err)
    );
  }
  
  // Create audit log
  await prisma.auditLog.create({
    data: {
      adminId: req.admin!.id,
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
router.get('/payouts/analytics', authenticateAdmin, asyncHandler(async (req, res) => {
  const { startDate, endDate, eventId } = req.query;
  
  const where: any = {};
  if (eventId) where.eventId = eventId;
  if (startDate || endDate) {
    where.createdAt = {};
    if (startDate) where.createdAt.gte = new Date(startDate as string);
    if (endDate) where.createdAt.lte = new Date(endDate as string);
  }
  
  const payouts = await prisma.payoutRequest.findMany({
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
      PENDING: (payouts as any[]).filter((p: any) => p.status === 'PENDING').length,
      PROCESSED: (payouts as any[]).filter((p: any) => p.status === 'PROCESSED').length,
      REJECTED: (payouts as any[]).filter((p: any) => p.status === 'REJECTED').length,
      CANCELLED: (payouts as any[]).filter((p: any) => p.status === 'CANCELLED').length,
    },
    amounts: {
      totalPending: payouts
        .filter(p => p.status === 'PENDING')
        .reduce((sum: number, p: any) => sum + (p.requestedAmount || 0), 0),
      totalProcessed: payouts
        .filter((p: any) => p.status === 'PROCESSED')
        .reduce((sum: number, p: any) => sum + (p.requestedAmount || 0), 0),
      totalRejected: payouts
        .filter((p: any) => p.status === 'REJECTED')
        .reduce((sum: number, p: any) => sum + (p.requestedAmount || 0), 0),
    },
    averagePayout: payouts.length > 0
      ? payouts.reduce((sum: number, p: any) => sum + (p.requestedAmount || 0), 0) / payouts.length
      : 0,
    byEvent: (payouts as any[]).reduce((acc: Record<string, { count: number; total: number }>, p: any) => {
      const eventName = p.event?.name || 'Unknown';
      if (!acc[eventName]) {
        acc[eventName] = { count: 0, total: 0 };
      }
      acc[eventName].count++;
      acc[eventName].total += p.requestedAmount || 0;
      return acc;
    }, {} as Record<string, { count: number; total: number }>),
  };
  
  res.json({ analytics });
}));

export default router;
