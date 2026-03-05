"use strict";
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
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const prisma_js_1 = __importDefault(require("../utils/prisma.js"));
const errorHandler_js_1 = require("../middleware/errorHandler.js");
const phase_js_1 = require("../utils/phase.js");
const template_helper_js_1 = require("../utils/template-helper.js");
const supabaseStorage_js_1 = require("../services/supabaseStorage.js");
const itineraryRealtime_js_1 = require("../services/itineraryRealtime.js");
const featureFlags_js_1 = require("../utils/featureFlags.js");
const router = (0, express_1.Router)();
const getQueryString = (value, fallback) => typeof value === 'string' ? value : fallback;
const compareSemver = (a, b) => {
    const parse = (input) => String(input || '0.0.0')
        .split('.')
        .map((part) => Number(part.replaceAll(/[^\d]/g, '') || 0))
        .slice(0, 3);
    const left = parse(a);
    const right = parse(b);
    for (let index = 0; index < 3; index += 1) {
        const l = left[index] || 0;
        const r = right[index] || 0;
        if (l > r)
            return 1;
        if (l < r)
            return -1;
    }
    return 0;
};
const parseJson = (value, fallback) => {
    if (!value)
        return fallback;
    try {
        return JSON.parse(value);
    }
    catch {
        return fallback;
    }
};
/**
 * GET /api/public/mobile-version-check
 */
