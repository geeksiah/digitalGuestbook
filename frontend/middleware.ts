import { NextRequest, NextResponse } from 'next/server';

type DomainMapping = {
  slug: string;
  canonicalHost: string;
};

const CACHE_TTL_MS = 15 * 1000;
const domainCache = new Map<string, { mapping: DomainMapping | null; expiresAt: number }>();

const isPlatformHost = (host: string) =>
  host.includes('localhost')
  || host.includes('127.0.0.1')
  || host.endsWith('.vercel.app')
  || host.endsWith('.netlify.app')
  || host.endsWith('.eventpeepo.com');

const isStaticAssetPath = (pathname: string) =>
  pathname.startsWith('/_next/')
  || pathname === '/favicon.ico'
  || pathname === '/robots.txt'
  || pathname === '/sitemap.xml'
  || pathname === '/manifest.json'
  || pathname.startsWith('/img/')
  || pathname.startsWith('/public/')
  || pathname.startsWith('/embed/')
  || pathname === '/sw.js'
  || /\.[a-z0-9]{2,8}$/i.test(pathname);

const isBlockedPlatformPath = (pathname: string) =>
  pathname === '/admin'
  || pathname.startsWith('/admin/')
  || pathname === '/owner'
  || pathname.startsWith('/owner/')
  || pathname === '/event-owner'
  || pathname.startsWith('/event-owner/')
  || pathname === '/invite'
  || pathname.startsWith('/invite/')
  || pathname === '/mc'
  || pathname.startsWith('/mc/')
  || pathname === '/api'
  || pathname.startsWith('/api/');

const EVENT_CHILD_ROUTE_ROOTS = new Set([
  'booth',
  'checkin',
  'ended',
  'guestbook',
  'invitation',
  'itinerary',
  'leaderboard',
  'live',
  'nominate',
  'nominee',
  'nominees',
  'rsvp',
  'thanks',
  'vote',
]);

const getRewriteRequestHeaders = (
  request: NextRequest,
  mapping: DomainMapping,
  publicPath: string,
) => {
  const requestHeaders = new Headers(request.headers);
  requestHeaders.set('x-eventpeepo-custom-domain', mapping.canonicalHost);
  requestHeaders.set('x-eventpeepo-event-slug', mapping.slug);
  requestHeaders.set('x-eventpeepo-public-path', publicPath || '/');
  return requestHeaders;
};

const PAGE_STYLE = `body{margin:0;min-height:100vh;display:flex;align-items:center;justify-content:center;padding:24px;background:#f5f6f7;color:#1a1a2e;font-family:system-ui,-apple-system,"Segoe UI",sans-serif}.card{width:100%;max-width:420px;background:#fff;border:1px solid #e8eaec;border-radius:12px;padding:24px;text-align:center}h1{margin:0;font-size:20px;color:#063932}p{margin:8px 0 0;font-size:14px;line-height:1.5;color:#5b6469}button{margin-top:20px;min-height:40px;padding:0 16px;border:0;border-radius:8px;background:#063932;color:#fff;font-size:14px;font-weight:600;cursor:pointer}.spin{width:36px;height:36px;margin:0 auto 16px;border-radius:50%;border:3px solid #d5d9dc;border-top-color:#063932;animation:s 1s linear infinite}@keyframes s{to{transform:rotate(360deg)}}`;

const htmlPage = (title: string, body: string, extra = '') => `<!doctype html><html lang="en"><head><meta charset="utf-8"/><meta name="viewport" content="width=device-width,initial-scale=1"/><meta name="robots" content="noindex"/><title>${title}</title><style>${PAGE_STYLE}</style></head><body><div class="card">${body}</div>${extra}</body></html>`;

/** Friendly page instead of a bare "Not Found" string. */
const notFound = () => new NextResponse(
  htmlPage(
    'Page not found',
    '<h1>Page not found</h1><p>This address does not exist, or it has moved.</p><button type="button" onclick="history.length>1?history.back():location.reload()">Go back</button>',
  ),
  {
    status: 404,
    headers: { 'Cache-Control': 'no-store', 'Content-Type': 'text/html; charset=utf-8' },
  },
);

