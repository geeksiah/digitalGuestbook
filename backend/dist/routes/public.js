"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const prisma_js_1 = __importDefault(require("../utils/prisma.js"));
const errorHandler_js_1 = require("../middleware/errorHandler.js");
const phase_js_1 = require("../utils/phase.js");
const template_helper_js_1 = require("../utils/template-helper.js");
const router = (0, express_1.Router)();
// Event select fields for public routes (includes template IDs)
const EVENT_PUBLIC_SELECT = {
    id: true,
    slug: true,
    name: true,
    description: true,
    date: true,
    endDate: true,
    timezone: true,
    venue: true,
    ownerName: true,
    ownerEmail: true,
    ownerPhone: true,
    organizationName: true,
    primaryColor: true,
    secondaryColor: true,
    accentColor: true,
    phase: true,
    phaseOverride: true,
    invitationEnabled: true,
    rsvpEnabled: true,
    guestbookEnabled: true,
    checkInEnabled: true,
    invitationOnly: true,
    isArchived: true,
    invitationTemplateId: true,
    rsvpTemplateId: true,
    guestbookTemplateId: true,
    guestbookVideoTemplateId: true,
    guestbookAudioTemplateId: true,
    guestbookPhotoTemplateId: true,
    boothTemplateId: true,
    boothVideoTemplateId: true,
    boothAudioTemplateId: true,
    boothPhotoTemplateId: true,
    thankYouTemplateId: true,
    liveLandingTemplateId: true,
    eventEndedTemplateId: true,
    ownerAccessToken: true,
    maxRecordingDuration: true,
    minRecordingDuration: true,
    maxPhotosPerGuest: true,
    maxPhotosPerBoothSession: true,
    boothShutterCountdown: true,
    reelEnabled: true,
    notifyOnRsvp: true,
    notifyOnCheckIn: true,
    notifyOnGuestbook: true,
    emailNotifications: true,
    smsNotifications: true,
    whatsappNotifications: true,
};
/**
 * GET /api/public/event/:slug
 * Get public event information
 */
router.get('/event/:slug', (0, errorHandler_js_1.asyncHandler)(async (req, res) => {
    const event = await prisma_js_1.default.event.findUnique({
        where: { slug: req.params.slug },
        select: EVENT_PUBLIC_SELECT,
    });
    if (!event) {
        throw new errorHandler_js_1.AppError('Event not found', 404);
    }
    if (event.isArchived) {
        throw new errorHandler_js_1.AppError('This event is no longer available', 410);
    }
    const currentPhase = (0, phase_js_1.calculateEventPhase)(event);
    const capabilities = (0, phase_js_1.getPhaseCapabilities)(currentPhase);
    res.json({
        event: {
            id: event.id,
            slug: event.slug,
            name: event.name,
            description: event.description,
            date: event.date,
            endDate: event.endDate,
            timezone: event.timezone,
            venue: event.venue,
            phase: currentPhase,
            capabilities,
            services: {
                invitation: event.invitationEnabled,
                rsvp: event.rsvpEnabled,
                guestbook: event.guestbookEnabled,
                checkIn: event.checkInEnabled,
            },
            invitationOnly: event.invitationOnly,
        },
        urls: {
            rsvp: event.rsvpEnabled ? `/e/${event.slug}/rsvp` : null,
            guestbook: event.guestbookEnabled ? `/e/${event.slug}/guestbook` : null,
            booth: event.guestbookEnabled ? `/e/${event.slug}/booth` : null,
            thankYou: `/e/${event.slug}/thanks`,
        },
    });
}));
/**
 * GET /api/public/event/:slug/invitation
 * Get rendered invitation page
 */
