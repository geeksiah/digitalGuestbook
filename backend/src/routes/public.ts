// backend/src/routes/public.ts
// ═══════════════════════════════════════════════════════════════════════════════
// PRODUCTION-SAFE UPDATE — Adds X-Template-Asset-Base header for CDN-direct
// asset delivery, while keeping server-side rewriting as fallback.
//
// Changes from previous production version:
//   1. Emits X-Template-Asset-Base + Access-Control-Expose-Headers
//   2. Emits Cache-Control on template HTML responses
//   3. TEMPLATES bucket Supabase public URL used when available
//   4. All existing routes preserved exactly
//   5. Server-side rewriting KEPT as fallback for non-updated frontends
// ═══════════════════════════════════════════════════════════════════════════════

import { Router } from 'express';
import prisma from '../utils/prisma.js';
import { asyncHandler, AppError } from '../middleware/errorHandler.js';
import { calculateEventPhase, getPhaseCapabilities } from '../utils/phase.js';
import { getEventTemplate } from '../utils/template-helper.js';

const router = Router();

// ─── Event select fields ───────────────────────────────────────────────────────
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
function buildTemplateData(event: any, currentPhase: string, capabilities: any) {
  const frontendUrl = (
    process.env.FRONTEND_URL ||
    process.env.SITE_URL ||
    process.env.APP_URL ||
    ''
  ).replace(/\/+$/, '');

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
async function fetchPublicEvent(slug: string) {
  const event = await prisma.event.findUnique({
    where: { slug },
    select: EVENT_PUBLIC_SELECT,
  });

  if (!event) throw new AppError('Event not found', 404);
  if (event.isArchived) throw new AppError('This event is no longer available', 410);

  return event;
}

// ─── Helper: compute Supabase public base URL for template assets ──────────────
function getTemplateAssetBase(templateId: string): string | null {
  const supabaseUrl = process.env.SUPABASE_URL;
  if (!supabaseUrl) return null;

  // Supabase public URL pattern for the templates bucket
  return `${supabaseUrl.replace(/\/+$/, '')}/storage/v1/object/public/templates/${templateId}/`;
}

// ─── Helper: render template ───────────────────────────────────────────────────
// UPDATED: Emits X-Template-Asset-Base header so the frontend can rewrite
// asset URLs to hit Supabase CDN directly instead of the backend.
// Server-side rewriting is KEPT as fallback for direct-fetch/curl compatibility.
async function renderEventTemplate(
  event: any,
  templateType: string,
  templateId: string | null | undefined,
  templateData: any,
  res: any
) {
  const template = await getEventTemplate(templateType, templateId);

  console.info(
    `[Render] event=${event.id} slug=${event.slug} ` +
    `templateType=${templateType} assignedId=${templateId || 'none'} ` +
    `selectedTemplate=${template?.id || 'none'} ` +
    `templateName=${template?.name || 'none'}`
  );

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

  const replaceVariables = (tpl: string, data: any): string => {
    return tpl.replace(/\{\{([^}]+)\}\}/g, (match, pathStr) => {
      const keys = pathStr.trim().split('.');
      let value: any = data;
      for (const key of keys) {
        if (value && typeof value === 'object' && key in value) {
          value = value[key];
        } else {
          console.warn(`[Render] Variable not found: ${pathStr}`);
          return match;
        }
      }
      return String(value ?? '');
    });
  };

  html = replaceVariables(html, templateData);

  // ── Asset URL resolution ─────────────────────────────────────────────────
  // Strategy:
  //   1. Emit X-Template-Asset-Base header → frontend reads it, rewrites to CDN
  //   2. ALSO do server-side rewriting (fallback for curl/direct-fetch/old frontends)
  //
  // The frontend SHOULD prefer the header value over server-side rewritten URLs.

  // Try Supabase CDN path first (if TEMPLATES bucket is public)
  const supabaseAssetBase = template.assetsPath
    ? getTemplateAssetBase(template.id)
    : null;

  // Backend API fallback path
  const backendUrl = (
    process.env.API_URL ||
    process.env.BACKEND_URL ||
    process.env.RENDER_EXTERNAL_URL ||
    ''
  ).replace(/\/+$/, '');

  const apiAssetBase = backendUrl
    ? `${backendUrl}/api/templates/${template.id}/assets/`
    : `/api/templates/${template.id}/assets/`;

  // The header tells the frontend where to get assets from.
  // Prefer Supabase CDN (public, fast, no backend load).
  // Fall back to backend API asset route if Supabase URL not configured.
  const assetBaseForHeader = supabaseAssetBase || apiAssetBase;

  // Server-side rewriting always uses the backend API path for maximum compatibility
  // (the backend asset route handles auth, content-type, etc.)
  const assetBaseForHtml = apiAssetBase;

  if (template.assetsPath) {
    // Pattern 1: src="./assets/..." or src="../assets/..."
    html = html.replace(
      /(src|href)=["'](\.\/|\.\.\/)?assets\//g,
      `$1="${assetBaseForHtml}`
    );

    // Pattern 2: src="/assets/..."
    html = html.replace(
      /(src|href)=["']\/assets\//g,
      `$1="${assetBaseForHtml}`
    );

    // Pattern 3: bare filenames like src="MCS_9627.jpeg"
    html = html.replace(
      /(src)=["'](?!\w+:\/\/|\/|#|data:|blob:)([^"']+\.(jpe?g|png|gif|webp|svg|ico|css|js|woff2?|ttf|eot|mp4|webm|mp3|wav|pdf))["']/gi,
      `$1="${assetBaseForHtml}$2"`
    );

    // Pattern 4: CSS url() references in inline styles
    html = html.replace(
      /url\(['"]?(?:\.\/|\.\.\/)?assets\//g,
      `url('${assetBaseForHtml}`
    );

    // Pattern 5: CSS url() in separate cssContent
    if (template.cssContent) {
      template.cssContent = template.cssContent.replace(
        /url\(['"]?(?:\.\/|\.\.\/)?assets\//g,
        `url('${assetBaseForHtml}`
      );
    }

    console.info(
      `[Render] Asset paths resolved for template=${template.id} ` +
      `htmlBase=${assetBaseForHtml} headerBase=${assetBaseForHeader}`
    );
  }

  // Inject CSS
  if (template.cssContent) {
    const cssTag = `<style id="tpl-css-${template.id}">\n${template.cssContent}\n</style>`;
    if (html.includes('</head>')) {
      html = html.replace('</head>', `${cssTag}\n</head>`);
    } else {
      html = cssTag + '\n' + html;
    }
  }

  // Inject JS
  if (template.jsContent) {
    const jsTag = `<script id="tpl-js-${template.id}">\n${template.jsContent}\n</script>`;
    if (html.includes('</body>')) {
      html = html.replace('</body>', `${jsTag}\n</body>`);
    } else {
      html = html + '\n' + jsTag;
    }
  }

  // ── Response headers ─────────────────────────────────────────────────────
  res.setHeader('Content-Type', 'text/html; charset=utf-8');
  res.setHeader('Cache-Control', 'private, max-age=30');

  // Emit CDN asset base as header — frontend reads this and rewrites URLs
  if (assetBaseForHeader) {
    res.setHeader('X-Template-Asset-Base', assetBaseForHeader);
  }

  // Expose the custom header to frontend fetch()
  res.setHeader('Access-Control-Expose-Headers', 'X-Template-Asset-Base');

  res.send(html);
}

// ═══════════════════════════════════════════════════════════════════════════════
// ROUTES — all preserved exactly from production
// ═══════════════════════════════════════════════════════════════════════════════

/**
 * GET /api/public/event/:slug
 */
router.get('/event/:slug', asyncHandler(async (req, res) => {
  const event = await fetchPublicEvent(req.params.slug);
  const currentPhase = calculateEventPhase(event);
  const capabilities = getPhaseCapabilities(currentPhase);

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
router.get('/event/:slug/invitation', asyncHandler(async (req, res) => {
  const event = await fetchPublicEvent(req.params.slug);
  if (!event.invitationEnabled) throw new AppError('Invitation page not available', 404);

  const currentPhase = calculateEventPhase(event);
  const capabilities = getPhaseCapabilities(currentPhase);
  const templateData = buildTemplateData(event, currentPhase, capabilities);

  await renderEventTemplate(event, 'INVITATION', event.invitationTemplateId, templateData, res);
}));

// ─── RSVP ──────────────────────────────────────────────────────────────────────
router.get('/event/:slug/rsvp', asyncHandler(async (req, res) => {
  const event = await fetchPublicEvent(req.params.slug);
  if (!event.rsvpEnabled) throw new AppError('RSVP is not available for this event', 404);

  const currentPhase = calculateEventPhase(event);
  const capabilities = getPhaseCapabilities(currentPhase);
  if (!capabilities.canSubmitRsvp) throw new AppError('RSVP is not available during this event phase', 403);

  const templateData = buildTemplateData(event, currentPhase, capabilities);
  await renderEventTemplate(event, 'RSVP', event.rsvpTemplateId, templateData, res);
}));

// ─── Live Landing ──────────────────────────────────────────────────────────────
router.get('/event/:slug/live', asyncHandler(async (req, res) => {
  const event = await fetchPublicEvent(req.params.slug);
  const currentPhase = calculateEventPhase(event);
  const capabilities = getPhaseCapabilities(currentPhase);

  if (currentPhase !== 'LIVE') {
    return res.json({ template: null, phase: currentPhase, message: 'Event is not in LIVE phase' });
  }

  const templateData = buildTemplateData(event, currentPhase, capabilities);
  await renderEventTemplate(event, 'LIVE_LANDING', event.liveLandingTemplateId, templateData, res);
}));

// ─── Event Ended ───────────────────────────────────────────────────────────────
router.get('/event/:slug/ended', asyncHandler(async (req, res) => {
  const event = await fetchPublicEvent(req.params.slug);
  const currentPhase = calculateEventPhase(event);
  const capabilities = getPhaseCapabilities(currentPhase);

  if (currentPhase !== 'POST_EVENT') {
    return res.json({ template: null, phase: currentPhase, message: 'Event is not in POST_EVENT phase' });
  }

  const templateData = buildTemplateData(event, currentPhase, capabilities);
  await renderEventTemplate(event, 'EVENT_ENDED', event.eventEndedTemplateId, templateData, res);
}));

// ─── Guestbook ─────────────────────────────────────────────────────────────────
router.get('/event/:slug/guestbook', asyncHandler(async (req, res) => {
  const event = await fetchPublicEvent(req.params.slug);
  if (!event.guestbookEnabled) throw new AppError('Guestbook is not available for this event', 404);

  const currentPhase = calculateEventPhase(event);
  const capabilities = getPhaseCapabilities(currentPhase);
  if (!capabilities.canAccessGuestbook) throw new AppError('Guestbook is not available during this event phase', 403);

  const templateData = buildTemplateData(event, currentPhase, capabilities);
  await renderEventTemplate(event, 'GUESTBOOK', event.guestbookTemplateId, templateData, res);
}));

router.get('/event/:slug/guestbook/video', asyncHandler(async (req, res) => {
  const event = await fetchPublicEvent(req.params.slug);
  if (!event.guestbookEnabled) throw new AppError('Guestbook is not available for this event', 404);

  const currentPhase = calculateEventPhase(event);
  const capabilities = getPhaseCapabilities(currentPhase);
  if (!capabilities.canAccessGuestbook) throw new AppError('Guestbook is not available during this event phase', 403);

  const templateData = buildTemplateData(event, currentPhase, capabilities);
  await renderEventTemplate(event, 'GUESTBOOK_VIDEO', (event as any).guestbookVideoTemplateId, templateData, res);
}));

router.get('/event/:slug/guestbook/audio', asyncHandler(async (req, res) => {
  const event = await fetchPublicEvent(req.params.slug);
  if (!event.guestbookEnabled) throw new AppError('Guestbook is not available for this event', 404);

  const currentPhase = calculateEventPhase(event);
  const capabilities = getPhaseCapabilities(currentPhase);
  if (!capabilities.canAccessGuestbook) throw new AppError('Guestbook is not available during this event phase', 403);

  const templateData = buildTemplateData(event, currentPhase, capabilities);
  await renderEventTemplate(event, 'GUESTBOOK_AUDIO', (event as any).guestbookAudioTemplateId, templateData, res);
}));

router.get('/event/:slug/guestbook/photo', asyncHandler(async (req, res) => {
  const event = await fetchPublicEvent(req.params.slug);
  if (!event.guestbookEnabled) throw new AppError('Guestbook is not available for this event', 404);

  const currentPhase = calculateEventPhase(event);
  const capabilities = getPhaseCapabilities(currentPhase);
  if (!capabilities.canAccessGuestbook) throw new AppError('Guestbook is not available during this event phase', 403);

  const templateData = buildTemplateData(event, currentPhase, capabilities);
  await renderEventTemplate(event, 'GUESTBOOK_PHOTO', (event as any).guestbookPhotoTemplateId, templateData, res);
}));

// ─── Booth ─────────────────────────────────────────────────────────────────────
router.get('/event/:slug/booth', asyncHandler(async (req, res) => {
  const event = await fetchPublicEvent(req.params.slug);
  if (!event.guestbookEnabled) throw new AppError('Booth is not available for this event', 404);

  const currentPhase = calculateEventPhase(event);
  const capabilities = getPhaseCapabilities(currentPhase);
  if (!capabilities.canAccessGuestbook) throw new AppError('Booth is not available during this event phase', 403);

  const templateData = buildTemplateData(event, currentPhase, capabilities);
  await renderEventTemplate(event, 'BOOTH', (event as any).boothTemplateId, templateData, res);
}));

router.get('/event/:slug/booth/video', asyncHandler(async (req, res) => {
  const event = await fetchPublicEvent(req.params.slug);
  if (!event.guestbookEnabled) throw new AppError('Booth is not available for this event', 404);

  const currentPhase = calculateEventPhase(event);
  const capabilities = getPhaseCapabilities(currentPhase);
  if (!capabilities.canAccessGuestbook) throw new AppError('Booth is not available during this event phase', 403);

  const templateData = buildTemplateData(event, currentPhase, capabilities);
  await renderEventTemplate(event, 'BOOTH_VIDEO', (event as any).boothVideoTemplateId, templateData, res);
}));

router.get('/event/:slug/booth/audio', asyncHandler(async (req, res) => {
  const event = await fetchPublicEvent(req.params.slug);
  if (!event.guestbookEnabled) throw new AppError('Booth is not available for this event', 404);

  const currentPhase = calculateEventPhase(event);
  const capabilities = getPhaseCapabilities(currentPhase);
  if (!capabilities.canAccessGuestbook) throw new AppError('Booth is not available during this event phase', 403);

  const templateData = buildTemplateData(event, currentPhase, capabilities);
  await renderEventTemplate(event, 'BOOTH_AUDIO', (event as any).boothAudioTemplateId, templateData, res);
}));

router.get('/event/:slug/booth/photo', asyncHandler(async (req, res) => {
  const event = await fetchPublicEvent(req.params.slug);
  if (!event.guestbookEnabled) throw new AppError('Booth is not available for this event', 404);

  const currentPhase = calculateEventPhase(event);
  const capabilities = getPhaseCapabilities(currentPhase);
  if (!capabilities.canAccessGuestbook) throw new AppError('Booth is not available during this event phase', 403);

  const templateData = buildTemplateData(event, currentPhase, capabilities);
  await renderEventTemplate(event, 'BOOTH_PHOTO', (event as any).boothPhotoTemplateId, templateData, res);
}));

// ─── Thank-You ─────────────────────────────────────────────────────────────────
router.get('/event/:slug/thank-you', asyncHandler(async (req, res) => {
  const event = await fetchPublicEvent(req.params.slug);
  const currentPhase = calculateEventPhase(event);

  if (currentPhase !== 'POST_EVENT') {
    return res.json({ template: null, phase: currentPhase, message: 'Event is not in POST_EVENT phase' });
  }

  const capabilities = getPhaseCapabilities(currentPhase);
  const templateData = buildTemplateData(event, currentPhase, capabilities);
  await renderEventTemplate(event, 'THANK_YOU', event.thankYouTemplateId, templateData, res);
}));

export default router;