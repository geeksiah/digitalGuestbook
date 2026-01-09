import { Router } from 'express';
import { v4 as uuidv4 } from 'uuid';
import prisma from '../utils/prisma.js';
import { asyncHandler, AppError } from '../middleware/errorHandler.js';
import { authenticateAdmin } from '../middleware/auth.js';
import { createEventSchema, updateEventSchema } from '../utils/validation.js';
import { calculateEventPhase } from '../utils/phase.js';

const router = Router();

// All routes require admin authentication
router.use(authenticateAdmin);

/**
 * GET /api/events
 * List all events with optional filters
 */
router.get('/', asyncHandler(async (req, res) => {
  const { archived, phase } = req.query;

  const where: any = {};
  
  if (archived === 'true') {
    where.isArchived = true;
  } else if (archived === 'false') {
    where.isArchived = false;
  }

  const events = await prisma.event.findMany({
    where,
    orderBy: { date: 'desc' },
    include: {
      _count: {
        select: {
          rsvps: true,
          invitations: true,
          checkIns: true,
          mediaAssets: true,
        },
      },
    },
  });

  // Calculate current phase for each event
  const eventsWithPhase = events.map((event) => ({
    ...event,
    currentPhase: calculateEventPhase(event),
  }));

  // Filter by phase if requested
  const filtered = phase
    ? eventsWithPhase.filter((e) => e.currentPhase === phase)
    : eventsWithPhase;

  res.json({ events: filtered });
}));

/**
 * GET /api/events/:id
 * Get single event details
 */