router.get('/event/:slug/invitation', (0, errorHandler_js_1.asyncHandler)(async (req, res) => {
    const event = await prisma_js_1.default.event.findUnique({
        where: { slug: req.params.slug },
        select: EVENT_PUBLIC_SELECT,
    });
    if (!event) {
        throw new errorHandler_js_1.AppError('Event not found', 404);
    }
    if (!event.invitationEnabled) {
        throw new errorHandler_js_1.AppError('Invitation page not available', 404);
    }
    const currentPhase = (0, phase_js_1.calculateEventPhase)(event);
    const capabilities = (0, phase_js_1.getPhaseCapabilities)(currentPhase);
    // Use helper function
    const template = await (0, template_helper_js_1.getEventTemplate)('INVITATION', event.invitationTemplateId);
    if (!template) {
        return res.json({
            template: null,
            data: {
                event: {
                    name: event.name,
                    description: event.description,
                    date: event.date,
                    venue: event.venue,
                },
                phase: currentPhase,
                capabilities,
                urls: {
                    rsvp: event.rsvpEnabled && capabilities.canSubmitRsvp
                        ? `/e/${event.slug}/rsvp`
                        : null,
                    guestbook: event.guestbookEnabled && capabilities.canAccessGuestbook
                        ? `/e/${event.slug}/guestbook`
                        : null,
                },
            },
        });
    }
    // Render using shared renderer
    const templateData = {
        event: {
            name: event.name,
            description: event.description,
            date: event.date,
            formattedDate: new Date(event.date).toLocaleDateString('en-US', {
                weekday: 'long',
                year: 'numeric',
                month: 'long',
                day: 'numeric',
                hour: 'numeric',
                minute: '2-digit',
            }),
            venue: event.venue,
        },
        phase: currentPhase,
        capabilities,
        urls: {
            rsvp: `/e/${event.slug}/rsvp`,
            guestbook: `/e/${event.slug}/guestbook`,
            booth: `/e/${event.slug}/booth`,
            thankYou: `/e/${event.slug}/thanks`,
        },
    };
    await renderEventTemplate(event, 'INVITATION', event.invitationTemplateId, templateData, res);
}));
/**
 * GET /api/public/event/:slug/thank-you
 * Get thank-you page
 */
router.get('/event/:slug/thank-you', (0, errorHandler_js_1.asyncHandler)(async (req, res) => {
    const event = await prisma_js_1.default.event.findUnique({
        where: { slug: req.params.slug },
        select: EVENT_PUBLIC_SELECT,
    });
    if (!event) {
        throw new errorHandler_js_1.AppError('Event not found', 404);
    }
    const currentPhase = (0, phase_js_1.calculateEventPhase)(event);
    // Thank-you page is only for POST_EVENT phase
    if (currentPhase !== 'POST_EVENT') {
        return res.redirect(`/e/${event.slug}`);
    }
    // Use helper function
    const template = await (0, template_helper_js_1.getEventTemplate)('THANK_YOU', event.thankYouTemplateId);
    if (!template) {
        return res.json({
            template: null,
            data: {
                event: {
                    name: event.name,
                    date: event.date,
                },
                message: 'Thank you for being part of our special day!',
            },
        });
    }
    // Render template
    const templateData = {
        event: {
            name: event.name,
            date: event.date,
        },
    };
    // Use shared renderer to ensure asset path resolution and consistent rendering
    await renderEventTemplate(event, 'THANK_YOU', event.thankYouTemplateId, templateData, res);
}));
// Helper function to render template with event data
async function renderEventTemplate(event, templateType, templateId, templateData, res) {
    const template = await (0, template_helper_js_1.getEventTemplate)(templateType, templateId);
    // Debug: log which template was selected for rendering
    try {
        console.info(`[Render] event=${event.id} templateType=${templateType} assignedId=${templateId} selectedTemplate=${template?.id || 'none'} type=${template?.type || 'none'}`);
    }
    catch (e) {
        console.info('[Render] Selected template (unable to stringify)');
    }
    if (!template) {
        return res.json({
            template: null,
            data: templateData,
        });
    }
    // Replace template variables
    let html = template.htmlContent;
    const replaceVariables = (template, data, prefix = '') => {
        return template.replace(/\{\{([^}]+)\}\}/g, (match, path) => {
            const fullPath = prefix ? `${prefix}.${path}` : path;
            const keys = path.split('.');
            let value = data;
            for (const key of keys) {
                if (value && typeof value === 'object' && key in value) {
                    value = value[key];
                }
                else {
                    return match; // Keep original if not found
                }
            }
            return String(value ?? '');
        });
    };
    html = replaceVariables(html, templateData);
    // Inject CSS and JS
    if (template.cssContent) {
        html = html.replace('</head>', `<style>${template.cssContent}</style></head>`);
    }
    if (template.jsContent) {
        html = html.replace('</body>', `<script>${template.jsContent}</script></body>`);
    }
    res.send(html);
}
/**
 * GET /api/public/event/:slug/rsvp
 * Get RSVP form page
 */
