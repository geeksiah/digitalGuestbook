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
import { BUCKETS, buildPublicUrl, getPublicUrl } from '../services/supabaseStorage.js';
import { subscribeToItineraryUpdates } from '../services/itineraryRealtime.js';
import { featureFlags } from '../utils/featureFlags.js';

const router = Router();

const compareSemver = (a: string, b: string) => {
  const parse = (input: string) =>
    String(input || '0.0.0')
      .split('.')
      .map((part) => Number(part.replace(/[^\d]/g, '') || 0))
      .slice(0, 3);
  const left = parse(a);
  const right = parse(b);
  for (let index = 0; index < 3; index += 1) {
    const l = left[index] || 0;
    const r = right[index] || 0;
    if (l > r) return 1;
    if (l < r) return -1;
  }
  return 0;
};

/**
 * GET /api/public/mobile-version-check
 */
router.get('/mobile-version-check', asyncHandler(async (req, res) => {
  if (!featureFlags.ownerUpdateCheck) {
    return res.json({
      status: 'UP_TO_DATE',
      reason: 'disabled',
    });
  }

  const platformRaw = String(req.query.platform || 'android').toLowerCase();
  const platform = platformRaw === 'ios' ? 'ios' : 'android';
  const currentVersion = String(req.query.version || '0.0.0');

  const settings = await prisma.systemSettings.findUnique({
    where: { id: 'default' },
    select: {
      ownerMobileLatestVersion: true,
      ownerMobileMinimumVersion: true,
      ownerMobileAndroidStoreUrl: true,
      ownerMobileIosStoreUrl: true,
    },
  });

  const latestVersion = settings?.ownerMobileLatestVersion || currentVersion;
  const minimumVersion = settings?.ownerMobileMinimumVersion || currentVersion;
  const storeUrl = platform === 'ios'
    ? settings?.ownerMobileIosStoreUrl || null
    : settings?.ownerMobileAndroidStoreUrl || null;

  let status: 'UP_TO_DATE' | 'UPDATE_AVAILABLE' | 'UPDATE_REQUIRED' = 'UP_TO_DATE';
  if (compareSemver(currentVersion, minimumVersion) < 0) {
    status = 'UPDATE_REQUIRED';
  } else if (compareSemver(currentVersion, latestVersion) < 0) {
    status = 'UPDATE_AVAILABLE';
  }

  return res.json({
    status,
    currentVersion,
    latestVersion,
    minimumVersion,
    platform,
    storeUrl,
  });
}));

// ─── Event select fields ───────────────────────────────────────────────────────
const EVENT_PUBLIC_SELECT = {
  id: true,
  slug: true,
  name: true,
  description: true,
  socialTitle: true,
  socialDescription: true,
  coverImagePath: true,
  coverImageAlt: true,
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
  strictInviteOnly: true,
  itineraryEnabled: true,
  giftingEnabled: true,
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
  itineraryPageTemplateId: true,
  giftingPageTemplateId: true,
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
      rsvp: event.rsvpEnabled ? `${frontendUrl}/e/${event.slug}/rsvp` : null,
      guestbook: event.guestbookEnabled ? `${frontendUrl}/e/${event.slug}/guestbook` : null,
      booth: event.guestbookEnabled ? `${frontendUrl}/e/${event.slug}/booth` : null,
      thankYou: `${frontendUrl}/e/${event.slug}/thanks`,
      invitation: `${frontendUrl}/e/${event.slug}`,
      live: `${frontendUrl}/e/${event.slug}/live`,
      checkIn: event.checkInEnabled ? `${frontendUrl}/e/${event.slug}/checkin` : null,
      guestbookVideo: event.guestbookEnabled ? `${frontendUrl}/e/${event.slug}/guestbook/video` : null,
      guestbookAudio: event.guestbookEnabled ? `${frontendUrl}/e/${event.slug}/guestbook/audio` : null,
      guestbookPhoto: event.guestbookEnabled ? `${frontendUrl}/e/${event.slug}/guestbook/photo` : null,
      boothVideo: event.guestbookEnabled ? `${frontendUrl}/e/${event.slug}/booth/video` : null,
      boothAudio: event.guestbookEnabled ? `${frontendUrl}/e/${event.slug}/booth/audio` : null,
      boothPhoto: event.guestbookEnabled ? `${frontendUrl}/e/${event.slug}/booth/photo` : null,
      itinerary: event.itineraryEnabled ? `${frontendUrl}/e/${event.slug}/itinerary` : null,
      gifting: event.giftingEnabled ? `${frontendUrl}/gift/${event.slug}` : null,
    },
  };
}

