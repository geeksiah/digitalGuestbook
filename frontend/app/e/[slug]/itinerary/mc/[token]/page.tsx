'use client';

import { useEffect, useRef, useState } from 'react';
import { useParams } from 'next/navigation';
import { itineraryApi } from '@/lib/api';
import { cn, formatDate } from '@/lib/utils';
import toast from 'react-hot-toast';

interface McItem {
  id: string;
  title: string;
  description: string | null;
  startsAt: string | null;
  location: string | null;
  isCompleted: boolean;
}

export default function McItineraryPage() {
  const params = useParams();
  const token = params.token as string;

  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState<string | null>(null);
  const [syncing, setSyncing] = useState(false);
  const [lastSyncedAt, setLastSyncedAt] = useState<Date | null>(null);
  const [eventName, setEventName] = useState('');
  const [items, setItems] = useState<McItem[]>([]);
  const [recentlyToggledIds, setRecentlyToggledIds] = useState<string[]>([]);
  const toggleTimeoutsRef = useRef<number[]>([]);
  const hasShownErrorRef = useRef(false);

  const clearToggleTimeouts = () => {
    toggleTimeoutsRef.current.forEach((id) => window.clearTimeout(id));
    toggleTimeoutsRef.current = [];
  };

  const fetchData = async (silent = false) => {
    try {
      if (silent) setSyncing(true);
      const response = await itineraryApi.getMcSession(token);
      setEventName(response.data.event.name);
      setItems(response.data.event.itineraryItems || []);
      setLastSyncedAt(new Date());
      hasShownErrorRef.current = false;
    } catch (error: any) {
      if (!silent || !hasShownErrorRef.current) {
        toast.error(error.response?.data?.error || 'Unable to load MC itinerary');
        hasShownErrorRef.current = true;
      }
    } finally {
      if (silent) setSyncing(false);
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData(false);
    const interval = window.setInterval(() => fetchData(true), 3000);
    const onVisibilityChange = () => {
      if (document.visibilityState === 'visible') fetchData(true);
    };
    document.addEventListener('visibilitychange', onVisibilityChange);

    return () => {
      window.clearInterval(interval);
      document.removeEventListener('visibilitychange', onVisibilityChange);
      clearToggleTimeouts();
    };
  }, [token]);

  const toggleItem = async (itemId: string) => {
    setSubmitting(itemId);
    const currentItem = items.find((item) => item.id === itemId);
    const nextCompleted = currentItem ? !currentItem.isCompleted : true;
    setItems((current) =>
      current.map((item) => (item.id === itemId ? { ...item, isCompleted: nextCompleted } : item))
    );
    try {
      const response = await itineraryApi.toggleMcItem(token, itemId, nextCompleted);
      const updatedItem = response.data.item as McItem;
      setItems((current) => current.map((item) => (item.id === itemId ? updatedItem : item)));
      setRecentlyToggledIds((current) => Array.from(new Set([...current, itemId])));
      const timeoutId = window.setTimeout(() => {
        setRecentlyToggledIds((current) => current.filter((id) => id !== itemId));
      }, 1000);
      toggleTimeoutsRef.current.push(timeoutId);
      await fetchData(true);
    } catch (error: any) {
      await fetchData(true);
      toast.error(error.response?.data?.error || 'Failed to update item');
    } finally {
      setSubmitting(null);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-surface-50 flex items-center justify-center">
        <div className="animate-spin rounded-full h-9 w-9 border-b-2 border-brand-900" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-surface-50 py-8 px-4">
      <div className="max-w-2xl mx-auto space-y-4">
        <div className="bg-white rounded-xl border border-surface-200 p-5">
          <p className="text-xs uppercase tracking-wider text-surface-500 font-semibold">MC Control</p>
          <h1 className="text-2xl font-bold text-brand-900 mt-1">{eventName}</h1>
          <p className="text-sm text-surface-600 mt-2">Mark each activity complete as it happens.</p>
          <p className="mt-2 text-xs text-surface-500">
            {syncing ? 'Syncing...' : 'Synced'}
            {lastSyncedAt ? ` · ${formatDate(lastSyncedAt.toISOString(), 'p')}` : ''}
          </p>
        </div>

        <div className="space-y-3">
          {items.map((item) => (
            <div
              key={item.id}
              className={cn(
                'bg-white rounded-xl border border-surface-200 p-4 transition-all duration-300',
                item.isCompleted && 'bg-emerald-50/30',
                recentlyToggledIds.includes(item.id) && 'ring-2 ring-emerald-300 scale-[1.01]',
                submitting === item.id && 'opacity-80'
              )}
            >
              <div className="flex items-start justify-between gap-3">
                <div>
                  <h3 className={cn('font-semibold transition-colors duration-300', item.isCompleted ? 'text-surface-500 line-through' : 'text-brand-900')}>
                    {item.title}
                  </h3>
                  {item.description && <p className="text-sm text-surface-600 mt-1">{item.description}</p>}
                  <div className="text-xs text-surface-500 mt-2 space-y-0.5">
                    {item.startsAt && <p>{formatDate(item.startsAt, 'p')}</p>}
                    {item.location && <p>{item.location}</p>}
                  </div>
                </div>
                <button
                  className={cn(item.isCompleted ? 'btn-secondary' : 'btn-primary', 'min-w-[108px] justify-center')}
                  disabled={submitting === item.id}
                  onClick={() => toggleItem(item.id)}
                >
                  {submitting === item.id ? 'Saving...' : item.isCompleted ? 'Uncheck' : 'Check Off'}
                </button>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

