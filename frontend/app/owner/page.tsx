'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { ownerDashboardApi } from '@/lib/api';
import { formatDate, cn } from '@/lib/utils';
import { DashboardKpiCard, DashboardPageHeader, DashboardSection } from '@/components/dashboard/ui';
import toast from 'react-hot-toast';

interface Event {
  id: string;
  name: string;
  slug: string;
  date: string;
  venue: string | null;
  currentPhase: string;
  _count: {
    rsvps: number;
    invitations: number;
    checkIns: number;
    mediaAssets: number;
    transactions: number;
  };
}

interface Stats {
  totalEvents: number;
  totalRsvps: number;
  totalCheckIns: number;
  totalMedia: number;
  revenueByCurrency: Record<string, { gross: number; net: number }>;
}

const Icons = {
  events: <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" /></svg>,
  rsvps: <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M12 4.354a4 4 0 110 5.292M15 21H3v-1a6 6 0 0112 0v1zm0 0h6v-1a6 6 0 00-9-5.197M13 7a4 4 0 11-8 0 4 4 0 018 0z" /></svg>,
  checkins: <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>,
  media: <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" /></svg>,
  revenue: <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>,
  arrow: <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" /></svg>,
};

export default function OwnerDashboardPage() {
  const [events, setEvents] = useState<Event[]>([]);
  const [stats, setStats] = useState<Stats | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchData();
  }, []);

  const fetchData = async () => {
    try {
      setLoading(true);
      const [eventsResponse, statsResponse] = await Promise.all([
        ownerDashboardApi.getEvents(),
        ownerDashboardApi.getStats(),
      ]);
      setEvents(eventsResponse.data.events);
      setStats(statsResponse.data.stats);
    } catch (error) {
      toast.error('Failed to load dashboard data');
    } finally {
      setLoading(false);
    }
  };

  const getPhaseStyle = (phase: string) => {
    switch (phase) {
      case 'LIVE': return 'bg-emerald-50 text-emerald-700 border-emerald-200';
      case 'PRE_EVENT': return 'bg-blue-50 text-blue-700 border-blue-200';
      case 'POST_EVENT': return 'bg-surface-50 text-surface-700 border-surface-200';
      default: return 'bg-surface-50 text-surface-700 border-surface-200';
    }
  };

  const getPhaseLabel = (phase: string) => {
    switch (phase) {
      case 'LIVE': return 'Live';
      case 'PRE_EVENT': return 'Upcoming';
      case 'POST_EVENT': return 'Past';
      default: return phase;
    }
  };

  if (loading) {
    return (
      <div className="text-center py-12">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-brand-900 mx-auto" />
      </div>
    );
  }

  return (
    <div className="space-y-5 sm:space-y-7">
      <DashboardPageHeader title="Dashboard" subtitle="Your event operations at a glance" />

      {/* Stats Cards */}
      {stats && (
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4">
          <DashboardKpiCard label="Events" value={stats.totalEvents} icon={Icons.events} tone="blue" />
          <DashboardKpiCard label="RSVPs" value={stats.totalRsvps} icon={Icons.rsvps} tone="emerald" />
          <DashboardKpiCard label="Check-Ins" value={stats.totalCheckIns} icon={Icons.checkins} tone="violet" />
          <DashboardKpiCard label="Media" value={stats.totalMedia} icon={Icons.media} tone="rose" />
        </div>
      )}

      {/* Revenue Summary */}
      {stats && Object.keys(stats.revenueByCurrency).length > 0 && (
        <DashboardSection title="Revenue" subtitle="Net and gross by currency">
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
            {Object.entries(stats.revenueByCurrency).map(([currency, amounts]) => (
              <div key={currency} className="rounded-xl border border-surface-200 bg-surface-50/50 p-4">
                <p className="text-[10px] uppercase tracking-widest font-semibold text-surface-400 mb-1.5">{currency}</p>
                <p className="text-xl sm:text-2xl font-bold text-brand-900">
                  {new Intl.NumberFormat('en-US', {
                    style: 'currency',
                    currency: currency,
                  }).format(amounts.net)}
                </p>
                <p className="text-xs text-surface-500 mt-1">
                  Gross: {new Intl.NumberFormat('en-US', {
                    style: 'currency',
                    currency: currency,
                  }).format(amounts.gross)}
                </p>
              </div>
            ))}
          </div>
        </DashboardSection>
      )}

      {/* Recent Events */}
      <DashboardSection
        title="Your Events"
        subtitle="Open an event to manage it"
        action={(
          <Link href="/owner/events" className="text-sm font-semibold text-brand-700 hover:text-brand-900 transition-colors px-1">
            View all
          </Link>
        )}
        contentClassName="p-0"
      >
        {events.length === 0 ? (
          <div className="text-center py-10 px-4">
            <div className="inline-flex items-center justify-center w-11 h-11 rounded-full bg-surface-100 mb-3">
              {Icons.events}
            </div>
            <p className="text-sm font-medium text-surface-600">No events yet</p>
            <p className="text-xs text-surface-400 mt-1">Events will appear here once created</p>
          </div>
        ) : (
          <div className="divide-y divide-surface-100">
            {events.slice(0, 5).map((event) => (
              <Link
                key={event.id}
                href={`/owner/events/${event.id}`}
                className="group flex items-center gap-3 px-4 sm:px-5 py-3.5 hover:bg-surface-50 active:bg-surface-100 transition-colors"
              >
                <div className="flex-1 min-w-0">
                  <div className="flex flex-wrap items-center gap-1.5">
                    <h3 className="text-sm font-semibold text-brand-900 truncate">{event.name}</h3>
                    <span
                      className={cn(
                        'inline-flex px-1.5 py-0.5 text-[10px] font-medium rounded border leading-none',
                        getPhaseStyle(event.currentPhase)
                      )}
                    >
                      {getPhaseLabel(event.currentPhase)}
                    </span>
                  </div>
                  <div className="flex flex-wrap items-center gap-x-3 gap-y-0.5 mt-1 text-xs text-surface-500">
                    <span>{formatDate(event.date)}</span>
                    {event.venue && <span>{event.venue}</span>}
                  </div>
                  <div className="flex gap-3 mt-2 text-xs">
                    <span className="text-surface-500"><span className="font-semibold text-brand-900">{event._count.rsvps}</span> RSVPs</span>
                    <span className="text-surface-500"><span className="font-semibold text-brand-900">{event._count.checkIns}</span> Check-ins</span>
                  </div>
                </div>
                <div className="text-surface-300 group-hover:text-brand-600 transition-colors flex-shrink-0">
                  {Icons.arrow}
                </div>
              </Link>
            ))}
          </div>
        )}
      </DashboardSection>
    </div>
  );
}


