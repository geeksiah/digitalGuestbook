"use strict";
// COMPLETE REPLACEMENT FOR backend/src/routes/public.ts
// Fixes:
//   1. Adds missing routes: guestbook, guestbook/video, guestbook/audio, guestbook/photo,
//      rsvp, live, ended, booth, booth/video, booth/audio, booth/photo
//   2. Proper phase-aware template rendering
//   3. Proper asset path resolution
//   4. All sub-page template IDs included in EVENT_PUBLIC_SELECT
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
// ─── Event select fields ───────────────────────────────────────────────────────
// CRITICAL: include ALL template ID fields so renderEventTemplate can look them up
const EVENT_PUBLIC_SELECT = {
    id: true,
    slug: true,
    name: true,
    description: true,
    date: true,
    endDate: true,
    timezone: true,
    venue: true,
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
    // Template assignments
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
};
// ─── Helper: standard template data ────────────────────────────────────────────
function buildTemplateData(event, currentPhase, capabilities) {
    // Frontend URL for navigation links inside templates
    const frontendUrl = (process.env.FRONTEND_URL ||
        process.env.SITE_URL ||
        process.env.APP_URL ||
        '').replace(/\/+$/, '');
    return {
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
            primaryColor: event.primaryColor,
            secondaryColor: event.secondaryColor,
            accentColor: event.accentColor,
            slug: event.slug,
            invitationOnly: event.invitationOnly,
            phase: currentPhase,
        },
        phase: currentPhase,
        capabilities,
        urls: {
            rsvp: `${frontendUrl}/e/${event.slug}/rsvp`,
            guestbook: `${frontendUrl}/e/${event.slug}/guestbook`,
            booth: `${frontendUrl}/e/${event.slug}/booth`,
            thankYou: `${frontendUrl}/e/${event.slug}/thanks`,
            invitation: `${frontendUrl}/e/${event.slug}`,
            live: `${frontendUrl}/e/${event.slug}/live`,
            checkIn: `${frontendUrl}/e/${event.slug}/checkin`,
            guestbookVideo: `${frontendUrl}/e/${event.slug}/guestbook/video`,
            guestbookAudio: `${frontendUrl}/e/${event.slug}/guestbook/audio`,
            guestbookPhoto: `${frontendUrl}/e/${event.slug}/guestbook/photo`,
            boothVideo: `${frontendUrl}/e/${event.slug}/booth/video`,
            boothAudio: `${frontendUrl}/e/${event.slug}/booth/audio`,
            boothPhoto: `${frontendUrl}/e/${event.slug}/booth/photo`,
        },
    };
}
// ─── Helper: fetch event or throw ──────────────────────────────────────────────
async function fetchPublicEvent(slug) {
    const event = await prisma_js_1.default.event.findUnique({
        where: { slug },
        select: EVENT_PUBLIC_SELECT,
    });
    if (!event) {
        throw new errorHandler_js_1.AppError('Event not found', 404);
    }
    if (event.isArchived) {
        throw new errorHandler_js_1.AppError('This event is no longer available', 410);
    }
    return event;
}
// ─── Helper: render template ───────────────────────────────────────────────────
// CRITICAL FIXES:
// 1. Only uses assigned template (no automatic defaults)
// 2. Properly resolves asset paths to API endpoints
// 3. Better error handling and logging
async function renderEventTemplate(event, templateType, templateId, templateData, res) {
    const template = await (0, template_helper_js_1.getEventTemplate)(templateType, templateId);
    console.info(`[Render] event=${event.id} slug=${event.slug} ` +
        `templateType=${templateType} assignedId=${templateId || 'none'} ` +
        `selectedTemplate=${template?.id || 'none'} ` +
        `templateName=${template?.name || 'none'}`);
    if (!template) {
        console.warn(`[Render] No template found for event=${event.id} type=${templateType}`);
        return res.status(404).json({
            template: null,
            data: templateData,
            error: 'No template assigned',
            message: `This event doesn't have a ${templateType.toLowerCase().replace('_', ' ')} template assigned. Please contact the event organizer.`,
        });
    }
    // Replace template variables
    let html = template.htmlContent;
    const replaceVariables = (tpl, data) => {
        return tpl.replace(/\{\{([^}]+)\}\}/g, (match, pathStr) => {
            const keys = pathStr.trim().split('.');
            let value = data;
            for (const key of keys) {
                if (value && typeof value === 'object' && key in value) {
                    value = value[key];
                }
                else {
                    console.warn(`[Render] Variable not found: ${pathStr}`);
                    return match;
                }
            }
            return String(value ?? '');
        });
    };
    html = replaceVariables(html, templateData);
    // CRITICAL FIX: Resolve asset paths using FULL backend URL
    // The HTML is fetched by the frontend (app.eventpeepo.com) and rendered there.
    // Relative /api/ paths would resolve against the frontend domain and 404.
    // We must use absolute URLs pointing to the backend.
    if (template.assetsPath) {
        const backendUrl = (process.env.API_URL ||
            process.env.BACKEND_URL ||
            process.env.RENDER_EXTERNAL_URL ||
            '').replace(/\/+$/, '');
        const assetBase = backendUrl
            ? `${backendUrl}/api/templates/${template.id}/assets/`
            : `/api/templates/${template.id}/assets/`;
        // Pattern 1: src="./assets/..." or src="../assets/..."
        html = html.replace(/(src|href)=["'](\.\/|\.\.\/)?assets\//g, `$1="${assetBase}`);
        // Pattern 2: src="/assets/..."
        html = html.replace(/(src|href)=["']\/assets\//g, `$1="${assetBase}`);
        // Pattern 3: bare filenames like src="MCS_9627.jpeg" (no assets/ prefix)
        // These are relative to the template root — rewrite to asset endpoint
        html = html.replace(/(src)=["'](?!\w+:\/\/|\/|#|data:|blob:)([^"']+\.(jpe?g|png|gif|webp|svg|ico|css|js|woff2?|ttf|eot|mp4|webm|mp3|wav|pdf))["']/gi, `$1="${assetBase}$2"`);
        // Pattern 4: CSS url() references in inline styles
        html = html.replace(/url\(['"]?(?:\.\/|\.\.\/)?assets\//g, `url('${assetBase}`);
        // Pattern 5: CSS url() in separate cssContent
        if (template.cssContent) {
            template.cssContent = template.cssContent.replace(/url\(['"]?(?:\.\/|\.\.\/)?assets\//g, `url('${assetBase}`);
        }
        console.info(`[Render] Resolved asset paths for template=${template.id} base=${assetBase}`);
    }
    // Inject CSS
    if (template.cssContent) {
        const cssTag = `<style>\n${template.cssContent}\n</style>`;
        if (html.includes('</head>')) {
            html = html.replace('</head>', `${cssTag}\n</head>`);
        }
        else {
            html = cssTag + '\n' + html;
        }
    }
    // Inject JS
    if (template.jsContent) {
        const jsTag = `<script>\n${template.jsContent}\n</script>`;
        if (html.includes('</body>')) {
            html = html.replace('</body>', `${jsTag}\n</body>`);
        }
        else {
            html = html + '\n' + jsTag;
        }
    }
    // Set proper content type and send
    res.setHeader('Content-Type', 'text/html; charset=utf-8');
    res.send(html);
}
// ═══════════════════════════════════════════════════════════════════════════════
// ROUTES
// ═══════════════════════════════════════════════════════════════════════════════
/**
 * GET /api/public/event/:slug
 * Get public event information (JSON)
 */
router.get('/event/:slug', (0, errorHandler_js_1.asyncHandler)(async (req, res) => {
    const event = await fetchPublicEvent(req.params.slug);
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
// ─── Invitation ────────────────────────────────────────────────────────────────
/**
 * GET /api/public/event/:slug/invitation
 * Rendered invitation page
 */
router.get('/event/:slug/invitation', (0, errorHandler_js_1.asyncHandler)(async (req, res) => {
    const event = await fetchPublicEvent(req.params.slug);
    if (!event.invitationEnabled) {
        throw new errorHandler_js_1.AppError('Invitation page not available', 404);
    }
    const currentPhase = (0, phase_js_1.calculateEventPhase)(event);
    const capabilities = (0, phase_js_1.getPhaseCapabilities)(currentPhase);
    const templateData = buildTemplateData(event, currentPhase, capabilities);
    await renderEventTemplate(event, 'INVITATION', event.invitationTemplateId, templateData, res);
}));
// ─── RSVP ──────────────────────────────────────────────────────────────────────
/**
 * GET /api/public/event/:slug/rsvp
 * Rendered RSVP form page
 */
router.get('/event/:slug/rsvp', (0, errorHandler_js_1.asyncHandler)(async (req, res) => {
    const event = await fetchPublicEvent(req.params.slug);
    if (!event.rsvpEnabled) {
        throw new errorHandler_js_1.AppError('RSVP is not available for this event', 404);
    }
    const currentPhase = (0, phase_js_1.calculateEventPhase)(event);
    const capabilities = (0, phase_js_1.getPhaseCapabilities)(currentPhase);
    if (!capabilities.canSubmitRsvp) {
        throw new errorHandler_js_1.AppError('RSVP is not available during this event phase', 403);
    }
    const templateData = buildTemplateData(event, currentPhase, capabilities);
    await renderEventTemplate(event, 'RSVP', event.rsvpTemplateId, templateData, res);
}));
// ─── Live Landing ──────────────────────────────────────────────────────────────
/**
 * GET /api/public/event/:slug/live
 * Live landing page (shown during LIVE phase)
 */
router.get('/event/:slug/live', (0, errorHandler_js_1.asyncHandler)(async (req, res) => {
    const event = await fetchPublicEvent(req.params.slug);
    const currentPhase = (0, phase_js_1.calculateEventPhase)(event);
    const capabilities = (0, phase_js_1.getPhaseCapabilities)(currentPhase);
    // Live landing only during LIVE phase — return JSON (not redirect) so fetch() works
    if (currentPhase !== 'LIVE') {
        return res.json({ template: null, phase: currentPhase, message: 'Event is not in LIVE phase' });
    }
    const templateData = buildTemplateData(event, currentPhase, capabilities);
    await renderEventTemplate(event, 'LIVE_LANDING', event.liveLandingTemplateId, templateData, res);
}));
// ─── Event Ended ───────────────────────────────────────────────────────────────
/**
 * GET /api/public/event/:slug/ended
 * Event ended page (shown during POST_EVENT phase)
 */
router.get('/event/:slug/ended', (0, errorHandler_js_1.asyncHandler)(async (req, res) => {
    const event = await fetchPublicEvent(req.params.slug);
    const currentPhase = (0, phase_js_1.calculateEventPhase)(event);
    const capabilities = (0, phase_js_1.getPhaseCapabilities)(currentPhase);
    // Ended page only during POST_EVENT — return JSON (not redirect) so fetch() works
    if (currentPhase !== 'POST_EVENT') {
        return res.json({ template: null, phase: currentPhase, message: 'Event is not in POST_EVENT phase' });
    }
    const templateData = buildTemplateData(event, currentPhase, capabilities);
    await renderEventTemplate(event, 'EVENT_ENDED', event.eventEndedTemplateId, templateData, res);
}));
// ─── Guestbook ─────────────────────────────────────────────────────────────────
/**
 * GET /api/public/event/:slug/guestbook
 * Guestbook menu / landing page
 */
router.get('/event/:slug/guestbook', (0, errorHandler_js_1.asyncHandler)(async (req, res) => {
    const event = await fetchPublicEvent(req.params.slug);
    if (!event.guestbookEnabled) {
        throw new errorHandler_js_1.AppError('Guestbook is not available for this event', 404);
    }
    const currentPhase = (0, phase_js_1.calculateEventPhase)(event);
    const capabilities = (0, phase_js_1.getPhaseCapabilities)(currentPhase);
    if (!capabilities.canAccessGuestbook) {
        throw new errorHandler_js_1.AppError('Guestbook is not available during this event phase', 403);
    }
    const templateData = buildTemplateData(event, currentPhase, capabilities);
    await renderEventTemplate(event, 'GUESTBOOK', event.guestbookTemplateId, templateData, res);
}));
/**
 * GET /api/public/event/:slug/guestbook/video
 * Guestbook video recording page
 */
router.get('/event/:slug/guestbook/video', (0, errorHandler_js_1.asyncHandler)(async (req, res) => {
    const event = await fetchPublicEvent(req.params.slug);
    if (!event.guestbookEnabled) {
        throw new errorHandler_js_1.AppError('Guestbook is not available for this event', 404);
    }
    const currentPhase = (0, phase_js_1.calculateEventPhase)(event);
    const capabilities = (0, phase_js_1.getPhaseCapabilities)(currentPhase);
    if (!capabilities.canAccessGuestbook) {
        throw new errorHandler_js_1.AppError('Guestbook is not available during this event phase', 403);
    }
    const templateData = buildTemplateData(event, currentPhase, capabilities);
    await renderEventTemplate(event, 'GUESTBOOK_VIDEO', event.guestbookVideoTemplateId, templateData, res);
}));
/**
 * GET /api/public/event/:slug/guestbook/audio
 * Guestbook audio recording page
 */
router.get('/event/:slug/guestbook/audio', (0, errorHandler_js_1.asyncHandler)(async (req, res) => {
    const event = await fetchPublicEvent(req.params.slug);
    if (!event.guestbookEnabled) {
        throw new errorHandler_js_1.AppError('Guestbook is not available for this event', 404);
    }
    const currentPhase = (0, phase_js_1.calculateEventPhase)(event);
    const capabilities = (0, phase_js_1.getPhaseCapabilities)(currentPhase);
    if (!capabilities.canAccessGuestbook) {
        throw new errorHandler_js_1.AppError('Guestbook is not available during this event phase', 403);
    }
    const templateData = buildTemplateData(event, currentPhase, capabilities);
    await renderEventTemplate(event, 'GUESTBOOK_AUDIO', event.guestbookAudioTemplateId, templateData, res);
}));
/**
 * GET /api/public/event/:slug/guestbook/photo
 * Guestbook photo upload page
 */
router.get('/event/:slug/guestbook/photo', (0, errorHandler_js_1.asyncHandler)(async (req, res) => {
    const event = await fetchPublicEvent(req.params.slug);
    if (!event.guestbookEnabled) {
        throw new errorHandler_js_1.AppError('Guestbook is not available for this event', 404);
    }
    const currentPhase = (0, phase_js_1.calculateEventPhase)(event);
    const capabilities = (0, phase_js_1.getPhaseCapabilities)(currentPhase);
    if (!capabilities.canAccessGuestbook) {
        throw new errorHandler_js_1.AppError('Guestbook is not available during this event phase', 403);
    }
    const templateData = buildTemplateData(event, currentPhase, capabilities);
    await renderEventTemplate(event, 'GUESTBOOK_PHOTO', event.guestbookPhotoTemplateId, templateData, res);
}));
// ─── Booth ─────────────────────────────────────────────────────────────────────
/**
 * GET /api/public/event/:slug/booth
 * Booth menu / landing page (kiosk mode)
 */
router.get('/event/:slug/booth', (0, errorHandler_js_1.asyncHandler)(async (req, res) => {
    const event = await fetchPublicEvent(req.params.slug);
    if (!event.guestbookEnabled) {
        throw new errorHandler_js_1.AppError('Booth is not available for this event', 404);
    }
    const currentPhase = (0, phase_js_1.calculateEventPhase)(event);
    const capabilities = (0, phase_js_1.getPhaseCapabilities)(currentPhase);
    if (!capabilities.canAccessGuestbook) {
        throw new errorHandler_js_1.AppError('Booth is not available during this event phase', 403);
    }
    const templateData = buildTemplateData(event, currentPhase, capabilities);
    await renderEventTemplate(event, 'BOOTH', event.boothTemplateId, templateData, res);
}));
/**
 * GET /api/public/event/:slug/booth/video
 * Booth video recording page
 */
router.get('/event/:slug/booth/video', (0, errorHandler_js_1.asyncHandler)(async (req, res) => {
    const event = await fetchPublicEvent(req.params.slug);
    if (!event.guestbookEnabled) {
        throw new errorHandler_js_1.AppError('Booth is not available for this event', 404);
    }
    const currentPhase = (0, phase_js_1.calculateEventPhase)(event);
    const capabilities = (0, phase_js_1.getPhaseCapabilities)(currentPhase);
    if (!capabilities.canAccessGuestbook) {
        throw new errorHandler_js_1.AppError('Booth is not available during this event phase', 403);
    }
    const templateData = buildTemplateData(event, currentPhase, capabilities);
    await renderEventTemplate(event, 'BOOTH_VIDEO', event.boothVideoTemplateId, templateData, res);
}));
/**
 * GET /api/public/event/:slug/booth/audio
 * Booth audio recording page
 */
router.get('/event/:slug/booth/audio', (0, errorHandler_js_1.asyncHandler)(async (req, res) => {
    const event = await fetchPublicEvent(req.params.slug);
    if (!event.guestbookEnabled) {
        throw new errorHandler_js_1.AppError('Booth is not available for this event', 404);
    }
    const currentPhase = (0, phase_js_1.calculateEventPhase)(event);
    const capabilities = (0, phase_js_1.getPhaseCapabilities)(currentPhase);
    if (!capabilities.canAccessGuestbook) {
        throw new errorHandler_js_1.AppError('Booth is not available during this event phase', 403);
    }
    const templateData = buildTemplateData(event, currentPhase, capabilities);
    await renderEventTemplate(event, 'BOOTH_AUDIO', event.boothAudioTemplateId, templateData, res);
}));
/**
 * GET /api/public/event/:slug/booth/photo
 * Booth photo capture page
 */
router.get('/event/:slug/booth/photo', (0, errorHandler_js_1.asyncHandler)(async (req, res) => {
    const event = await fetchPublicEvent(req.params.slug);
    if (!event.guestbookEnabled) {
        throw new errorHandler_js_1.AppError('Booth is not available for this event', 404);
    }
    const currentPhase = (0, phase_js_1.calculateEventPhase)(event);
    const capabilities = (0, phase_js_1.getPhaseCapabilities)(currentPhase);
    if (!capabilities.canAccessGuestbook) {
        throw new errorHandler_js_1.AppError('Booth is not available during this event phase', 403);
    }
    const templateData = buildTemplateData(event, currentPhase, capabilities);
    await renderEventTemplate(event, 'BOOTH_PHOTO', event.boothPhotoTemplateId, templateData, res);
}));
// ─── Thank-You ─────────────────────────────────────────────────────────────────
/**
 * GET /api/public/event/:slug/thank-you
 * Thank-you page (POST_EVENT phase only)
 */
router.get('/event/:slug/thank-you', (0, errorHandler_js_1.asyncHandler)(async (req, res) => {
    const event = await fetchPublicEvent(req.params.slug);
    const currentPhase = (0, phase_js_1.calculateEventPhase)(event);
    // Thank-you page is only for POST_EVENT phase — return JSON (not redirect)
    if (currentPhase !== 'POST_EVENT') {
        return res.json({ template: null, phase: currentPhase, message: 'Event is not in POST_EVENT phase' });
    }
    const capabilities = (0, phase_js_1.getPhaseCapabilities)(currentPhase);
    const templateData = buildTemplateData(event, currentPhase, capabilities);
    await renderEventTemplate(event, 'THANK_YOU', event.thankYouTemplateId, templateData, res);
}));
exports.default = router;
//# sourceMappingURL=public.js.map