function getPathValue(source: any, rawPath: string): any {
  if (!source || typeof source !== 'object') return undefined;
  const path = rawPath.trim();
  if (!path) return source;
  const keys = path.split('.').filter(Boolean);
  let value: any = source;
  for (const key of keys) {
    if (value && typeof value === 'object' && key in value) {
      value = value[key];
    } else {
      return undefined;
    }
  }
  return value;
}

function resolveTemplateValue(pathStr: string, currentData: any, rootData: any): any {
  const path = pathStr.trim();
  if (!path) return undefined;
  if (path === 'this' || path === '.') return currentData;
  if (path.startsWith('@root.')) {
    return getPathValue(rootData, path.slice('@root.'.length));
  }
  if (path.startsWith('this.')) {
    return getPathValue(currentData, path.slice('this.'.length));
  }

  const currentValue = getPathValue(currentData, path);
  if (currentValue !== undefined) return currentValue;
  return getPathValue(rootData, path);
}

function isTruthyTemplateValue(value: any): boolean {
  if (Array.isArray(value)) return value.length > 0;
  return Boolean(value);
}

function renderTemplateWithBlocks(
  tpl: string,
  currentData: any,
  rootData: any,
  depth = 0
): string {
  if (depth > 12) return tpl;

  let output = tpl;

  // {{#each path}}...{{/each}}
  output = output.replace(/\{\{#each\s+([^}]+)\}\}([\s\S]*?)\{\{\/each\}\}/g, (_match, pathStr, inner) => {
    const collection = resolveTemplateValue(pathStr, currentData, rootData);
    if (Array.isArray(collection)) {
      return collection
        .map((item, index) => {
          const itemCtx =
            item && typeof item === 'object'
              ? { ...item, this: item, '@index': index }
              : { this: item, '@index': index };
          return renderTemplateWithBlocks(inner, itemCtx, rootData, depth + 1);
        })
        .join('');
    }
    if (collection && typeof collection === 'object') {
      return Object.entries(collection)
        .map(([key, value], index) => {
          const itemCtx =
            value && typeof value === 'object'
              ? { ...value, this: value, '@key': key, '@index': index }
              : { this: value, '@key': key, '@index': index };
          return renderTemplateWithBlocks(inner, itemCtx, rootData, depth + 1);
        })
        .join('');
    }
    return '';
  });

  // {{#if path}}...{{else}}...{{/if}}
  output = output.replace(/\{\{#if\s+([^}]+)\}\}([\s\S]*?)(?:\{\{else\}\}([\s\S]*?))?\{\{\/if\}\}/g, (_match, pathStr, truthyBlock, falsyBlock = '') => {
    const conditionValue = resolveTemplateValue(pathStr, currentData, rootData);
    const chosenBlock = isTruthyTemplateValue(conditionValue) ? truthyBlock : falsyBlock;
    return renderTemplateWithBlocks(chosenBlock, currentData, rootData, depth + 1);
  });

  // Standard variables: {{event.name}}, {{title}}, {{this}}
  output = output.replace(/\{\{\s*([^#\/][^}]*)\s*\}\}/g, (match, pathStr) => {
    const value = resolveTemplateValue(pathStr, currentData, rootData);
    if (value === undefined || value === null) return '';
    if (typeof value === 'object') return JSON.stringify(value);
    return String(value);
  });

  // Compatibility syntax: {urls.invitation}
  output = output.replace(/\{\s*((?:urls|event|phase|capabilities|itinerary|itineraryMeta)\.[^{}]+?)\s*\}/g, (match, pathStr) => {
    const value = resolveTemplateValue(pathStr, currentData, rootData);
    if (value === undefined || value === null) return match;
    if (typeof value === 'object') return JSON.stringify(value);
    return String(value);
  });

  return output;
}

function formatItineraryTime(value: Date | string | null | undefined, timezone: string | null | undefined): string {
  if (!value) return '';
  const date = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(date.getTime())) return '';
  try {
    return new Intl.DateTimeFormat('en-US', {
      hour: 'numeric',
      minute: '2-digit',
      hour12: true,
      timeZone: timezone || 'UTC',
    }).format(date);
  } catch {
    return new Intl.DateTimeFormat('en-US', {
      hour: 'numeric',
      minute: '2-digit',
      hour12: true,
    }).format(date);
  }
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

function resolveEventCoverUrl(coverImagePath: string | null | undefined): string | null {
  if (!coverImagePath) return null;
  if (coverImagePath.startsWith('http://') || coverImagePath.startsWith('https://')) {
    return coverImagePath;
  }

  const backendBase = (
    process.env.API_URL
    || process.env.BACKEND_URL
    || process.env.RENDER_EXTERNAL_URL
    || ''
  ).replace(/\/+$/, '');
  const supabaseBase = (process.env.SUPABASE_URL || '').replace(/\/+$/, '');

  const toBackendAbsolute = (value: string) => {
    const path = value.startsWith('/') ? value : `/${value}`;
    return backendBase ? `${backendBase}${path}` : path;
  };

  try {
    const publicUrl = getPublicUrl(BUCKETS.MEDIA, coverImagePath);
    if (publicUrl.startsWith('http://') || publicUrl.startsWith('https://')) {
      return publicUrl;
    }
    if (supabaseBase && publicUrl.startsWith('/storage/v1/object/public/')) {
      return `${supabaseBase}${publicUrl}`;
    }
    return toBackendAbsolute(publicUrl);
  } catch {
    try {
      const publicUrl = buildPublicUrl(BUCKETS.MEDIA, coverImagePath);
      if (publicUrl.startsWith('http://') || publicUrl.startsWith('https://')) {
        return publicUrl;
      }
      if (supabaseBase && publicUrl.startsWith('/storage/v1/object/public/')) {
        return `${supabaseBase}${publicUrl}`;
      }
      return toBackendAbsolute(publicUrl);
    } catch {
      const normalized = coverImagePath.replace(/^\/+/, '');
      if (supabaseBase && normalized.includes('/')) {
        return `${supabaseBase}/storage/v1/object/public/${BUCKETS.MEDIA}/${normalized}`;
      }
      return toBackendAbsolute(coverImagePath);
    }
  }
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

  html = renderTemplateWithBlocks(html, templateData, templateData);

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
      socialTitle: event.socialTitle,
      socialDescription: event.socialDescription,
      coverImagePath: event.coverImagePath,
      coverImageAlt: event.coverImageAlt,
      coverImageUrl: resolveEventCoverUrl(event.coverImagePath),
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
      strictInviteOnly: event.strictInviteOnly,
      itineraryEnabled: event.itineraryEnabled,
      giftingEnabled: event.giftingEnabled,
    },
    urls: {
      rsvp: event.rsvpEnabled ? `/e/${event.slug}/rsvp` : null,
      guestbook: event.guestbookEnabled ? `/e/${event.slug}/guestbook` : null,
      booth: event.guestbookEnabled ? `/e/${event.slug}/booth` : null,
      itinerary: event.itineraryEnabled ? `/e/${event.slug}/itinerary` : null,
      gifting: event.giftingEnabled ? `/gift/${event.slug}` : null,
      thankYou: `/e/${event.slug}/thanks`,
    },
  });
}));

