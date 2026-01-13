import { Router } from 'express';
import prisma from '../utils/prisma.js';
import { asyncHandler, AppError } from '../middleware/errorHandler.js';
import { authenticateOwnerAccount } from '../middleware/auth.js';
import { calculateEventPhase } from '../utils/phase.js';
import { z } from 'zod';

const router = Router();

// All routes require owner authentication
router.use(authenticateOwnerAccount);

/**
 * GET /api/owner-dashboard/events
 * Get all events for the logged-in owner
 */
router.get('/events', asyncHandler(async (req, res) => {
  const ownerId = (req as any).ownerId;

  const events = await prisma.event.findMany({
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
    currentPhase: calculateEventPhase(event),
  }));

  res.json({ events: eventsWithPhase });
}));

/**
 * GET /api/owner-dashboard/events/:eventId
 * Get single event details
 */
router.get('/events/:eventId', asyncHandler(async (req, res) => {
  const ownerId = (req as any).ownerId;
  const { eventId } = req.params;

  const event = await prisma.event.findFirst({
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
    throw new AppError('Event not found', 404);
  }

  res.json({
    event: {
      ...event,
      currentPhase: calculateEventPhase(event),
    },
  });
}));

/**
 * GET /api/owner-dashboard/stats
 * Get overall statistics for the owner
 */
router.get('/stats', asyncHandler(async (req, res) => {
  const ownerId = (req as any).ownerId;

  const events = await prisma.event.findMany({
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
  
  const revenueByCurrency: Record<string, { gross: number; net: number }> = {};
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
router.get('/events/:eventId/rsvps', asyncHandler(async (req, res) => {
  const ownerId = (req as any).ownerId;
  const { eventId } = req.params;
  const { status } = req.query;

  // Verify owner owns this event
  const event = await prisma.event.findFirst({
    where: { id: eventId, ownerId },
    select: { id: true },
  });

  if (!event) {
    throw new AppError('Event not found', 404);
  }

  const where: any = { eventId };
  if (status && status !== 'all') {
    where.status = status;
  }

  const rsvps = await prisma.rSVP.findMany({
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
router.get('/events/:eventId/media', asyncHandler(async (req, res) => {
  const ownerId = (req as any).ownerId;
  const { eventId } = req.params;
  const { type } = req.query;

  // Verify owner owns this event
  const event = await prisma.event.findFirst({
    where: { id: eventId, ownerId },
    select: { id: true },
  });

  if (!event) {
    throw new AppError('Event not found', 404);
  }

  const where: any = { eventId };
  if (type) {
    where.type = type;
  }

  const { downloadFile, BUCKETS, getPublicUrl } = await import('../services/supabaseStorage.js');

  const media = await prisma.mediaAsset.findMany({
    where,
    orderBy: { createdAt: 'desc' },
  });

  // Transform media to include proper URLs
  const mediaWithUrls = media.map(asset => {
    let fileUrl = asset.filePath;
    if (!asset.filePath.startsWith('http://') && !asset.filePath.startsWith('https://')) {
      try {
        fileUrl = getPublicUrl(BUCKETS.MEDIA, asset.filePath);
      } catch {
        fileUrl = asset.filePath.startsWith('/') ? asset.filePath : `/${asset.filePath}`;
      }
    }

    let thumbnailUrl = asset.thumbnailPath;
    if (asset.thumbnailPath && !asset.thumbnailPath.startsWith('http://') && !asset.thumbnailPath.startsWith('https://')) {
      try {
        thumbnailUrl = getPublicUrl(BUCKETS.MEDIA, asset.thumbnailPath);
      } catch {
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
router.get('/events/:eventId/checkins', asyncHandler(async (req, res) => {
  const ownerId = (req as any).ownerId;
  const { eventId } = req.params;

  // Verify owner owns this event
  const event = await prisma.event.findFirst({
    where: { id: eventId, ownerId },
    select: { id: true },
  });

  if (!event) {
    throw new AppError('Event not found', 404);
  }

  const checkIns = await prisma.checkIn.findMany({
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
router.get('/events/:eventId/tickets', asyncHandler(async (req, res) => {
  const ownerId = (req as any).ownerId;
  const { eventId } = req.params;

  // Verify owner owns this event
  const event = await prisma.event.findFirst({
    where: { id: eventId, ownerId },
    select: { id: true },
  });

  if (!event) {
    throw new AppError('Event not found', 404);
  }

  const tickets = await prisma.ticketType.findMany({
    where: { eventId },
    orderBy: { sortOrder: 'asc' },
  });

  res.json({ tickets });
}));

/**
 * GET /api/owner-dashboard/wallet
 * Get wallet configuration for the logged-in owner
 */
router.get('/wallet', asyncHandler(async (req, res) => {
  const ownerId = (req as any).ownerId;
  
  const owner = await prisma.owner.findUnique({
    where: { id: ownerId },
    include: { wallet: true },
  });
  
  if (!owner) {
    throw new AppError('Owner not found', 404);
  }
  
  res.json({ wallet: owner.wallet || null });
}));

/**
 * POST /api/owner-dashboard/wallet
 * Create or update wallet configuration for the logged-in owner
 */
router.post('/wallet', asyncHandler(async (req, res) => {
  const ownerId = (req as any).ownerId;
  
  const owner = await prisma.owner.findUnique({
    where: { id: ownerId },
  });
  
  if (!owner) {
    throw new AppError('Owner not found', 404);
  }
  
  const walletSchema = z.object({
    // Bank Account Details
    bankName: z.string().optional(),
    accountName: z.string().optional(),
    accountNumber: z.string().optional(),
    routingNumber: z.string().optional(),
    swiftCode: z.string().optional(),
    
    // Mobile Money
    mobileProvider: z.enum(['mpesa', 'mtn', 'airtel']).optional(),
    mobileNumber: z.string().optional(),
    
    // Digital Wallets
    paypalEmail: z.string().email().optional(),
    stripeAccountId: z.string().optional(),
    paystackSubaccount: z.string().optional(),
    
    // Payout Preferences
    preferredMethod: z.enum(['bank', 'mobile', 'paypal', 'stripe', 'paystack']).default('bank'),
    currency: z.string().default('USD'),
    autoPayoutEnabled: z.boolean().optional(),
    autoPayoutThreshold: z.number().optional(),
  });
  
  const data = walletSchema.parse(req.body);
  
  const wallet = await (prisma as any).ownerWallet.upsert({
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
router.get('/payouts', asyncHandler(async (req, res) => {
  const ownerId = (req as any).ownerId;

  // Get all events owned by this owner
  const events = await prisma.event.findMany({
    where: { ownerId },
    select: { 
      id: true,
      name: true,
      slug: true,
    },
  });

  const eventIds = events.map(e => e.id);

  // Get all payout requests for these events
  const payouts = await prisma.payoutRequest.findMany({
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
  const eventTotals = await Promise.all(
    events.map(async (event) => {
      // Get all transactions for this event
      const transactions = await prisma.transaction.findMany({
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
    })
  );

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
router.post('/payouts', asyncHandler(async (req, res) => {
  const ownerId = (req as any).ownerId;
  
  const payoutSchema = z.object({
    eventId: z.string().uuid(),
    requestedAmount: z.number().positive(),
    currency: z.string().default('USD'),
    payoutMethod: z.enum(['bank', 'mobile', 'paypal', 'stripe', 'paystack']),
    notes: z.string().optional(),
  });
  
  const data = payoutSchema.parse(req.body);
  
  // Verify event belongs to owner
  const event = await prisma.event.findFirst({
    where: {
      id: data.eventId,
      ownerId,
    },
  });
  
  if (!event) {
    throw new AppError('Event not found or you do not have access', 404);
  }
  
  // Get wallet configuration to verify payout method
  const wallet = await (prisma as any).ownerWallet.findUnique({
    where: { ownerId },
  });
  
  if (!wallet) {
    throw new AppError('Wallet configuration required. Please set up your wallet first.', 400);
  }
  
  // Check if preferred method matches request
  if (wallet.preferredMethod !== data.payoutMethod) {
    // Allow override but warn (optional check)
  }
  
  // Calculate available balance for this event
  const transactions = await prisma.transaction.findMany({
    where: {
      eventId: data.eventId,
      type: 'ticket_sale',
      status: 'completed',
    },
  });
  
  const totalNet = transactions.reduce((sum, t) => sum + (t.netAmount || 0), 0);
  
  // Get existing payout requests for this event
  const existingPayouts = await prisma.payoutRequest.findMany({
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
    throw new AppError(
      `Requested amount (${data.currency} ${data.requestedAmount.toFixed(2)}) exceeds available balance (${data.currency} ${availableBalance.toFixed(2)})`,
      400
    );
  }
  
  // Create payout request
  const payout = await prisma.payoutRequest.create({
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

export default router;