router.get('/event/:slug/rsvp', (0, errorHandler_js_1.asyncHandler)(async (req, res) => {
    const event = await prisma_js_1.default.event.findUnique({
        where: { slug: req.params.slug },
        select: EVENT_PUBLIC_SELECT,
    });
    if (!event) {
        throw new errorHandler_js_1.AppError('Event not found', 404);
    }
    if (!event.rsvpEnabled) {
        throw new errorHandler_js_1.AppError('RSVP is not enabled for this event', 404);
    }
    const currentPhase = (0, phase_js_1.calculateEventPhase)(event);
    const capabilities = (0, phase_js_1.getPhaseCapabilities)(currentPhase);
    const templateData = {
        event: {
            name: event.name,
            description: event.description,
            date: event.date,
            venue: event.venue,
        },
        phase: currentPhase,
        capabilities,
        urls: {
            invitation: `/e/${event.slug}/invitation`,
            guestbook: `/e/${event.slug}/guestbook`,
            thankYou: `/e/${event.slug}/thanks`,
        },
    };
    await renderEventTemplate(event, 'RSVP', event.rsvpTemplateId, templateData, res);
}));
/**
 * GET /api/public/event/:slug/guestbook
 * Get guestbook menu page
 */
router.get('/event/:slug/guestbook', (0, errorHandler_js_1.asyncHandler)(async (req, res) => {
    const event = await prisma_js_1.default.event.findUnique({
        where: { slug: req.params.slug },
        select: EVENT_PUBLIC_SELECT,
    });
    if (!event) {
        throw new errorHandler_js_1.AppError('Event not found', 404);
    }
    if (!event.guestbookEnabled) {
        throw new errorHandler_js_1.AppError('Guestbook is not enabled for this event', 404);
    }
    const currentPhase = (0, phase_js_1.calculateEventPhase)(event);
    const capabilities = (0, phase_js_1.getPhaseCapabilities)(currentPhase);
    if (!capabilities.canAccessGuestbook) {
        throw new errorHandler_js_1.AppError('Guestbook is not available at this time', 404);
    }
    const templateData = {
        event: {
            name: event.name,
            description: event.description,
            date: event.date,
            venue: event.venue,
        },
        phase: currentPhase,
        capabilities,
        urls: {
            video: `/e/${event.slug}/guestbook/video`,
            audio: `/e/${event.slug}/guestbook/audio`,
            photo: `/e/${event.slug}/guestbook/photo`,
            booth: `/e/${event.slug}/booth`,
            thankYou: `/e/${event.slug}/thanks`,
        },
    };
    await renderEventTemplate(event, 'GUESTBOOK', event.guestbookTemplateId, templateData, res);
}));
/**
 * GET /api/public/event/:slug/guestbook/video
 * Get video recording page
 */
router.get('/event/:slug/guestbook/video', (0, errorHandler_js_1.asyncHandler)(async (req, res) => {
    const event = await prisma_js_1.default.event.findUnique({
        where: { slug: req.params.slug },
        select: EVENT_PUBLIC_SELECT,
    });
    if (!event) {
        throw new errorHandler_js_1.AppError('Event not found', 404);
    }
    if (!event.guestbookEnabled) {
        throw new errorHandler_js_1.AppError('Guestbook is not enabled for this event', 404);
    }
    const currentPhase = (0, phase_js_1.calculateEventPhase)(event);
    const capabilities = (0, phase_js_1.getPhaseCapabilities)(currentPhase);
    if (!capabilities.canAccessGuestbook) {
        throw new errorHandler_js_1.AppError('Guestbook is not available at this time', 404);
    }
    const templateData = {
        event: {
            name: event.name,
            description: event.description,
            date: event.date,
            venue: event.venue,
        },
        phase: currentPhase,
        capabilities,
        settings: {
            maxDuration: event.maxRecordingDuration,
            minDuration: event.minRecordingDuration,
        },
        urls: {
            guestbook: `/e/${event.slug}/guestbook`,
            thankYou: `/e/${event.slug}/thanks`,
        },
    };
    await renderEventTemplate(event, 'GUESTBOOK_VIDEO', event.guestbookVideoTemplateId, templateData, res);
}));
/**
 * GET /api/public/event/:slug/guestbook/audio
 * Get audio recording page
 */
