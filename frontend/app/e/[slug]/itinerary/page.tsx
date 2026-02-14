'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import { useParams } from 'next/navigation';
import { API_BASE_URL, publicApi } from '@/lib/api';
import BackendTemplateFrame, { useBackendTemplate } from '@/components/BackendTemplateFrame';
import { formatDate } from '@/lib/utils';
import toast from 'react-hot-toast';
import ItineraryBoard from '@/components/itinerary/ItineraryBoard';

interface ItineraryItem {
  id: string;
  title: string;
  description: string | null;
  startsAt: string | null;
  endsAt: string | null;
  location: string | null;
  sortOrder: number;
  isCompleted: boolean;
  completedAt: string | null;
}

export default function EventItineraryPage() {
  const params = useParams();
  const slug = params.slug as string;
  const { loading: templateLoading, available: hasTemplate } = useBackendTemplate(slug, 'itinerary-page');

  const [loading, setLoading] = useState(true);
  const [eventName, setEventName] = useState('');
  const [items, setItems] = useState<ItineraryItem[]>([]);
  const [completed, setCompleted] = useState(0);
  const [lastUpdatedAt, setLastUpdatedAt] = useState<string | undefined>();
  const [highlightedItemIds, setHighlightedItemIds] = useState<string[]>([]);

  const percent = useMemo(() => (items.length ? Math.round((completed / items.length) * 100) : 0), [completed, items.length]);
  const highlightTimeoutsRef = useRef<number[]>([]);
  const hasShownErrorRef = useRef(false);
  const lastUpdatedRef = useRef<string | undefined>(undefined);

  const clearHighlightTimeouts = () => {
    highlightTimeoutsRef.current.forEach((id) => window.clearTimeout(id));
    highlightTimeoutsRef.current = [];
  };

  const fetchItinerary = async (silent = false) => {
    try {
      const response = await publicApi.getItinerary(slug, lastUpdatedRef.current);
      setEventName(response.data.event.name);
      setCompleted(response.data.itinerary.completed || 0);
      const nextLastUpdatedAt = response.data.itinerary.lastUpdatedAt || lastUpdatedRef.current;
      setLastUpdatedAt(nextLastUpdatedAt);
      lastUpdatedRef.current = nextLastUpdatedAt;
      hasShownErrorRef.current = false;

      if (!response.data.itinerary.changed) return;

      const nextItems: ItineraryItem[] = response.data.itinerary.items || [];
      setItems((previousItems) => {
        const previousById = new Map(previousItems.map((item) => [item.id, item]));
        const newlyCompletedIds = nextItems
          .filter((item) => item.isCompleted && !previousById.get(item.id)?.isCompleted)
          .map((item) => item.id);

        if (newlyCompletedIds.length) {
          setHighlightedItemIds((current) => Array.from(new Set([...current, ...newlyCompletedIds])));
          const timeoutId = window.setTimeout(() => {
            setHighlightedItemIds((current) => current.filter((id) => !newlyCompletedIds.includes(id)));
          }, 1400);
          highlightTimeoutsRef.current.push(timeoutId);
        }

        return nextItems;
      });
    } catch (error: any) {
      if (!silent && !hasShownErrorRef.current) {
        toast.error(error.response?.data?.error || 'Failed to load itinerary');
        hasShownErrorRef.current = true;
      }
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (!slug || templateLoading || hasTemplate) return;

    fetchItinerary(false);
    const interval = window.setInterval(() => fetchItinerary(true), 3000);
    const stream = new EventSource(`${API_BASE_URL}/api/public/event/${slug}/itinerary/stream`);
    const onRealtimeUpdate = () => fetchItinerary(true);
    stream.addEventListener('itinerary-update', onRealtimeUpdate as EventListener);
    const onVisibilityChange = () => {
      if (document.visibilityState === 'visible') fetchItinerary(true);
    };
    document.addEventListener('visibilitychange', onVisibilityChange);

    return () => {
      window.clearInterval(interval);
      stream.removeEventListener('itinerary-update', onRealtimeUpdate as EventListener);
      stream.close();
      document.removeEventListener('visibilitychange', onVisibilityChange);
      clearHighlightTimeouts();
    };
  }, [slug, templateLoading, hasTemplate]);

  if (templateLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-surface-50">
        <div className="animate-spin rounded-full h-9 w-9 border-b-2 border-brand-900" />
      </div>
    );
  }

  if (hasTemplate) {
    return (
      <BackendTemplateFrame
        slug={slug}
        endpoint="itinerary-page"
        refreshIntervalMs={15000}
        revalidateOnFocus
        forceFresh
        eventStreamPath={`/api/public/event/${slug}/itinerary/stream`}
      />
    );
  }

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-surface-50">
        <div className="animate-spin rounded-full h-9 w-9 border-b-2 border-brand-900" />
      </div>
    );
  }

  return (
    <ItineraryBoard
      mode="guest"
      eventName={eventName}
      items={items}
      subtitle={`${percent}% complete`}
      syncLabel={`Live sync${lastUpdatedAt ? ` - ${formatDate(lastUpdatedAt, 'p')}` : ''}`}
      recentlyChangedIds={highlightedItemIds}
    />
  );
}
