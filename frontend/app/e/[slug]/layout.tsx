import type { Metadata } from 'next';
import { headers } from 'next/headers';

const SITE_URL =
  process.env.NEXT_PUBLIC_SITE_URL
  || process.env.SITE_URL
  || process.env.APP_URL
  || 'https://app.eventpeepo.com';

const resolveApiBaseUrl = () => {
  const configured =
    process.env.NEXT_PUBLIC_API_URL
    || process.env.API_URL
    || process.env.BACKEND_URL
    || process.env.RENDER_EXTERNAL_URL
    || SITE_URL;

  if (process.env.NODE_ENV === 'production' && configured.includes('localhost')) {
    return SITE_URL;
  }
  return configured;
};

const API_BASE_URL = resolveApiBaseUrl().replace(/\/+$/, '');
const SUPABASE_URL = (
  process.env.NEXT_PUBLIC_SUPABASE_URL
  || process.env.SUPABASE_URL
  || ''
).replace(/\/+$/, '');
const SITE_BASE_URL = SITE_URL.replace(/\/+$/, '');

const toAbsoluteMediaUrl = (
  value: string | null | undefined,
  publicBaseUrl: string = SITE_BASE_URL,
) => {
  if (!value) return null;
  const raw = value.trim();
  if (!raw) return null;
  if (raw.startsWith('http://') || raw.startsWith('https://')) return raw;

  // Supabase public storage path returned without host
  if (raw.startsWith('/storage/v1/object/public/')) {
    return SUPABASE_URL ? `${SUPABASE_URL}${raw}` : `${API_BASE_URL}${raw}`;
  }

  // Backend-hosted assets (legacy/local uploads, generated media)
  if (
    raw.startsWith('/uploads/')
    || raw.startsWith('/api/')
    || raw.startsWith('/media/')
    || raw.startsWith('/generated/')
  ) {
    return `${API_BASE_URL}${raw}`;
  }

  // Likely a storage key (e.g. "events/abc/cover.jpg")
  const normalized = raw.replace(/^\/+/, '');
  if (normalized.includes('/')) {
    if (SUPABASE_URL) {
      return `${SUPABASE_URL}/storage/v1/object/public/media-assets/${normalized}`;
    }
    return `${API_BASE_URL}/${normalized}`;
  }

  const path = raw.startsWith('/') ? raw : `/${raw}`;
  return `${publicBaseUrl.replace(/\/+$/, '')}${path}`;
};

const normalizeHost = (raw: string | null) =>
  String(raw || '')
    .split(',')[0]
    .trim()
    .toLowerCase()
    .replace(/:\d+$/, '')
    .replace(/\.$/, '');

const isPlatformHost = (host: string) =>
  host === 'localhost'
  || host === '127.0.0.1'
  || host.endsWith('.vercel.app')
  || host.endsWith('.netlify.app')
  || host === 'eventpeepo.com'
  || host.endsWith('.eventpeepo.com');

const normalizePublicPath = (raw: string | null) => {
  const value = String(raw || '/').trim();
  if (!value || value === '/') return '/';
  return value.startsWith('/') ? value : `/${value}`;
};

async function resolveMetadataLocation(slug: string) {
  const requestHeaders = await headers();
  const middlewareCustomHost = normalizeHost(
    requestHeaders.get('x-eventpeepo-custom-domain'),
  );
  const forwardedHost = normalizeHost(requestHeaders.get('x-forwarded-host'));
  const directHost = normalizeHost(requestHeaders.get('host'));
  const requestHost = forwardedHost || directHost;

  // Middleware writes x-eventpeepo-custom-domain only after a hostname has
  // successfully resolved to an ACTIVE EventDomain. Prefer that trusted value.
  const customHost = middlewareCustomHost
    || (requestHost && !isPlatformHost(requestHost) ? requestHost : '');

  if (customHost && !isPlatformHost(customHost)) {
    const forwardedProto = String(requestHeaders.get('x-forwarded-proto') || '')
      .split(',')[0]
      .trim()
      .replace(/:$/, '');
    const protocol = forwardedProto || (process.env.NODE_ENV === 'production' ? 'https' : 'http');
    const origin = `${protocol}://${customHost}`;
    const publicPath = normalizePublicPath(
      requestHeaders.get('x-eventpeepo-public-path'),
    );

    return {
      origin,
      canonicalUrl: publicPath === '/' ? `${origin}/` : `${origin}${publicPath}`,
    };
  }

  return {
    origin: SITE_BASE_URL,
    canonicalUrl: `${SITE_BASE_URL}/e/${slug}`,
  };
}

async function fetchEventForMetadata(slug: string) {
  try {
    const response = await fetch(`${API_BASE_URL}/api/public/event/${slug}`, {
      cache: 'no-store',
    });
    if (!response.ok) return null;
    const payload = await response.json();
    return payload?.event || null;
  } catch {
    return null;
  }
}

export async function generateMetadata(
  { params }: { params: Promise<{ slug: string }> }
): Promise<Metadata> {
  const { slug } = await params;
  const [event, metadataLocation] = await Promise.all([
    fetchEventForMetadata(slug),
    resolveMetadataLocation(slug),
  ]);

  const title = event?.socialTitle || event?.name || 'EventPeepo Event';
  const description =
    event?.socialDescription
    || event?.description
    || 'Join this event on EventPeepo.';
  const image =
    toAbsoluteMediaUrl(event?.coverImageUrl, metadataLocation.origin)
    || toAbsoluteMediaUrl(event?.coverImagePath, metadataLocation.origin)
    || `${metadataLocation.origin}/og-app-eventpeepo.png`;
  const url = metadataLocation.canonicalUrl;

  return {
    metadataBase: new URL(metadataLocation.origin),
    title,
    description,
    alternates: {
      canonical: url,
    },
    openGraph: {
      type: 'website',
      title,
      description,
      url,
      siteName: event?.name || 'EventPeepo',
      images: [
        {
          url: image,
          width: 1200,
          height: 630,
          alt: event?.coverImageAlt || title,
        },
      ],
    },
    twitter: {
      card: 'summary_large_image',
      title,
      description,
      images: [
        {
          url: image,
          width: 1200,
          height: 630,
          alt: event?.coverImageAlt || title,
        },
      ],
    },
  };
}

export default function EventSlugLayout({ children }: { children: React.ReactNode }) {
  return children;
}
