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
  || pathname === '/api'
  || pathname.startsWith('/api/');

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

  // Never allow another event slug to be mounted beneath this customer host.
  if (pathname === '/e' || pathname.startsWith('/e/')) return notFound();

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
    return NextResponse.rewrite(rewriteUrl);
  }

  // Clean tenant routing:
  //   client.com/              -> internal /e/event-slug
  //   client.com/rsvp          -> internal /e/event-slug/rsvp
  //   client.com/guestbook/... -> internal /e/event-slug/guestbook/...
  // The internal rewrite never changes the URL shown in the browser.
  const rewriteUrl = request.nextUrl.clone();
  rewriteUrl.pathname = pathname === '/' ? eventPrefix : `${eventPrefix}${pathname}`;
  return NextResponse.rewrite(rewriteUrl);
}

export const config = {
  matcher: '/:path*',
};