router.get('/mobile-version-check', (0, errorHandler_js_1.asyncHandler)(async (req, res) => {
    if (!featureFlags_js_1.featureFlags.ownerUpdateCheck) {
        return res.json({
            status: 'UP_TO_DATE',
            reason: 'disabled',
        });
    }
    const platformRaw = getQueryString(req.query.platform, 'android').toLowerCase();
    const platform = platformRaw === 'ios' ? 'ios' : 'android';
    const currentVersion = getQueryString(req.query.version, '0.0.0');
    const settings = await prisma_js_1.default.systemSettings.findUnique({
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
    let status = 'UP_TO_DATE';
    if (compareSemver(currentVersion, minimumVersion) < 0) {
        status = 'UPDATE_REQUIRED';
    }
    else if (compareSemver(currentVersion, latestVersion) < 0) {
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
    votingPageTemplateId: true,
    nominationPageTemplateId: true,
    nomineesPageTemplateId: true,
    leaderboardPageTemplateId: true,
    votingConfig: {
        select: {
            isEnabled: true,
        },
    },
};
// ─── Helper: standard template data ────────────────────────────────────────────
function buildTemplateData(event, currentPhase, capabilities) {
    const frontendUrl = (process.env.FRONTEND_URL ||
        process.env.SITE_URL ||
        process.env.APP_URL ||
        '').replace(/\/+$/, '');
    const apiBaseUrl = (process.env.API_URL ||
        process.env.BACKEND_URL ||
        process.env.RENDER_EXTERNAL_URL ||
        frontendUrl).replace(/\/+$/, '');
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
            vote: event.votingConfig?.isEnabled ? `${frontendUrl}/e/${event.slug}/vote` : null,
            voting: event.votingConfig?.isEnabled ? `${frontendUrl}/e/${event.slug}/vote` : null,
            nominate: event.votingConfig?.isEnabled ? `${frontendUrl}/e/${event.slug}/nominate` : null,
            nominees: event.votingConfig?.isEnabled ? `${frontendUrl}/e/${event.slug}/nominees` : null,
            leaderboard: event.votingConfig?.isEnabled ? `${frontendUrl}/e/${event.slug}/leaderboard` : null,
        },
        api: {
            baseUrl: apiBaseUrl,
        },
    };
}
function getPathValue(source, rawPath) {
    if (!source || typeof source !== 'object')
        return undefined;
    const path = rawPath.trim();
    if (!path)
        return source;
    const keys = path.split('.').filter(Boolean);
    let value = source;
    for (const key of keys) {
        if (value && typeof value === 'object' && key in value) {
            value = value[key];
        }
        else {
            return undefined;
        }
    }
    return value;
}
function resolveTemplateValue(pathStr, currentData, rootData) {
    const path = pathStr.trim();
    if (!path)
        return undefined;
    if (path === 'this' || path === '.')
        return currentData;
    if (path.startsWith('@root.')) {
        return getPathValue(rootData, path.slice('@root.'.length));
    }
    if (path.startsWith('this.')) {
        return getPathValue(currentData, path.slice('this.'.length));
    }
    const currentValue = getPathValue(currentData, path);
    if (currentValue !== undefined)
        return currentValue;
    return getPathValue(rootData, path);
}
function isTruthyTemplateValue(value) {
    if (Array.isArray(value))
        return value.length > 0;
    return Boolean(value);
}
function renderTemplateWithBlocks(tpl, currentData, rootData, depth = 0) {
    if (depth > 12)
        return tpl;
    let output = tpl;
    // {{#each path}}...{{/each}}
    output = output.replaceAll(/\{\{#each\s+([^}]+)\}\}([\s\S]*?)\{\{\/each\}\}/g, (_match, pathStr, inner) => {
        const collection = resolveTemplateValue(pathStr, currentData, rootData);
        if (Array.isArray(collection)) {
            return collection
                .map((item, index) => {
                const itemCtx = item && typeof item === 'object'
                    ? { ...item, this: item, '@index': index }
                    : { this: item, '@index': index };
                return renderTemplateWithBlocks(inner, itemCtx, rootData, depth + 1);
            })
                .join('');
        }
        if (collection && typeof collection === 'object') {
            return Object.entries(collection)
                .map(([key, value], index) => {
                const itemCtx = value && typeof value === 'object'
                    ? { ...value, this: value, '@key': key, '@index': index }
                    : { this: value, '@key': key, '@index': index };
                return renderTemplateWithBlocks(inner, itemCtx, rootData, depth + 1);
            })
                .join('');
        }
        return '';
    });
    // {{#if path}}...{{else}}...{{/if}}
    output = output.replaceAll(/\{\{#if\s+([^}]+)\}\}([\s\S]*?)(?:\{\{else\}\}([\s\S]*?))?\{\{\/if\}\}/g, (_match, pathStr, truthyBlock, falsyBlock = '') => {
        const conditionValue = resolveTemplateValue(pathStr, currentData, rootData);
        const chosenBlock = isTruthyTemplateValue(conditionValue) ? truthyBlock : falsyBlock;
        return renderTemplateWithBlocks(chosenBlock, currentData, rootData, depth + 1);
    });
    // Standard variables: {{event.name}}, {{title}}, {{this}}
    output = output.replaceAll(/\{\{\s*([^#/][^}]*)\s*\}\}/g, (match, pathStr) => {
        const value = resolveTemplateValue(pathStr, currentData, rootData);
        if (value === undefined || value === null)
            return '';
        if (typeof value === 'object')
            return JSON.stringify(value);
        return String(value);
    });
    // Compatibility syntax: {urls.invitation}
    output = output.replaceAll(/\{\s*((?:urls|event|phase|capabilities|itinerary|itineraryMeta)\.[^{}]+?)\s*\}/g, (match, pathStr) => {
        const value = resolveTemplateValue(pathStr, currentData, rootData);
        if (value === undefined || value === null)
            return match;
        if (typeof value === 'object')
            return JSON.stringify(value);
        return String(value);
    });
    return output;
}
function formatItineraryTime(value, timezone) {
    if (!value)
        return '';
    const date = value instanceof Date ? value : new Date(value);
    if (Number.isNaN(date.getTime()))
        return '';
    try {
        return new Intl.DateTimeFormat('en-US', {
            hour: 'numeric',
            minute: '2-digit',
            hour12: true,
            timeZone: timezone || 'UTC',
        }).format(date);
    }
    catch {
        return new Intl.DateTimeFormat('en-US', {
            hour: 'numeric',
            minute: '2-digit',
            hour12: true,
        }).format(date);
    }
}
// ─── Helper: fetch event or throw ──────────────────────────────────────────────
async function fetchPublicEvent(slug) {
    const event = await prisma_js_1.default.event.findUnique({
        where: { slug },
        select: EVENT_PUBLIC_SELECT,
    });
    if (!event)
        throw new errorHandler_js_1.AppError('Event not found', 404);
    if (event.isArchived)
        throw new errorHandler_js_1.AppError('This event is no longer available', 410);
    return event;
}
// ─── Helper: compute Supabase public base URL for template assets ──────────────
function getTemplateAssetBase(templateId) {
    const supabaseUrl = process.env.SUPABASE_URL;
    if (!supabaseUrl)
        return null;
    // Supabase public URL pattern for the templates bucket
    return `${supabaseUrl.replace(/\/+$/, '')}/storage/v1/object/public/templates/${templateId}/`;
}
function resolveEventCoverUrl(coverImagePath) {
    if (!coverImagePath)
        return null;
    if (coverImagePath.startsWith('http://') || coverImagePath.startsWith('https://')) {
        return coverImagePath;
    }
    const backendBase = (process.env.API_URL
        || process.env.BACKEND_URL
        || process.env.RENDER_EXTERNAL_URL
        || '').replace(/\/+$/, '');
    const supabaseBase = (process.env.SUPABASE_URL || '').replace(/\/+$/, '');
    const toBackendAbsolute = (value) => {
        const path = value.startsWith('/') ? value : `/${value}`;
        return backendBase ? `${backendBase}${path}` : path;
    };
    try {
        const publicUrl = (0, supabaseStorage_js_1.getPublicUrl)(supabaseStorage_js_1.BUCKETS.MEDIA, coverImagePath);
        if (publicUrl.startsWith('http://') || publicUrl.startsWith('https://')) {
            return publicUrl;
        }
        if (supabaseBase && publicUrl.startsWith('/storage/v1/object/public/')) {
            return `${supabaseBase}${publicUrl}`;
        }
        return toBackendAbsolute(publicUrl);
    }
    catch {
        try {
            const publicUrl = (0, supabaseStorage_js_1.buildPublicUrl)(supabaseStorage_js_1.BUCKETS.MEDIA, coverImagePath);
            if (publicUrl.startsWith('http://') || publicUrl.startsWith('https://')) {
                return publicUrl;
            }
            if (supabaseBase && publicUrl.startsWith('/storage/v1/object/public/')) {
                return `${supabaseBase}${publicUrl}`;
            }
            return toBackendAbsolute(publicUrl);
        }
        catch {
            const normalized = coverImagePath.replace(/^\/+/, '');
            if (supabaseBase && normalized.includes('/')) {
                return `${supabaseBase}/storage/v1/object/public/${supabaseStorage_js_1.BUCKETS.MEDIA}/${normalized}`;
            }
            return toBackendAbsolute(coverImagePath);
        }
    }
}
// ─── Helper: render template ───────────────────────────────────────────────────
// UPDATED: Emits X-Template-Asset-Base header so the frontend can rewrite
// asset URLs to hit Supabase CDN directly instead of the backend.
// Server-side rewriting is KEPT as fallback for direct-fetch/curl compatibility.
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
    const backendUrl = (process.env.API_URL ||
        process.env.BACKEND_URL ||
        process.env.RENDER_EXTERNAL_URL ||
        '').replace(/\/+$/, '');
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
        html = html.replaceAll(/(src|href)=["'](\.\/|\.\.\/)?assets\//g, `$1="${assetBaseForHtml}`);
        // Pattern 2: src="/assets/..."
        html = html.replaceAll(/(src|href)=["']\/assets\//g, `$1="${assetBaseForHtml}`);
        // Pattern 3: bare filenames like src="MCS_9627.jpeg"
        html = html.replaceAll(/(src)=["'](?!\w+:\/\/|\/|#|data:|blob:)([^"']+\.(jpe?g|png|gif|webp|svg|ico|css|js|woff2?|ttf|eot|mp4|webm|mp3|wav|pdf))["']/gi, `$1="${assetBaseForHtml}$2"`);
        // Pattern 4: CSS url() references in inline styles
        html = html.replaceAll(/url\(['"]?(?:\.\/|\.\.\/)?assets\//g, `url('${assetBaseForHtml}`);
        // Pattern 5: CSS url() in separate cssContent
        if (template.cssContent) {
            template.cssContent = template.cssContent.replaceAll(/url\(['"]?(?:\.\/|\.\.\/)?assets\//g, `url('${assetBaseForHtml}`);
        }
        console.info(`[Render] Asset paths resolved for template=${template.id} ` +
            `htmlBase=${assetBaseForHtml} headerBase=${assetBaseForHeader}`);
    }
    // Inject CSS
    if (template.cssContent) {
        const cssTag = `<style id="tpl-css-${template.id}">\n${template.cssContent}\n</style>`;
        if (html.includes('</head>')) {
            html = html.replace('</head>', `${cssTag}\n</head>`);
        }
        else {
            html = cssTag + '\n' + html;
        }
    }
    // Inject JS
    if (template.jsContent) {
        const jsTag = `<script id="tpl-js-${template.id}">\n${template.jsContent}\n</script>`;
        if (html.includes('</body>')) {
            html = html.replace('</body>', `${jsTag}\n</body>`);
        }
        else {
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
            vote: `/e/${event.slug}/vote`,
            voting: `/e/${event.slug}/vote`,
            nominate: `/e/${event.slug}/nominate`,
            nominees: `/e/${event.slug}/nominees`,
            leaderboard: `/e/${event.slug}/leaderboard`,
            thankYou: `/e/${event.slug}/thanks`,
        },
    });
}));
/**
 * GET /api/public/domain/:host
 * Resolve custom domain host to event slug
 */
router.get('/domain/:host', (0, errorHandler_js_1.asyncHandler)(async (req, res) => {
    const host = String(req.params.host || '').trim().toLowerCase();
    if (!host) {
        throw new errorHandler_js_1.AppError('Host is required', 400);
    }
    const domain = await prisma_js_1.default.eventDomain.findUnique({
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
router.get('/rsvp-invite/:token', (0, errorHandler_js_1.asyncHandler)(async (req, res) => {
    const token = String(req.params.token || '').trim();
    if (!token) {
        throw new errorHandler_js_1.AppError('Invite token is required', 400);
    }
    const invite = await prisma_js_1.default.rsvpInvite.findUnique({
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
        throw new errorHandler_js_1.AppError('Invite not found', 404);
    }
    if (invite.expiresAt && invite.expiresAt < new Date()) {
        throw new errorHandler_js_1.AppError('Invite has expired', 410);
    }
    if (invite.status === 'SENT') {
        await prisma_js_1.default.rsvpInvite.update({
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
router.get('/event/:slug/itinerary', (0, errorHandler_js_1.asyncHandler)(async (req, res) => {
    const event = await prisma_js_1.default.event.findUnique({
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
    if (!event)
        throw new errorHandler_js_1.AppError('Event not found', 404);
    if (event.isArchived)
        throw new errorHandler_js_1.AppError('This event is no longer available', 410);
    if (!event.itineraryEnabled)
        throw new errorHandler_js_1.AppError('Itinerary is disabled for this event', 404);
    const total = event.itineraryItems.length;
    const completed = event.itineraryItems.filter((item) => item.isCompleted).length;
    const lastUpdatedAt = event.itineraryItems.reduce((latest, item) => new Date(Math.max(latest.getTime(), item.updatedAt.getTime())), event.updatedAt);
    const sinceParam = typeof req.query.since === 'string' ? req.query.since : '';
    const sinceDate = sinceParam ? new Date(sinceParam) : null;
    const hasValidSince = Boolean(sinceDate && !Number.isNaN(sinceDate.getTime()));
    const changed = !hasValidSince || sinceDate < lastUpdatedAt;
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
router.get('/event/:slug/itinerary/stream', (0, errorHandler_js_1.asyncHandler)(async (req, res) => {
    const event = await prisma_js_1.default.event.findUnique({
        where: { slug: req.params.slug },
        select: {
            id: true,
            isArchived: true,
            itineraryEnabled: true,
        },
    });
    if (!event)
        throw new errorHandler_js_1.AppError('Event not found', 404);
    if (event.isArchived)
        throw new errorHandler_js_1.AppError('This event is no longer available', 410);
    if (!event.itineraryEnabled)
        throw new errorHandler_js_1.AppError('Itinerary is disabled for this event', 404);
    res.status(200);
    res.setHeader('Content-Type', 'text/event-stream; charset=utf-8');
    res.setHeader('Cache-Control', 'no-cache, no-transform');
    res.setHeader('Connection', 'keep-alive');
    res.setHeader('X-Accel-Buffering', 'no');
    res.flushHeaders?.();
    const sendEvent = (eventName, payload) => {
        res.write(`event: ${eventName}\n`);
        res.write(`data: ${JSON.stringify(payload)}\n\n`);
        res.flush?.();
    };
    sendEvent('ready', {
        eventId: event.id,
        updatedAt: new Date().toISOString(),
    });
    const unsubscribe = (0, itineraryRealtime_js_1.subscribeToItineraryUpdates)(event.id, (payload) => {
        sendEvent('itinerary-update', payload);
    });
    const heartbeat = setInterval(() => {
        res.write(`: keepalive ${Date.now()}\n\n`);
        res.flush?.();
    }, 25000);
    req.on('close', () => {
        clearInterval(heartbeat);
        unsubscribe();
        try {
            res.end();
        }
        catch {
            // Ignore close race conditions.
        }
    });
}));
/**
 * GET /api/public/event/:slug/itinerary-page
 * Render itinerary page template (if assigned)
 */
router.get('/event/:slug/itinerary-page', (0, errorHandler_js_1.asyncHandler)(async (req, res) => {
    const event = await fetchPublicEvent(req.params.slug);
    if (!event.itineraryEnabled)
        throw new errorHandler_js_1.AppError('Itinerary is disabled for this event', 404);
    const currentPhase = (0, phase_js_1.calculateEventPhase)(event);
    const capabilities = (0, phase_js_1.getPhaseCapabilities)(currentPhase);
    const itineraryItems = await prisma_js_1.default.eventItineraryItem.findMany({
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
    await renderEventTemplate(event, 'ITINERARY', event.itineraryPageTemplateId, templateData, res);
}));
/**
 * GET /api/public/event/:slug/gifting
 * Render gifting page template (if assigned)
 */
router.get('/event/:slug/gifting', (0, errorHandler_js_1.asyncHandler)(async (req, res) => {
    const event = await fetchPublicEvent(req.params.slug);
    if (!event.giftingEnabled)
        throw new errorHandler_js_1.AppError('Gifting is disabled for this event', 404);
    const currentPhase = (0, phase_js_1.calculateEventPhase)(event);
    const capabilities = (0, phase_js_1.getPhaseCapabilities)(currentPhase);
    const templateData = buildTemplateData(event, currentPhase, capabilities);
    await renderEventTemplate(event, 'GIFTING', event.giftingPageTemplateId, templateData, res);
}));
const buildVotingTemplateData = async (event, selectedContestId) => {
    const votingConfig = await prisma_js_1.default.votingEventConfig.findUnique({
        where: { eventId: event.id },
        select: {
            mode: true,
            isEnabled: true,
            allowFreeVotes: true,
            allowPaidVotes: true,
            allowPublicNominations: true,
            requireOtpForElection: true,
            voteUnitPrice: true,
            currency: true,
            maxVotesPerPurchase: true,
            freeVoteLabel: true,
            paidVoteLabel: true,
        },
    });
    if (!votingConfig?.isEnabled) {
        throw new errorHandler_js_1.AppError('Voting is not enabled for this event', 404);
    }
    const contests = await prisma_js_1.default.votingContest.findMany({
        where: {
            eventId: event.id,
            isActive: true,
            ...(selectedContestId ? { id: selectedContestId } : {}),
        },
        orderBy: [{ sortOrder: 'asc' }, { createdAt: 'asc' }],
        select: {
            id: true,
            title: true,
            description: true,
            mode: true,
            allowPublicNominations: true,
            nominationFormFieldsJson: true,
            sortOrder: true,
            startsAt: true,
            endsAt: true,
            options: {
                where: { isActive: true },
                orderBy: [{ totalVotes: 'desc' }, { name: 'asc' }],
                select: {
                    id: true,
                    name: true,
                    description: true,
                    imagePath: true,
                    totalVotes: true,
                    freeVotes: true,
                    paidVotes: true,
                    sortOrder: true,
                },
            },
        },
    });
    const currentPhase = (0, phase_js_1.calculateEventPhase)(event);
    const capabilities = (0, phase_js_1.getPhaseCapabilities)(currentPhase);
    const contestPayload = contests.map((contest) => ({
        ...contest,
        startsAtIso: contest.startsAt ? contest.startsAt.toISOString() : null,
        endsAtIso: contest.endsAt ? contest.endsAt.toISOString() : null,
        nominationFormFields: parseJson(contest.nominationFormFieldsJson, []),
    }));
    const nomineesByCategory = contestPayload.map((contest) => {
        const totalVotes = contest.options.reduce((sum, option) => sum + Number(option.totalVotes || 0), 0) || 1;
        return {
            contestId: contest.id,
            title: contest.title,
            mode: contest.mode,
            totalVotes: contest.options.reduce((sum, option) => sum + Number(option.totalVotes || 0), 0),
            nominees: contest.options.map((option) => ({
                optionId: option.id,
                contestId: contest.id,
                ...option,
                voteSharePercent: Number(((Number(option.totalVotes || 0) / totalVotes) * 100).toFixed(2)),
            })),
        };
    });
    const leaderboard = contestPayload.map((contest) => ({
        contestId: contest.id,
        title: contest.title,
        mode: contest.mode,
        totalVotes: contest.options.reduce((sum, option) => sum + Number(option.totalVotes || 0), 0),
        rankings: contest.options.map((option, index) => ({
            rank: index + 1,
            contestId: contest.id,
            optionId: option.id,
            name: option.name,
            totalVotes: option.totalVotes,
            freeVotes: option.freeVotes,
            paidVotes: option.paidVotes,
            trendDelta: 0,
        })),
    }));
    return {
        ...buildTemplateData(event, currentPhase, capabilities),
        voting: {
            config: votingConfig,
            contests: contestPayload,
            categories: contestPayload.map((contest) => ({
                id: contest.id,
                title: contest.title,
                mode: contest.mode,
            })),
            nomineesByCategory,
            selectedCategory: selectedContestId || contestPayload[0]?.id || null,
            leaderboard,
        },
    };
};
/**
 * GET /api/public/event/:slug/voting-page
 * Render vote page template (if assigned)
 */
router.get('/event/:slug/voting-page', (0, errorHandler_js_1.asyncHandler)(async (req, res) => {
    const event = await fetchPublicEvent(req.params.slug);
    const selectedContestId = String(req.query.contestId || '').trim() || null;
    const templateData = await buildVotingTemplateData(event, selectedContestId);
    await renderEventTemplate(event, 'VOTING', event.votingPageTemplateId, templateData, res);
}));
/**
 * GET /api/public/event/:slug/nomination-page
 * Render nomination page template (if assigned)
 */
router.get('/event/:slug/nomination-page', (0, errorHandler_js_1.asyncHandler)(async (req, res) => {
    const event = await fetchPublicEvent(req.params.slug);
    const selectedContestId = String(req.query.contestId || '').trim() || null;
    const templateData = await buildVotingTemplateData(event, selectedContestId);
    await renderEventTemplate(event, 'VOTING_NOMINATION', event.nominationPageTemplateId, templateData, res);
}));
/**
 * GET /api/public/event/:slug/nominees-page
 * Render nominees listing template (if assigned)
 */
router.get('/event/:slug/nominees-page', (0, errorHandler_js_1.asyncHandler)(async (req, res) => {
    const event = await fetchPublicEvent(req.params.slug);
    const selectedContestId = String(req.query.contestId || '').trim() || null;
    const templateData = await buildVotingTemplateData(event, selectedContestId);
    await renderEventTemplate(event, 'VOTING_NOMINEES', event.nomineesPageTemplateId, templateData, res);
}));
/**
 * GET /api/public/event/:slug/leaderboard-page
 * Render leaderboard page template (if assigned)
 */
router.get('/event/:slug/leaderboard-page', (0, errorHandler_js_1.asyncHandler)(async (req, res) => {
    const event = await fetchPublicEvent(req.params.slug);
    const selectedContestId = String(req.query.contestId || '').trim() || null;
    const templateData = await buildVotingTemplateData(event, selectedContestId);
    await renderEventTemplate(event, 'VOTING_LEADERBOARD', event.leaderboardPageTemplateId, templateData, res);
}));
// ─── Invitation ────────────────────────────────────────────────────────────────
router.get('/event/:slug/invitation', (0, errorHandler_js_1.asyncHandler)(async (req, res) => {
    const event = await fetchPublicEvent(req.params.slug);
    if (!event.invitationEnabled)
        throw new errorHandler_js_1.AppError('Invitation page not available', 404);
    const currentPhase = (0, phase_js_1.calculateEventPhase)(event);
    const capabilities = (0, phase_js_1.getPhaseCapabilities)(currentPhase);
    const templateData = buildTemplateData(event, currentPhase, capabilities);
    await renderEventTemplate(event, 'INVITATION', event.invitationTemplateId, templateData, res);
}));
// ─── RSVP ──────────────────────────────────────────────────────────────────────
router.get('/event/:slug/rsvp', (0, errorHandler_js_1.asyncHandler)(async (req, res) => {
    const event = await fetchPublicEvent(req.params.slug);
    if (!event.rsvpEnabled)
        throw new errorHandler_js_1.AppError('RSVP is not available for this event', 404);
    const currentPhase = (0, phase_js_1.calculateEventPhase)(event);
    const capabilities = (0, phase_js_1.getPhaseCapabilities)(currentPhase);
    if (!capabilities.canSubmitRsvp)
        throw new errorHandler_js_1.AppError('RSVP is not available during this event phase', 403);
    const templateData = buildTemplateData(event, currentPhase, capabilities);
    await renderEventTemplate(event, 'RSVP', event.rsvpTemplateId, templateData, res);
}));
// ─── Live Landing ──────────────────────────────────────────────────────────────
router.get('/event/:slug/live', (0, errorHandler_js_1.asyncHandler)(async (req, res) => {
    const event = await fetchPublicEvent(req.params.slug);
    const currentPhase = (0, phase_js_1.calculateEventPhase)(event);
    const capabilities = (0, phase_js_1.getPhaseCapabilities)(currentPhase);
    if (currentPhase !== 'LIVE') {
        return res.json({ template: null, phase: currentPhase, message: 'Event is not in LIVE phase' });
    }
    const templateData = buildTemplateData(event, currentPhase, capabilities);
    await renderEventTemplate(event, 'LIVE_LANDING', event.liveLandingTemplateId, templateData, res);
}));
// ─── Event Ended ───────────────────────────────────────────────────────────────
router.get('/event/:slug/ended', (0, errorHandler_js_1.asyncHandler)(async (req, res) => {
    const event = await fetchPublicEvent(req.params.slug);
    const currentPhase = (0, phase_js_1.calculateEventPhase)(event);
    const capabilities = (0, phase_js_1.getPhaseCapabilities)(currentPhase);
    if (currentPhase !== 'POST_EVENT') {
        return res.json({ template: null, phase: currentPhase, message: 'Event is not in POST_EVENT phase' });
    }
    const templateData = buildTemplateData(event, currentPhase, capabilities);
    await renderEventTemplate(event, 'EVENT_ENDED', event.eventEndedTemplateId, templateData, res);
}));
// ─── Guestbook ─────────────────────────────────────────────────────────────────
router.get('/event/:slug/guestbook', (0, errorHandler_js_1.asyncHandler)(async (req, res) => {
    const event = await fetchPublicEvent(req.params.slug);
    if (!event.guestbookEnabled)
        throw new errorHandler_js_1.AppError('Guestbook is not available for this event', 404);
    const currentPhase = (0, phase_js_1.calculateEventPhase)(event);
    const capabilities = (0, phase_js_1.getPhaseCapabilities)(currentPhase);
    if (!capabilities.canAccessGuestbook)
        throw new errorHandler_js_1.AppError('Guestbook is not available during this event phase', 403);
    const templateData = buildTemplateData(event, currentPhase, capabilities);
    await renderEventTemplate(event, 'GUESTBOOK', event.guestbookTemplateId, templateData, res);
}));
router.get('/event/:slug/guestbook/video', (0, errorHandler_js_1.asyncHandler)(async (req, res) => {
    const event = await fetchPublicEvent(req.params.slug);
    if (!event.guestbookEnabled)
        throw new errorHandler_js_1.AppError('Guestbook is not available for this event', 404);
    const currentPhase = (0, phase_js_1.calculateEventPhase)(event);
    const capabilities = (0, phase_js_1.getPhaseCapabilities)(currentPhase);
    if (!capabilities.canAccessGuestbook)
        throw new errorHandler_js_1.AppError('Guestbook is not available during this event phase', 403);
    const templateData = buildTemplateData(event, currentPhase, capabilities);
    await renderEventTemplate(event, 'GUESTBOOK_VIDEO', event.guestbookVideoTemplateId, templateData, res);
}));
router.get('/event/:slug/guestbook/audio', (0, errorHandler_js_1.asyncHandler)(async (req, res) => {
    const event = await fetchPublicEvent(req.params.slug);
    if (!event.guestbookEnabled)
        throw new errorHandler_js_1.AppError('Guestbook is not available for this event', 404);
    const currentPhase = (0, phase_js_1.calculateEventPhase)(event);
    const capabilities = (0, phase_js_1.getPhaseCapabilities)(currentPhase);
    if (!capabilities.canAccessGuestbook)
        throw new errorHandler_js_1.AppError('Guestbook is not available during this event phase', 403);
    const templateData = buildTemplateData(event, currentPhase, capabilities);
    await renderEventTemplate(event, 'GUESTBOOK_AUDIO', event.guestbookAudioTemplateId, templateData, res);
}));
router.get('/event/:slug/guestbook/photo', (0, errorHandler_js_1.asyncHandler)(async (req, res) => {
    const event = await fetchPublicEvent(req.params.slug);
    if (!event.guestbookEnabled)
        throw new errorHandler_js_1.AppError('Guestbook is not available for this event', 404);
    const currentPhase = (0, phase_js_1.calculateEventPhase)(event);
    const capabilities = (0, phase_js_1.getPhaseCapabilities)(currentPhase);
    if (!capabilities.canAccessGuestbook)
        throw new errorHandler_js_1.AppError('Guestbook is not available during this event phase', 403);
    const templateData = buildTemplateData(event, currentPhase, capabilities);
    await renderEventTemplate(event, 'GUESTBOOK_PHOTO', event.guestbookPhotoTemplateId, templateData, res);
}));
// ─── Booth ─────────────────────────────────────────────────────────────────────
router.get('/event/:slug/booth', (0, errorHandler_js_1.asyncHandler)(async (req, res) => {
    const event = await fetchPublicEvent(req.params.slug);
    if (!event.guestbookEnabled)
        throw new errorHandler_js_1.AppError('Booth is not available for this event', 404);
    const currentPhase = (0, phase_js_1.calculateEventPhase)(event);
    const capabilities = (0, phase_js_1.getPhaseCapabilities)(currentPhase);
    if (!capabilities.canAccessGuestbook)
        throw new errorHandler_js_1.AppError('Booth is not available during this event phase', 403);
    const templateData = buildTemplateData(event, currentPhase, capabilities);
    await renderEventTemplate(event, 'BOOTH', event.boothTemplateId, templateData, res);
}));
router.get('/event/:slug/booth/video', (0, errorHandler_js_1.asyncHandler)(async (req, res) => {
    const event = await fetchPublicEvent(req.params.slug);
    if (!event.guestbookEnabled)
        throw new errorHandler_js_1.AppError('Booth is not available for this event', 404);
    const currentPhase = (0, phase_js_1.calculateEventPhase)(event);
    const capabilities = (0, phase_js_1.getPhaseCapabilities)(currentPhase);
    if (!capabilities.canAccessGuestbook)
        throw new errorHandler_js_1.AppError('Booth is not available during this event phase', 403);
    const templateData = buildTemplateData(event, currentPhase, capabilities);
    await renderEventTemplate(event, 'BOOTH_VIDEO', event.boothVideoTemplateId, templateData, res);
}));
router.get('/event/:slug/booth/audio', (0, errorHandler_js_1.asyncHandler)(async (req, res) => {
    const event = await fetchPublicEvent(req.params.slug);
    if (!event.guestbookEnabled)
        throw new errorHandler_js_1.AppError('Booth is not available for this event', 404);
    const currentPhase = (0, phase_js_1.calculateEventPhase)(event);
    const capabilities = (0, phase_js_1.getPhaseCapabilities)(currentPhase);
    if (!capabilities.canAccessGuestbook)
        throw new errorHandler_js_1.AppError('Booth is not available during this event phase', 403);
    const templateData = buildTemplateData(event, currentPhase, capabilities);
    await renderEventTemplate(event, 'BOOTH_AUDIO', event.boothAudioTemplateId, templateData, res);
}));
router.get('/event/:slug/booth/photo', (0, errorHandler_js_1.asyncHandler)(async (req, res) => {
    const event = await fetchPublicEvent(req.params.slug);
    if (!event.guestbookEnabled)
        throw new errorHandler_js_1.AppError('Booth is not available for this event', 404);
    const currentPhase = (0, phase_js_1.calculateEventPhase)(event);
    const capabilities = (0, phase_js_1.getPhaseCapabilities)(currentPhase);
    if (!capabilities.canAccessGuestbook)
        throw new errorHandler_js_1.AppError('Booth is not available during this event phase', 403);
    const templateData = buildTemplateData(event, currentPhase, capabilities);
    await renderEventTemplate(event, 'BOOTH_PHOTO', event.boothPhotoTemplateId, templateData, res);
}));
// ─── Thank-You ─────────────────────────────────────────────────────────────────
router.get('/event/:slug/thank-you', (0, errorHandler_js_1.asyncHandler)(async (req, res) => {
    const event = await fetchPublicEvent(req.params.slug);
    const currentPhase = (0, phase_js_1.calculateEventPhase)(event);
    if (currentPhase !== 'POST_EVENT') {
        return res.json({ template: null, phase: currentPhase, message: 'Event is not in POST_EVENT phase' });
    }
    const capabilities = (0, phase_js_1.getPhaseCapabilities)(currentPhase);
    const templateData = buildTemplateData(event, currentPhase, capabilities);
    await renderEventTemplate(event, 'THANK_YOU', event.thankYouTemplateId, templateData, res);
}));
exports.default = router;
//# sourceMappingURL=public.js.map