import { NextRequest, NextResponse } from 'next/server';

const CACHE_TTL_MS = 5 * 60 * 1000;
const domainCache = new Map<string, { slug: string; expiresAt: number }>();

const isIgnoredPath = (pathname: string) =>
  pathname.startsWith('/api')
  || pathname.startsWith('/_next')
  || pathname.startsWith('/admin')
  || pathname.startsWith('/owner')
  || pathname.startsWith('/event-owner')
  || pathname.startsWith('/invite')
  || pathname.startsWith('/gift')
  || pathname.startsWith('/e/')
  || pathname === '/favicon.ico'
  || pathname.startsWith('/img/')
  || pathname.startsWith('/public/');

const isPlatformHost = (host: string) =>
  host.includes('localhost')
  || host.includes('127.0.0.1')
  || host.endsWith('.vercel.app')
  || host.endsWith('.netlify.app')
  || host.endsWith('.eventpeepo.com');

async function resolveMappedSlug(host: string): Promise<string | null> {
  const cached = domainCache.get(host);
  if (cached && cached.expiresAt > Date.now()) {
    return cached.slug;
  }

  const apiBase = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001';
  try {
    const response = await fetch(`${apiBase}/api/public/domain/${encodeURIComponent(host)}`, {
      method: 'GET',
      headers: { 'Content-Type': 'application/json' },
      cache: 'no-store',
    });
    if (!response.ok) return null;
    const payload = await response.json();
    if (!payload?.mapped || !payload?.slug) return null;

    domainCache.set(host, {
      slug: payload.slug,
      expiresAt: Date.now() + CACHE_TTL_MS,
    });
    return payload.slug;
  } catch {
    return null;
  }
}

export async function middleware(request: NextRequest) {
  const host = request.headers.get('host')?.split(':')[0]?.toLowerCase() || '';
  const pathname = request.nextUrl.pathname;

  if (!host || isPlatformHost(host) || isIgnoredPath(pathname)) {
    return NextResponse.next();
  }

  const slug = await resolveMappedSlug(host);
  if (!slug) {
    return NextResponse.next();
  }

  const rewriteUrl = request.nextUrl.clone();
  rewriteUrl.pathname = pathname === '/' ? `/e/${slug}` : `/e/${slug}${pathname}`;

  return NextResponse.rewrite(rewriteUrl);
}

export const config = {
  matcher: '/:path*',
};