router.get('/event/:slug/guestbook/audio', (0, errorHandler_js_1.asyncHandler)(async (req, res) => {
    const event = await prisma_js_1.default.event.findUnique({
        where: { slug: req.params.slug },
        select: EVENT_PUBLIC_SELECT,
    });
    if (!event) {
        throw new errorHandler_js_1.AppError('Event not found', 404);
    }
    if (!event.guestbookEnabled) {
        throw new errorHandler_js_1.AppError('Guestbook is not enabled for this event', 404);
    }
    const currentPhase = (0, phase_js_1.calculateEventPhase)(event);
    const capabilities = (0, phase_js_1.getPhaseCapabilities)(currentPhase);
    if (!capabilities.canAccessGuestbook) {
        throw new errorHandler_js_1.AppError('Guestbook is not available at this time', 404);
    }
    const templateData = {
        event: {
            name: event.name,
            description: event.description,
            date: event.date,
            venue: event.venue,
        },
        phase: currentPhase,
        capabilities,
        settings: {
            maxDuration: event.maxRecordingDuration,
            minDuration: event.minRecordingDuration,
        },
        urls: {
            guestbook: `/e/${event.slug}/guestbook`,
            thankYou: `/e/${event.slug}/thanks`,
        },
    };
    await renderEventTemplate(event, 'GUESTBOOK_AUDIO', event.guestbookAudioTemplateId, templateData, res);
}));
/**
 * GET /api/public/event/:slug/guestbook/photo
 * Get photo upload page
 */
router.get('/event/:slug/guestbook/photo', (0, errorHandler_js_1.asyncHandler)(async (req, res) => {
    const event = await prisma_js_1.default.event.findUnique({
        where: { slug: req.params.slug },
        select: EVENT_PUBLIC_SELECT,
    });
    if (!event) {
        throw new errorHandler_js_1.AppError('Event not found', 404);
    }
    if (!event.guestbookEnabled) {
        throw new errorHandler_js_1.AppError('Guestbook is not enabled for this event', 404);
    }
    const currentPhase = (0, phase_js_1.calculateEventPhase)(event);
    const capabilities = (0, phase_js_1.getPhaseCapabilities)(currentPhase);
    if (!capabilities.canAccessGuestbook) {
        throw new errorHandler_js_1.AppError('Guestbook is not available at this time', 404);
    }
    const templateData = {
        event: {
            name: event.name,
            description: event.description,
            date: event.date,
            venue: event.venue,
        },
        phase: currentPhase,
        capabilities,
        settings: {
            maxPhotos: event.maxPhotosPerGuest,
        },
        urls: {
            guestbook: `/e/${event.slug}/guestbook`,
            thankYou: `/e/${event.slug}/thanks`,
        },
    };
    await renderEventTemplate(event, 'GUESTBOOK_PHOTO', event.guestbookPhotoTemplateId, templateData, res);
}));
/**
 * GET /api/public/event/:slug/booth
 * Get booth menu page
 */
router.get('/event/:slug/booth', (0, errorHandler_js_1.asyncHandler)(async (req, res) => {
    const event = await prisma_js_1.default.event.findUnique({
        where: { slug: req.params.slug },
        select: EVENT_PUBLIC_SELECT,
    });
    if (!event) {
        throw new errorHandler_js_1.AppError('Event not found', 404);
    }
    if (!event.guestbookEnabled) {
        throw new errorHandler_js_1.AppError('Booth is not enabled for this event', 404);
    }
    const currentPhase = (0, phase_js_1.calculateEventPhase)(event);
    const capabilities = (0, phase_js_1.getPhaseCapabilities)(currentPhase);
    if (!capabilities.canAccessGuestbook) {
        throw new errorHandler_js_1.AppError('Booth is not available at this time', 404);
    }
    const templateData = {
        event: {
            name: event.name,
            description: event.description,
            date: event.date,
            venue: event.venue,
        },
        phase: currentPhase,
        capabilities,
        urls: {
            video: `/e/${event.slug}/booth/video`,
            audio: `/e/${event.slug}/booth/audio`,
            photo: `/e/${event.slug}/booth/photo`,
            guestbook: `/e/${event.slug}/guestbook`,
            thankYou: `/e/${event.slug}/thanks`,
        },
    };
    await renderEventTemplate(event, 'BOOTH', event.boothTemplateId, templateData, res);
}));
/**
 * GET /api/public/event/:slug/booth/video
 * Get booth video recording page
 */
