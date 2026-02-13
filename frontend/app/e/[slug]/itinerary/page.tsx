'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import { useParams } from 'next/navigation';
import { publicApi } from '@/lib/api';
import BackendTemplateFrame, { useBackendTemplate } from '@/components/BackendTemplateFrame';
import { cn, formatDate } from '@/lib/utils';
import toast from 'react-hot-toast';

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
    const onVisibilityChange = () => {
      if (document.visibilityState === 'visible') fetchItinerary(true);
    };
    document.addEventListener('visibilitychange', onVisibilityChange);

    return () => {
      window.clearInterval(interval);
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
    return <BackendTemplateFrame slug={slug} endpoint="itinerary-page" />;
  }

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-surface-50">
        <div className="animate-spin rounded-full h-9 w-9 border-b-2 border-brand-900" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-surface-50 py-8 px-4">
      <div className="max-w-2xl mx-auto space-y-5">
        <div className="bg-white rounded-xl border border-surface-200 p-5">
          <h1 className="text-2xl font-bold text-brand-900">{eventName} Itinerary</h1>
          <p className="text-sm text-surface-600 mt-2">{completed}/{items.length} completed</p>
          <div className="mt-3 h-2 rounded-full bg-surface-100 overflow-hidden">
            <div className="h-full bg-brand-900 transition-all duration-700 ease-out" style={{ width: `${percent}%` }} />
          </div>
          <p className="mt-2 text-xs text-surface-500">
            Live sync active · updates every 3 seconds
            {lastUpdatedAt ? ` · Last update ${formatDate(lastUpdatedAt, 'p')}` : ''}
          </p>
        </div>

        <div className="space-y-3">
          {items.map((item) => (
            <div
              key={item.id}
              className={cn(
                'bg-white rounded-xl border border-surface-200 p-4 transition-all duration-500',
                item.isCompleted && 'bg-emerald-50/30',
                highlightedItemIds.includes(item.id) && 'ring-2 ring-emerald-300 scale-[1.01]'
              )}
            >
              <div className="flex items-start gap-3">
                <div
                  className={cn(
                    'w-5 h-5 mt-0.5 rounded-full border-2 transition-all duration-300',
                    item.isCompleted ? 'bg-emerald-500 border-emerald-500 scale-110' : 'border-surface-300'
                  )}
                />
                <div className="min-w-0">
                  <h3 className={cn('font-semibold transition-colors duration-300', item.isCompleted ? 'text-surface-500 line-through' : 'text-brand-900')}>
                    {item.title}
                  </h3>
                  {item.description && <p className="text-sm text-surface-600 mt-1">{item.description}</p>}
                  <div className="text-xs text-surface-500 mt-2 space-y-0.5">
                    {item.startsAt && <p>{formatDate(item.startsAt, 'p')}</p>}
                    {item.location && <p>{item.location}</p>}
                  </div>
                </div>
              </div>
            </div>
          ))}
          {items.length === 0 && (
            <div className="bg-white rounded-xl border border-surface-200 p-8 text-center text-surface-500">
              No itinerary items yet.
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

