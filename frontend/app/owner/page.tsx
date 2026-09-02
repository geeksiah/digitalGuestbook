'use client';

import { useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
import { ownerDashboardApi } from '@/lib/api';
import {
  formatCount,
  formatCurrencyAmount,
  formatDate,
  getErrorMessage,
  getPhaseLabel,
  getPhaseTone,
  resolveEventCover,
} from '@/lib/utils';
import {
  EmptyState,
  ListRow,
  ListSkeleton,
  PageHeader,
  Panel,
  StatRow,
  StatRowSkeleton,
  StatusBadge,
  Thumb,
} from '@/components/ui/Primitives';

interface OwnerEvent {
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

export default function OwnerDashboardPage() {
  const [events, setEvents] = useState<OwnerEvent[]>([]);
  const [stats, setStats] = useState<Stats | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const [eventsResponse, statsResponse] = await Promise.all([
        ownerDashboardApi.getEvents(),
        ownerDashboardApi.getStats(),
      ]);
      setEvents(eventsResponse.data.events || []);
      setStats(statsResponse.data.stats || null);
    } catch (err) {
      setError(getErrorMessage(err, 'Could not load your dashboard.'));
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const revenue = Object.entries(stats?.revenueByCurrency || {});

  return (
    <div className="page">
      <PageHeader
        title="Dashboard"
        actions={
          <Link href="/owner/events" className="btn-outline">
            All events
          </Link>
        }
        mobileActions={null}
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
      ) : stats ? (
        <StatRow
          items={[
            { label: 'Events', value: formatCount(stats.totalEvents), href: '/owner/events' },
            { label: 'RSVPs', value: formatCount(stats.totalRsvps) },
            { label: 'Check-ins', value: formatCount(stats.totalCheckIns) },
            { label: 'Media', value: formatCount(stats.totalMedia) },
          ]}
        />
      ) : null}

      {revenue.length > 0 ? (
        <Panel
          title="Revenue"
          action={
            <Link href="/owner/payouts" className="btn-ghost btn-sm">
              Payouts
            </Link>
          }
        >
          <div className="grid gap-x-6 gap-y-4 sm:grid-cols-2 xl:grid-cols-3">
            {revenue.map(([currency, amounts]) => (
              <div key={currency} className="min-w-0">
                <p className="text-[13px] font-medium text-surface-600">{currency} net</p>
                <p className="num mt-0.5 truncate text-xl font-semibold tracking-tight text-brand-900">
                  {formatCurrencyAmount(amounts.net, currency)}
                </p>
                <p className="num mt-1 truncate text-[12px] text-surface-600">
                  Gross {formatCurrencyAmount(amounts.gross, currency)}
                </p>
              </div>
            ))}
          </div>
        </Panel>
      ) : null}

      <Panel
        title="Recent events"
        action={
          <Link href="/owner/events" className="btn-ghost btn-sm">
            View all
          </Link>
        }
        flush
      >
        {loading ? (
          <ListSkeleton rows={4} className="rounded-none border-0" />
        ) : events.length === 0 ? (
          <div className="p-4 sm:p-5">
            <EmptyState
              title="No events yet"
              action={
                <Link href="/owner/events" className="btn-primary btn-sm">
                  Create event
                </Link>
              }
            />
          </div>
        ) : (
          <div className="divide-y divide-surface-200">
            {events.slice(0, 6).map((event) => (
              <ListRow
                key={event.id}
                href={`/owner/events/${event.id}`}
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
                      <span className="font-semibold text-brand-900">{formatCount(event._count.checkIns)}</span> in
                    </span>
                  </>
                }
                action={
                  <Link href={`/owner/events/${event.id}`} className="btn-outline btn-sm">
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
