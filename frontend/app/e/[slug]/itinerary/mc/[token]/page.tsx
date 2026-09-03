'use client';

/**
 * Long-form MC control link kept alive for links issued before /mc/<token>
 * existed. Both routes render the same screen.
 */
import McControlScreen from '@/components/itinerary/McControlScreen';

export default function McItineraryPage() {
  return <McControlScreen />;
}
