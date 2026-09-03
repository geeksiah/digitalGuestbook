import type { Metadata } from 'next';
import { buildEventMetadata } from '@/lib/eventMetadata';

/**
 * Gifting sits outside /e/<slug>, so without this it would inherit the
 * platform-wide tags from app/layout.tsx and show EventPeepo marketing copy
 * on a client's own domain.
 */
export async function generateMetadata(
  { params }: { params: Promise<{ slug: string }> }
): Promise<Metadata> {
  const { slug } = await params;
  return buildEventMetadata(slug, { publicPath: '/gift', titleSuffix: 'Gifts' });
}

export default function GiftSlugLayout({ children }: { children: React.ReactNode }) {
  return children;
}