router.get('/event/:slug/booth/video', (0, errorHandler_js_1.asyncHandler)(async (req, res) => {
    const event = await prisma_js_1.default.event.findUnique({
        where: { slug: req.params.slug },
        select: EVENT_PUBLIC_SELECT,
    });
    if (!event) {
        throw new errorHandler_js_1.AppError('Event not found', 404);
    }
    if (!event.guestbookEnabled) {
        throw new errorHandler_js_1.AppError('Booth is not enabled for this event', 404);
    }
    const currentPhase = (0, phase_js_1.calculateEventPhase)(event);
    const capabilities = (0, phase_js_1.getPhaseCapabilities)(currentPhase);
    if (!capabilities.canAccessGuestbook) {
        throw new errorHandler_js_1.AppError('Booth is not available at this time', 404);
    }
    const templateData = {
        event: {
            name: event.name,
            description: event.description,
            date: event.date,
            venue: event.venue,
        },
        phase: currentPhase,
        capabilities,
        settings: {
            maxDuration: event.maxRecordingDuration,
            minDuration: event.minRecordingDuration,
            maxPhotos: event.maxPhotosPerBoothSession,
            countdown: event.boothShutterCountdown,
        },
        urls: {
            booth: `/e/${event.slug}/booth`,
            thankYou: `/e/${event.slug}/thanks`,
        },
    };
    await renderEventTemplate(event, 'BOOTH_VIDEO', event.boothVideoTemplateId, templateData, res);
}));
/**
 * GET /api/public/event/:slug/booth/audio
 * Get booth audio recording page
 */
router.get('/event/:slug/booth/audio', (0, errorHandler_js_1.asyncHandler)(async (req, res) => {
    const event = await prisma_js_1.default.event.findUnique({
        where: { slug: req.params.slug },
        select: EVENT_PUBLIC_SELECT,
    });
    if (!event) {
        throw new errorHandler_js_1.AppError('Event not found', 404);
    }
    if (!event.guestbookEnabled) {
        throw new errorHandler_js_1.AppError('Booth is not enabled for this event', 404);
    }
    const currentPhase = (0, phase_js_1.calculateEventPhase)(event);
    const capabilities = (0, phase_js_1.getPhaseCapabilities)(currentPhase);
    if (!capabilities.canAccessGuestbook) {
        throw new errorHandler_js_1.AppError('Booth is not available at this time', 404);
    }
    const templateData = {
        event: {
            name: event.name,
            description: event.description,
            date: event.date,
            venue: event.venue,
        },
        phase: currentPhase,
        capabilities,
        settings: {
            maxDuration: event.maxRecordingDuration,
            minDuration: event.minRecordingDuration,
        },
        urls: {
            booth: `/e/${event.slug}/booth`,
            thankYou: `/e/${event.slug}/thanks`,
        },
    };
    await renderEventTemplate(event, 'BOOTH_AUDIO', event.boothAudioTemplateId, templateData, res);
}));
/**
 * GET /api/public/event/:slug/booth/photo
 * Get booth photo capture page
 */
