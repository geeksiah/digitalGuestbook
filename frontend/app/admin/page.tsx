'use client';

import { useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
import { adminApi, eventsApi } from '@/lib/api';
import {
  formatCount,
  formatDate,
  getErrorMessage,
  getPhaseLabel,
  getPhaseTone,
  resolveEventCover,
} from '@/lib/utils';
import {
  EmptyState,
  ListSkeleton,
  ListSurface,
  ListRow,
  PageHeader,
  Panel,
  StatRow,
  StatRowSkeleton,
  Thumb,
  StatusBadge,
} from '@/components/ui/Primitives';
import { Plus } from '@/components/ui/icons';

interface EventRow {
  id: string;
  slug: string;
  name: string;
  date: string;
  venue: string | null;
  coverImagePath?: string | null;
  coverImageUrl?: string | null;
  currentPhase: string;
  invitationOnly: boolean;
  Owner?: { id: string; name: string; email: string } | null;
  _count: {
    rsvps: number;
    invitations: number;
    checkIns: number;
    mediaAssets: number;
  };
}

export default function AdminDashboard() {
  const [events, setEvents] = useState<EventRow[]>([]);
  const [pending, setPending] = useState<EventRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setError(null);
    try {
      const [eventsResponse, pendingResponse] = await Promise.all([
        eventsApi.list({ archived: false }),
        adminApi.getPendingApprovals().catch(() => ({ data: { events: [] } })),
      ]);
      setEvents(eventsResponse.data.events || []);
      setPending(pendingResponse.data?.events || []);
    } catch (err) {
      setError(getErrorMessage(err, 'Could not load the dashboard.'));
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const liveCount = events.filter((event) => event.currentPhase === 'LIVE').length;
  const totalRsvps = events.reduce((sum, event) => sum + (event._count?.rsvps || 0), 0);
  const totalMedia = events.reduce((sum, event) => sum + (event._count?.mediaAssets || 0), 0);
  const recent = events.slice(0, 6);

  return (
    <div className="page">
      <PageHeader
        title="Dashboard"
        actions={
          <Link href="/admin/events/new" className="btn-primary">
            <Plus className="h-4 w-4" strokeWidth={2} aria-hidden="true" />
            New event
          </Link>
        }
        mobileActions={
          <Link href="/admin/events/new" className="icon-btn" aria-label="New event">
            <Plus className="h-5 w-5" strokeWidth={2} aria-hidden="true" />
          </Link>
        }
      />

      {error ? (
        <div className="banner-error" role="alert">
          <span className="flex-1">{error}</span>
          <button type="button" className="shrink-0 font-semibold underline" onClick={() => void load()}>
            Retry
          </button>
        </div>
      ) : null}

      {loading ? (
        <StatRowSkeleton />
      ) : (
        <StatRow
          items={[
            { label: 'Events', value: formatCount(events.length), href: '/admin/events' },
            { label: 'Live now', value: formatCount(liveCount), tone: liveCount > 0 ? 'positive' : 'default' },
            { label: 'RSVPs', value: formatCount(totalRsvps) },
            { label: 'Media', value: formatCount(totalMedia) },
          ]}
        />
      )}

      {pending.length > 0 ? (
        <Panel
          title={`Awaiting approval (${pending.length})`}
          action={
            <Link href="/admin/events" className="btn-outline btn-sm">
              Review
            </Link>
          }
          flush
        >
          <div className="divide-y divide-surface-200">
            {pending.slice(0, 4).map((event) => (
              <ListRow
                key={event.id}
                title={event.name}
                status={<StatusBadge tone="warning">Pending</StatusBadge>}
                meta={
                  <>
                    <span>{event.Owner?.name || 'Unknown owner'}</span>
                    <span aria-hidden="true">&middot;</span>
                    <span>{formatDate(event.date, 'MMM d, yyyy')}</span>
                  </>
                }
                action={
                  <Link href={`/admin/events/${event.id}`} className="btn-outline btn-sm">
                    Open
                  </Link>
                }
              />
            ))}
          </div>
        </Panel>
      ) : null}

      <Panel
        title="Recent events"
        action={
          <Link href="/admin/events" className="btn-ghost btn-sm">
            View all
          </Link>
        }
        flush
      >
        {loading ? (
          <ListSkeleton rows={4} className="rounded-none border-0" />
        ) : recent.length === 0 ? (
          <div className="p-4 sm:p-5">
            <EmptyState
              title="No events yet"
              action={
                <Link href="/admin/events/new" className="btn-primary btn-sm">
                  Create event
                </Link>
              }
            />
          </div>
        ) : (
          <div className="divide-y divide-surface-200">
            {recent.map((event) => (
              <ListRow
                key={event.id}
                href={`/admin/events/${event.id}`}
                media={<Thumb src={resolveEventCover(event)} alt="" className="h-10 w-10" />}
                title={event.name}
                status={
                  <StatusBadge tone={getPhaseTone(event.currentPhase)} dot>
                    {getPhaseLabel(event.currentPhase)}
                  </StatusBadge>
                }
                meta={
                  <>
                    <span>{formatDate(event.date, 'MMM d, yyyy')}</span>
                    {event.venue ? (
                      <>
                        <span aria-hidden="true">&middot;</span>
                        <span className="truncate">{event.venue}</span>
                      </>
                    ) : null}
                  </>
                }
                metrics={
                  <>
                    <span className="meta num">
                      <span className="font-semibold text-brand-900">{formatCount(event._count.rsvps)}</span> RSVPs
                    </span>
                    <span className="meta num">
                      <span className="font-semibold text-brand-900">{formatCount(event._count.mediaAssets)}</span> media
                    </span>
                  </>
                }
                action={
                  <Link href={`/admin/events/${event.id}`} className="btn-outline btn-sm">
                    Manage
                  </Link>
                }
              />
            ))}
          </div>
        )}
      </Panel>
    </div>
  );
}
