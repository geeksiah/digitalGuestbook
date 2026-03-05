'use client';

import { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { API_BASE_URL, ownerDashboardApi } from '@/lib/api';
import { formatDate } from '@/lib/utils';
import { DashboardKpiCard, DashboardPageHeader, DashboardSection } from '@/components/dashboard/ui';
import toast from 'react-hot-toast';

interface Event {
  id: string;
  name: string;
  slug: string;
  date: string;
  venue: string | null;
  currentPhase: string;
  coverImagePath?: string | null;
  coverImageUrl?: string | null;
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
  events: <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" /></svg>,
  rsvps: <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M12 4.354a4 4 0 110 5.292M15 21H3v-1a6 6 0 0112 0v1zm0 0h6v-1a6 6 0 00-9-5.197M13 7a4 4 0 11-8 0 4 4 0 018 0z" /></svg>,
  checkins: <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>,
  media: <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" /></svg>,
};

const getPhaseLabel = (phase: string) => {
  switch (phase) {
    case 'LIVE':
      return 'Live';
    case 'PRE_EVENT':
      return 'Upcoming';
    case 'POST_EVENT':
      return 'Past';
    default:
      return phase;
  }
};

const getPhaseStyle = (phase: string) => {
  switch (phase) {
    case 'LIVE':
      return 'bg-emerald-50 text-emerald-700 border-emerald-200';
    case 'PRE_EVENT':
      return 'bg-blue-50 text-blue-700 border-blue-200';
    default:
      return 'bg-surface-100 text-surface-700 border-surface-200';
  }
};

const toAbsoluteMediaUrl = (value: string | null | undefined) => {
  if (!value) return null;
  const raw = value.trim();
  if (!raw) return null;
  if (raw.startsWith('http://') || raw.startsWith('https://') || raw.startsWith('data:')) return raw;

  if (
    raw.startsWith('/storage/v1/object/public/')
    || raw.startsWith('/uploads/')
    || raw.startsWith('/api/')
    || raw.startsWith('/media/')
    || raw.startsWith('/generated/')
  ) {
    return `${API_BASE_URL}${raw}`;
  }

  return null;
};

const resolveEventCover = (event: Event) =>
  toAbsoluteMediaUrl(event.coverImageUrl)
  || toAbsoluteMediaUrl(event.coverImagePath)
  || null;

function EventCover({
  src,
  name,
  className,
}: {
  src: string | null;
  name: string;
  className: string;
}) {
  const [failed, setFailed] = useState(false);

  if (!src || failed) {
    return (
      <div className={`flex items-center justify-center bg-gradient-to-br from-brand-900 to-brand-700 ${className}`}>
        <span className="px-3 text-center text-sm font-semibold text-white/95">{name}</span>
      </div>
    );
  }

  return (
    <img
      src={src}
      alt={name}
      className={className}
      onError={() => setFailed(true)}
    />
  );
}

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
      setEvents(eventsResponse.data.events || []);
      setStats(statsResponse.data.stats || null);
    } catch {
      toast.error('Failed to load dashboard data');
    } finally {
      setLoading(false);
    }
  };

  const featuredEvent = useMemo(() => events[0] || null, [events]);

  if (loading) {
    return (
      <div className="py-12 text-center">
        <div className="mx-auto h-8 w-8 animate-spin rounded-full border-b-2 border-brand-900" />
      </div>
    );
  }

  return (
    <div className="space-y-5 sm:space-y-6">
      <DashboardPageHeader
        title="Owner Dashboard"
        subtitle="Manage events, guests, and payouts from one clean workspace."
        action={(
          <Link href="/owner/events" className="btn-accent">
            Manage events
          </Link>
        )}
      />

      <section className="dashboard-canvas overflow-hidden">
        <div className="grid gap-4 p-4 sm:p-5 lg:grid-cols-[1.05fr_0.95fr]">
          <div>
            <p className="text-sm font-medium text-surface-600">Today</p>
            <h2 className="mt-1 text-2xl font-semibold tracking-tight text-brand-900 sm:text-3xl">
              Keep every event on schedule.
            </h2>
            <p className="mt-2 text-sm text-surface-600">Quick access to RSVPs, check-ins, media, and payouts.</p>
            <div className="mt-4 flex flex-wrap gap-2">
              <Link href="/owner/events" className="btn-outline">Events</Link>
              <Link href="/owner/payouts" className="btn-outline">Payouts</Link>
            </div>
          </div>

          <article className="relative overflow-hidden rounded-2xl border border-surface-200">
            <EventCover
              src={featuredEvent ? resolveEventCover(featuredEvent) : null}
              name={featuredEvent?.name || 'No cover image'}
              className="h-48 w-full object-cover sm:h-56"
            />
            <div className="absolute inset-0 bg-gradient-to-t from-black/60 to-transparent" />
            <div className="absolute bottom-3 left-3 right-3 text-white">
              <p className="text-xs uppercase tracking-wider text-white/90">Featured</p>
              <p className="mt-1 truncate text-base font-semibold">{featuredEvent?.name || 'Your events'}</p>
              {featuredEvent && (
                <p className="mt-0.5 text-xs text-white/85">
                  {formatDate(featuredEvent.date, 'MMM d, yyyy')}
                  {featuredEvent.venue ? ` • ${featuredEvent.venue}` : ''}
                </p>
              )}
            </div>
          </article>
        </div>
      </section>

      {stats && (
        <div className="grid grid-cols-2 gap-3 sm:gap-4 lg:grid-cols-4">
          <DashboardKpiCard label="Events" value={stats.totalEvents} icon={Icons.events} tone="blue" />
          <DashboardKpiCard label="RSVPs" value={stats.totalRsvps} icon={Icons.rsvps} tone="emerald" />
          <DashboardKpiCard label="Check-ins" value={stats.totalCheckIns} icon={Icons.checkins} tone="violet" />
          <DashboardKpiCard label="Media" value={stats.totalMedia} icon={Icons.media} tone="rose" />
        </div>
      )}

      <DashboardSection title="Your Events" subtitle="Open an event to manage details, voting, and guests.">
        {events.length === 0 ? (
          <div className="rounded-2xl bg-surface-100 px-4 py-10 text-center">
            <p className="text-sm font-medium text-surface-700">No events yet.</p>
            <p className="mt-1 text-sm text-surface-500">Events will appear here once created.</p>
          </div>
        ) : (
          <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
            {events.slice(0, 6).map((event) => (
              <article key={event.id} className="overflow-hidden rounded-2xl border border-surface-200 bg-white">
                <div className="relative h-32">
                  <EventCover
                    src={resolveEventCover(event)}
                    name={event.name}
                    className="h-full w-full object-cover"
                  />
                  <div className="absolute inset-0 bg-gradient-to-t from-black/60 to-transparent" />
                  <div className="absolute left-3 top-3">
                    <span className={`inline-flex rounded-full border px-2 py-0.5 text-[11px] font-semibold ${getPhaseStyle(event.currentPhase)}`}>
                      {getPhaseLabel(event.currentPhase)}
                    </span>
                  </div>
                  <div className="absolute bottom-3 left-3 right-3">
                    <p className="truncate text-sm font-semibold text-white">{event.name}</p>
                  </div>
                </div>

                <div className="space-y-2.5 p-3">
                  <p className="text-xs text-surface-600">
                    {formatDate(event.date, 'MMM d, yyyy')}
                    {event.venue ? ` • ${event.venue}` : ''}
                  </p>
                  <div className="grid grid-cols-3 gap-2 text-center">
                    <div className="rounded-lg bg-surface-100 py-1.5 text-[11px]">
                      <p className="font-semibold text-brand-900">{event._count.rsvps}</p>
                      <p className="text-surface-500">RSVP</p>
                    </div>
                    <div className="rounded-lg bg-surface-100 py-1.5 text-[11px]">
                      <p className="font-semibold text-brand-900">{event._count.checkIns}</p>
                      <p className="text-surface-500">Check-in</p>
                    </div>
                    <div className="rounded-lg bg-surface-100 py-1.5 text-[11px]">
                      <p className="font-semibold text-brand-900">{event._count.mediaAssets}</p>
                      <p className="text-surface-500">Media</p>
                    </div>
                  </div>
                  <Link href={`/owner/events/${event.id}`} className="btn-accent w-full !min-h-[38px] !text-xs">
                    Open event
                  </Link>
                </div>
              </article>
            ))}
          </div>
        )}
      </DashboardSection>

      {stats && Object.keys(stats.revenueByCurrency).length > 0 && (
        <DashboardSection title="Revenue" subtitle="Net and gross by currency.">
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {Object.entries(stats.revenueByCurrency).map(([currency, amounts]) => (
              <div key={currency} className="rounded-xl bg-surface-100 p-4">
                <p className="text-xs font-semibold uppercase tracking-widest text-surface-500">{currency}</p>
                <p className="mt-1 text-2xl font-bold text-brand-900">
                  {new Intl.NumberFormat('en-US', { style: 'currency', currency }).format(amounts.net)}
                </p>
                <p className="mt-1 text-sm text-surface-600">
                  Gross {new Intl.NumberFormat('en-US', { style: 'currency', currency }).format(amounts.gross)}
                </p>
              </div>
            ))}
          </div>
        </DashboardSection>
      )}
    </div>
  );
}
