'use client';

/**
 * Short MC control link: /mc/<token>.
 *
 * The MC opens this on a phone at the venue, often from a message, so the URL
 * is kept as short as possible. The event is identified by the token alone,
 * which is why no slug appears in the path.
 */
import McControlScreen from '@/components/itinerary/McControlScreen';

export default function McTokenPage() {
  return <McControlScreen />;
}
