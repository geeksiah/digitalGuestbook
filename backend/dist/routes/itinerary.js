"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const crypto_1 = require("crypto");
const zod_1 = require("zod");
const prisma_js_1 = __importDefault(require("../utils/prisma.js"));
const errorHandler_js_1 = require("../middleware/errorHandler.js");
const auth_js_1 = require("../middleware/auth.js");
const itineraryRealtime_js_1 = require("../services/itineraryRealtime.js");
const siteUrl_js_1 = require("../utils/siteUrl.js");
const router = (0, express_1.Router)();
const templateSchema = zod_1.z.object({
    name: zod_1.z.string().min(2),
    description: zod_1.z.string().optional().nullable(),
    itemsJson: zod_1.z.string().optional().nullable(),
    isDefault: zod_1.z.boolean().optional(),
});
const itemSchema = zod_1.z.object({
    title: zod_1.z.string().min(1),
    description: zod_1.z.string().optional().nullable(),
    startsAt: zod_1.z.string().datetime().optional().nullable(),
    endsAt: zod_1.z.string().datetime().optional().nullable(),
    location: zod_1.z.string().optional().nullable(),
    sortOrder: zod_1.z.number().int().optional(),
});
// ============================================
// Admin template CRUD
// ============================================
router.get('/templates', auth_js_1.authenticateAdmin, (0, errorHandler_js_1.asyncHandler)(async (_req, res) => {
    const templates = await prisma_js_1.default.itineraryTemplate.findMany({
        orderBy: [{ isDefault: 'desc' }, { createdAt: 'desc' }],
    });
    res.json({ templates });
}));
router.post('/templates', auth_js_1.authenticateAdmin, (0, errorHandler_js_1.asyncHandler)(async (req, res) => {
    const data = templateSchema.parse(req.body);
    const template = await prisma_js_1.default.itineraryTemplate.create({
        data: {
            name: data.name,
            description: data.description ?? null,
            itemsJson: data.itemsJson ?? null,
            isDefault: data.isDefault ?? false,
        },
    });
    res.status(201).json({ template });
}));
router.patch('/templates/:id', auth_js_1.authenticateAdmin, (0, errorHandler_js_1.asyncHandler)(async (req, res) => {
    const data = templateSchema.partial().parse(req.body);
    const template = await prisma_js_1.default.itineraryTemplate.update({
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
router.delete('/templates/:id', auth_js_1.authenticateAdmin, (0, errorHandler_js_1.asyncHandler)(async (req, res) => {
    await prisma_js_1.default.itineraryTemplate.delete({
        where: { id: req.params.id },
    });
    res.json({ message: 'Template deleted' });
}));
// ============================================
// Owner event itinerary management
// ============================================
const requireOwnerEvent = async (ownerId, eventId) => {
    const event = await prisma_js_1.default.event.findFirst({
        where: { id: eventId, ownerId },
        select: { id: true },
    });
    if (!event)
        throw new errorHandler_js_1.AppError('Event not found', 404);
    return event;
};
const requireManagedEvent = async (req, eventId) => {
    if (req.admin?.id) {
        const event = await prisma_js_1.default.event.findUnique({
            where: { id: eventId },
            select: { id: true },
        });
        if (!event)
            throw new errorHandler_js_1.AppError('Event not found', 404);
        return event;
    }
    const ownerId = req.ownerId;
    if (!ownerId)
        throw new errorHandler_js_1.AppError('Authentication required', 401);
    return requireOwnerEvent(ownerId, eventId);
};
router.post('/events/:eventId/apply-template', auth_js_1.authenticateAdminOrOwnerAccount, (0, errorHandler_js_1.asyncHandler)(async (req, res) => {
    const { eventId } = req.params;
    const templateId = String(req.body?.templateId || '');
    await requireManagedEvent(req, eventId);
    const template = await prisma_js_1.default.itineraryTemplate.findUnique({
        where: { id: templateId },
    });
    if (!template)
        throw new errorHandler_js_1.AppError('Template not found', 404);
    const parsedItems = template.itemsJson ? JSON.parse(template.itemsJson) : [];
    if (!Array.isArray(parsedItems))
        throw new errorHandler_js_1.AppError('Template items are invalid', 400);
    await prisma_js_1.default.$transaction(async (tx) => {
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
                data: parsedItems.map((item, index) => ({
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
    (0, itineraryRealtime_js_1.publishItineraryUpdate)(eventId, { reason: 'apply-template' });
    res.json({ message: 'Template applied successfully' });
}));
router.get('/events/:eventId/items', auth_js_1.authenticateAdminOrOwnerAccount, (0, errorHandler_js_1.asyncHandler)(async (req, res) => {
    const { eventId } = req.params;
    await requireManagedEvent(req, eventId);
    const items = await prisma_js_1.default.eventItineraryItem.findMany({
        where: { eventId },
        orderBy: { sortOrder: 'asc' },
    });
    res.json({ items });
}));
router.post('/events/:eventId/items', auth_js_1.authenticateAdminOrOwnerAccount, (0, errorHandler_js_1.asyncHandler)(async (req, res) => {
    const { eventId } = req.params;
    const data = itemSchema.parse(req.body);
    await requireManagedEvent(req, eventId);
    const maxOrder = await prisma_js_1.default.eventItineraryItem.aggregate({
        where: { eventId },
        _max: { sortOrder: true },
    });
    const item = await prisma_js_1.default.eventItineraryItem.create({
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
    await prisma_js_1.default.event.update({
        where: { id: eventId },
        data: { itineraryEnabled: true },
    });
    (0, itineraryRealtime_js_1.publishItineraryUpdate)(eventId, { reason: 'item-created', itemId: item.id });
    res.status(201).json({ item });
}));
router.patch('/events/:eventId/items/:itemId', auth_js_1.authenticateAdminOrOwnerAccount, (0, errorHandler_js_1.asyncHandler)(async (req, res) => {
    const { eventId, itemId } = req.params;
    const data = itemSchema.partial().parse(req.body);
    await requireManagedEvent(req, eventId);
    const existing = await prisma_js_1.default.eventItineraryItem.findFirst({
        where: { id: itemId, eventId },
        select: { id: true },
    });
    if (!existing)
        throw new errorHandler_js_1.AppError('Itinerary item not found', 404);
    const item = await prisma_js_1.default.eventItineraryItem.update({
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
    (0, itineraryRealtime_js_1.publishItineraryUpdate)(eventId, { reason: 'item-updated', itemId: item.id });
    res.json({ item });
}));
router.delete('/events/:eventId/items/:itemId', auth_js_1.authenticateAdminOrOwnerAccount, (0, errorHandler_js_1.asyncHandler)(async (req, res) => {
    const { eventId, itemId } = req.params;
    await requireManagedEvent(req, eventId);
    const existing = await prisma_js_1.default.eventItineraryItem.findFirst({
        where: { id: itemId, eventId },
        select: { id: true },
    });
    if (!existing)
        throw new errorHandler_js_1.AppError('Itinerary item not found', 404);
    await prisma_js_1.default.eventItineraryItem.delete({
        where: { id: existing.id },
    });
    (0, itineraryRealtime_js_1.publishItineraryUpdate)(eventId, { reason: 'item-deleted', itemId: existing.id });
    res.json({ message: 'Itinerary item deleted' });
}));
router.post('/events/:eventId/items/reorder', auth_js_1.authenticateAdminOrOwnerAccount, (0, errorHandler_js_1.asyncHandler)(async (req, res) => {
    const { eventId } = req.params;
    const itemIds = Array.isArray(req.body?.itemIds) ? req.body.itemIds : [];
    if (!itemIds.length)
        throw new errorHandler_js_1.AppError('itemIds must be a non-empty array', 400);
    await requireManagedEvent(req, eventId);
    await prisma_js_1.default.$transaction(itemIds.map((id, index) => prisma_js_1.default.eventItineraryItem.updateMany({
        where: { id, eventId },
        data: { sortOrder: index },
    })));
    (0, itineraryRealtime_js_1.publishItineraryUpdate)(eventId, { reason: 'items-reordered' });
    res.json({ message: 'Items reordered successfully' });
}));
router.post('/events/:eventId/mc-session', auth_js_1.authenticateAdminOrOwnerAccount, (0, errorHandler_js_1.asyncHandler)(async (req, res) => {
    const { eventId } = req.params;
    await requireManagedEvent(req, eventId);
    // 128 bits of entropy is ample for a session token and keeps the URL short
    // enough to read out loud or paste into a chat.
    const token = (0, crypto_1.randomBytes)(16).toString('hex');
    const expiresAt = req.body?.expiresInHours
        ? new Date(Date.now() + Number(req.body.expiresInHours) * 60 * 60 * 1000)
        : null;
    const session = await prisma_js_1.default.itineraryMcSession.create({
        data: {
            eventId,
            token,
            displayName: req.body?.displayName ? String(req.body.displayName) : null,
            expiresAt,
        },
    });
    const event = await prisma_js_1.default.event.findUnique({
        where: { id: eventId },
        select: {
            slug: true,
            domains: { select: { host: true, status: true, isPrimary: true } },
        },
    });
    // Always absolute: the MC opens this on their own phone, so a bare path is
    // useless. Uses the event's connected domain when it has one.
    const mcUrl = (0, siteUrl_js_1.buildEventPublicUrl)(event?.slug || '', `/itinerary/mc/${token}`, event?.domains);
    res.status(201).json({ session, mcUrl });
}));
// ============================================
// MC session public controls
// ============================================
router.get('/mc/:token', (0, errorHandler_js_1.asyncHandler)(async (req, res) => {
    const token = String(req.params.token || '').trim();
    const session = await prisma_js_1.default.itineraryMcSession.findUnique({
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
    if (!session || !session.isActive)
        throw new errorHandler_js_1.AppError('MC session not found', 404);
    if (session.expiresAt && session.expiresAt < new Date())
        throw new errorHandler_js_1.AppError('MC session expired', 410);
    if (!session.event.itineraryEnabled)
        throw new errorHandler_js_1.AppError('Itinerary disabled for this event', 404);
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
router.post('/mc/:token/items/:itemId/toggle', (0, errorHandler_js_1.asyncHandler)(async (req, res) => {
    const token = String(req.params.token || '').trim();
    const { itemId } = req.params;
    const session = await prisma_js_1.default.itineraryMcSession.findUnique({
        where: { token },
        select: { id: true, eventId: true, isActive: true, expiresAt: true },
    });
    if (!session || !session.isActive)
        throw new errorHandler_js_1.AppError('MC session not found', 404);
    if (session.expiresAt && session.expiresAt < new Date())
        throw new errorHandler_js_1.AppError('MC session expired', 410);
    const item = await prisma_js_1.default.eventItineraryItem.findFirst({
        where: { id: itemId, eventId: session.eventId },
    });
    if (!item)
        throw new errorHandler_js_1.AppError('Itinerary item not found', 404);
    const requestedState = req.body?.isCompleted;
    const nextCompleted = typeof requestedState === 'boolean'
        ? requestedState
        : !item.isCompleted;
    const updated = await prisma_js_1.default.eventItineraryItem.update({
        where: { id: item.id },
        data: {
            isCompleted: nextCompleted,
            completedAt: nextCompleted ? new Date() : null,
            completedBySessionId: nextCompleted ? session.id : null,
        },
    });
    (0, itineraryRealtime_js_1.publishItineraryUpdate)(session.eventId, {
        reason: 'item-toggled',
        itemId: updated.id,
        isCompleted: updated.isCompleted,
    });
    res.json({ item: updated });
}));
exports.default = router;
//# sourceMappingURL=itinerary.js.map