/**
 * GET /api/public/domain/:host
 * Resolve custom domain host to event slug
 */
router.get('/domain/:host', asyncHandler(async (req, res) => {
  const host = String(req.params.host || '').trim().toLowerCase();
  if (!host) {
    throw new AppError('Host is required', 400);
  }

  const domain = await prisma.eventDomain.findUnique({
    where: { host },
    include: {
      event: {
        select: {
          id: true,
          slug: true,
          isArchived: true,
        },
      },
    },
  });

  if (!domain || !domain.event || domain.event.isArchived || !['ACTIVE', 'VERIFIED'].includes(domain.status)) {
    return res.status(404).json({ mapped: false });
  }

  return res.json({
    mapped: true,
    eventId: domain.event.id,
    slug: domain.event.slug,
    host: domain.host,
  });
}));

/**
 * GET /api/public/rsvp-invite/:token
 * Public payload for WhatsApp/deep-link invite card
 */
router.get('/rsvp-invite/:token', asyncHandler(async (req, res) => {
  const token = String(req.params.token || '').trim();
  if (!token) {
    throw new AppError('Invite token is required', 400);
  }

  const invite = await prisma.rsvpInvite.findUnique({
    where: { token },
    include: {
      event: {
        select: {
          id: true,
          slug: true,
          name: true,
          description: true,
          date: true,
          endDate: true,
          timezone: true,
          venue: true,
          socialTitle: true,
          socialDescription: true,
          coverImagePath: true,
          coverImageAlt: true,
          strictInviteOnly: true,
          invitationOnly: true,
        },
      },
    },
  });

  if (!invite) {
    throw new AppError('Invite not found', 404);
  }

  if (invite.expiresAt && invite.expiresAt < new Date()) {
    throw new AppError('Invite has expired', 410);
  }

  if (invite.status === 'SENT') {
    await prisma.rsvpInvite.update({
      where: { id: invite.id },
      data: {
        status: 'OPENED',
        openedAt: invite.openedAt || new Date(),
      },
    });
  }

  res.json({
    invite: {
      id: invite.id,
      token: invite.token,
      status: invite.status,
      inviteeName: invite.inviteeName,
      inviteePhone: invite.inviteePhone,
      inviteeEmail: invite.inviteeEmail,
      initialResponse: invite.initialResponse,
      partySize: invite.partySize,
      note: invite.note,
      expiresAt: invite.expiresAt,
    },
    event: {
      id: invite.event.id,
      slug: invite.event.slug,
      name: invite.event.name,
      title: invite.event.socialTitle || invite.event.name,
      description: invite.event.socialDescription || invite.event.description,
      date: invite.event.date,
      endDate: invite.event.endDate,
      timezone: invite.event.timezone,
      venue: invite.event.venue,
      coverImageUrl: resolveEventCoverUrl(invite.event.coverImagePath),
      coverImageAlt: invite.event.coverImageAlt,
      strictInviteOnly: invite.event.strictInviteOnly,
      invitationOnly: invite.event.invitationOnly,
    },
  });
}));

