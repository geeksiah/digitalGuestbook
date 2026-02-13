'use client';

import { useEffect, useState } from 'react';
import { useParams } from 'next/navigation';
import { itineraryApi } from '@/lib/api';
import { formatDate } from '@/lib/utils';
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
  const [eventName, setEventName] = useState('');
  const [items, setItems] = useState<McItem[]>([]);

  const fetchData = async () => {
    try {
      const response = await itineraryApi.getMcSession(token);
      setEventName(response.data.event.name);
      setItems(response.data.event.itineraryItems || []);
    } catch (error: any) {
      toast.error(error.response?.data?.error || 'Unable to load MC itinerary');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
    const interval = setInterval(fetchData, 10000);
    return () => clearInterval(interval);
  }, [token]);

  const toggleItem = async (itemId: string) => {
    setSubmitting(itemId);
    try {
      await itineraryApi.toggleMcItem(token, itemId);
      await fetchData();
    } catch (error: any) {
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
        </div>

        <div className="space-y-3">
          {items.map((item) => (
            <div key={item.id} className="bg-white rounded-xl border border-surface-200 p-4">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <h3 className={`font-semibold ${item.isCompleted ? 'text-surface-500 line-through' : 'text-brand-900'}`}>{item.title}</h3>
                  {item.description && <p className="text-sm text-surface-600 mt-1">{item.description}</p>}
                  <div className="text-xs text-surface-500 mt-2 space-y-0.5">
                    {item.startsAt && <p>{formatDate(item.startsAt, 'p')}</p>}
                    {item.location && <p>{item.location}</p>}
                  </div>
                </div>
                <button
                  className={item.isCompleted ? 'btn-secondary' : 'btn-primary'}
                  disabled={submitting === item.id}
                  onClick={() => toggleItem(item.id)}
                >
                  {item.isCompleted ? 'Undo' : 'Complete'}
                </button>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

