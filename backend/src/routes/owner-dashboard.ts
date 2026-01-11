import { Router } from 'express';
import prisma from '../utils/prisma.js';
import { asyncHandler, AppError } from '../middleware/errorHandler.js';
import { authenticateOwnerAccount } from '../middleware/auth.js';
import { calculateEventPhase } from '../utils/phase.js';

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

export default router;