router.get('/:id', asyncHandler(async (req, res) => {
  const event = await prisma.event.findUnique({
    where: { id: req.params.id },
    include: {
      invitationTemplate: true,
      rsvpTemplate: true,
      guestbookTemplate: true,
      thankYouTemplate: true,
      _count: {
        select: {
          rsvps: true,
          invitations: true,
          checkIns: true,
          mediaAssets: true,
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
 * POST /api/events
 * Create new event
 */
router.post('/', asyncHandler(async (req, res) => {
  const data = createEventSchema.parse(req.body);

  // Check if slug is unique
  const existing = await prisma.event.findUnique({
    where: { slug: data.slug },
  });

  if (existing) {
    throw new AppError('Event slug already exists', 400);
  }

  const event = await prisma.event.create({
    data: {
      ...data,
      date: new Date(data.date),
      endDate: data.endDate ? new Date(data.endDate) : null,
      ownerAccessToken: crypto.randomUUID(),
    },
  });

  // Create audit log
  await prisma.auditLog.create({
    data: {
      eventId: event.id,
      adminId: req.admin!.id,
      action: 'EVENT_CREATED',
      entityType: 'EVENT',
      entityId: event.id,
      details: JSON.stringify({ name: event.name, slug: event.slug }),
    },
  });

  res.status(201).json({
    event: {
      ...event,
      currentPhase: calculateEventPhase(event),
    },
  });
}));

/**
 * PATCH /api/events/:id
 * Update event
 */
router.patch('/:id', asyncHandler(async (req, res) => {
  const data = updateEventSchema.parse(req.body);

  const existing = await prisma.event.findUnique({
    where: { id: req.params.id },
  });

  if (!existing) {
    throw new AppError('Event not found', 404);
  }

  // Check slug uniqueness if changed
  if (data.slug && data.slug !== existing.slug) {
    const slugExists = await prisma.event.findUnique({
      where: { slug: data.slug },
    });
    if (slugExists) {
      throw new AppError('Event slug already exists', 400);
    }
  }

  const event = await prisma.event.update({
    where: { id: req.params.id },
    data: {
      ...data,
      date: data.date ? new Date(data.date) : undefined,
      endDate: data.endDate ? new Date(data.endDate) : undefined,
    },
  });

  // Create audit log for phase change
  if (data.phase && data.phase !== existing.phase) {
    await prisma.auditLog.create({
      data: {
        eventId: event.id,
        adminId: req.admin!.id,
        action: 'PHASE_CHANGED',
        entityType: 'EVENT',
        entityId: event.id,
        details: JSON.stringify({ 
          from: existing.phase, 
          to: data.phase,
          override: data.phaseOverride ?? existing.phaseOverride,
        }),
      },
    });
  }

  res.json({
    event: {
      ...event,
      currentPhase: calculateEventPhase(event),
    },
  });
}));

/**
 * POST /api/events/:id/phase
 * Set event phase (with override)
 */
router.post('/:id/phase', asyncHandler(async (req, res) => {
  const { phase, override = true } = req.body;

  if (!['PRE_EVENT', 'LIVE', 'POST_EVENT'].includes(phase)) {
    throw new AppError('Invalid phase value', 400);
  }

  const existing = await prisma.event.findUnique({
    where: { id: req.params.id },
  });

  if (!existing) {
    throw new AppError('Event not found', 404);
  }

  const event = await prisma.event.update({
    where: { id: req.params.id },
    data: {
      phase,
      phaseOverride: override,
    },
  });

  // Audit log
  await prisma.auditLog.create({
    data: {
      eventId: event.id,
      adminId: req.admin!.id,
      action: 'PHASE_CHANGED',
      entityType: 'EVENT',
      entityId: event.id,
      details: JSON.stringify({ 
        from: existing.phase, 
        to: phase,
        override,
      }),
    },
  });

  res.json({
    event: {
      ...event,
      currentPhase: calculateEventPhase(event),
    },
  });
}));

/**
 * POST /api/events/:id/reset-phase
 * Reset to automatic phase calculation
 */
router.post('/:id/reset-phase', asyncHandler(async (req, res) => {
  const event = await prisma.event.update({
    where: { id: req.params.id },
    data: { phaseOverride: false },
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
 * POST /api/events/:id/archive
 * Archive event
 */
router.post('/:id/archive', asyncHandler(async (req, res) => {
  const event = await prisma.event.update({
    where: { id: req.params.id },
    data: { isArchived: true },
  });

  if (!event) {
    throw new AppError('Event not found', 404);
  }

  await prisma.auditLog.create({
    data: {
      eventId: event.id,
      adminId: req.admin!.id,
      action: 'EVENT_ARCHIVED',
      entityType: 'EVENT',
      entityId: event.id,
    },
  });

  res.json({ event });
}));

/**
 * POST /api/events/:id/unarchive
 * Unarchive event
 */
router.post('/:id/unarchive', asyncHandler(async (req, res) => {
  const event = await prisma.event.update({
    where: { id: req.params.id },
    data: { isArchived: false },
  });

  if (!event) {
    throw new AppError('Event not found', 404);
  }

  res.json({ event });
}));

/**
 * DELETE /api/events/:id
 * Delete event (superadmin only)
 */
router.delete('/:id', asyncHandler(async (req, res) => {
  if (req.admin?.role !== 'superadmin') {
    throw new AppError('Only superadmins can delete events', 403);
  }

  const event = await prisma.event.findUnique({
    where: { id: req.params.id },
  });

  if (!event) {
    throw new AppError('Event not found', 404);
  }

  await prisma.event.delete({
    where: { id: req.params.id },
  });

  res.json({ message: 'Event deleted successfully' });
}));

/**
 * POST /api/events/:id/regenerate-owner-token
 * Regenerate event owner access token
 */
router.post('/:id/regenerate-owner-token', asyncHandler(async (req, res) => {
  const event = await prisma.event.update({
    where: { id: req.params.id },
    data: { ownerAccessToken: crypto.randomUUID() },
  });

  if (!event) {
    throw new AppError('Event not found', 404);
  }

  res.json({ 
    ownerAccessToken: event.ownerAccessToken,
    ownerPortalUrl: `/event-owner/${event.ownerAccessToken}`,
  });
}));

/**
 * GET /api/events/:id/stats
 * Get event statistics
 */
router.get('/:id/stats', asyncHandler(async (req, res) => {
  const eventId = req.params.id;

  const [
    totalRsvps,
    pendingRsvps,
    approvedRsvps,
    rejectedRsvps,
    totalGuests,
    checkedIn,
    mediaCount,
  ] = await Promise.all([
    prisma.rSVP.count({ where: { eventId } }),
    prisma.rSVP.count({ where: { eventId, status: 'PENDING' } }),
    prisma.rSVP.count({ where: { eventId, status: 'APPROVED' } }),
    prisma.rSVP.count({ where: { eventId, status: 'REJECTED' } }),
    prisma.rSVP.aggregate({
      where: { eventId, status: 'APPROVED' },
      _sum: { guestCount: true },
    }),
    prisma.invitation.count({ where: { eventId, isCheckedIn: true } }),
    prisma.mediaAsset.count({ where: { eventId } }),
  ]);

  // Attendance breakdown
  const attendanceBreakdown = await prisma.rSVP.groupBy({
    by: ['attendance'],
    where: { eventId },
    _count: true,
  });

  // Media breakdown
  const mediaBreakdown = await prisma.mediaAsset.groupBy({
    by: ['type'],
    where: { eventId },
    _count: true,
  });

  res.json({
    stats: {
      rsvps: {
        total: totalRsvps,
        pending: pendingRsvps,
        approved: approvedRsvps,
        rejected: rejectedRsvps,
      },
      attendance: {
        totalExpected: totalGuests._sum.guestCount || 0,
        checkedIn,
      },
      media: {
        total: mediaCount,
        breakdown: mediaBreakdown.reduce((acc, item) => {
          acc[item.type.toLowerCase()] = item._count;
          return acc;
        }, {} as Record<string, number>),
      },
      attendanceBreakdown: attendanceBreakdown.reduce((acc, item) => {
        acc[item.attendance.toLowerCase()] = item._count;
        return acc;
      }, {} as Record<string, number>),
    },
  });
}));

export default router;
