import type { Metadata } from 'next';

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

const toAbsoluteMediaUrl = (value: string | null | undefined) => {
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
  return `${SITE_BASE_URL}${path}`;
};

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
  const event = await fetchEventForMetadata(slug);

  const title = event?.socialTitle || event?.name || 'EventPeepo Event';
  const description =
    event?.socialDescription
    || event?.description
    || 'Join this event on EventPeepo.';
  const image =
    toAbsoluteMediaUrl(event?.coverImageUrl)
    || toAbsoluteMediaUrl(event?.coverImagePath)
    || `${SITE_BASE_URL}/og-app-eventpeepo.png`;
  const url = `${SITE_URL}/e/${slug}`;

  return {
    metadataBase: new URL(SITE_URL),
    title,
    description,
    openGraph: {
      type: 'website',
      title,
      description,
      url,
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
