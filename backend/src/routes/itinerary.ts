import { Router } from 'express';
import { randomBytes } from 'crypto';
import { z } from 'zod';
import prisma from '../utils/prisma.js';
import { asyncHandler, AppError } from '../middleware/errorHandler.js';
import { authenticateAdmin, authenticateAdminOrOwnerAccount } from '../middleware/auth.js';
import { publishItineraryUpdate } from '../services/itineraryRealtime.js';
import { buildSiteUrl } from '../utils/siteUrl.js';

const router = Router();

const templateSchema = z.object({
  name: z.string().min(2),
  description: z.string().optional().nullable(),
  itemsJson: z.string().optional().nullable(),
  isDefault: z.boolean().optional(),
});

const itemSchema = z.object({
  title: z.string().min(1),
  description: z.string().optional().nullable(),
  startsAt: z.string().datetime().optional().nullable(),
  endsAt: z.string().datetime().optional().nullable(),
  location: z.string().optional().nullable(),
  sortOrder: z.number().int().optional(),
});

// ============================================
// Admin template CRUD
// ============================================

router.get('/templates', authenticateAdmin, asyncHandler(async (_req, res) => {
  const templates = await prisma.itineraryTemplate.findMany({
    orderBy: [{ isDefault: 'desc' }, { createdAt: 'desc' }],
  });
  res.json({ templates });
}));

router.post('/templates', authenticateAdmin, asyncHandler(async (req, res) => {
  const data = templateSchema.parse(req.body);
  const template = await prisma.itineraryTemplate.create({
    data: {
      name: data.name,
      description: data.description ?? null,
      itemsJson: data.itemsJson ?? null,
      isDefault: data.isDefault ?? false,
    },
  });
  res.status(201).json({ template });
}));

router.patch('/templates/:id', authenticateAdmin, asyncHandler(async (req, res) => {
  const data = templateSchema.partial().parse(req.body);
  const template = await prisma.itineraryTemplate.update({
    where: { id: req.params.id },
    data: {
      name: data.name,
      description: data.description,
      itemsJson: data.itemsJson,
      isDefault: data.isDefault,
    },
  });
  res.json({ template });
}));

router.delete('/templates/:id', authenticateAdmin, asyncHandler(async (req, res) => {
  await prisma.itineraryTemplate.delete({
    where: { id: req.params.id },
  });
  res.json({ message: 'Template deleted' });
}));

// ============================================
// Owner event itinerary management
// ============================================

const requireOwnerEvent = async (ownerId: string, eventId: string) => {
  const event = await prisma.event.findFirst({
    where: { id: eventId, ownerId },
    select: { id: true },
  });
  if (!event) throw new AppError('Event not found', 404);
  return event;
};

const requireManagedEvent = async (req: any, eventId: string) => {
  if (req.admin?.id) {
    const event = await prisma.event.findUnique({
      where: { id: eventId },
      select: { id: true },
    });
    if (!event) throw new AppError('Event not found', 404);
    return event;
  }

  const ownerId = req.ownerId as string | undefined;
  if (!ownerId) throw new AppError('Authentication required', 401);
  return requireOwnerEvent(ownerId, eventId);
};

router.post('/events/:eventId/apply-template', authenticateAdminOrOwnerAccount, asyncHandler(async (req, res) => {
  const { eventId } = req.params;
  const templateId = String(req.body?.templateId || '');

  await requireManagedEvent(req as any, eventId);

  const template = await prisma.itineraryTemplate.findUnique({
    where: { id: templateId },
  });
  if (!template) throw new AppError('Template not found', 404);

  const parsedItems = template.itemsJson ? JSON.parse(template.itemsJson) : [];
  if (!Array.isArray(parsedItems)) throw new AppError('Template items are invalid', 400);

  await prisma.$transaction(async (tx) => {
    await tx.event.update({
      where: { id: eventId },
      data: {
        itineraryEnabled: true,
        itineraryTemplateId: template.id,
      },
    });

    await tx.eventItineraryItem.deleteMany({ where: { eventId } });
    if (parsedItems.length) {
      await tx.eventItineraryItem.createMany({
        data: parsedItems.map((item: any, index: number) => ({
          eventId,
          templateId: template.id,
          title: String(item.title || `Item ${index + 1}`),
          description: item.description ? String(item.description) : null,
          startsAt: item.startsAt ? new Date(item.startsAt) : null,
          endsAt: item.endsAt ? new Date(item.endsAt) : null,
          location: item.location ? String(item.location) : null,
          sortOrder: index,
        })),
      });
    }
  });

  publishItineraryUpdate(eventId, { reason: 'apply-template' });

  res.json({ message: 'Template applied successfully' });
}));