/**
 * The API is asleep or still booting, so we cannot tell which event this
 * domain belongs to yet. Ask the guest to refresh, and keep checking quietly
 * so the message turns into "ready" by itself.
 */
const serverWaking = () => new NextResponse(
  htmlPage(
    'Getting things ready',
    '<div class="spin" id="s"></div><h1 id="t">Getting things ready</h1><p id="m">This can take up to a minute on the first visit. Please refresh the page shortly.</p><button type="button" onclick="location.reload()">Refresh page</button>',
    `<script>(function(){var n=0;function c(){if(n++>24)return;fetch(location.href,{cache:"no-store",headers:{"x-ep-probe":"1"}}).then(function(r){if(r.status!==503){document.getElementById("s").style.display="none";document.getElementById("t").textContent="All set";document.getElementById("m").textContent="Everything is ready now. Refresh the page to continue.";}else setTimeout(c,5000)}).catch(function(){setTimeout(c,5000)})}setTimeout(c,5000)})();</script>`,
  ),
  {
    status: 503,
    headers: {
      'Cache-Control': 'no-store',
      'Content-Type': 'text/html; charset=utf-8',
      'Retry-After': '15',
    },
  },
);

/** Mapping known before the API went to sleep; used while it wakes up. */
const STALE_TTL_MS = 24 * 60 * 60 * 1000;
const staleDomainCache = new Map<string, { mapping: DomainMapping; savedAt: number }>();
const DOMAIN_LOOKUP_TIMEOUT_MS = 5_000;

type Resolution =
  | { kind: 'mapped'; mapping: DomainMapping }
  | { kind: 'unmapped' }
  | { kind: 'unavailable' };

async function resolveMappedDomain(host: string): Promise<Resolution> {
  const cached = domainCache.get(host);
  if (cached && cached.expiresAt > Date.now()) {
    return cached.mapping ? { kind: 'mapped', mapping: cached.mapping } : { kind: 'unmapped' };
  }

  const staleFallback = (): Resolution => {
    const stale = staleDomainCache.get(host);
    if (stale && Date.now() - stale.savedAt < STALE_TTL_MS) return { kind: 'mapped', mapping: stale.mapping };
    return { kind: 'unavailable' };
  };

  const apiBase = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001';
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), DOMAIN_LOOKUP_TIMEOUT_MS);
  try {
    const response = await fetch(`${apiBase}/api/public/domain/${encodeURIComponent(host)}`, {
      method: 'GET',
      headers: { 'Content-Type': 'application/json' },
      cache: 'no-store',
      signal: controller.signal,
    });

    // Server asleep, booting or erroring: not the same as "no such domain".
    if (response.status >= 500 || response.status === 429) return staleFallback();

    if (!response.ok) {
      domainCache.set(host, { mapping: null, expiresAt: Date.now() + 5_000 });
      return { kind: 'unmapped' };
    }

    const payload = await response.json().catch(() => null);
    if (!payload) return staleFallback();
    if (!payload?.mapped || !payload?.slug || !payload?.host) return { kind: 'unmapped' };

    const mapping = {
      slug: String(payload.slug),
      canonicalHost: String(payload.host).toLowerCase().replace(/^www\./, ''),
    };
    domainCache.set(host, { mapping, expiresAt: Date.now() + CACHE_TTL_MS });
    staleDomainCache.set(host, { mapping, savedAt: Date.now() });
    return { kind: 'mapped', mapping };
  } catch {
    return staleFallback();
  } finally {
    clearTimeout(timer);
  }
}

