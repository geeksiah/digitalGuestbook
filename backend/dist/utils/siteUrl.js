"use strict";
/**
 * Where the guest-facing app lives.
 *
 * Every link that leaves the server (emails, WhatsApp, MC control links, QR
 * targets) has to be absolute, so these helpers never return a bare path.
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.getSiteUrl = getSiteUrl;
exports.buildSiteUrl = buildSiteUrl;
exports.pickLiveEventDomain = pickLiveEventDomain;
exports.getEventPublicBaseUrl = getEventPublicBaseUrl;
exports.buildEventPublicUrl = buildEventPublicUrl;
exports.getApiUrl = getApiUrl;
/** The app's canonical host, used when no environment variable is configured. */
const DEFAULT_SITE_URL = 'https://app.eventpeepo.com';
/** A hostname, optionally with a port. Rejects the junk a bad env var yields. */
const HOSTNAME_PATTERN = /^(?:[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?\.)*[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?$/i;
/**
 * Normalise one base URL: trim, add a scheme if missing, drop trailing slashes.
 *
 * `new URL()` alone is not enough of a guard here. A comma-separated value like
 * "https://a.com,https://b.com" parses without throwing, because a comma is a
 * legal hostname character, and yields the nonsense origin "https://a.com,https".
 * That is how a misconfigured variable turns into a very long broken link, so
 * the hostname is validated explicitly.
 */
function normalizeBaseUrl(value) {
    let raw = String(value || '').trim();
    if (!raw)
        return null;
    if (/[,\s]/.test(raw)) {
        const parts = raw
            .split(/[,\s]+/)
            .map((part) => part.trim())
            .filter(Boolean);
        // Only treat it as a list when every part is itself a URL. Otherwise the
        // value is simply malformed, and salvaging its first word would invent a
        // hostname out of nothing.
        const isList = parts.length > 1 && parts.every((part) => /^https?:\/\//i.test(part));
        if (!isList) {
            console.warn(`[Site URL] "${value}" is not a usable URL. Ignoring it.`);
            return null;
        }
        console.warn(`[Site URL] Received a list of ${parts.length} values ("${raw}"). ` +
            `This variable takes one URL, so "${parts[0]}" is being used. ` +
            'Put the full list in CORS_ORIGIN instead.');
        raw = parts[0];
    }
    const withScheme = /^https?:\/\//i.test(raw) ? raw : `https://${raw}`;
    try {
        const parsed = new URL(withScheme);
        if (!parsed.hostname || !HOSTNAME_PATTERN.test(parsed.hostname)) {
            console.warn(`[Site URL] "${value}" is not a usable URL (hostname "${parsed.hostname}"). Ignoring it.`);
            return null;
        }
        return `${parsed.origin}${parsed.pathname.replace(/\/+$/, '')}`;
    }
    catch {
        console.warn(`[Site URL] "${value}" could not be parsed as a URL. Ignoring it.`);
        return null;
    }
}
/**
 * Get the site URL (frontend URL) from environment variables.
 * Falls back to localhost only in development.
 */
function getSiteUrl() {
    const configured = normalizeBaseUrl(process.env.FRONTEND_URL) ||
        normalizeBaseUrl(process.env.SITE_URL) ||
        normalizeBaseUrl(process.env.APP_URL);
    if (configured)
        return configured;
    if (process.env.NODE_ENV === 'development') {
        return 'http://localhost:3000';
    }
    console.warn(`[Site URL] FRONTEND_URL, SITE_URL or APP_URL is not set. Falling back to ${DEFAULT_SITE_URL}. ` +
        'Set FRONTEND_URL so generated links point at your deployment.');
    return DEFAULT_SITE_URL;
}
/**
 * Absolute URL for a path on the guest-facing app.
 * Use this instead of string-concatenating an env var.
 */
function buildSiteUrl(path) {
    const suffix = path.startsWith('/') ? path : `/${path}`;
    return `${getSiteUrl()}${suffix}`;
}
function pickLiveEventDomain(domains) {
    const live = (domains || []).filter((domain) => domain?.host && (domain.status === 'ACTIVE' || domain.status === 'VERIFIED'));
    if (live.length === 0)
        return null;
    const rank = (domain) => (domain.isPrimary ? 0 : 1) + (domain.status === 'ACTIVE' ? 0 : 2);
    return [...live].sort((a, b) => rank(a) - rank(b))[0];
}
/**
 * Base URL a guest should see for an event: its own domain when one is
 * connected, otherwise the shared app host.
 */
function getEventPublicBaseUrl(domains) {
    const domain = pickLiveEventDomain(domains);
    if (!domain)
        return getSiteUrl();
    return `https://${domain.host.replace(/^www\./, '')}`;
}
/**
 * Absolute URL for one of an event's guest pages.
 *
 * On a connected domain the hostname already identifies the event, so the
 * `/e/<slug>` prefix is dropped to match how the frontend middleware rewrites
 * incoming requests.
 */
function buildEventPublicUrl(slug, path, domains) {
    const suffix = path.startsWith('/') ? path : `/${path}`;
    const domain = pickLiveEventDomain(domains);
    if (domain) {
        const origin = `https://${domain.host.replace(/^www\./, '')}`;
        return suffix === '/' ? origin : `${origin}${suffix}`;
    }
    const site = getSiteUrl();
    // Gifting lives at /gift/<slug> on the shared host, unlike the other event
    // pages which sit under /e/<slug>. On a custom domain both collapse to /gift.
    if (suffix === '/gift' || suffix.startsWith('/gift/')) {
        return `${site}/gift/${slug}${suffix.slice('/gift'.length)}`;
    }
    return `${site}/e/${slug}${suffix === '/' ? '' : suffix}`;
}
/**
 * Get the API URL from environment variables.
 * Falls back to localhost only in development.
 */
function getApiUrl() {
    const apiUrl = normalizeBaseUrl(process.env.API_URL) || normalizeBaseUrl(process.env.BACKEND_URL);
    if (apiUrl)
        return apiUrl;
    if (process.env.NODE_ENV === 'development') {
        return 'http://localhost:3001';
    }
    const renderUrl = normalizeBaseUrl(process.env.RENDER_EXTERNAL_URL);
    if (renderUrl)
        return renderUrl;
    const siteUrl = getSiteUrl();
    if (siteUrl.includes('localhost')) {
        return 'http://localhost:3001';
    }
    return siteUrl;
}
//# sourceMappingURL=siteUrl.js.map