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

const toAbsoluteUrl = (value: string | null | undefined) => {
  if (!value) return null;
  if (value.startsWith('http://') || value.startsWith('https://')) return value;
  const base = SITE_URL.replace(/\/+$/, '');
  const path = value.startsWith('/') ? value : `/${value}`;
  return `${base}${path}`;
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
  const image = toAbsoluteUrl(event?.coverImageUrl || event?.coverImagePath) || `${SITE_URL}/og-app-eventpeepo.png`;
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
