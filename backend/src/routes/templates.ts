import { Router } from 'express';
import prisma from '../utils/prisma.js';
import { asyncHandler, AppError } from '../middleware/errorHandler.js';
import { authenticateAdmin } from '../middleware/auth.js';
import { createTemplateSchema, updateTemplateSchema } from '../utils/validation.js';

const router = Router();

// All routes require admin authentication
router.use(authenticateAdmin);

/**
 * GET /api/templates
 * List all templates with optional type filter
 */
router.get('/', asyncHandler(async (req, res) => {
  const { type } = req.query;

  const where: any = {};
  if (type) {
    where.type = type;
  }

  const templates = await prisma.template.findMany({
    where,
    orderBy: [
      { type: 'asc' },
      { isDefault: 'desc' },
      { name: 'asc' },
    ],
    include: {
      _count: {
        select: {
          eventsAsInvitation: true,
          eventsAsRsvp: true,
          eventsAsGuestbook: true,
          eventsAsThankYou: true,
        },
      },
    },
  });

  // Calculate total usage count
  const templatesWithUsage = templates.map((t) => ({
    ...t,
    usageCount: 
      t._count.eventsAsInvitation +
      t._count.eventsAsRsvp +
      t._count.eventsAsGuestbook +
      t._count.eventsAsThankYou,
  }));

  res.json({ templates: templatesWithUsage });
}));

/**
 * GET /api/templates/:id
 * Get single template
 */
router.get('/:id', asyncHandler(async (req, res) => {
  const template = await prisma.template.findUnique({
    where: { id: req.params.id },
    include: {
      eventsAsInvitation: { select: { id: true, name: true, slug: true } },
      eventsAsRsvp: { select: { id: true, name: true, slug: true } },
      eventsAsGuestbook: { select: { id: true, name: true, slug: true } },
      eventsAsThankYou: { select: { id: true, name: true, slug: true } },
    },
  });

  if (!template) {
    throw new AppError('Template not found', 404);
  }

  res.json({ template });
}));

/**
 * POST /api/templates
 * Create new template
 */
router.post('/', asyncHandler(async (req, res) => {
  const data = createTemplateSchema.parse(req.body);

  // If setting as default, unset other defaults of same type
  if (data.isDefault) {
    await prisma.template.updateMany({
      where: { type: data.type, isDefault: true },
      data: { isDefault: false },
    });
  }

  const template = await prisma.template.create({
    data,
  });

  res.status(201).json({ template });
}));

/**
 * PATCH /api/templates/:id
 * Update template
 */
router.patch('/:id', asyncHandler(async (req, res) => {
  const data = updateTemplateSchema.parse(req.body);

  const existing = await prisma.template.findUnique({
    where: { id: req.params.id },
  });

  if (!existing) {
    throw new AppError('Template not found', 404);
  }

  // If setting as default, unset other defaults of same type
  if (data.isDefault && !existing.isDefault) {
    await prisma.template.updateMany({
      where: { 
        type: data.type || existing.type, 
        isDefault: true,
        id: { not: req.params.id },
      },
      data: { isDefault: false },
    });
  }

  const template = await prisma.template.update({
    where: { id: req.params.id },
    data,
  });

  res.json({ template });
}));

/**
 * DELETE /api/templates/:id
 * Delete template
 */
router.delete('/:id', asyncHandler(async (req, res) => {
  const template = await prisma.template.findUnique({
    where: { id: req.params.id },
    include: {
      _count: {
        select: {
          eventsAsInvitation: true,
          eventsAsRsvp: true,
          eventsAsGuestbook: true,
          eventsAsThankYou: true,
        },
      },
    },
  });

  if (!template) {
    throw new AppError('Template not found', 404);
  }

  const totalUsage = 
    template._count.eventsAsInvitation +
    template._count.eventsAsRsvp +
    template._count.eventsAsGuestbook +
    template._count.eventsAsThankYou;

  if (totalUsage > 0) {
    throw new AppError(
      `Cannot delete template that is in use by ${totalUsage} event(s)`,
      400
    );
  }

  await prisma.template.delete({
    where: { id: req.params.id },
  });

  res.json({ message: 'Template deleted successfully' });
}));

/**
 * POST /api/templates/:id/duplicate
 * Duplicate a template
 */
router.post('/:id/duplicate', asyncHandler(async (req, res) => {
  const source = await prisma.template.findUnique({
    where: { id: req.params.id },
  });

  if (!source) {
    throw new AppError('Template not found', 404);
  }

  const template = await prisma.template.create({
    data: {
      name: `${source.name} (Copy)`,
      description: source.description,
      type: source.type,
      htmlContent: source.htmlContent,
      cssContent: source.cssContent,
      jsContent: source.jsContent,
      variables: source.variables,
      isDefault: false,
    },
  });

  res.status(201).json({ template });
}));

/**
 * POST /api/events/:eventId/templates
 * Assign templates to an event
 */
router.post('/assign/:eventId', asyncHandler(async (req, res) => {
  const { eventId } = req.params;
  const {
    invitationTemplateId,
    rsvpTemplateId,
    guestbookTemplateId,
    thankYouTemplateId,
  } = req.body;

  const event = await prisma.event.findUnique({
    where: { id: eventId },
  });

  if (!event) {
    throw new AppError('Event not found', 404);
  }

  // Validate template IDs and types
  const templateAssignments: any = {};

  if (invitationTemplateId) {
    if (!event.invitationEnabled) {
      throw new AppError('Cannot assign invitation template - invitation service is disabled', 400);
    }
    const template = await prisma.template.findUnique({ where: { id: invitationTemplateId } });
    if (!template || template.type !== 'INVITATION') {
      throw new AppError('Invalid invitation template', 400);
    }
    templateAssignments.invitationTemplateId = invitationTemplateId;
  }

  if (rsvpTemplateId) {
    if (!event.rsvpEnabled) {
      throw new AppError('Cannot assign RSVP template - RSVP service is disabled', 400);
    }
    const template = await prisma.template.findUnique({ where: { id: rsvpTemplateId } });
    if (!template || template.type !== 'RSVP') {
      throw new AppError('Invalid RSVP template', 400);
    }
    templateAssignments.rsvpTemplateId = rsvpTemplateId;
  }

  if (guestbookTemplateId) {
    if (!event.guestbookEnabled) {
      throw new AppError('Cannot assign guestbook template - guestbook service is disabled', 400);
    }
    const template = await prisma.template.findUnique({ where: { id: guestbookTemplateId } });
    if (!template || template.type !== 'GUESTBOOK') {
      throw new AppError('Invalid guestbook template', 400);
    }
    templateAssignments.guestbookTemplateId = guestbookTemplateId;
  }

  if (thankYouTemplateId) {
    const template = await prisma.template.findUnique({ where: { id: thankYouTemplateId } });
    if (!template || template.type !== 'THANK_YOU') {
      throw new AppError('Invalid thank-you template', 400);
    }
    templateAssignments.thankYouTemplateId = thankYouTemplateId;
  }

  const updatedEvent = await prisma.event.update({
    where: { id: eventId },
    data: templateAssignments,
    include: {
      invitationTemplate: true,
      rsvpTemplate: true,
      guestbookTemplate: true,
      thankYouTemplate: true,
    },
  });

  res.json({ event: updatedEvent });
}));

export default router;
