import type { Metadata } from 'next';

const SITE_URL = process.env.NEXT_PUBLIC_SITE_URL || 'https://app.eventpeepo.com';
const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001';

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
  const image = event?.coverImageUrl || `${SITE_URL}/og-app-eventpeepo.png`;
  const url = `${SITE_URL}/e/${slug}`;

  return {
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
