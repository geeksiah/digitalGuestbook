'use client';

import { useEffect, useRef, useState } from 'react';
import { useParams } from 'next/navigation';
import { itineraryApi } from '@/lib/api';
import { formatDate } from '@/lib/utils';
import toast from 'react-hot-toast';
import ItineraryBoard from '@/components/itinerary/ItineraryBoard';

interface McItem {
  id: string;
  title: string;
  description: string | null;
  startsAt: string | null;
  endsAt: string | null;
  location: string | null;
  isCompleted: boolean;
}

export default function McControlScreen() {
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
      if (!silent && !hasShownErrorRef.current) {
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
    setItems((current) => current.map((item) => (item.id === itemId ? { ...item, isCompleted: nextCompleted } : item)));
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
    <ItineraryBoard
      mode="mc"
      eventName={eventName}
      items={items}
      syncLabel={syncing ? 'Syncing...' : `Synced${lastSyncedAt ? ` - ${formatDate(lastSyncedAt.toISOString(), 'p')}` : ''}`}
      submittingId={submitting}
      recentlyChangedIds={recentlyToggledIds}
      onToggleItem={toggleItem}
    />
  );
}
