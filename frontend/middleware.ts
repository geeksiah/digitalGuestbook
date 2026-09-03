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

const notFound = () => new NextResponse('Not Found', {
  status: 404,
  headers: { 'Cache-Control': 'no-store' },
});

async function resolveMappedDomain(host: string): Promise<DomainMapping | null> {
  const cached = domainCache.get(host);
  if (cached && cached.expiresAt > Date.now()) return cached.mapping;

  const apiBase = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001';
  try {
    const response = await fetch(`${apiBase}/api/public/domain/${encodeURIComponent(host)}`, {
      method: 'GET',
      headers: { 'Content-Type': 'application/json' },
      cache: 'no-store',
    });

    if (!response.ok) {
      domainCache.set(host, { mapping: null, expiresAt: Date.now() + 5_000 });
      return null;
    }

    const payload = await response.json();
    if (!payload?.mapped || !payload?.slug || !payload?.host) return null;

    const mapping = {
      slug: String(payload.slug),
      canonicalHost: String(payload.host).toLowerCase().replace(/^www\./, ''),
    };
    domainCache.set(host, { mapping, expiresAt: Date.now() + CACHE_TTL_MS });
    return mapping;
  } catch {
    return null;
  }
}

export async function middleware(request: NextRequest) {
  const incomingHost = request.headers.get('host')?.split(':')[0]?.toLowerCase().replace(/\.$/, '') || '';
  const pathname = request.nextUrl.pathname;

  if (!incomingHost || isPlatformHost(incomingHost)) {
    return NextResponse.next();
  }

  const mapping = await resolveMappedDomain(incomingHost);
  if (!mapping) return notFound();

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