router.get('/events/:eventId/items', authenticateAdminOrOwnerAccount, asyncHandler(async (req, res) => {
  const { eventId } = req.params;

  await requireManagedEvent(req as any, eventId);

  const items = await prisma.eventItineraryItem.findMany({
    where: { eventId },
    orderBy: { sortOrder: 'asc' },
  });

  res.json({ items });
}));

router.post('/events/:eventId/items', authenticateAdminOrOwnerAccount, asyncHandler(async (req, res) => {
  const { eventId } = req.params;
  const data = itemSchema.parse(req.body);

  await requireManagedEvent(req as any, eventId);

  const maxOrder = await prisma.eventItineraryItem.aggregate({
    where: { eventId },
    _max: { sortOrder: true },
  });

  const item = await prisma.eventItineraryItem.create({
    data: {
      eventId,
      title: data.title,
      description: data.description ?? null,
      startsAt: data.startsAt ? new Date(data.startsAt) : null,
      endsAt: data.endsAt ? new Date(data.endsAt) : null,
      location: data.location ?? null,
      sortOrder: data.sortOrder ?? ((maxOrder._max.sortOrder ?? -1) + 1),
    },
  });

  await prisma.event.update({
    where: { id: eventId },
    data: { itineraryEnabled: true },
  });

  publishItineraryUpdate(eventId, { reason: 'item-created', itemId: item.id });

  res.status(201).json({ item });
}));

router.patch('/events/:eventId/items/:itemId', authenticateAdminOrOwnerAccount, asyncHandler(async (req, res) => {
  const { eventId, itemId } = req.params;
  const data = itemSchema.partial().parse(req.body);

  await requireManagedEvent(req as any, eventId);

  const existing = await prisma.eventItineraryItem.findFirst({
    where: { id: itemId, eventId },
    select: { id: true },
  });
  if (!existing) throw new AppError('Itinerary item not found', 404);

  const item = await prisma.eventItineraryItem.update({
    where: { id: existing.id },
    data: {
      title: data.title,
      description: data.description !== undefined ? data.description : undefined,
      startsAt: data.startsAt !== undefined ? (data.startsAt ? new Date(data.startsAt) : null) : undefined,
      endsAt: data.endsAt !== undefined ? (data.endsAt ? new Date(data.endsAt) : null) : undefined,
      location: data.location !== undefined ? data.location : undefined,
      sortOrder: data.sortOrder,
    },
  });

  publishItineraryUpdate(eventId, { reason: 'item-updated', itemId: item.id });

  res.json({ item });
}));

router.delete('/events/:eventId/items/:itemId', authenticateAdminOrOwnerAccount, asyncHandler(async (req, res) => {
  const { eventId, itemId } = req.params;
  await requireManagedEvent(req as any, eventId);

  const existing = await prisma.eventItineraryItem.findFirst({
    where: { id: itemId, eventId },
    select: { id: true },
  });
  if (!existing) throw new AppError('Itinerary item not found', 404);

  await prisma.eventItineraryItem.delete({
    where: { id: existing.id },
  });

  publishItineraryUpdate(eventId, { reason: 'item-deleted', itemId: existing.id });

  res.json({ message: 'Itinerary item deleted' });
}));

