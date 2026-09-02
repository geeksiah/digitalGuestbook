'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
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
  ListRow,
  ListSkeleton,
  PageHeader,
  Pagination,
  Panel,
  SearchField,
  SegmentedControl,
  StatusBadge,
  Thumb,
  Toolbar,
  useDebounced,
  usePagination,
} from '@/components/ui/Primitives';
import { Menu, MenuItem, MenuSeparator, Modal } from '@/components/ui/Overlay';
import { Plus } from '@/components/ui/icons';
import toast from 'react-hot-toast';

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

type Filter = 'active' | 'archived' | 'all';

export default function EventsPage() {
  const [events, setEvents] = useState<EventRow[]>([]);
  const [pendingApprovals, setPendingApprovals] = useState<EventRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [filter, setFilter] = useState<Filter>('active');
  const [search, setSearch] = useState('');
  const [busyId, setBusyId] = useState<string | null>(null);
  const [rejecting, setRejecting] = useState<EventRow | null>(null);
  const [rejectReason, setRejectReason] = useState('');

  const query = useDebounced(search.trim().toLowerCase(), 200);

  const fetchEvents = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const params: Record<string, boolean> = {};
      if (filter === 'active') params.archived = false;
      if (filter === 'archived') params.archived = true;

      const [response, pending] = await Promise.all([
        eventsApi.list(params),
        adminApi.getPendingApprovals().catch(() => ({ data: { events: [] } })),
      ]);
      setEvents(response.data.events || []);
      setPendingApprovals(pending.data?.events || []);
    } catch (err) {
      setError(getErrorMessage(err, 'Could not load events.'));
    } finally {
      setLoading(false);
    }
  }, [filter]);

  useEffect(() => {
    void fetchEvents();
  }, [fetchEvents]);

  const filtered = useMemo(() => {
    if (!query) return events;
    return events.filter((event) =>
      [event.name, event.slug, event.venue, event.Owner?.name].some((field) =>
        String(field || '').toLowerCase().includes(query)
      )
    );
  }, [events, query]);

  const paged = usePagination(filtered, 15);

  const approve = async (event: EventRow) => {
    setBusyId(event.id);
    try {
      await adminApi.approveEvent(event.id);
      toast.success(`${event.name} approved`);
      await fetchEvents();
    } catch (err) {
      toast.error(getErrorMessage(err, 'Could not approve the event.'));
    } finally {
      setBusyId(null);
    }
  };

  const submitRejection = async () => {
    if (!rejecting || !rejectReason.trim()) return;
    setBusyId(rejecting.id);
    try {
      await adminApi.rejectEvent(rejecting.id, rejectReason.trim());
      toast.success(`${rejecting.name} rejected`);
      setRejecting(null);
      setRejectReason('');
      await fetchEvents();
    } catch (err) {
      toast.error(getErrorMessage(err, 'Could not reject the event.'));
    } finally {
      setBusyId(null);
    }
  };

  const setArchived = async (event: EventRow, archive: boolean) => {
    setBusyId(event.id);
    try {
      if (archive) {
        await eventsApi.archive(event.id);
        toast.success('Event archived');
      } else {
        await eventsApi.unarchive(event.id);
        toast.success('Event restored');
      }
      await fetchEvents();
    } catch (err) {
      toast.error(getErrorMessage(err, 'Could not update the event.'));
    } finally {
      setBusyId(null);
    }
  };

  return (
    <div className="page">
      <PageHeader
        title="Events"
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

      {pendingApprovals.length > 0 ? (
        <Panel title={`Awaiting approval (${pendingApprovals.length})`} flush>
          <div className="divide-y divide-surface-200">
            {pendingApprovals.map((event) => (
              <div key={event.id} className="flex flex-col gap-3 px-4 py-3 sm:flex-row sm:items-center">
                <div className="min-w-0 flex-1">
                  <p className="truncate text-[15px] font-semibold text-brand-900">{event.name}</p>
                  <p className="mt-0.5 meta truncate">
                    {event.Owner?.name || 'Unknown owner'}
                    {event.Owner?.email ? ` · ${event.Owner.email}` : ''} · {formatDate(event.date, 'MMM d, yyyy')}
                  </p>
                </div>
                <div className="flex shrink-0 items-center gap-2">
                  <button
                    type="button"
                    className="btn-outline btn-sm flex-1 sm:flex-none"
                    disabled={busyId === event.id}
                    onClick={() => {
                      setRejecting(event);
                      setRejectReason('');
                    }}
                  >
                    Reject
                  </button>
                  <button
                    type="button"
                    className="btn-primary btn-sm flex-1 sm:flex-none"
                    disabled={busyId === event.id}
                    onClick={() => void approve(event)}
                  >
                    Approve
                  </button>
                </div>
              </div>
            ))}
          </div>
        </Panel>
      ) : null}

      <Toolbar
        end={
          <SegmentedControl<Filter>
            label="Event status"
            value={filter}
            onChange={setFilter}
            options={[
              { value: 'active', label: 'Active' },
              { value: 'archived', label: 'Archived' },
              { value: 'all', label: 'All' },
            ]}
          />
        }
      >
        <SearchField
          value={search}
          onChange={setSearch}
          placeholder="Search events"
          className="w-full sm:w-72"
        />
        {!loading ? (
          <span className="meta num hidden sm:inline">
            {formatCount(filtered.length)} {filtered.length === 1 ? 'event' : 'events'}
          </span>
        ) : null}
      </Toolbar>

      {error ? (
        <div className="banner-error" role="alert">
          <span className="flex-1">{error}</span>
          <button type="button" className="shrink-0 font-semibold underline" onClick={() => void fetchEvents()}>
            Retry
          </button>
        </div>
      ) : null}

      {loading ? (
        <ListSkeleton rows={6} />
      ) : filtered.length === 0 ? (
        <EmptyState
          title={query ? 'No matching events' : filter === 'archived' ? 'No archived events' : 'No events yet'}
          hint={query ? 'Try a different name, slug, venue or owner.' : undefined}
          action={
            query ? (
              <button type="button" className="btn-outline btn-sm" onClick={() => setSearch('')}>
                Clear search
              </button>
            ) : (
              <Link href="/admin/events/new" className="btn-primary btn-sm">
                Create event
              </Link>
            )
          }
        />
      ) : (
        <>
          <div className="divide-y divide-surface-200 overflow-hidden rounded-xl border border-surface-200 bg-white">
            {paged.rows.map((event) => (
              <ListRow
                key={event.id}
                href={`/admin/events/${event.id}`}
                media={<Thumb src={resolveEventCover(event)} alt="" className="h-11 w-11" />}
                title={event.name}
                status={
                  <>
                    <StatusBadge tone={getPhaseTone(event.currentPhase)} dot>
                      {getPhaseLabel(event.currentPhase)}
                    </StatusBadge>
                    {event.isArchived ? <StatusBadge tone="neutral">Archived</StatusBadge> : null}
                    {event.invitationOnly ? <StatusBadge tone="brand">Invite only</StatusBadge> : null}
                  </>
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
                    <span aria-hidden="true">&middot;</span>
                    <span className="truncate font-mono text-[12px]">/{event.slug}</span>
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
                    <span className="meta num">
                      <span className="font-semibold text-brand-900">{formatCount(event._count.mediaAssets)}</span> media
                    </span>
                  </>
                }
                action={
                  <Link href={`/admin/events/${event.id}`} className="btn-outline btn-sm hidden sm:inline-flex">
                    Manage
                  </Link>
                }
                overflow={
                  <Menu label={`Actions for ${event.name}`} sheetTitle={event.name}>
                    <MenuItem href={`/admin/events/${event.id}`}>Manage event</MenuItem>
                    <MenuItem href={`/e/${event.slug}`} target="_blank">
                      View public page
                    </MenuItem>
                    <MenuSeparator />
                    <MenuItem
                      danger={!event.isArchived}
                      disabled={busyId === event.id}
                      onClick={() => void setArchived(event, !event.isArchived)}
                    >
                      {event.isArchived ? 'Restore event' : 'Archive event'}
                    </MenuItem>
                  </Menu>
                }
              />
            ))}
          </div>

          <Pagination
            page={paged.page}
            pageCount={paged.pageCount}
            total={paged.total}
            pageSize={paged.pageSize}
            onPageChange={paged.setPage}
          />
        </>
      )}

      <Modal
        open={Boolean(rejecting)}
        onClose={() => setRejecting(null)}
        title={`Reject ${rejecting?.name || 'event'}?`}
        description="The owner receives this reason and can resubmit."
        size="sm"
        footer={
          <>
            <button type="button" className="btn-outline" onClick={() => setRejecting(null)}>
              Cancel
            </button>
            <button
              type="button"
              className="btn-danger"
              disabled={!rejectReason.trim() || busyId === rejecting?.id}
              onClick={() => void submitRejection()}
            >
              Reject event
            </button>
          </>
        }
      >
        <label className="label" htmlFor="reject-reason">
          Reason
        </label>
        <textarea
          id="reject-reason"
          data-autofocus
          className="input"
          rows={4}
          value={rejectReason}
          onChange={(event) => setRejectReason(event.target.value)}
          placeholder="What needs to change before this event can go live?"
        />
      </Modal>
    </div>
  );
}