/**
 * GET /api/public/event/:slug/itinerary
 * Public attendee itinerary (read-only)
 */
router.get('/event/:slug/itinerary', asyncHandler(async (req, res) => {
  const event = await prisma.event.findUnique({
    where: { slug: req.params.slug },
    select: {
      id: true,
      slug: true,
      name: true,
      date: true,
      venue: true,
      updatedAt: true,
      itineraryEnabled: true,
      isArchived: true,
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
          updatedAt: true,
        },
      },
    },
  });

  if (!event) throw new AppError('Event not found', 404);
  if (event.isArchived) throw new AppError('This event is no longer available', 410);
  if (!event.itineraryEnabled) throw new AppError('Itinerary is disabled for this event', 404);

  const total = event.itineraryItems.length;
  const completed = event.itineraryItems.filter((item) => item.isCompleted).length;
  const lastUpdatedAt = event.itineraryItems.reduce<Date>(
    (latest, item) => (item.updatedAt > latest ? item.updatedAt : latest),
    event.updatedAt
  );
  const sinceParam = typeof req.query.since === 'string' ? req.query.since : '';
  const sinceDate = sinceParam ? new Date(sinceParam) : null;
  const hasValidSince = Boolean(sinceDate && !Number.isNaN(sinceDate.getTime()));
  const changed = !hasValidSince || (sinceDate as Date) < lastUpdatedAt;

  const items = changed
    ? event.itineraryItems.map(({ updatedAt, ...item }) => item)
    : [];

  res.json({
    event: {
      id: event.id,
      slug: event.slug,
      name: event.name,
      date: event.date,
      venue: event.venue,
    },
    itinerary: {
      total,
      completed,
      percent: total ? Math.round((completed / total) * 100) : 0,
      changed,
      lastUpdatedAt,
      items,
    },
  });
}));