router.get('/event/:slug/booth/photo', (0, errorHandler_js_1.asyncHandler)(async (req, res) => {
    const event = await prisma_js_1.default.event.findUnique({
        where: { slug: req.params.slug },
        select: EVENT_PUBLIC_SELECT,
    });
    if (!event) {
        throw new errorHandler_js_1.AppError('Event not found', 404);
    }
    if (!event.guestbookEnabled) {
        throw new errorHandler_js_1.AppError('Booth is not enabled for this event', 404);
    }
    const currentPhase = (0, phase_js_1.calculateEventPhase)(event);
    const capabilities = (0, phase_js_1.getPhaseCapabilities)(currentPhase);
    if (!capabilities.canAccessGuestbook) {
        throw new errorHandler_js_1.AppError('Booth is not available at this time', 404);
    }
    const templateData = {
        event: {
            name: event.name,
            description: event.description,
            date: event.date,
            venue: event.venue,
        },
        phase: currentPhase,
        capabilities,
        settings: {
            maxPhotos: event.maxPhotosPerBoothSession,
            countdown: event.boothShutterCountdown,
        },
        urls: {
            booth: `/e/${event.slug}/booth`,
            thankYou: `/e/${event.slug}/thanks`,
        },
    };
    await renderEventTemplate(event, 'BOOTH_PHOTO', event.boothPhotoTemplateId, templateData, res);
}));
/**
 * GET /api/public/event/:slug/live
 * Get live landing page (shown during LIVE phase)
 */
router.get('/event/:slug/live', (0, errorHandler_js_1.asyncHandler)(async (req, res) => {
    const event = await prisma_js_1.default.event.findUnique({
        where: { slug: req.params.slug },
        select: EVENT_PUBLIC_SELECT,
    });
    if (!event) {
        throw new errorHandler_js_1.AppError('Event not found', 404);
    }
    const currentPhase = (0, phase_js_1.calculateEventPhase)(event);
    // Live landing page is only shown during LIVE phase
    if (currentPhase !== 'LIVE') {
        return res.redirect(`/e/${event.slug}`);
    }
    const capabilities = (0, phase_js_1.getPhaseCapabilities)(currentPhase);
    const templateData = {
        event: {
            name: event.name,
            description: event.description,
            date: event.date,
            venue: event.venue,
        },
        phase: currentPhase,
        capabilities,
        urls: {
            guestbook: `/e/${event.slug}/guestbook`,
            booth: `/e/${event.slug}/booth`,
            thankYou: `/e/${event.slug}/thanks`,
        },
    };
    await renderEventTemplate(event, 'LIVE_LANDING', event.liveLandingTemplateId, templateData, res);
}));
/**
 * GET /api/public/event/:slug/ended
 * Get event ended page (shown after POST_EVENT phase)
 */
router.get('/event/:slug/ended', (0, errorHandler_js_1.asyncHandler)(async (req, res) => {
    const event = await prisma_js_1.default.event.findUnique({
        where: { slug: req.params.slug },
        select: EVENT_PUBLIC_SELECT,
    });
    if (!event) {
        throw new errorHandler_js_1.AppError('Event not found', 404);
    }
    const currentPhase = (0, phase_js_1.calculateEventPhase)(event);
    // Event ended page is only shown after POST_EVENT phase
    if (currentPhase !== 'POST_EVENT') {
        return res.redirect(`/e/${event.slug}`);
    }
    const capabilities = (0, phase_js_1.getPhaseCapabilities)(currentPhase);
    const templateData = {
        event: {
            name: event.name,
            description: event.description,
            date: event.date,
            venue: event.venue,
        },
        phase: currentPhase,
        capabilities,
        urls: {
            thankYou: `/e/${event.slug}/thanks`,
        },
    };
    await renderEventTemplate(event, 'EVENT_ENDED', event.eventEndedTemplateId, templateData, res);
}));
/**
 * GET /api/public/verify-access/:eventSlug
 * Verify access code for invitation-only events
 */
router.get('/verify-access/:eventSlug', (0, errorHandler_js_1.asyncHandler)(async (req, res) => {
    const { eventSlug } = req.params;
    const { code } = req.query;
    if (!code) {
        throw new errorHandler_js_1.AppError('Access code required', 400);
    }
    const event = await prisma_js_1.default.event.findUnique({
        where: { slug: eventSlug },
    });
    if (!event) {
        throw new errorHandler_js_1.AppError('Event not found', 404);
    }
    const invitation = await prisma_js_1.default.invitation.findFirst({
        where: {
            eventId: event.id,
            accessCode: code,
        },
        include: {
            rsvp: {
                select: { status: true },
            },
        },
    });
    if (!invitation) {
        return res.json({ valid: false, reason: 'Invalid code' });
    }
    if (invitation.rsvp.status !== 'APPROVED') {
        return res.json({ valid: false, reason: 'Not approved' });
    }
    res.json({
        valid: true,
        guest: {
            name: invitation.guestName,
            guestCount: invitation.guestCount,
        },
    });
}));
/**
 * GET /api/public/booth/download/:token
 * Get session photos info (for displaying download page)
 */
