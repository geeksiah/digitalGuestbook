'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { API_BASE_URL, eventsApi } from '@/lib/api';
import { formatDate, getPhaseLabel, cn } from '@/lib/utils';
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
  slug: string;
  name: string;
  date: string;
  venue: string | null;
  coverImagePath?: string | null;
  coverImageUrl?: string | null;
  currentPhase: string;
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
  pendingRsvps: number;
  totalMedia: number;
}

const Icons = {
  calendar: <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" /></svg>,
  live: <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M5.636 18.364a9 9 0 010-12.728m12.728 0a9 9 0 010 12.728m-9.9-2.829a5 5 0 010-7.07m7.072 0a5 5 0 010 7.07M13 12a1 1 0 11-2 0 1 1 0 012 0z" /></svg>,
  users: <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M12 4.354a4 4 0 110 5.292M15 21H3v-1a6 6 0 0112 0v1zm0 0h6v-1a6 6 0 00-9-5.197M13 7a4 4 0 11-8 0 4 4 0 018 0z" /></svg>,
  media: <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M15 10l4.553-2.276A1 1 0 0121 8.618v6.764a1 1 0 01-1.447.894L15 14M5 18h8a2 2 0 002-2V8a2 2 0 00-2-2H5a2 2 0 00-2 2v8a2 2 0 002 2z" /></svg>,
  plus: <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" /></svg>,
  template: <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M4 5a1 1 0 011-1h14a1 1 0 011 1v2a1 1 0 01-1 1H5a1 1 0 01-1-1V5zM4 13a1 1 0 011-1h6a1 1 0 011 1v6a1 1 0 01-1 1H5a1 1 0 01-1-1v-6zM16 13a1 1 0 011-1h2a1 1 0 011 1v6a1 1 0 01-1 1h-2a1 1 0 01-1-1v-6z" /></svg>,
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

export default function AdminDashboard() {
  const [events, setEvents] = useState<Event[]>([]);
  const [stats, setStats] = useState<DashboardStats | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    void fetchData();
  }, []);

  const fetchData = async () => {
    try {
      const response = await eventsApi.list({ archived: false });
      const rows = response.data.events;
      setEvents(rows);

      setStats({
        totalEvents: rows.length,
        activeEvents: rows.filter((e: Event) => e.currentPhase === 'LIVE').length,
        totalRsvps: rows.reduce((sum: number, e: Event) => sum + e._count.rsvps, 0),
        pendingRsvps: 0,
        totalMedia: rows.reduce((sum: number, e: Event) => sum + e._count.mediaAssets, 0),
      });
    } catch {
      toast.error('Failed to load dashboard data');
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <div className="flex min-h-[60vh] items-center justify-center">
        <div className="h-9 w-9 animate-spin rounded-full border-b-2 border-brand-900" />
      </div>
    );
  }

  const recentEvents = events.slice(0, 5);

  return (
    <div className="mobile-stack-section">
      <DashboardHeroHeader
        eyebrow="Admin overview"
        title="Platform dashboard"
        subtitle="Track live activity, review recent events, and move quickly into the areas that need attention."
        action={(
          <>
            <Link href="/admin/events" className="btn-outline">All Events</Link>
            <Link href="/admin/events/new" className="btn-primary">
              {Icons.plus}
              <span className="ml-2">New Event</span>
            </Link>
          </>
        )}
      />

      <MetricStrip>
        <DashboardKpiCard label="Events" value={stats?.totalEvents || 0} icon={Icons.calendar} tone="blue" hint="Published and draft events in view" />
        <DashboardKpiCard label="Live now" value={stats?.activeEvents || 0} icon={Icons.live} tone="emerald" hint="Events currently accepting guests or votes" />
        <DashboardKpiCard label="RSVPs" value={stats?.totalRsvps || 0} icon={Icons.users} tone="violet" hint="Total responses across active events" />
        <DashboardKpiCard label="Media" value={stats?.totalMedia || 0} icon={Icons.media} tone="rose" hint="Captured guest moments and uploads" />
      </MetricStrip>

      <SplitPanelLayout
        main={(
          <DashboardSection
            title="Recent events"
            subtitle="Open any event to manage pages, voting, access, and event operations."
            action={<Link href="/admin/events" className="btn-ghost">View all</Link>}
          >
            {recentEvents.length === 0 ? (
              <div className="rounded-3xl border border-dashed border-surface-200 bg-surface-50 px-6 py-12 text-center">
                <p className="text-base font-semibold text-brand-900">No events yet</p>
                <p className="mt-1 text-sm text-surface-500">Create your first event to start taking RSVPs, nominations, or votes.</p>
              </div>
            ) : (
              <div className="space-y-3">
                {recentEvents.map((event) => {
                  const cover = resolveEventCover(event);
                  return (
                    <EntityListRow
                      key={event.id}
                      media={(
                        <div className="h-16 w-24 overflow-hidden rounded-2xl border border-surface-200 bg-surface-100">
                          {cover ? (
                            <img src={cover} alt={event.name} className="h-full w-full object-cover" />
                          ) : (
                            <div className="h-full w-full bg-gradient-to-br from-brand-900 to-brand-700" />
                          )}
                        </div>
                      )}
                      title={event.name}
                      meta={(
                        <span className={cn(
                          'rounded-full px-2.5 py-1 text-xs font-semibold',
                          event.currentPhase === 'LIVE' ? 'bg-emerald-50 text-emerald-700' :
                          event.currentPhase === 'PRE_EVENT' ? 'bg-sky-50 text-sky-700' :
                          'bg-surface-100 text-surface-600'
                        )}>
                          {getPhaseLabel(event.currentPhase)}
                        </span>
                      )}
                      subtitle={
                        <div className="flex flex-wrap items-center gap-x-4 gap-y-1">
                          <span>{formatDate(event.date, 'MMM d, yyyy')}</span>
                          {event.venue ? <span>{event.venue}</span> : null}
                          <span className="font-mono text-xs text-surface-400">/{event.slug}</span>
                        </div>
                      }
                      stats={(
                        <>
                          <div className="text-sm text-surface-500"><span className="font-semibold text-brand-900">{event._count.rsvps}</span> RSVPs</div>
                          <div className="text-sm text-surface-500"><span className="font-semibold text-brand-900">{event._count.mediaAssets}</span> Media</div>
                        </>
                      )}
                      actions={<Link href={`/admin/events/${event.id}`} className="btn-primary">Manage</Link>}
                    />
                  );
                })}
              </div>
            )}
          </DashboardSection>
        )}
        side={(
          <div className="space-y-4">
            <InsightPanel title="Quick actions" subtitle="Move into the most common admin tasks without digging through menus.">
              <div className="space-y-3">
                <QuickActionCard title="Create a new event" description="Start a new event workspace, then add templates and services." icon={Icons.plus} action={<Link href="/admin/events/new" className="btn-primary">Start</Link>} />
                <QuickActionCard title="Review templates" description="Update invitation, RSVP, guestbook, and voting templates." icon={Icons.template} action={<Link href="/admin/templates" className="btn-outline">Open</Link>} />
                <QuickActionCard title="Manage USSD and credits" description="Connect offline channels, assign them to events, and monitor balances." icon={Icons.calendar} action={<Link href="/admin/ussd" className="btn-outline">Open</Link>} />
              </div>
            </InsightPanel>

            <InsightPanel title="Focus for today" subtitle="A short operational snapshot so the next step is obvious.">
              <div className="space-y-3 text-sm text-surface-600">
                <div className="rounded-2xl bg-surface-50 px-4 py-3">
                  <p className="font-semibold text-brand-900">Live events</p>
                  <p className="mt-1">There are {stats?.activeEvents || 0} live events currently in motion.</p>
                </div>
                <div className="rounded-2xl bg-surface-50 px-4 py-3">
                  <p className="font-semibold text-brand-900">Guest activity</p>
                  <p className="mt-1">{stats?.totalRsvps || 0} RSVPs and {stats?.totalMedia || 0} media items have been recorded across active events.</p>
                </div>
              </div>
            </InsightPanel>
          </div>
        )}
      />
    </div>
  );
}
