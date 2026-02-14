import { Router } from 'express';
import prisma from '../utils/prisma.js';
import { asyncHandler, AppError } from '../middleware/errorHandler.js';
import { authenticateAdmin } from '../middleware/auth.js';
import { queuePaystackTransferForPayout } from '../services/payoutAutomation.js';

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
  const { eventId, status, type, startDate, endDate, page = 1, limit = 50 } = req.query;
  const pageNumber = Math.max(1, Number(page) || 1);
  const pageLimit = Math.max(1, Math.min(200, Number(limit) || 50));

  const parseDate = (value?: string, asEndOfDay = false) => {
    if (!value) return null;
    const d = new Date(value);
    if (Number.isNaN(d.getTime())) return null;
    if (asEndOfDay) {
      d.setHours(23, 59, 59, 999);
    }
    return d;
  };

  const start = parseDate(typeof startDate === 'string' ? startDate : undefined, false);
  const end = parseDate(typeof endDate === 'string' ? endDate : undefined, true);

  // Legacy RSVP ticket sales filter (kept for compatibility with existing pages)
  const rsvpWhere: any = {
    ticketType: { not: null },
    amountPaid: { not: null },
  };
  if (eventId) rsvpWhere.eventId = eventId;
  if (status && ['PAID', 'PENDING', 'FAILED', 'REFUNDED'].includes(String(status).toUpperCase())) {
    rsvpWhere.paymentStatus = String(status).toUpperCase();
  }
  if (start) rsvpWhere.submittedAt = { ...rsvpWhere.submittedAt, gte: start };
  if (end) rsvpWhere.submittedAt = { ...rsvpWhere.submittedAt, lte: end };

  const statusMap: Record<string, string> = {
    PAID: 'completed',
    PENDING: 'pending',
    FAILED: 'failed',
    REFUNDED: 'refunded',
  };
  const normalizedStatus = status ? String(status).toUpperCase() : '';
  const txStatus = normalizedStatus ? (statusMap[normalizedStatus] || String(status).toLowerCase()) : undefined;

  const txWhere: any = {};
  if (eventId) txWhere.eventId = eventId;
  if (txStatus) txWhere.status = txStatus;
  if (type) txWhere.type = String(type);
  if (start) txWhere.createdAt = { ...txWhere.createdAt, gte: start };
  if (end) txWhere.createdAt = { ...txWhere.createdAt, lte: end };

  const [rsvps, totalRsvps, transactions, totalTransactions] = await Promise.all([
    prisma.rSVP.findMany({
      where: rsvpWhere,
      include: {
        event: { select: { id: true, name: true, slug: true } },
        invitation: { select: { accessCode: true } },
      },
      orderBy: { submittedAt: 'desc' },
      skip: (pageNumber - 1) * pageLimit,
      take: pageLimit,
    }),
    prisma.rSVP.count({ where: rsvpWhere }),
    prisma.transaction.findMany({
      where: txWhere,
      include: {
        event: { select: { id: true, name: true, slug: true } },
      },
      orderBy: { createdAt: 'desc' },
      skip: (pageNumber - 1) * pageLimit,
      take: pageLimit,
    }),
    prisma.transaction.count({ where: txWhere }),
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

  const initBucket = () => ({ count: 0, gross: 0, adminRevenue: 0, ownerNet: 0, processingFees: 0 });
  const byType: Record<string, ReturnType<typeof initBucket>> = {};
  const byStatus: Record<string, number> = {};
  const byCurrency: Record<string, ReturnType<typeof initBucket>> = {};
  const adminRevenueTransactions: string[] = [];
  const completedTransactions = transactions.filter((t: any) => t.status === 'completed');

  for (const tx of transactions as any[]) {
    if (!byType[tx.type]) byType[tx.type] = initBucket();
    if (!byCurrency[tx.currency]) byCurrency[tx.currency] = initBucket();

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

  const ticketTransactions = transactions.filter((t: any) => t.type === 'ticket_sale');
  const giftTransactions = transactions.filter((t: any) => ['gift_cash', 'gift_package_sale'].includes(t.type));

  const sum = (list: any[], selector: (item: any) => number) =>
    list.reduce((acc, item) => acc + selector(item), 0);

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
    totalFulfilled: allPayouts.filter((p: any) => p.status === 'FULFILLED').length,
    totalFulfilledAmount: allPayouts
      .filter((p: any) => p.status === 'FULFILLED')
      .reduce((sum: number, p: any) => sum + (p.requestedAmount || 0), 0),
    totalProcessing: allPayouts.filter((p: any) => p.status === 'PROCESSING').length,
    totalProcessingAmount: allPayouts
      .filter((p: any) => p.status === 'PROCESSING')
      .reduce((sum: number, p: any) => sum + (p.requestedAmount || 0), 0),
    totalDelayed: allPayouts.filter((p: any) => p.status === 'DELAYED').length,
    totalDelayedAmount: allPayouts
      .filter((p: any) => p.status === 'DELAYED')
      .reduce((sum: number, p: any) => sum + (p.requestedAmount || 0), 0),
    totalRejected: allPayouts.filter((p: any) => p.status === 'REJECTED').length,
    totalRejectedAmount: allPayouts
      .filter((p: any) => p.status === 'REJECTED')
      .reduce((sum: number, p: any) => sum + (p.requestedAmount || 0), 0),
    byStatus: {
      PENDING: allPayouts.filter((p: any) => p.status === 'PENDING').length,
      PROCESSING: allPayouts.filter((p: any) => p.status === 'PROCESSING').length,
      FULFILLED: allPayouts.filter((p: any) => p.status === 'FULFILLED').length,
      DELAYED: allPayouts.filter((p: any) => p.status === 'DELAYED').length,
      REJECTED: allPayouts.filter((p: any) => p.status === 'REJECTED').length,
    },
    byLedgerStatus: (allPayouts as any[]).reduce((acc: Record<string, number>, payout: any) => {
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
  
  if (['FULFILLED', 'REJECTED'].includes(payout.status)) {
    throw new AppError('This payout request has already been finalized', 400);
  }
  
  // Determine new status based on body (default to PROCESSING)
  const newStatus = req.body.status || 'PROCESSING'; // PROCESSING | FULFILLED | DELAYED
  
  if (!['PROCESSING', 'FULFILLED', 'DELAYED'].includes(newStatus)) {
    throw new AppError('Invalid status. Must be PROCESSING, FULFILLED, or DELAYED', 400);
  }

  const shouldAutoTransfer =
    payout.payoutMethod === 'paystack'
    && newStatus === 'PROCESSING'
    && req.body.autoTransfer !== false
    && ['PENDING', 'DELAYED'].includes(payout.status);

  if (shouldAutoTransfer) {
    const automated = await queuePaystackTransferForPayout(id, req.admin!.id);
    return res.json({
      payout: automated,
      automation: {
        initiated: true,
        message: 'Paystack transfer initiated. Final status will reconcile via webhook.',
      },
    });
  }
  
  const updated = await (prisma as any).payoutRequest.update({
    where: { id },
    data: {
      status: newStatus,
      ledgerStatus: newStatus === 'FULFILLED' ? 'TRANSFER_SUCCESS' : newStatus === 'DELAYED' ? 'MANUAL_REVIEW' : 'TRANSFER_PENDING',
      processedAt: processedAt ? new Date(processedAt) : new Date(),
      processedBy: req.admin!.id,
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
  const event = updated.event as any;
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
  } else if (newStatus === 'FULFILLED') {
    emailSubject = `Payout Fulfilled: $${updated.requestedAmount.toFixed(2)}`;
    emailTitle = 'Payout Fulfilled';
    emailMessage = `Your payout request for <strong>${event.name}</strong> has been fulfilled successfully.`;
    smsBody = `Payout fulfilled for ${event.name}: $${updated.requestedAmount.toFixed(2)} ${updated.currency}. Transaction Ref: ${updated.transactionRef || 'N/A'}`;
    whatsappTitle = '*Payout Fulfilled*';
    whatsappMessage = `Your payout request for *${event.name}* has been fulfilled.\n\nAmount: $${updated.requestedAmount.toFixed(2)} ${updated.currency}\nMethod: ${updated.payoutMethod}\n${updated.transactionRef ? `Transaction Ref: ${updated.transactionRef}\n` : ''}Thank you!`;
  } else if (newStatus === 'DELAYED') {
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
  
  const updated = await (prisma as any).payoutRequest.update({
    where: { id },
    data: {
      status: 'REJECTED',
      ledgerStatus: 'REJECTED',
      processedAt: new Date(),
      processedBy: req.admin!.id,
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
      PROCESSING: (payouts as any[]).filter((p: any) => p.status === 'PROCESSING').length,
      FULFILLED: (payouts as any[]).filter((p: any) => p.status === 'FULFILLED').length,
      DELAYED: (payouts as any[]).filter((p: any) => p.status === 'DELAYED').length,
      REJECTED: (payouts as any[]).filter((p: any) => p.status === 'REJECTED').length,
    },
    amounts: {
      totalPending: payouts
        .filter(p => p.status === 'PENDING')
        .reduce((sum: number, p: any) => sum + (p.requestedAmount || 0), 0),
      totalProcessing: payouts
        .filter((p: any) => p.status === 'PROCESSING')
        .reduce((sum: number, p: any) => sum + (p.requestedAmount || 0), 0),
      totalFulfilled: payouts
        .filter((p: any) => p.status === 'FULFILLED')
        .reduce((sum: number, p: any) => sum + (p.requestedAmount || 0), 0),
      totalDelayed: payouts
        .filter((p: any) => p.status === 'DELAYED')
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
    byLedgerStatus: (payouts as any[]).reduce((acc: Record<string, number>, payout: any) => {
      const key = payout.ledgerStatus || 'UNKNOWN';
      acc[key] = (acc[key] || 0) + 1;
      return acc;
    }, {}),
  };
  
  res.json({ analytics });
}));

export default router;