router.post('/events/:eventId/items/reorder', authenticateAdminOrOwnerAccount, asyncHandler(async (req, res) => {
  const { eventId } = req.params;
  const itemIds = Array.isArray(req.body?.itemIds) ? req.body.itemIds : [];
  if (!itemIds.length) throw new AppError('itemIds must be a non-empty array', 400);

  await requireManagedEvent(req as any, eventId);

  await prisma.$transaction(
    itemIds.map((id: string, index: number) =>
      prisma.eventItineraryItem.updateMany({
        where: { id, eventId },
        data: { sortOrder: index },
      })
    )
  );

  publishItineraryUpdate(eventId, { reason: 'items-reordered' });

  res.json({ message: 'Items reordered successfully' });
}));

router.post('/events/:eventId/mc-session', authenticateAdminOrOwnerAccount, asyncHandler(async (req, res) => {
  const { eventId } = req.params;
  await requireManagedEvent(req as any, eventId);

  // The MC opens this on a phone at the venue, often typed or read aloud, so
  // the link is kept short: base64url instead of hex (22 chars rather than 32)
  // still carries 128 bits of entropy.
  const token = randomBytes(16).toString('base64url');
  const expiresAt = req.body?.expiresInHours
    ? new Date(Date.now() + Number(req.body.expiresInHours) * 60 * 60 * 1000)
    : null;

  const session = await prisma.itineraryMcSession.create({
    data: {
      eventId,
      token,
      displayName: req.body?.displayName ? String(req.body.displayName) : null,
      expiresAt,
    },
  });

  // /mc/<token> is a platform route: the token already identifies the event,
  // so no slug is needed and the URL stays as short as it can be.
  const mcUrl = buildSiteUrl(`/mc/${token}`);

  res.status(201).json({ session, mcUrl });
}));

// ============================================
// MC session public controls
// ============================================

router.get('/mc/:token', asyncHandler(async (req, res) => {
  const token = String(req.params.token || '').trim();
  const session = await prisma.itineraryMcSession.findUnique({
    where: { token },
    include: {
      event: {
        select: {
          id: true,
          slug: true,
          name: true,
          itineraryEnabled: true,
          itineraryItems: {
            orderBy: { sortOrder: 'asc' },
            select: {
              id: true,
              title: true,
              description: true,
              startsAt: true,
              endsAt: true,
              location: true,
              sortOrder: true,
              isCompleted: true,
              completedAt: true,
            },
          },
        },
      },
    },
  });

  if (!session || !session.isActive) throw new AppError('MC session not found', 404);
  if (session.expiresAt && session.expiresAt < new Date()) throw new AppError('MC session expired', 410);
  if (!session.event.itineraryEnabled) throw new AppError('Itinerary disabled for this event', 404);

  res.json({
    session: {
      id: session.id,
      token: session.token,
      displayName: session.displayName,
      expiresAt: session.expiresAt,
    },
    event: session.event,
  });
}));

router.post('/mc/:token/items/:itemId/toggle', asyncHandler(async (req, res) => {
  const token = String(req.params.token || '').trim();
  const { itemId } = req.params;

  const session = await prisma.itineraryMcSession.findUnique({
    where: { token },
    select: { id: true, eventId: true, isActive: true, expiresAt: true },
  });

  if (!session || !session.isActive) throw new AppError('MC session not found', 404);
  if (session.expiresAt && session.expiresAt < new Date()) throw new AppError('MC session expired', 410);

  const item = await prisma.eventItineraryItem.findFirst({
    where: { id: itemId, eventId: session.eventId },
  });
  if (!item) throw new AppError('Itinerary item not found', 404);

  const requestedState = req.body?.isCompleted;
  const nextCompleted =
    typeof requestedState === 'boolean'
      ? requestedState
      : !item.isCompleted;

  const updated = await prisma.eventItineraryItem.update({
    where: { id: item.id },
    data: {
      isCompleted: nextCompleted,
      completedAt: nextCompleted ? new Date() : null,
      completedBySessionId: nextCompleted ? session.id : null,
    },
  });

  publishItineraryUpdate(session.eventId, {
    reason: 'item-toggled',
    itemId: updated.id,
    isCompleted: updated.isCompleted,
  });

  res.json({ item: updated });
}));

export default router;