/**
 * GET /api/public/event/:slug/itinerary/stream
 * Server-sent events stream for itinerary realtime updates
 */
router.get('/event/:slug/itinerary/stream', asyncHandler(async (req, res) => {
  const event = await prisma.event.findUnique({
    where: { slug: req.params.slug },
    select: {
      id: true,
      isArchived: true,
      itineraryEnabled: true,
    },
  });

  if (!event) throw new AppError('Event not found', 404);
  if (event.isArchived) throw new AppError('This event is no longer available', 410);
  if (!event.itineraryEnabled) throw new AppError('Itinerary is disabled for this event', 404);

  res.status(200);
  res.setHeader('Content-Type', 'text/event-stream; charset=utf-8');
  res.setHeader('Cache-Control', 'no-cache, no-transform');
  res.setHeader('Connection', 'keep-alive');
  res.setHeader('X-Accel-Buffering', 'no');
  (res as any).flushHeaders?.();

  const sendEvent = (eventName: string, payload: Record<string, any>) => {
    res.write(`event: ${eventName}\n`);
    res.write(`data: ${JSON.stringify(payload)}\n\n`);
    (res as any).flush?.();
  };

  sendEvent('ready', {
    eventId: event.id,
    updatedAt: new Date().toISOString(),
  });

  const unsubscribe = subscribeToItineraryUpdates(event.id, (payload) => {
    sendEvent('itinerary-update', payload);
  });

  const heartbeat = setInterval(() => {
    res.write(`: keepalive ${Date.now()}\n\n`);
    (res as any).flush?.();
  }, 25000);

  req.on('close', () => {
    clearInterval(heartbeat);
    unsubscribe();
    try {
      res.end();
    } catch {
      // Ignore close race conditions.
    }
  });
}));

/**
 * GET /api/public/event/:slug/itinerary-page
 * Render itinerary page template (if assigned)
 */
router.get('/event/:slug/itinerary-page', asyncHandler(async (req, res) => {
  const event = await fetchPublicEvent(req.params.slug);
  if (!event.itineraryEnabled) throw new AppError('Itinerary is disabled for this event', 404);

  const currentPhase = calculateEventPhase(event);
  const capabilities = getPhaseCapabilities(currentPhase);
  const itineraryItems = await prisma.eventItineraryItem.findMany({
    where: { eventId: event.id },
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
  });

  const itinerary = itineraryItems.map((item) => ({
    id: item.id,
    title: item.title,
    description: item.description,
    startsAt: formatItineraryTime(item.startsAt, event.timezone),
    endsAt: formatItineraryTime(item.endsAt, event.timezone),
    startsAtIso: item.startsAt ? item.startsAt.toISOString() : null,
    endsAtIso: item.endsAt ? item.endsAt.toISOString() : null,
    location: item.location,
    sortOrder: item.sortOrder,
    isCompleted: item.isCompleted,
    completedAt: item.completedAt ? item.completedAt.toISOString() : null,
  }));

  const completed = itinerary.filter((item) => item.isCompleted).length;
  const total = itinerary.length;

  const templateData = {
    ...buildTemplateData(event, currentPhase, capabilities),
    itinerary,
    itineraryMeta: {
      total,
      completed,
      percent: total ? Math.round((completed / total) * 100) : 0,
    },
  };

  await renderEventTemplate(event, 'ITINERARY', (event as any).itineraryPageTemplateId, templateData, res);
}));

/**
 * GET /api/public/event/:slug/gifting
 * Render gifting page template (if assigned)
 */
router.get('/event/:slug/gifting', asyncHandler(async (req, res) => {
  const event = await fetchPublicEvent(req.params.slug);
  if (!event.giftingEnabled) throw new AppError('Gifting is disabled for this event', 404);

  const currentPhase = calculateEventPhase(event);
  const capabilities = getPhaseCapabilities(currentPhase);
  const templateData = buildTemplateData(event, currentPhase, capabilities);

  await renderEventTemplate(event, 'GIFTING', (event as any).giftingPageTemplateId, templateData, res);
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
