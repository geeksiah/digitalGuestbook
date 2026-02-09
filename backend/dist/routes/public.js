"use strict";
// COMPLETE REPLACEMENT FOR backend/src/routes/public.ts
// This file includes all the fixes for template rendering with proper asset path resolution
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const prisma_js_1 = __importDefault(require("../utils/prisma.js"));
const errorHandler_js_1 = require("../middleware/errorHandler.js");
const phase_js_1 = require("../utils/phase.js");
const template_helper_js_1 = require("../utils/template-helper.js"); // FIXED: No more automatic defaults
const router = (0, express_1.Router)();
// Event select fields for public routes
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
    invitationTemplateId: true,
    rsvpTemplateId: true,
    guestbookTemplateId: true,
    thankYouTemplateId: true,
    liveLandingTemplateId: true,
    eventEndedTemplateId: true,
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
    // Prepare template data
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
    // Use the fixed rendering function
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
    // Render template
    const templateData = {
        event: {
            name: event.name,
            date: event.date,
        },
    };
    await renderEventTemplate(event, 'THANK_YOU', event.thankYouTemplateId, templateData, res);
}));
/**
 * FIXED: Helper function to render template with event data and proper asset paths
 * CRITICAL FIXES:
 * 1. Only uses assigned template (no automatic defaults)
 * 2. Properly resolves asset paths to API endpoints
 * 3. Better error handling and logging
 */
async function renderEventTemplate(event, templateType, templateId, templateData, res) {
    const template = await (0, template_helper_js_1.getEventTemplate)(templateType, templateId);
    // Debug logging
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
            message: `This event doesn't have a ${templateType.toLowerCase()} template assigned. Please contact the event organizer.`
        });
    }
    // Replace template variables
    let html = template.htmlContent;
    const replaceVariables = (template, data) => {
        return template.replace(/\{\{([^}]+)\}\}/g, (match, path) => {
            const keys = path.trim().split('.');
            let value = data;
            for (const key of keys) {
                if (value && typeof value === 'object' && key in value) {
                    value = value[key];
                }
                else {
                    console.warn(`[Render] Variable not found: ${path}`);
                    return match; // Keep original if not found
                }
            }
            return String(value ?? '');
        });
    };
    html = replaceVariables(html, templateData);
    // CRITICAL FIX: Resolve asset paths
    // Replace relative asset paths with absolute API paths
    if (template.assetsPath) {
        // Pattern 1: src="./assets/..." or src="../assets/..."
        html = html.replace(/(src|href)=["'](\.\/|\.\.\/)?assets\//g, `$1="/api/templates/${template.id}/assets/`);
        // Pattern 2: src="/assets/..."
        html = html.replace(/(src|href)=["']\/assets\//g, `$1="/api/templates/${template.id}/assets/`);
        // Pattern 3: CSS url() references
        if (template.cssContent) {
            template.cssContent = template.cssContent.replace(/url\(['"]?(\.\/|\.\.\/)?assets\//g, `url('/api/templates/${template.id}/assets/`);
        }
        console.info(`[Render] Resolved asset paths for template=${template.id}`);
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
// ... rest of your public routes (guestbook, booth, etc.) remain unchanged ...
exports.default = router;
//# sourceMappingURL=public.js.map