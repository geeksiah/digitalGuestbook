'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { API_BASE_URL, ownerDashboardApi } from '@/lib/api';
import { formatDate, cn } from '@/lib/utils';
import {
  DashboardHeroHeader,
  DashboardKpiCard,
  DashboardSection,
  EntityListRow,
  InsightPanel,
  MetricStrip,
  QuickActionCard,
  SplitPanelLayout,
} from '@/components/dashboard/ui';
import toast from 'react-hot-toast';

interface Event {
  id: string;
  name: string;
  slug: string;
  date: string;
  venue: string | null;
  coverImagePath?: string | null;
  coverImageUrl?: string | null;
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
  events: <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" /></svg>,
  rsvps: <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M12 4.354a4 4 0 110 5.292M15 21H3v-1a6 6 0 0112 0v1zm0 0h6v-1a6 6 0 00-9-5.197M13 7a4 4 0 11-8 0 4 4 0 018 0z" /></svg>,
  checkins: <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>,
  media: <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" /></svg>,
  revenue: <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>,
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
  toAbsoluteMediaUrl(event.coverImageUrl) || toAbsoluteMediaUrl(event.coverImagePath);

export default function OwnerDashboardPage() {
  const [events, setEvents] = useState<Event[]>([]);
  const [stats, setStats] = useState<Stats | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    void fetchData();
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
    } catch {
      toast.error('Failed to load dashboard data');
    } finally {
      setLoading(false);
    }
  };

  const getPhaseStyle = (phase: string) => {
    switch (phase) {
      case 'LIVE': return 'bg-emerald-50 text-emerald-700';
      case 'PRE_EVENT': return 'bg-blue-50 text-blue-700';
      case 'POST_EVENT': return 'bg-surface-100 text-surface-700';
      default: return 'bg-surface-100 text-surface-700';
    }
  };

  if (loading) {
    return (
      <div className="flex min-h-[60vh] items-center justify-center">
        <div className="h-9 w-9 animate-spin rounded-full border-b-2 border-brand-900" />
      </div>
    );
  }

  return (
    <div className="mobile-stack-section">
      <DashboardHeroHeader
        eyebrow="Owner overview"
        title="Your event workspace"
        subtitle="Stay on top of guest activity, revenue, and the events that need your next action."
        action={<Link href="/owner/events" className="btn-primary">Open events</Link>}
      />

      {stats ? (
        <MetricStrip>
          <DashboardKpiCard label="Events" value={stats.totalEvents} icon={Icons.events} tone="blue" hint="Active and archived events in your workspace" />
          <DashboardKpiCard label="RSVPs" value={stats.totalRsvps} icon={Icons.rsvps} tone="emerald" hint="Guest responses across your events" />
          <DashboardKpiCard label="Check-ins" value={stats.totalCheckIns} icon={Icons.checkins} tone="violet" hint="Guests already welcomed on-site" />
          <DashboardKpiCard label="Media" value={stats.totalMedia} icon={Icons.media} tone="rose" hint="Photos, audio, and video captured by guests" />
        </MetricStrip>
      ) : null}

      <SplitPanelLayout
        main={(
          <div className="space-y-4">
            {stats && Object.keys(stats.revenueByCurrency).length > 0 ? (
              <DashboardSection title="Revenue summary" subtitle="Net revenue by currency based on completed transactions.">
                <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
                  {Object.entries(stats.revenueByCurrency).map(([currency, amounts]) => (
                    <div key={currency} className="detail-card p-4">
                      <div className="flex items-start justify-between gap-3">
                        <div>
                          <p className="text-[11px] font-semibold uppercase tracking-[0.22em] text-surface-400">{currency}</p>
                          <p className="mt-2 text-3xl font-bold tracking-tight text-brand-900">
                            {new Intl.NumberFormat('en-US', { style: 'currency', currency }).format(amounts.net)}
                          </p>
                          <p className="mt-2 text-sm text-surface-500">
                            Gross {new Intl.NumberFormat('en-US', { style: 'currency', currency }).format(amounts.gross)}
                          </p>
                        </div>
                        <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-primary-50 text-brand-900">
                          {Icons.revenue}
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </DashboardSection>
            ) : null}

            <DashboardSection
              title="Recent events"
              subtitle="Open an event to manage invitations, voting, media, and public pages."
              action={<Link href="/owner/events" className="btn-ghost">View all</Link>}
            >
              {events.length === 0 ? (
                <div className="rounded-3xl border border-dashed border-surface-200 bg-surface-50 px-6 py-12 text-center">
                  <p className="text-base font-semibold text-brand-900">No events yet</p>
                  <p className="mt-1 text-sm text-surface-500">Create your first event and submit it for review.</p>
                </div>
              ) : (
                <div className="space-y-3">
                  {events.slice(0, 5).map((event) => {
                    const cover = resolveEventCover(event);
                    return (
                      <EntityListRow
                        key={event.id}
                        media={(
                          <div className="h-16 w-24 overflow-hidden rounded-2xl border border-surface-200 bg-surface-100">
                            {cover ? <img src={cover} alt={event.name} className="h-full w-full object-cover" /> : <div className="h-full w-full bg-gradient-to-br from-brand-900 to-brand-700" />}
                          </div>
                        )}
                        title={event.name}
                        meta={<span className={cn('rounded-full px-2.5 py-1 text-xs font-semibold', getPhaseStyle(event.currentPhase))}>{event.currentPhase === 'PRE_EVENT' ? 'Upcoming' : event.currentPhase === 'POST_EVENT' ? 'Past' : 'Live'}</span>}
                        subtitle={(
                          <div className="flex flex-wrap items-center gap-x-4 gap-y-1">
                            <span>{formatDate(event.date)}</span>
                            {event.venue ? <span>{event.venue}</span> : null}
                          </div>
                        )}
                        stats={(
                          <>
                            <div className="text-sm text-surface-500"><span className="font-semibold text-brand-900">{event._count.rsvps}</span> RSVPs</div>
                            <div className="text-sm text-surface-500"><span className="font-semibold text-brand-900">{event._count.checkIns}</span> Check-ins</div>
                          </>
                        )}
                        actions={<Link href={`/owner/events/${event.id}`} className="btn-primary">Manage</Link>}
                      />
                    );
                  })}
                </div>
              )}
            </DashboardSection>
          </div>
        )}
        side={(
          <div className="space-y-4">
            <InsightPanel title="Quick actions" subtitle="Use the most common workflows without leaving the dashboard.">
              <div className="space-y-3">
                <QuickActionCard title="Create an event" description="Start a new event and submit it for admin approval." icon={Icons.events} action={<Link href="/owner/events" className="btn-primary">Go</Link>} />
                <QuickActionCard title="Review payouts" description="Check revenue and payout summaries for completed orders." icon={Icons.revenue} action={<Link href="/owner/payouts" className="btn-outline">Open</Link>} />
                <QuickActionCard title="Update account" description="Refresh contact details and account information used across your events." icon={Icons.rsvps} action={<Link href="/owner/account" className="btn-outline">Open</Link>} />
              </div>
            </InsightPanel>
          </div>
        )}
      />
    </div>
  );
}
