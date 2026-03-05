'use client';

import { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { API_BASE_URL, eventsApi } from '@/lib/api';
import { formatDate, getPhaseLabel } from '@/lib/utils';
import { DashboardKpiCard, DashboardPageHeader, DashboardSection } from '@/components/dashboard/ui';
import toast from 'react-hot-toast';

interface Event {
  id: string;
  slug: string;
  name: string;
  date: string;
  venue: string | null;
  currentPhase: string;
  coverImagePath?: string | null;
  coverImageUrl?: string | null;
  invitationOnly: boolean;
  _count: {
    rsvps: number;
    invitations: number;
    checkIns: number;
    mediaAssets: number;
  };
}

interface DashboardStats {
  totalEvents: number;
  activeEvents: number;
  totalRsvps: number;
  totalMedia: number;
}

const Icons = {
  calendar: <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" /></svg>,
  live: <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M5.636 18.364a9 9 0 010-12.728m12.728 0a9 9 0 010 12.728m-9.9-2.829a5 5 0 010-7.07m7.072 0a5 5 0 010 7.07M13 12a1 1 0 11-2 0 1 1 0 012 0z" /></svg>,
  users: <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M12 4.354a4 4 0 110 5.292M15 21H3v-1a6 6 0 0112 0v1zm0 0h6v-1a6 6 0 00-9-5.197M13 7a4 4 0 11-8 0 4 4 0 018 0z" /></svg>,
  media: <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M15 10l4.553-2.276A1 1 0 0121 8.618v6.764a1 1 0 01-1.447.894L15 14M5 18h8a2 2 0 002-2V8a2 2 0 00-2-2H5a2 2 0 00-2 2v8a2 2 0 002 2z" /></svg>,
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

export default function AdminDashboard() {
  const [events, setEvents] = useState<Event[]>([]);
  const [stats, setStats] = useState<DashboardStats | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchData();
  }, []);

  const fetchData = async () => {
    try {
      const response = await eventsApi.list({ archived: false });
      const loadedEvents = response.data.events || [];
      setEvents(loadedEvents);

      const totalEvents = loadedEvents.length;
      const activeEvents = loadedEvents.filter((event: Event) => event.currentPhase === 'LIVE').length;
      const totalRsvps = loadedEvents.reduce((sum: number, event: Event) => sum + event._count.rsvps, 0);
      const totalMedia = loadedEvents.reduce((sum: number, event: Event) => sum + event._count.mediaAssets, 0);

      setStats({ totalEvents, activeEvents, totalRsvps, totalMedia });
    } catch {
      toast.error('Failed to load dashboard data');
    } finally {
      setLoading(false);
    }
  };

  const featuredEvent = useMemo(() => events[0] || null, [events]);

  if (loading) {
    return (
      <div className="flex h-64 items-center justify-center">
        <div className="h-8 w-8 animate-spin rounded-full border-b-2 border-brand-900" />
      </div>
    );
  }

  return (
    <div className="space-y-5 sm:space-y-6">
      <DashboardPageHeader
        title="Admin Dashboard"
        subtitle="Monitor events, owners, and activity in one place."
        action={(
          <Link href="/admin/events/new" className="btn-accent">
            Create event
          </Link>
        )}
      />

      <section className="dashboard-canvas overflow-hidden">
        <div className="grid gap-4 p-4 sm:p-5 lg:grid-cols-[1.05fr_0.95fr]">
          <div>
            <p className="text-sm font-medium text-surface-600">Overview</p>
            <h2 className="mt-1 text-2xl font-semibold tracking-tight text-brand-900 sm:text-3xl">
              Keep operations clear and consistent.
            </h2>
            <p className="mt-2 text-sm text-surface-600">Track live events, guest activity, and content moderation quickly.</p>
            <div className="mt-4 flex flex-wrap gap-2">
              <Link href="/admin/events" className="btn-outline">Events</Link>
              <Link href="/admin/owners" className="btn-outline">Owners</Link>
              <Link href="/admin/payouts" className="btn-outline">Payouts</Link>
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
              <p className="text-xs uppercase tracking-wider text-white/90">Highlighted</p>
              <p className="mt-1 truncate text-base font-semibold">{featuredEvent?.name || 'Event portfolio'}</p>
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

      <div className="grid grid-cols-2 gap-3 sm:gap-4 lg:grid-cols-4">
        <DashboardKpiCard label="Events" value={stats?.totalEvents || 0} icon={Icons.calendar} tone="blue" />
        <DashboardKpiCard label="Live" value={stats?.activeEvents || 0} icon={Icons.live} tone="emerald" />
        <DashboardKpiCard label="RSVPs" value={stats?.totalRsvps || 0} icon={Icons.users} tone="violet" />
        <DashboardKpiCard label="Media" value={stats?.totalMedia || 0} icon={Icons.media} tone="rose" />
      </div>

      <DashboardSection
        title="Events"
        subtitle="Recent events with direct access to management."
        action={<Link href="/admin/events" className="text-sm font-semibold text-brand-900">View all</Link>}
      >
        {events.length === 0 ? (
          <div className="rounded-2xl bg-surface-100 px-4 py-10 text-center">
            <p className="text-sm font-medium text-surface-700">No events yet.</p>
            <p className="mt-1 text-sm text-surface-500">Create your first event to get started.</p>
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
                  <div className="grid grid-cols-2 gap-2 text-center">
                    <div className="rounded-lg bg-surface-100 py-1.5 text-[11px]">
                      <p className="font-semibold text-brand-900">{event._count.rsvps}</p>
                      <p className="text-surface-500">RSVP</p>
                    </div>
                    <div className="rounded-lg bg-surface-100 py-1.5 text-[11px]">
                      <p className="font-semibold text-brand-900">{event._count.mediaAssets}</p>
                      <p className="text-surface-500">Media</p>
                    </div>
                  </div>
                  <Link href={`/admin/events/${event.id}`} className="btn-accent w-full !min-h-[38px] !text-xs">
                    Manage event
                  </Link>
                </div>
              </article>
            ))}
          </div>
        )}
      </DashboardSection>
    </div>
  );
}