export async function middleware(request: NextRequest) {
  const incomingHost = request.headers.get('host')?.split(':')[0]?.toLowerCase().replace(/\.$/, '') || '';
  const pathname = request.nextUrl.pathname;

  if (!incomingHost || isPlatformHost(incomingHost)) {
    return NextResponse.next();
  }

  const resolution = await resolveMappedDomain(incomingHost);
  if (resolution.kind === 'unavailable') {
    // Shared assets never depend on the API.
    if (isStaticAssetPath(pathname)) return NextResponse.next();
    return serverWaking();
  }
  if (resolution.kind === 'unmapped') return notFound();
  const mapping = resolution.mapping;

  // Canonicalize www -> apex while preserving path and query string.
  if (incomingHost !== mapping.canonicalHost) {
    const redirectUrl = request.nextUrl.clone();
    redirectUrl.protocol = 'https:';
    redirectUrl.host = mapping.canonicalHost;
    return NextResponse.redirect(redirectUrl, 308);
  }

  // Shared Next.js/public assets are safe to serve from the common deployment.
  if (isStaticAssetPath(pathname)) return NextResponse.next();

  // A custom hostname belongs to exactly one Event, never to the EventPeepo
  // admin/owner platform or token-based global routes.
  if (isBlockedPlatformPath(pathname)) return notFound();

  const eventPrefix = `/e/${mapping.slug}`;

  // Clean up old EventPeepo-style links so visitors never need /e/<slug> on a
  // connected custom domain.
  if (pathname === eventPrefix) {
    const redirectUrl = request.nextUrl.clone();
    redirectUrl.pathname = '/';
    return NextResponse.redirect(redirectUrl, 308);
  }

  if (pathname.startsWith(`${eventPrefix}/`)) {
    const redirectUrl = request.nextUrl.clone();
    redirectUrl.pathname = pathname.slice(eventPrefix.length) || '/';
    return NextResponse.redirect(redirectUrl, 308);
  }

  // Some legacy/custom templates generated shorthand links such as
  // /e/guestbook or /e/rsvp (without the event slug). On a custom hostname the
  // hostname already identifies the Event, so collapse only known event-child
  // route roots to their clean public equivalent. Unknown /e/* paths remain
  // blocked so a customer hostname can never browse another event by slug.
  if (pathname.startsWith('/e/')) {
    const legacyRemainder = pathname.slice('/e/'.length);
    const legacyRoot = legacyRemainder.split('/')[0]?.toLowerCase();
    if (legacyRoot && EVENT_CHILD_ROUTE_ROOTS.has(legacyRoot)) {
      const redirectUrl = request.nextUrl.clone();
      redirectUrl.pathname = `/${legacyRemainder}`;
      return NextResponse.redirect(redirectUrl, 308);
    }
    return notFound();
  }
  if (pathname === '/e') return notFound();

  // Gifting is currently implemented at /gift/[slug], unlike the other event
  // pages under /e/[slug]. Expose it cleanly as customer-domain.com/gift.
  if (pathname === `/gift/${mapping.slug}`) {
    const redirectUrl = request.nextUrl.clone();
    redirectUrl.pathname = '/gift';
    return NextResponse.redirect(redirectUrl, 308);
  }
  // Where a gateway returns the payer after checkout.
  if (pathname === `/gift/${mapping.slug}/status`) {
    const redirectUrl = request.nextUrl.clone();
    redirectUrl.pathname = '/gift/status';
    return NextResponse.redirect(redirectUrl, 308);
  }
  if (pathname === '/gift/status') {
    const rewriteUrl = request.nextUrl.clone();
    rewriteUrl.pathname = `/gift/${mapping.slug}/status`;
    return NextResponse.rewrite(rewriteUrl, {
      request: {
        headers: getRewriteRequestHeaders(request, mapping, pathname),
      },
    });
  }
  if (pathname.startsWith('/gift/')) return notFound();
  if (pathname === '/gift') {
    const rewriteUrl = request.nextUrl.clone();
    rewriteUrl.pathname = `/gift/${mapping.slug}`;
    return NextResponse.rewrite(rewriteUrl, {
      request: {
        headers: getRewriteRequestHeaders(request, mapping, pathname),
      },
    });
  }

  // Clean tenant routing:
  //   client.com/              -> internal /e/event-slug
  //   client.com/rsvp          -> internal /e/event-slug/rsvp
  //   client.com/guestbook/... -> internal /e/event-slug/guestbook/...
  // The internal rewrite never changes the URL shown in the browser.
  const rewriteUrl = request.nextUrl.clone();
  rewriteUrl.pathname = pathname === '/' ? eventPrefix : `${eventPrefix}${pathname}`;
  return NextResponse.rewrite(rewriteUrl, {
    request: {
      headers: getRewriteRequestHeaders(request, mapping, pathname),
    },
  });
}

export const config = {
  matcher: '/:path*',
};
