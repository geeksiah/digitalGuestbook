'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { adminApi, eventsApi, API_BASE_URL } from '@/lib/api';
import { formatDate, getPhaseLabel, cn } from '@/lib/utils';
import {
  DashboardHeroHeader,
  DashboardSection,
  EntityListRow,
  InsightPanel,
  MetricStrip,
  DashboardKpiCard,
  SplitPanelLayout,
} from '@/components/dashboard/ui';
import { AppShellSectionNav } from '@/components/ui/AppShell';
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
  isArchived: boolean;
  invitationEnabled: boolean;
  rsvpEnabled: boolean;
  guestbookEnabled: boolean;
  _count: {
    rsvps: number;
    invitations: number;
    checkIns: number;
    mediaAssets: number;
  };
  approvalStatus?: string;
  Owner?: { id: string; name: string; email: string };
}

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

export default function EventsPage() {
  const [events, setEvents] = useState<Event[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<'all' | 'active' | 'archived'>('active');
  const [pendingApprovals, setPendingApprovals] = useState<Event[]>([]);
  const [reviewingId, setReviewingId] = useState<string | null>(null);

  useEffect(() => {
    void fetchEvents();
  }, [filter]);

  const fetchEvents = async () => {
    try {
      setLoading(true);
      const params: Record<string, boolean> = {};
      if (filter === 'active') params.archived = false;
      if (filter === 'archived') params.archived = true;

      const [response, pending] = await Promise.all([
        eventsApi.list(params),
        adminApi.getPendingApprovals(),
      ]);
      setEvents(response.data.events);
      setPendingApprovals(pending.data?.events || []);
    } catch {
      toast.error('Failed to load events');
    } finally {
      setLoading(false);
    }
  };

  const reviewApproval = async (eventId: string, approve: boolean) => {
    setReviewingId(eventId);
    try {
      if (approve) {
        await adminApi.approveEvent(eventId);
        toast.success('Event approved');
      } else {
        const reason = window.prompt('Rejection reason');
        if (!reason) return;
        await adminApi.rejectEvent(eventId, reason);
        toast.success('Event rejected');
      }
      await fetchEvents();
    } catch (error: any) {
      toast.error(error?.response?.data?.error || 'Action failed');
    } finally {
      setReviewingId(null);
    }
  };

  const handleArchive = async (id: string, archive: boolean) => {
    try {
      if (archive) {
        await eventsApi.archive(id);
        toast.success('Event archived');
      } else {
        await eventsApi.unarchive(id);
        toast.success('Event restored');
      }
      await fetchEvents();
    } catch {
      toast.error('Action failed');
    }
  };

  const liveCount = events.filter((event) => event.currentPhase === 'LIVE').length;
  const archivedCount = events.filter((event) => event.isArchived).length;

  return (
    <div className="mobile-stack-section">
      <DashboardHeroHeader
        eyebrow="Admin events"
        title="Event management"
        subtitle="Review approvals, monitor live activity, and move quickly into each event workspace."
        action={<Link href="/admin/events/new" className="btn-primary">New Event</Link>}
      />

      <MetricStrip>
        <DashboardKpiCard label="In view" value={events.length} hint="Events returned by the current filter" />
        <DashboardKpiCard label="Live" value={liveCount} tone="emerald" hint="Events currently active" />
        <DashboardKpiCard label="Archived" value={archivedCount} tone="rose" hint="Archived events in this list" />
        <DashboardKpiCard label="Pending review" value={pendingApprovals.length} tone="blue" hint="Owner-created events awaiting approval" />
      </MetricStrip>

      <SplitPanelLayout
        main={(
          <DashboardSection
            title="All events"
            subtitle="Open any event to manage templates, settings, public pages, or voting."
            action={(
              <AppShellSectionNav
                items={[
                  { label: 'Active', active: filter === 'active', onClick: () => setFilter('active') },
                  { label: 'Archived', active: filter === 'archived', onClick: () => setFilter('archived') },
                  { label: 'All', active: filter === 'all', onClick: () => setFilter('all') },
                ]}
              />
            )}
          >
            {loading ? (
              <div className="flex min-h-[240px] items-center justify-center">
                <div className="h-8 w-8 animate-spin rounded-full border-b-2 border-brand-900" />
              </div>
            ) : events.length === 0 ? (
              <div className="rounded-3xl border border-dashed border-surface-200 bg-surface-50 px-6 py-12 text-center">
                <p className="text-base font-semibold text-brand-900">No events found</p>
                <p className="mt-1 text-sm text-surface-500">{filter === 'archived' ? 'There are no archived events yet.' : 'Create a new event to get started.'}</p>
              </div>
            ) : (
              <div className="space-y-3">
                {events.map((event) => {
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
                      meta={(
                        <div className="flex flex-wrap items-center gap-2">
                          <span className={cn(
                            'rounded-full px-2.5 py-1 text-xs font-semibold',
                            event.currentPhase === 'LIVE' ? 'bg-emerald-50 text-emerald-700' :
                            event.currentPhase === 'PRE_EVENT' ? 'bg-sky-50 text-sky-700' :
                            'bg-surface-100 text-surface-600'
                          )}>
                            {getPhaseLabel(event.currentPhase)}
                          </span>
                          {event.invitationOnly ? <span className="rounded-full bg-primary-50 px-2.5 py-1 text-xs font-semibold text-brand-900">Invite only</span> : null}
                          {event.isArchived ? <span className="rounded-full bg-surface-100 px-2.5 py-1 text-xs font-semibold text-surface-600">Archived</span> : null}
                        </div>
                      )}
                      subtitle={(
                        <div className="flex flex-wrap items-center gap-x-4 gap-y-1">
                          <span>{formatDate(event.date, 'MMM d, yyyy')}</span>
                          {event.venue ? <span>{event.venue}</span> : null}
                          <span className="font-mono text-xs text-surface-400">/{event.slug}</span>
                        </div>
                      )}
                      stats={(
                        <>
                          <div className="text-sm text-surface-500"><span className="font-semibold text-brand-900">{event._count.rsvps}</span> RSVPs</div>
                          <div className="text-sm text-surface-500"><span className="font-semibold text-brand-900">{event._count.checkIns}</span> Check-ins</div>
                          <div className="text-sm text-surface-500"><span className="font-semibold text-brand-900">{event._count.mediaAssets}</span> Media</div>
                        </>
                      )}
                      actions={(
                        <>
                          <Link href={`/admin/events/${event.id}`} className="btn-primary">Manage</Link>
                          <Link href={`/e/${event.slug}`} target="_blank" className="btn-outline">Public page</Link>
                          <button onClick={() => handleArchive(event.id, !event.isArchived)} className="btn-ghost">
                            {event.isArchived ? 'Restore' : 'Archive'}
                          </button>
                        </>
                      )}
                    />
                  );
                })}
              </div>
            )}
          </DashboardSection>
        )}
        side={(
          <InsightPanel title="Pending approvals" subtitle="Review owner-submitted events before they go live.">
            {pendingApprovals.length === 0 ? (
              <div className="rounded-2xl bg-surface-50 px-4 py-6 text-sm text-surface-500">No pending owner events right now.</div>
            ) : (
              <div className="space-y-3">
                {pendingApprovals.map((event) => (
                  <div key={event.id} className="rounded-2xl border border-surface-200 bg-surface-50/70 p-4">
                    <p className="font-semibold text-brand-900">{event.name}</p>
                    <p className="mt-1 text-sm text-surface-500">{event.Owner?.name || 'Unknown owner'}{event.Owner?.email ? ` · ${event.Owner.email}` : ''}</p>
                    <p className="mt-1 text-sm text-surface-500">{formatDate(event.date, 'MMM d, yyyy')}</p>
                    <div className="mt-4 flex gap-2">
                      <button className="btn-outline flex-1 border-rose-200 text-rose-600 hover:bg-rose-50" disabled={reviewingId === event.id} onClick={() => reviewApproval(event.id, false)}>Reject</button>
                      <button className="btn-primary flex-1" disabled={reviewingId === event.id} onClick={() => reviewApproval(event.id, true)}>Approve</button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </InsightPanel>
        )}
      />
    </div>
  );
}
