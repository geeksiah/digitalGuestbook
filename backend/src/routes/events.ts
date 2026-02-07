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
  
  // Enforce logic: check-in disabled when invitation-only is false
  if (!data.invitationOnly && data.checkInEnabled) {
    data.checkInEnabled = false;
  }

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

  // Validate ownerId if provided
  if (data.ownerId !== undefined) {
    if (data.ownerId === null) {
      // Allow clearing ownerId
    } else {
      const owner = await prisma.owner.findUnique({
        where: { id: data.ownerId },
      });
      if (!owner) {
        throw new AppError('Owner not found', 404);
      }
      if (!owner.isActive) {
        throw new AppError('Cannot assign event to inactive owner', 400);
      }
    }
  }

  // Enforce logic: check-in disabled when invitation-only is false
  if (data.invitationOnly === false && data.checkInEnabled !== undefined) {
    data.checkInEnabled = false;
  }

  // Enforce logic: check-in disabled when invitation-only is false
  const updateData: any = {
    ...data,
    date: data.date ? new Date(data.date) : undefined,
    endDate: data.endDate ? new Date(data.endDate) : undefined,
  };
  
  if (updateData.invitationOnly === false) {
    updateData.checkInEnabled = false;
  }

  const event = await prisma.event.update({
    where: { id: req.params.id },
    data: updateData,
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
 * POST /api/events/:id/duplicate
 * Duplicate an event with all its settings
 */
router.post('/:id/duplicate', asyncHandler(async (req, res) => {
  const { id } = req.params;
  const { name, slug } = req.body;

  const originalEvent = await prisma.event.findUnique({
    where: { id },
    include: {
      formFields: true,
      ticketTypes: true,
    },
  });

  if (!originalEvent) {
    throw new AppError('Event not found', 404);
  }

  // Generate new slug if not provided
  let newSlug = slug || `${originalEvent.slug}-copy-${Date.now()}`;
  
  // Ensure slug is unique
  const existing = await prisma.event.findUnique({ where: { slug: newSlug } });
  if (existing) {
    newSlug = `${newSlug}-${Math.random().toString(36).substr(2, 5)}`;
  }

  // Generate new owner access token
  const newOwnerToken = uuidv4();

  // Create duplicate event (exclude relations that will be copied separately)
  const { id: _, createdAt: __, updatedAt: ___, ownerAccessToken: ____, formFields: _____, ticketTypes: ______, ...eventData } = originalEvent;
  
  const duplicatedEvent = await prisma.event.create({
    data: {
      ...eventData,
      slug: newSlug,
      name: name || `${originalEvent.name} (Copy)`,
      ownerAccessToken: newOwnerToken,
      isArchived: false, // Reset archived status
    },
  });

  // Copy form fields
  if (originalEvent.formFields.length > 0) {
    await prisma.eventFormField.createMany({
      data: originalEvent.formFields.map(field => ({
        eventId: duplicatedEvent.id,
        fieldName: field.fieldName,
        label: field.label,
        type: field.type,
        required: field.required,
        options: field.options,
        sortOrder: field.sortOrder,
      })),
    });
  }

  // Copy ticket types
  if (originalEvent.ticketTypes.length > 0) {
    await prisma.ticketType.createMany({
      data: originalEvent.ticketTypes.map(ticket => ({
        eventId: duplicatedEvent.id,
        name: ticket.name,
        description: ticket.description,
        price: ticket.price,
        currency: ticket.currency,
        quantityTotal: ticket.quantityTotal,
        maxPerOrder: ticket.maxPerOrder,
        isActive: ticket.isActive,
        sortOrder: ticket.sortOrder,
      })),
    });
  }

  // Create audit log
  await prisma.auditLog.create({
    data: {
      adminId: req.admin!.id,
      action: 'EVENT_DUPLICATED',
      entityType: 'EVENT',
      entityId: duplicatedEvent.id,
      details: JSON.stringify({
        originalEventId: id,
        newEventId: duplicatedEvent.id,
        newSlug: newSlug,
      }),
    },
  });

  res.status(201).json({
    event: duplicatedEvent,
    message: 'Event duplicated successfully',
  });
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

  // Create audit log
  await prisma.auditLog.create({
    data: {
      adminId: req.admin!.id,
      action: 'EVENT_DELETED',
      entityType: 'EVENT',
      entityId: req.params.id,
      details: JSON.stringify({ eventName: event.name, slug: event.slug }),
    },
  });

  res.json({ message: 'Event deleted successfully' });
}));

/**
 * POST /api/events/:id/templates
 * Assign templates to an event (with per-event asset isolation)
 */
router.post('/:id/templates', asyncHandler(async (req, res) => {
  const { id: eventId } = req.params;
  const {
    invitationTemplateId,
    rsvpTemplateId,
    guestbookTemplateId,
    guestbookVideoTemplateId,
    guestbookAudioTemplateId,
    guestbookPhotoTemplateId,
    boothTemplateId,
    boothVideoTemplateId,
    boothAudioTemplateId,
    boothPhotoTemplateId,
    thankYouTemplateId,
    liveLandingTemplateId,
    eventEndedTemplateId,
  } = req.body;

  const event = await prisma.event.findUnique({
    where: { id: eventId },
  });

  if (!event) {
    throw new AppError('Event not found', 404);
  }

  // Import template assignment logic
  const { copyTemplateAssetsForEvent } = await import('../services/templateIsolation.js');
  
  // Validate template IDs and types
  const templateAssignments: any = {};

  // Helper to validate and add template
  const validateAndAdd = async (
    templateId: string | null | undefined, 
    fieldName: string, 
    expectedType: string, 
    requiresService?: { enabled: boolean; name: string }
  ) => {
    if (templateId === null) {
      templateAssignments[fieldName] = null;
      return;
    }
    if (!templateId) return;
    
    if (requiresService && !requiresService.enabled) {
      throw new AppError(`Cannot assign ${expectedType} template - ${requiresService.name} service is disabled`, 400);
    }
    
    const template = await prisma.template.findUnique({ where: { id: templateId } });
    if (!template || template.type !== expectedType) {
      throw new AppError(`Invalid ${expectedType} template. Expected type: ${expectedType}, got: ${template?.type || 'none'}`, 400);
    }
    templateAssignments[fieldName] = templateId;
  };

  await validateAndAdd(invitationTemplateId, 'invitationTemplateId', 'INVITATION', 
    { enabled: event.invitationEnabled, name: 'invitation' });
  await validateAndAdd(rsvpTemplateId, 'rsvpTemplateId', 'RSVP', 
    { enabled: event.rsvpEnabled, name: 'RSVP' });
  await validateAndAdd(guestbookTemplateId, 'guestbookTemplateId', 'GUESTBOOK', 
    { enabled: event.guestbookEnabled, name: 'guestbook' });
  await validateAndAdd(guestbookVideoTemplateId, 'guestbookVideoTemplateId', 'GUESTBOOK_VIDEO', 
    { enabled: event.guestbookEnabled, name: 'guestbook' });
  await validateAndAdd(guestbookAudioTemplateId, 'guestbookAudioTemplateId', 'GUESTBOOK_AUDIO', 
    { enabled: event.guestbookEnabled, name: 'guestbook' });
  await validateAndAdd(guestbookPhotoTemplateId, 'guestbookPhotoTemplateId', 'GUESTBOOK_PHOTO', 
    { enabled: event.guestbookEnabled, name: 'guestbook' });
  await validateAndAdd(boothTemplateId, 'boothTemplateId', 'BOOTH', 
    { enabled: event.guestbookEnabled, name: 'guestbook/booth' });
  await validateAndAdd(boothVideoTemplateId, 'boothVideoTemplateId', 'BOOTH_VIDEO', 
    { enabled: event.guestbookEnabled, name: 'guestbook/booth' });
  await validateAndAdd(boothAudioTemplateId, 'boothAudioTemplateId', 'BOOTH_AUDIO', 
    { enabled: event.guestbookEnabled, name: 'guestbook/booth' });
  await validateAndAdd(boothPhotoTemplateId, 'boothPhotoTemplateId', 'BOOTH_PHOTO', 
    { enabled: event.guestbookEnabled, name: 'guestbook/booth' });
  await validateAndAdd(thankYouTemplateId, 'thankYouTemplateId', 'THANK_YOU');
  await validateAndAdd(liveLandingTemplateId, 'liveLandingTemplateId', 'LIVE_LANDING');
  await validateAndAdd(eventEndedTemplateId, 'eventEndedTemplateId', 'EVENT_ENDED');

  // Copy template assets to event-specific directory for isolation
  // This ensures Event A's templates don't leak into Event B
  await copyTemplateAssetsForEvent(eventId, {
    invitationTemplateId,
    rsvpTemplateId,
    guestbookTemplateId,
    guestbookVideoTemplateId,
    guestbookAudioTemplateId,
    guestbookPhotoTemplateId,
    boothTemplateId,
    boothVideoTemplateId,
    boothAudioTemplateId,
    boothPhotoTemplateId,
    thankYouTemplateId,
    liveLandingTemplateId,
    eventEndedTemplateId,
  });

  const updatedEvent = await prisma.event.update({
    where: { id: eventId },
    data: templateAssignments,
    include: {
      invitationTemplate: true,
      rsvpTemplate: true,
      guestbookTemplate: true,
      guestbookVideoTemplate: true,
      guestbookAudioTemplate: true,
      guestbookPhotoTemplate: true,
      boothTemplate: true,
      boothVideoTemplate: true,
      boothAudioTemplate: true,
      boothPhotoTemplate: true,
      thankYouTemplate: true,
      liveLandingTemplate: true,
      eventEndedTemplate: true,
    },
  });

  // Create audit log
  await prisma.auditLog.create({
    data: {
      eventId,
      adminId: req.admin!.id,
      action: 'TEMPLATES_ASSIGNED',
      entityType: 'EVENT',
      entityId: eventId,
      details: JSON.stringify(templateAssignments),
      ipAddress: req.ip,
      userAgent: req.get('user-agent'),
    },
  });

  res.json({ event: updatedEvent, message: 'Templates assigned and assets copied successfully' });
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
