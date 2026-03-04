'use client';

import { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { API_BASE_URL, ownerDashboardApi } from '@/lib/api';
import { formatDate } from '@/lib/utils';
import { DashboardKpiCard, DashboardSection } from '@/components/dashboard/ui';
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
  rsvps: <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M17 20h5V9H2v11h5m10 0v-6a3 3 0 10-6 0v6m6 0H7" /></svg>,
  checkins: <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>,
  media: <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" /></svg>,
};

const getPhaseLabel = (phase: string) => {
  if (phase === 'LIVE') return 'Live';
  if (phase === 'PRE_EVENT') return 'Upcoming';
  if (phase === 'POST_EVENT') return 'Past';
  return phase;
};

const getPhaseClass = (phase: string) => {
  if (phase === 'LIVE') return 'border-emerald-200 bg-emerald-50 text-emerald-700';
  if (phase === 'PRE_EVENT') return 'border-sky-200 bg-sky-50 text-sky-700';
  return 'border-surface-200 bg-surface-100 text-surface-600';
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
  || '/og-app-eventpeepo.png';

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

  const heroEvent = useMemo(() => events[0] || null, [events]);

  if (loading) {
    return (
      <div className="py-12 text-center">
        <div className="mx-auto h-8 w-8 animate-spin rounded-full border-b-2 border-brand-900" />
      </div>
    );
  }

  return (
    <div className="space-y-6 sm:space-y-7">
      <section className="dashboard-canvas p-5 sm:p-6">
        <div className="grid gap-5 lg:grid-cols-[1.05fr_0.95fr]">
          <div className="flex flex-col justify-center">
            <p className="pill-accent w-fit">Owner Dashboard</p>
            <h1 className="mt-3 text-3xl font-bold tracking-tight text-brand-900 sm:text-4xl">
              Simple control over your events.
            </h1>
            <p className="mt-2 max-w-xl text-sm text-surface-600">
              Track attendance, media, and payout performance in one clean workspace.
            </p>

            <div className="mt-5 flex flex-wrap gap-2.5">
              <Link href="/owner/events" className="btn-accent">Manage Events</Link>
              <Link href="/owner/payouts" className="btn-outline">Payouts</Link>
            </div>
          </div>

          <article className="relative overflow-hidden rounded-2xl border border-surface-200">
            <img
              src={heroEvent ? resolveEventCover(heroEvent) : '/og-app-eventpeepo.png'}
              alt={heroEvent ? heroEvent.name : 'Event cover'}
              className="h-64 w-full object-cover"
              onError={(e) => {
                e.currentTarget.src = '/og-app-eventpeepo.png';
              }}
            />
            <div className="absolute inset-0 bg-gradient-to-t from-black/65 via-black/20 to-transparent" />
            <div className="absolute bottom-4 left-4 right-4 text-white">
              {heroEvent ? (
                <>
                  <p className="text-xs font-semibold uppercase tracking-wider text-white/80">Featured event</p>
                  <h2 className="mt-1 text-xl font-semibold">{heroEvent.name}</h2>
                  <p className="mt-1 text-xs text-white/85">
                    {formatDate(heroEvent.date, 'MMM d, yyyy')}
                    {heroEvent.venue ? ` • ${heroEvent.venue}` : ''}
                  </p>
                </>
              ) : (
                <>
                  <p className="text-xs font-semibold uppercase tracking-wider text-white/80">Workspace ready</p>
                  <h2 className="mt-1 text-xl font-semibold">Create your first event</h2>
                  <p className="mt-1 text-xs text-white/85">New events appear here automatically.</p>
                </>
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

      <DashboardSection title="Your Events" subtitle="Visual event cards with quick actions" contentClassName="p-4 sm:p-5">
        {events.length === 0 ? (
          <div className="rounded-2xl border border-dashed border-surface-300 bg-surface-50 p-8 text-center">
            <p className="text-sm font-medium text-surface-700">No events yet.</p>
            <p className="mt-1 text-sm text-surface-500">Create your first event to get started.</p>
          </div>
        ) : (
          <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
            {events.slice(0, 6).map((event) => (
              <article key={event.id} className="overflow-hidden rounded-2xl border border-surface-200 bg-white">
                <div className="relative h-40">
                  <img
                    src={resolveEventCover(event)}
                    alt={event.name}
                    className="h-full w-full object-cover"
                    onError={(e) => {
                      e.currentTarget.src = '/og-app-eventpeepo.png';
                    }}
                  />
                  <div className="absolute inset-0 bg-gradient-to-t from-black/60 to-transparent" />
                  <div className="absolute left-3 right-3 top-3 flex items-center justify-between">
                    <span className={`inline-flex rounded-full border px-2 py-0.5 text-xs font-semibold ${getPhaseClass(event.currentPhase)}`}>
                      {getPhaseLabel(event.currentPhase)}
                    </span>
                    <span className="rounded-full bg-black/35 px-2 py-0.5 text-xs font-semibold text-white">/{event.slug}</span>
                  </div>
                  <div className="absolute bottom-3 left-3 right-3">
                    <h3 className="truncate text-base font-semibold text-white">{event.name}</h3>
                  </div>
                </div>

                <div className="space-y-3 p-4">
                  <p className="text-xs text-surface-600">
                    {formatDate(event.date, 'MMM d, yyyy')}
                    {event.venue ? ` • ${event.venue}` : ''}
                  </p>
                  <div className="grid grid-cols-3 gap-2 text-center text-xs">
                    <div className="rounded-lg border border-surface-200 bg-surface-50 px-2 py-2">
                      <p className="font-semibold text-brand-900">{event._count.rsvps}</p>
                      <p className="text-surface-500">RSVPs</p>
                    </div>
                    <div className="rounded-lg border border-surface-200 bg-surface-50 px-2 py-2">
                      <p className="font-semibold text-brand-900">{event._count.checkIns}</p>
                      <p className="text-surface-500">Check-ins</p>
                    </div>
                    <div className="rounded-lg border border-surface-200 bg-surface-50 px-2 py-2">
                      <p className="font-semibold text-brand-900">{event._count.mediaAssets}</p>
                      <p className="text-surface-500">Media</p>
                    </div>
                  </div>
                  <Link href={`/owner/events/${event.id}`} className="btn-accent w-full !min-h-[40px] !text-xs">
                    Open Event
                  </Link>
                </div>
              </article>
            ))}
          </div>
        )}
      </DashboardSection>

      {stats && Object.keys(stats.revenueByCurrency).length > 0 && (
        <DashboardSection title="Revenue" subtitle="Net and gross by currency">
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {Object.entries(stats.revenueByCurrency).map(([currency, amounts]) => (
              <article key={currency} className="rounded-xl border border-surface-200 bg-surface-50 p-4">
                <p className="text-xs font-semibold uppercase tracking-widest text-surface-500">{currency}</p>
                <p className="mt-1 text-2xl font-bold text-brand-900">
                  {new Intl.NumberFormat('en-US', {
                    style: 'currency',
                    currency,
                  }).format(amounts.net)}
                </p>
                <p className="mt-1 text-sm text-surface-600">
                  Gross{' '}
                  {new Intl.NumberFormat('en-US', {
                    style: 'currency',
                    currency,
                  }).format(amounts.gross)}
                </p>
              </article>
            ))}
          </div>
        </DashboardSection>
      )}
    </div>
  );
}
