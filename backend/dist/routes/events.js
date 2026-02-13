"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const uuid_1 = require("uuid");
const crypto_1 = require("crypto");
const dns_1 = require("dns");
const multer_1 = __importDefault(require("multer"));
const prisma_js_1 = __importDefault(require("../utils/prisma.js"));
const errorHandler_js_1 = require("../middleware/errorHandler.js");
const auth_js_1 = require("../middleware/auth.js");
const validation_js_1 = require("../utils/validation.js");
const phase_js_1 = require("../utils/phase.js");
const supabaseStorage_js_1 = require("../services/supabaseStorage.js");
const router = (0, express_1.Router)();
const coverUpload = (0, multer_1.default)({
    storage: multer_1.default.memoryStorage(),
    limits: { fileSize: 10 * 1024 * 1024 },
    fileFilter: (_req, file, cb) => {
        if (!file.mimetype.startsWith('image/')) {
            cb(new errorHandler_js_1.AppError('Only image files are allowed for covers', 400));
            return;
        }
        cb(null, true);
    },
});
const normalizeDomainHost = (rawHost) => rawHost.trim().toLowerCase().replace(/^https?:\/\//, '').replace(/\/+$/, '');
const isValidDomainHost = (host) => /^(?:[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?\.)+[a-z]{2,}$/i.test(host);
const resolveCoverUrl = (coverImagePath) => {
    if (!coverImagePath)
        return null;
    if (coverImagePath.startsWith('http://') || coverImagePath.startsWith('https://')) {
        return coverImagePath;
    }
    try {
        return (0, supabaseStorage_js_1.getPublicUrl)(supabaseStorage_js_1.BUCKETS.MEDIA, coverImagePath);
    }
    catch {
        return coverImagePath;
    }
};
// All routes require admin authentication
router.use(auth_js_1.authenticateAdmin);
/**
 * GET /api/events
 * List all events with optional filters
 */
router.get('/', (0, errorHandler_js_1.asyncHandler)(async (req, res) => {
    const { archived, phase } = req.query;
    const where = {};
    if (archived === 'true') {
        where.isArchived = true;
    }
    else if (archived === 'false') {
        where.isArchived = false;
    }
    const events = await prisma_js_1.default.event.findMany({
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
            domains: {
                orderBy: { createdAt: 'asc' },
            },
        },
    });
    // Calculate current phase for each event
    const eventsWithPhase = events.map((event) => ({
        ...event,
        currentPhase: (0, phase_js_1.calculateEventPhase)(event),
        coverImageUrl: resolveCoverUrl(event.coverImagePath),
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
router.get('/:id', (0, errorHandler_js_1.asyncHandler)(async (req, res) => {
    const event = await prisma_js_1.default.event.findUnique({
        where: { id: req.params.id },
        include: {
            invitationTemplate: true,
            rsvpTemplate: true,
            guestbookTemplate: true,
            thankYouTemplate: true,
            liveLandingTemplate: true,
            eventEndedTemplate: true,
            itineraryPageTemplate: true,
            giftingPageTemplate: true,
            domains: {
                orderBy: { createdAt: 'asc' },
            },
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
        throw new errorHandler_js_1.AppError('Event not found', 404);
    }
    res.json({
        event: {
            ...event,
            currentPhase: (0, phase_js_1.calculateEventPhase)(event),
            coverImageUrl: resolveCoverUrl(event.coverImagePath),
        },
    });
}));
/**
 * POST /api/events
 * Create new event
 */
router.post('/', (0, errorHandler_js_1.asyncHandler)(async (req, res) => {
    const data = validation_js_1.createEventSchema.parse(req.body);
    // Enforce logic: check-in disabled when invitation-only is false
    if (!data.invitationOnly && data.checkInEnabled) {
        data.checkInEnabled = false;
    }
    // Check if slug is unique
    const existing = await prisma_js_1.default.event.findUnique({
        where: { slug: data.slug },
    });
    if (existing) {
        throw new errorHandler_js_1.AppError('Event slug already exists', 400);
    }
    const event = await prisma_js_1.default.event.create({
        data: {
            ...data,
            date: new Date(data.date),
            endDate: data.endDate ? new Date(data.endDate) : null,
            socialTitle: data.socialTitle ?? null,
            socialDescription: data.socialDescription ?? null,
            coverImagePath: data.coverImagePath ?? null,
            coverImageAlt: data.coverImageAlt ?? null,
            ownerName: data.ownerName ?? null,
            ownerEmail: data.ownerEmail ?? null,
            ownerPhone: data.ownerPhone ?? null,
            organizationName: data.organizationName ?? null,
            itineraryTemplateId: data.itineraryTemplateId ?? null,
            itineraryPageTemplateId: data.itineraryPageTemplateId ?? null,
            giftingPageTemplateId: data.giftingPageTemplateId ?? null,
            ownerAccessToken: (0, crypto_1.randomUUID)(),
        },
    });
    // Create audit log
    await prisma_js_1.default.auditLog.create({
        data: {
            eventId: event.id,
            adminId: req.admin.id,
            action: 'EVENT_CREATED',
            entityType: 'EVENT',
            entityId: event.id,
            details: JSON.stringify({ name: event.name, slug: event.slug }),
        },
    });
    res.status(201).json({
        event: {
            ...event,
            currentPhase: (0, phase_js_1.calculateEventPhase)(event),
            coverImageUrl: resolveCoverUrl(event.coverImagePath),
        },
    });
}));
/**
 * PATCH /api/events/:id
 * Update event
 */
router.patch('/:id', (0, errorHandler_js_1.asyncHandler)(async (req, res) => {
    const data = validation_js_1.updateEventSchema.parse(req.body);
    const existing = await prisma_js_1.default.event.findUnique({
        where: { id: req.params.id },
    });
    if (!existing) {
        throw new errorHandler_js_1.AppError('Event not found', 404);
    }
    // Check slug uniqueness if changed
    if (data.slug && data.slug !== existing.slug) {
        const slugExists = await prisma_js_1.default.event.findUnique({
            where: { slug: data.slug },
        });
        if (slugExists) {
            throw new errorHandler_js_1.AppError('Event slug already exists', 400);
        }
    }
    // Validate ownerId if provided
    if (data.ownerId !== undefined) {
        if (data.ownerId === null) {
            // Allow clearing ownerId
        }
        else {
            const owner = await prisma_js_1.default.owner.findUnique({
                where: { id: data.ownerId },
            });
            if (!owner) {
                throw new errorHandler_js_1.AppError('Owner not found', 404);
            }
            if (!owner.isActive) {
                throw new errorHandler_js_1.AppError('Cannot assign event to inactive owner', 400);
            }
        }
    }
    // Enforce logic: check-in disabled when invitation-only is false
    if (data.invitationOnly === false && data.checkInEnabled !== undefined) {
        data.checkInEnabled = false;
    }
    // Enforce logic: check-in disabled when invitation-only is false
    const updateData = {
        ...data,
        date: data.date ? new Date(data.date) : undefined,
        endDate: data.endDate === null ? null : data.endDate ? new Date(data.endDate) : undefined,
        socialTitle: data.socialTitle !== undefined ? data.socialTitle : undefined,
        socialDescription: data.socialDescription !== undefined ? data.socialDescription : undefined,
        coverImagePath: data.coverImagePath !== undefined ? data.coverImagePath : undefined,
        coverImageAlt: data.coverImageAlt !== undefined ? data.coverImageAlt : undefined,
        ownerName: data.ownerName !== undefined ? data.ownerName : undefined,
        ownerEmail: data.ownerEmail !== undefined ? data.ownerEmail : undefined,
        ownerPhone: data.ownerPhone !== undefined ? data.ownerPhone : undefined,
        organizationName: data.organizationName !== undefined ? data.organizationName : undefined,
        itineraryTemplateId: data.itineraryTemplateId !== undefined ? data.itineraryTemplateId : undefined,
        itineraryPageTemplateId: data.itineraryPageTemplateId !== undefined ? data.itineraryPageTemplateId : undefined,
        giftingPageTemplateId: data.giftingPageTemplateId !== undefined ? data.giftingPageTemplateId : undefined,
    };
    if (updateData.invitationOnly === false) {
        updateData.checkInEnabled = false;
    }
    const event = await prisma_js_1.default.event.update({
        where: { id: req.params.id },
        data: updateData,
    });
    // Create audit log for phase change
    if (data.phase && data.phase !== existing.phase) {
        await prisma_js_1.default.auditLog.create({
            data: {
                eventId: event.id,
                adminId: req.admin.id,
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
            currentPhase: (0, phase_js_1.calculateEventPhase)(event),
            coverImageUrl: resolveCoverUrl(event.coverImagePath),
        },
    });
}));
/**
 * POST /api/events/:id/phase
 * Set event phase (with override)
 */
router.post('/:id/phase', (0, errorHandler_js_1.asyncHandler)(async (req, res) => {
    const { phase, override = true } = req.body;
    if (!['PRE_EVENT', 'LIVE', 'POST_EVENT'].includes(phase)) {
        throw new errorHandler_js_1.AppError('Invalid phase value', 400);
    }
    const existing = await prisma_js_1.default.event.findUnique({
        where: { id: req.params.id },
    });
    if (!existing) {
        throw new errorHandler_js_1.AppError('Event not found', 404);
    }
    const event = await prisma_js_1.default.event.update({
        where: { id: req.params.id },
        data: {
            phase,
            phaseOverride: override,
        },
    });
    // Audit log
    await prisma_js_1.default.auditLog.create({
        data: {
            eventId: event.id,
            adminId: req.admin.id,
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
            currentPhase: (0, phase_js_1.calculateEventPhase)(event),
        },
    });
}));
/**
 * POST /api/events/:id/reset-phase
 * Reset to automatic phase calculation
 */
router.post('/:id/reset-phase', (0, errorHandler_js_1.asyncHandler)(async (req, res) => {
    const event = await prisma_js_1.default.event.update({
        where: { id: req.params.id },
        data: { phaseOverride: false },
    });
    if (!event) {
        throw new errorHandler_js_1.AppError('Event not found', 404);
    }
    res.json({
        event: {
            ...event,
            currentPhase: (0, phase_js_1.calculateEventPhase)(event),
        },
    });
}));
/**
 * POST /api/events/:id/archive
 * Archive event
 */
router.post('/:id/archive', (0, errorHandler_js_1.asyncHandler)(async (req, res) => {
    const event = await prisma_js_1.default.event.update({
        where: { id: req.params.id },
        data: { isArchived: true },
    });
    if (!event) {
        throw new errorHandler_js_1.AppError('Event not found', 404);
    }
    await prisma_js_1.default.auditLog.create({
        data: {
            eventId: event.id,
            adminId: req.admin.id,
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
router.post('/:id/unarchive', (0, errorHandler_js_1.asyncHandler)(async (req, res) => {
    const event = await prisma_js_1.default.event.update({
        where: { id: req.params.id },
        data: { isArchived: false },
    });
    if (!event) {
        throw new errorHandler_js_1.AppError('Event not found', 404);
    }
    res.json({ event });
}));
/**
 * POST /api/events/:id/cover
 * Upload event cover image
 */
router.post('/:id/cover', coverUpload.single('cover'), (0, errorHandler_js_1.asyncHandler)(async (req, res) => {
    const { id } = req.params;
    const file = req.file;
    const alt = req.body.alt?.trim() || null;
    if (!file) {
        throw new errorHandler_js_1.AppError('Cover image file is required', 400);
    }
    const event = await prisma_js_1.default.event.findUnique({
        where: { id },
        select: { id: true, coverImagePath: true },
    });
    if (!event) {
        throw new errorHandler_js_1.AppError('Event not found', 404);
    }
    const safeName = file.originalname.replace(/[^a-zA-Z0-9_.-]/g, '_');
    const coverPath = `events/${id}/cover-${Date.now()}-${safeName}`;
    const upload = await (0, supabaseStorage_js_1.uploadToSupabase)(supabaseStorage_js_1.BUCKETS.MEDIA, coverPath, file.buffer, {
        contentType: file.mimetype,
        cacheControl: '3600',
        upsert: true,
    });
    if (event.coverImagePath) {
        await (0, supabaseStorage_js_1.deleteFromSupabase)(supabaseStorage_js_1.BUCKETS.MEDIA, event.coverImagePath).catch(() => null);
    }
    const updatedEvent = await prisma_js_1.default.event.update({
        where: { id },
        data: {
            coverImagePath: upload.path,
            coverImageAlt: alt,
        },
    });
    await prisma_js_1.default.auditLog.create({
        data: {
            eventId: id,
            adminId: req.admin.id,
            action: 'EVENT_COVER_UPLOADED',
            entityType: 'EVENT',
            entityId: id,
            details: JSON.stringify({ coverImagePath: upload.path, mimeType: file.mimetype }),
        },
    });
    res.json({
        event: {
            ...updatedEvent,
            coverImageUrl: resolveCoverUrl(updatedEvent.coverImagePath),
        },
    });
}));
/**
 * DELETE /api/events/:id/cover
 * Delete event cover image
 */
router.delete('/:id/cover', (0, errorHandler_js_1.asyncHandler)(async (req, res) => {
    const { id } = req.params;
    const event = await prisma_js_1.default.event.findUnique({
        where: { id },
        select: { id: true, coverImagePath: true },
    });
    if (!event) {
        throw new errorHandler_js_1.AppError('Event not found', 404);
    }
    if (event.coverImagePath) {
        await (0, supabaseStorage_js_1.deleteFromSupabase)(supabaseStorage_js_1.BUCKETS.MEDIA, event.coverImagePath).catch(() => null);
    }
    const updatedEvent = await prisma_js_1.default.event.update({
        where: { id },
        data: { coverImagePath: null, coverImageAlt: null },
    });
    await prisma_js_1.default.auditLog.create({
        data: {
            eventId: id,
            adminId: req.admin.id,
            action: 'EVENT_COVER_DELETED',
            entityType: 'EVENT',
            entityId: id,
        },
    });
    res.json({
        event: {
            ...updatedEvent,
            coverImageUrl: null,
        },
    });
}));
/**
 * GET /api/events/:eventId/domains
 * List custom domains for an event
 */
router.get('/:eventId/domains', (0, errorHandler_js_1.asyncHandler)(async (req, res) => {
    const { eventId } = req.params;
    const event = await prisma_js_1.default.event.findUnique({
        where: { id: eventId },
        select: { id: true },
    });
    if (!event) {
        throw new errorHandler_js_1.AppError('Event not found', 404);
    }
    const domains = await prisma_js_1.default.eventDomain.findMany({
        where: { eventId },
        orderBy: [{ isPrimary: 'desc' }, { createdAt: 'asc' }],
    });
    res.json({
        domains,
        dnsTarget: process.env.DOMAIN_CNAME_TARGET || 'cname.eventpeepo.com',
    });
}));
/**
 * POST /api/events/:eventId/domains
 * Add custom domain
 */
router.post('/:eventId/domains', (0, errorHandler_js_1.asyncHandler)(async (req, res) => {
    const { eventId } = req.params;
    const host = normalizeDomainHost(String(req.body.host || ''));
    const isPrimary = Boolean(req.body.isPrimary);
    if (!isValidDomainHost(host)) {
        throw new errorHandler_js_1.AppError('Please provide a valid domain host', 400);
    }
    const event = await prisma_js_1.default.event.findUnique({
        where: { id: eventId },
        select: { id: true },
    });
    if (!event) {
        throw new errorHandler_js_1.AppError('Event not found', 404);
    }
    const existing = await prisma_js_1.default.eventDomain.findUnique({ where: { host } });
    if (existing) {
        throw new errorHandler_js_1.AppError('Domain is already connected to another event', 400);
    }
    if (isPrimary) {
        await prisma_js_1.default.eventDomain.updateMany({
            where: { eventId },
            data: { isPrimary: false },
        });
    }
    const verificationToken = (0, crypto_1.randomBytes)(16).toString('hex');
    const domain = await prisma_js_1.default.eventDomain.create({
        data: {
            eventId,
            host,
            isPrimary,
            verificationToken,
            status: 'PENDING_VERIFICATION',
        },
    });
    await prisma_js_1.default.auditLog.create({
        data: {
            eventId,
            adminId: req.admin.id,
            action: 'EVENT_DOMAIN_ADDED',
            entityType: 'EVENT_DOMAIN',
            entityId: domain.id,
            details: JSON.stringify({ host }),
        },
    });
    res.status(201).json({
        domain,
        verification: {
            txtName: `_eventpeepo.${host}`,
            txtValue: verificationToken,
            cnameName: host.startsWith('www.') ? host : `www.${host}`,
            cnameValue: process.env.DOMAIN_CNAME_TARGET || 'cname.eventpeepo.com',
        },
    });
}));
/**
 * POST /api/events/:eventId/domains/:domainId/verify
 * Verify custom domain DNS records
 */
router.post('/:eventId/domains/:domainId/verify', (0, errorHandler_js_1.asyncHandler)(async (req, res) => {
    const { eventId, domainId } = req.params;
    const cnameTarget = (process.env.DOMAIN_CNAME_TARGET || 'cname.eventpeepo.com').toLowerCase();
    const domain = await prisma_js_1.default.eventDomain.findFirst({
        where: { id: domainId, eventId },
    });
    if (!domain) {
        throw new errorHandler_js_1.AppError('Domain not found', 404);
    }
    const txtHost = `_eventpeepo.${domain.host}`;
    let txtMatch = false;
    let cnameMatch = false;
    let errorMessage = null;
    try {
        const txtRecords = await dns_1.promises.resolveTxt(txtHost);
        const flat = txtRecords.flat().map((value) => value.trim());
        txtMatch = flat.includes(domain.verificationToken);
    }
    catch {
        txtMatch = false;
    }
    try {
        const cnameHost = domain.host.startsWith('www.') ? domain.host : `www.${domain.host}`;
        const cnameRecords = await dns_1.promises.resolveCname(cnameHost);
        cnameMatch = cnameRecords.some((record) => record.toLowerCase().replace(/\.$/, '') === cnameTarget.replace(/\.$/, ''));
    }
    catch {
        cnameMatch = false;
    }
    const verified = txtMatch && cnameMatch;
    const status = verified ? (domain.isPrimary ? 'ACTIVE' : 'VERIFIED') : 'FAILED';
    if (!verified) {
        errorMessage = 'TXT and/or CNAME records are not yet configured correctly';
    }
    const updated = await prisma_js_1.default.eventDomain.update({
        where: { id: domain.id },
        data: {
            status,
            verificationNotes: errorMessage,
        },
    });
    await prisma_js_1.default.auditLog.create({
        data: {
            eventId,
            adminId: req.admin.id,
            action: 'EVENT_DOMAIN_VERIFIED',
            entityType: 'EVENT_DOMAIN',
            entityId: domain.id,
            details: JSON.stringify({ host: domain.host, status, txtMatch, cnameMatch }),
        },
    });
    res.json({
        domain: updated,
        verification: { txtMatch, cnameMatch, verified },
    });
}));
/**
 * PATCH /api/events/:eventId/domains/:domainId/primary
 * Set primary domain for event
 */
router.patch('/:eventId/domains/:domainId/primary', (0, errorHandler_js_1.asyncHandler)(async (req, res) => {
    const { eventId, domainId } = req.params;
    const domain = await prisma_js_1.default.eventDomain.findFirst({
        where: { id: domainId, eventId },
    });
    if (!domain) {
        throw new errorHandler_js_1.AppError('Domain not found', 404);
    }
    if (!['VERIFIED', 'ACTIVE'].includes(domain.status)) {
        throw new errorHandler_js_1.AppError('Only verified domains can be set as primary', 400);
    }
    await prisma_js_1.default.eventDomain.updateMany({
        where: { eventId },
        data: { isPrimary: false },
    });
    const updated = await prisma_js_1.default.eventDomain.update({
        where: { id: domain.id },
        data: { isPrimary: true, status: 'ACTIVE' },
    });
    await prisma_js_1.default.auditLog.create({
        data: {
            eventId,
            adminId: req.admin.id,
            action: 'EVENT_DOMAIN_SET_PRIMARY',
            entityType: 'EVENT_DOMAIN',
            entityId: domain.id,
            details: JSON.stringify({ host: domain.host }),
        },
    });
    res.json({ domain: updated });
}));
/**
 * DELETE /api/events/:eventId/domains/:domainId
 * Remove a custom domain
 */
router.delete('/:eventId/domains/:domainId', (0, errorHandler_js_1.asyncHandler)(async (req, res) => {
    const { eventId, domainId } = req.params;
    const domain = await prisma_js_1.default.eventDomain.findFirst({
        where: { id: domainId, eventId },
    });
    if (!domain) {
        throw new errorHandler_js_1.AppError('Domain not found', 404);
    }
    await prisma_js_1.default.eventDomain.delete({
        where: { id: domain.id },
    });
    if (domain.isPrimary) {
        const fallback = await prisma_js_1.default.eventDomain.findFirst({
            where: { eventId, status: { in: ['VERIFIED', 'ACTIVE'] } },
            orderBy: { createdAt: 'asc' },
        });
        if (fallback) {
            await prisma_js_1.default.eventDomain.update({
                where: { id: fallback.id },
                data: { isPrimary: true, status: 'ACTIVE' },
            });
        }
    }
    await prisma_js_1.default.auditLog.create({
        data: {
            eventId,
            adminId: req.admin.id,
            action: 'EVENT_DOMAIN_DELETED',
            entityType: 'EVENT_DOMAIN',
            entityId: domain.id,
            details: JSON.stringify({ host: domain.host }),
        },
    });
    res.json({ message: 'Domain removed successfully' });
}));
/**
 * POST /api/events/:id/duplicate
 * Duplicate an event with all its settings
 */
router.post('/:id/duplicate', (0, errorHandler_js_1.asyncHandler)(async (req, res) => {
    const { id } = req.params;
    const { name, slug } = req.body;
    const originalEvent = await prisma_js_1.default.event.findUnique({
        where: { id },
        include: {
            formFields: true,
            ticketTypes: true,
        },
    });
    if (!originalEvent) {
        throw new errorHandler_js_1.AppError('Event not found', 404);
    }
    // Generate new slug if not provided
    let newSlug = slug || `${originalEvent.slug}-copy-${Date.now()}`;
    // Ensure slug is unique
    const existing = await prisma_js_1.default.event.findUnique({ where: { slug: newSlug } });
    if (existing) {
        newSlug = `${newSlug}-${Math.random().toString(36).substr(2, 5)}`;
    }
    // Generate new owner access token
    const newOwnerToken = (0, uuid_1.v4)();
    // Create duplicate event (exclude relations that will be copied separately)
    const { id: _, createdAt: __, updatedAt: ___, ownerAccessToken: ____, formFields: _____, ticketTypes: ______, ...eventData } = originalEvent;
    const duplicatedEvent = await prisma_js_1.default.event.create({
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
        await prisma_js_1.default.eventFormField.createMany({
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
        await prisma_js_1.default.ticketType.createMany({
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
    await prisma_js_1.default.auditLog.create({
        data: {
            adminId: req.admin.id,
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
router.delete('/:id', (0, errorHandler_js_1.asyncHandler)(async (req, res) => {
    if (req.admin?.role !== 'superadmin') {
        throw new errorHandler_js_1.AppError('Only superadmins can delete events', 403);
    }
    const event = await prisma_js_1.default.event.findUnique({
        where: { id: req.params.id },
    });
    if (!event) {
        throw new errorHandler_js_1.AppError('Event not found', 404);
    }
    await prisma_js_1.default.event.delete({
        where: { id: req.params.id },
    });
    // Create audit log
    await prisma_js_1.default.auditLog.create({
        data: {
            adminId: req.admin.id,
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
router.post('/:id/templates', (0, errorHandler_js_1.asyncHandler)(async (req, res) => {
    const { id: eventId } = req.params;
    const { invitationTemplateId, rsvpTemplateId, guestbookTemplateId, guestbookVideoTemplateId, guestbookAudioTemplateId, guestbookPhotoTemplateId, boothTemplateId, boothVideoTemplateId, boothAudioTemplateId, boothPhotoTemplateId, thankYouTemplateId, liveLandingTemplateId, eventEndedTemplateId, itineraryPageTemplateId, giftingPageTemplateId, } = req.body;
    const event = await prisma_js_1.default.event.findUnique({
        where: { id: eventId },
    });
    if (!event) {
        throw new errorHandler_js_1.AppError('Event not found', 404);
    }
    // Debug: log incoming assignment payload
    try {
        console.info(`[Events] Assign templates request for event=${eventId} body=${JSON.stringify(req.body)}`);
    }
    catch (e) {
        console.info('[Events] Assign templates request (unable to stringify body)');
    }
    // Import template assignment logic
    const { copyTemplateAssetsForEvent } = await import('../services/templateIsolation.js');
    // Validate template IDs and types
    const templateAssignments = {};
    // Helper to validate and add template
    const validateAndAdd = async (templateId, fieldName, expectedType, requiresService) => {
        if (templateId === null) {
            templateAssignments[fieldName] = null;
            return;
        }
        if (!templateId)
            return;
        if (requiresService && !requiresService.enabled) {
            throw new errorHandler_js_1.AppError(`Cannot assign ${expectedType} template - ${requiresService.name} service is disabled`, 400);
        }
        const template = await prisma_js_1.default.template.findUnique({ where: { id: templateId } });
        if (!template || template.type !== expectedType) {
            throw new errorHandler_js_1.AppError(`Invalid ${expectedType} template. Expected type: ${expectedType}, got: ${template?.type || 'none'}`, 400);
        }
        templateAssignments[fieldName] = templateId;
    };
    await validateAndAdd(invitationTemplateId, 'invitationTemplateId', 'INVITATION', { enabled: event.invitationEnabled, name: 'invitation' });
    await validateAndAdd(rsvpTemplateId, 'rsvpTemplateId', 'RSVP', { enabled: event.rsvpEnabled, name: 'RSVP' });
    await validateAndAdd(guestbookTemplateId, 'guestbookTemplateId', 'GUESTBOOK', { enabled: event.guestbookEnabled, name: 'guestbook' });
    await validateAndAdd(guestbookVideoTemplateId, 'guestbookVideoTemplateId', 'GUESTBOOK_VIDEO', { enabled: event.guestbookEnabled, name: 'guestbook' });
    await validateAndAdd(guestbookAudioTemplateId, 'guestbookAudioTemplateId', 'GUESTBOOK_AUDIO', { enabled: event.guestbookEnabled, name: 'guestbook' });
    await validateAndAdd(guestbookPhotoTemplateId, 'guestbookPhotoTemplateId', 'GUESTBOOK_PHOTO', { enabled: event.guestbookEnabled, name: 'guestbook' });
    await validateAndAdd(boothTemplateId, 'boothTemplateId', 'BOOTH', { enabled: event.guestbookEnabled, name: 'guestbook/booth' });
    await validateAndAdd(boothVideoTemplateId, 'boothVideoTemplateId', 'BOOTH_VIDEO', { enabled: event.guestbookEnabled, name: 'guestbook/booth' });
    await validateAndAdd(boothAudioTemplateId, 'boothAudioTemplateId', 'BOOTH_AUDIO', { enabled: event.guestbookEnabled, name: 'guestbook/booth' });
    await validateAndAdd(boothPhotoTemplateId, 'boothPhotoTemplateId', 'BOOTH_PHOTO', { enabled: event.guestbookEnabled, name: 'guestbook/booth' });
    await validateAndAdd(thankYouTemplateId, 'thankYouTemplateId', 'THANK_YOU');
    await validateAndAdd(liveLandingTemplateId, 'liveLandingTemplateId', 'LIVE_LANDING');
    await validateAndAdd(eventEndedTemplateId, 'eventEndedTemplateId', 'EVENT_ENDED');
    await validateAndAdd(itineraryPageTemplateId, 'itineraryPageTemplateId', 'ITINERARY', { enabled: event.itineraryEnabled, name: 'itinerary' });
    await validateAndAdd(giftingPageTemplateId, 'giftingPageTemplateId', 'GIFTING', { enabled: event.giftingEnabled, name: 'gifting' });
    // Debug: log validated template assignments before copying/updating
    console.info(`[Events] Validated template assignments for event=${eventId}: ${JSON.stringify(templateAssignments)}`);
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
        itineraryPageTemplateId,
        giftingPageTemplateId,
    });
    const updatedEvent = await prisma_js_1.default.event.update({
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
            itineraryPageTemplate: true,
            giftingPageTemplate: true,
        },
    });
    console.info(`[Events] Updated event ${eventId} templates: ${JSON.stringify({
        invitationTemplateId: updatedEvent.invitationTemplateId,
        rsvpTemplateId: updatedEvent.rsvpTemplateId,
        guestbookTemplateId: updatedEvent.guestbookTemplateId,
        thankYouTemplateId: updatedEvent.thankYouTemplateId,
        liveLandingTemplateId: updatedEvent.liveLandingTemplateId,
        eventEndedTemplateId: updatedEvent.eventEndedTemplateId,
        itineraryPageTemplateId: updatedEvent.itineraryPageTemplateId,
        giftingPageTemplateId: updatedEvent.giftingPageTemplateId,
    })}`);
    // Create audit log
    await prisma_js_1.default.auditLog.create({
        data: {
            eventId,
            adminId: req.admin.id,
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
router.post('/:id/regenerate-owner-token', (0, errorHandler_js_1.asyncHandler)(async (req, res) => {
    const event = await prisma_js_1.default.event.update({
        where: { id: req.params.id },
        data: { ownerAccessToken: (0, crypto_1.randomUUID)() },
    });
    if (!event) {
        throw new errorHandler_js_1.AppError('Event not found', 404);
    }
    res.json({
        ownerAccessToken: event.ownerAccessToken,
        ownerPortalUrl: `/event-owner/${event.ownerAccessToken}`,
    });
}));
// Backward-compatible alias
router.post('/:id/regenerate-couple-token', (0, errorHandler_js_1.asyncHandler)(async (req, res) => {
    const event = await prisma_js_1.default.event.update({
        where: { id: req.params.id },
        data: { ownerAccessToken: (0, crypto_1.randomUUID)() },
    });
    res.json({
        ownerAccessToken: event.ownerAccessToken,
        ownerPortalUrl: `/event-owner/${event.ownerAccessToken}`,
    });
}));
/**
 * GET /api/events/:id/stats
 * Get event statistics
 */
router.get('/:id/stats', (0, errorHandler_js_1.asyncHandler)(async (req, res) => {
    const eventId = req.params.id;
    const [totalRsvps, pendingRsvps, approvedRsvps, rejectedRsvps, totalGuests, checkedIn, mediaCount,] = await Promise.all([
        prisma_js_1.default.rSVP.count({ where: { eventId } }),
        prisma_js_1.default.rSVP.count({ where: { eventId, status: 'PENDING' } }),
        prisma_js_1.default.rSVP.count({ where: { eventId, status: 'APPROVED' } }),
        prisma_js_1.default.rSVP.count({ where: { eventId, status: 'REJECTED' } }),
        prisma_js_1.default.rSVP.aggregate({
            where: { eventId, status: 'APPROVED' },
            _sum: { guestCount: true },
        }),
        prisma_js_1.default.invitation.count({ where: { eventId, isCheckedIn: true } }),
        prisma_js_1.default.mediaAsset.count({ where: { eventId } }),
    ]);
    // Attendance breakdown
    const attendanceBreakdown = await prisma_js_1.default.rSVP.groupBy({
        by: ['attendance'],
        where: { eventId },
        _count: true,
    });
    // Media breakdown
    const mediaBreakdown = await prisma_js_1.default.mediaAsset.groupBy({
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
                }, {}),
            },
            attendanceBreakdown: attendanceBreakdown.reduce((acc, item) => {
                acc[item.attendance.toLowerCase()] = item._count;
                return acc;
            }, {}),
        },
    });
}));
exports.default = router;
//# sourceMappingURL=events.js.map