router.get('/booth/download/:token/info', (0, errorHandler_js_1.asyncHandler)(async (req, res) => {
    const { token } = req.params;
    const { verifyBoothDownloadToken, getSessionPhotos } = await import('../services/boothDownload.js');
    const result = await verifyBoothDownloadToken(token, false); // Don't mark as used yet
    if (!result) {
        throw new errorHandler_js_1.AppError('Invalid or expired download token', 404);
    }
    if (result.type === 'session' && result.sessionId && result.eventId) {
        const photos = await getSessionPhotos(result.sessionId, result.eventId, result.deviceId || null);
        if (photos.length === 0) {
            throw new errorHandler_js_1.AppError('No photos found for this session', 404);
        }
        res.json({
            token,
            type: 'session',
            photos: photos.map(p => ({
                id: p.id,
                fileName: p.fileName,
            })),
        });
    }
    else if (result.type === 'single' && result.filePath) {
        res.json({
            token,
            type: 'single',
            photos: [{
                    id: result.mediaId,
                    fileName: result.filePath.split('/').pop() || 'photo.jpg',
                }],
        });
    }
    else {
        throw new errorHandler_js_1.AppError('Invalid download token', 400);
    }
}));
/**
 * GET /api/public/booth/download/:token/:photoId
 * Download a single photo from a session
 */
router.get('/booth/download/:token/:photoId', (0, errorHandler_js_1.asyncHandler)(async (req, res) => {
    const { token, photoId } = req.params;
    const { verifyBoothDownloadToken, getSessionPhotos } = await import('../services/boothDownload.js');
    const { downloadFile, BUCKETS } = await import('../services/supabaseStorage.js');
    const result = await verifyBoothDownloadToken(token, false); // Don't mark as used - allow multiple downloads
    if (!result) {
        throw new errorHandler_js_1.AppError('Invalid or expired download token', 404);
    }
    try {
        let photo = null;
        if (result.type === 'session' && result.sessionId && result.eventId) {
            // Get all photos from session and find the requested one
            const photos = await getSessionPhotos(result.sessionId, result.eventId, result.deviceId || null);
            photo = photos.find(p => p.id === photoId) || null;
        }
        else if (result.type === 'single' && result.mediaId === photoId) {
            // Single photo download
            const media = await prisma_js_1.default.mediaAsset.findUnique({
                where: { id: photoId },
                select: { id: true, filePath: true, fileName: true },
            });
            if (media) {
                photo = {
                    id: media.id,
                    filePath: media.filePath,
                    fileName: media.fileName,
                };
            }
        }
        if (!photo) {
            throw new errorHandler_js_1.AppError('Photo not found', 404);
        }
        // Download file from Supabase
        const fileBuffer = await downloadFile(BUCKETS.MEDIA, photo.filePath);
        // Get file extension from path
        const ext = photo.filePath.split('.').pop() || 'jpg';
        const contentType = ext === 'jpg' || ext === 'jpeg' ? 'image/jpeg' :
            ext === 'png' ? 'image/png' :
                ext === 'gif' ? 'image/gif' : 'application/octet-stream';
        res.setHeader('Content-Type', contentType);
        res.setHeader('Content-Disposition', `attachment; filename="${photo.fileName || `booth-photo-${photo.id}.${ext}`}"`);
        res.send(fileBuffer);
    }
    catch (error) {
        console.error('[Booth Download] Failed to download photo:', error.message);
        throw new errorHandler_js_1.AppError('Failed to download photo', 500);
    }
}));
/**
 * GET /api/public/booth/download/:token
 * Redirect to frontend download page
 */
router.get('/booth/download/:token', (0, errorHandler_js_1.asyncHandler)(async (req, res) => {
    const { getSiteUrl } = await import('../utils/siteUrl.js');
    const siteUrl = getSiteUrl();
    res.redirect(`${siteUrl}/booth/download/${req.params.token}`);
}));
exports.default = router;
//# sourceMappingURL=public.js.map