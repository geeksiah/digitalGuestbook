'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { ownerDashboardApi } from '@/lib/api';
import {
  formatCount,
  formatDate,
  getErrorMessage,
  getPhaseLabel,
  getPhaseTone,
  humanizeEnum,
  resolveEventCover,
  slugify,
} from '@/lib/utils';
import {
  EmptyState,
  ListRow,
  ListSkeleton,
  PageHeader,
  Pagination,
  SearchField,
  SegmentedControl,
  StatRow,
  StatRowSkeleton,
  StatusBadge,
  SubmitButton,
  Thumb,
  Toolbar,
  useDebounced,
  usePagination,
} from '@/components/ui/Primitives';
import { Menu, MenuItem, Modal } from '@/components/ui/Overlay';
import { Plus } from '@/components/ui/icons';
import toast from 'react-hot-toast';

interface OwnerEvent {
  id: string;
  name: string;
  slug: string;
  date: string;
  defaultCurrency?: string;
  venue: string | null;
  coverImagePath?: string | null;
  coverImageUrl?: string | null;
  currentPhase: string;
  approvalStatus?: 'PENDING_REVIEW' | 'APPROVED' | 'REJECTED' | string;
  _count: {
    rsvps: number;
    invitations: number;
    checkIns: number;
    mediaAssets: number;
    transactions: number;
  };
}

type Filter = 'all' | 'pre' | 'live' | 'post';

const CURRENCIES = ['USD', 'EUR', 'GBP', 'GHS', 'KES', 'NGN'];

const emptyDraft = { name: '', slug: '', date: '', timezone: 'UTC', defaultCurrency: 'USD', venue: '' };

export default function OwnerEventsPage() {
  const [events, setEvents] = useState<OwnerEvent[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [filter, setFilter] = useState<Filter>('all');
  const [search, setSearch] = useState('');

  const [showCreate, setShowCreate] = useState(false);
  const [creating, setCreating] = useState(false);
  const [draft, setDraft] = useState(emptyDraft);
  const [slugTouched, setSlugTouched] = useState(false);
  const [slugAvailable, setSlugAvailable] = useState<boolean | null>(null);
  const [slugChecking, setSlugChecking] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);

  const query = useDebounced(search.trim().toLowerCase(), 200);
  const slugQuery = useDebounced(draft.slug, 400);

  const fetchEvents = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const response = await ownerDashboardApi.getEvents();
      setEvents(response.data.events || []);
    } catch (err) {
      setError(getErrorMessage(err, 'Could not load your events.'));
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void fetchEvents();
  }, [fetchEvents]);

  // Check availability while typing so the answer is there before submitting.
  useEffect(() => {
    if (!showCreate) return;
    const candidate = slugQuery.trim();
    if (candidate.length < 2) {
      setSlugAvailable(null);
      return;
    }
    let cancelled = false;
    setSlugChecking(true);
    ownerDashboardApi
      .checkSlugAvailability(candidate)
      .then((response: any) => {
        if (!cancelled) setSlugAvailable(Boolean(response.data?.available));
      })
      .catch(() => {
        if (!cancelled) setSlugAvailable(null);
      })
      .finally(() => {
        if (!cancelled) setSlugChecking(false);
      });
    return () => {
      cancelled = true;
    };
  }, [slugQuery, showCreate]);

  const filtered = useMemo(() => {
    const byPhase = events.filter((event) => {
      if (filter === 'pre') return event.currentPhase === 'PRE_EVENT';
      if (filter === 'live') return event.currentPhase === 'LIVE';
      if (filter === 'post') return event.currentPhase === 'POST_EVENT';
      return true;
    });
    if (!query) return byPhase;
    return byPhase.filter((event) =>
      [event.name, event.slug, event.venue].some((field) => String(field || '').toLowerCase().includes(query))
    );
  }, [events, filter, query]);

  const paged = usePagination(filtered, 15);

  const openCreate = () => {
    setDraft(emptyDraft);
    setSlugTouched(false);
    setSlugAvailable(null);
    setFormError(null);
    setShowCreate(true);
  };

  const createEvent = async () => {
    const name = draft.name.trim();
    const slug = draft.slug.trim().toLowerCase();
    if (!name || !slug || !draft.date) {
      setFormError('Name, address and date are required.');
      return;
    }
    if (slugAvailable === false) {
      setFormError('That address is taken. Choose another.');
      return;
    }

    setCreating(true);
    setFormError(null);
    try {
      const check = await ownerDashboardApi.checkSlugAvailability(slug);
      if (!check.data?.available) {
        setSlugAvailable(false);
        setFormError('That address is taken. Choose another.');
        return;
      }

      await ownerDashboardApi.createEvent({
        name,
        slug,
        date: new Date(draft.date).toISOString(),
        timezone: draft.timezone || 'UTC',
        defaultCurrency: draft.defaultCurrency || 'USD',
        venue: draft.venue.trim() || undefined,
      });
      toast.success('Event created and sent for approval');
      setShowCreate(false);
      await fetchEvents();
    } catch (err) {
      // Keep the form values so nothing typed is lost.
      setFormError(getErrorMessage(err, 'Could not create the event.'));
    } finally {
      setCreating(false);
    }
  };

  const liveCount = events.filter((event) => event.currentPhase === 'LIVE').length;
  const pendingCount = events.filter((event) => event.approvalStatus && event.approvalStatus !== 'APPROVED').length;

  return (
    <div className="page">
      <PageHeader
        title="Events"
        actions={
          <button type="button" className="btn-primary" onClick={openCreate}>
            <Plus className="h-4 w-4" strokeWidth={2} aria-hidden="true" />
            New event
          </button>
        }
        mobileActions={
          <button type="button" className="icon-btn" onClick={openCreate} aria-label="New event">
            <Plus className="h-5 w-5" strokeWidth={2} aria-hidden="true" />
          </button>
        }
      />

      {loading ? (
        <StatRowSkeleton count={3} />
      ) : (
        <StatRow
          items={[
            { label: 'Events', value: formatCount(events.length) },
            { label: 'Live', value: formatCount(liveCount), tone: liveCount > 0 ? 'positive' : 'default' },
            { label: 'Awaiting review', value: formatCount(pendingCount) },
          ]}
        />
      )}

      <Toolbar
        end={
          <SegmentedControl<Filter>
            label="Event phase"
            value={filter}
            onChange={setFilter}
            options={[
              { value: 'all', label: 'All' },
              { value: 'pre', label: 'Upcoming' },
              { value: 'live', label: 'Live' },
              { value: 'post', label: 'Ended' },
            ]}
          />
        }
      >
        <SearchField value={search} onChange={setSearch} placeholder="Search events" className="w-full sm:w-72" />
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
        <ListSkeleton rows={5} />
      ) : filtered.length === 0 ? (
        <EmptyState
          title={query || filter !== 'all' ? 'No matching events' : 'No events yet'}
          action={
            query || filter !== 'all' ? (
              <button
                type="button"
                className="btn-outline btn-sm"
                onClick={() => {
                  setSearch('');
                  setFilter('all');
                }}
              >
                Clear filters
              </button>
            ) : (
              <button type="button" className="btn-primary btn-sm" onClick={openCreate}>
                Create event
              </button>
            )
          }
        />
      ) : (
        <>
          <div className="divide-y divide-surface-200 overflow-hidden rounded-xl border border-surface-200 bg-white">
            {paged.rows.map((event) => (
              <ListRow
                key={event.id}
                href={`/owner/events/${event.id}`}
                media={<Thumb src={resolveEventCover(event)} alt="" className="h-11 w-11" />}
                title={event.name}
                status={
                  <>
                    <StatusBadge tone={getPhaseTone(event.currentPhase)} dot>
                      {getPhaseLabel(event.currentPhase)}
                    </StatusBadge>
                    {event.approvalStatus && event.approvalStatus !== 'APPROVED' ? (
                      <StatusBadge tone={event.approvalStatus === 'REJECTED' ? 'danger' : 'warning'}>
                        {humanizeEnum(event.approvalStatus)}
                      </StatusBadge>
                    ) : null}
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
                  <Link href={`/owner/events/${event.id}`} className="btn-outline btn-sm hidden sm:inline-flex">
                    Manage
                  </Link>
                }
                overflow={
                  <Menu label={`Actions for ${event.name}`} sheetTitle={event.name}>
                    <MenuItem href={`/owner/events/${event.id}`}>Manage event</MenuItem>
                    <MenuItem href={`/e/${event.slug}`} target="_blank">
                      View public page
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
        open={showCreate}
        onClose={() => setShowCreate(false)}
        title="New event"
        description="An admin reviews the event before it goes live."
        size="md"
        footer={
          <>
            <button type="button" className="btn-outline" onClick={() => setShowCreate(false)} disabled={creating}>
              Cancel
            </button>
            <SubmitButton loading={creating} onClick={() => void createEvent()} disabled={slugChecking}>
              Create event
            </SubmitButton>
          </>
        }
      >
        <div className="space-y-4">
          {formError ? (
            <div className="banner-error" role="alert">
              {formError}
            </div>
          ) : null}

          <div>
            <label className="label" htmlFor="event-name">
              Event name
            </label>
            <input
              id="event-name"
              data-autofocus
              className="input"
              value={draft.name}
              onChange={(e) => {
                const value = e.target.value;
                setDraft((prev) => ({ ...prev, name: value, slug: slugTouched ? prev.slug : slugify(value) }));
              }}
              placeholder="Ama & Kofi's wedding"
            />
          </div>

          <div>
            <label className="label" htmlFor="event-slug">
              Web address
            </label>
            <div className="flex items-center gap-2">
              <span className="shrink-0 text-sm text-surface-600">/e/</span>
              <input
                id="event-slug"
                className={
                  slugAvailable === false ? 'input input-error' : 'input'
                }
                value={draft.slug}
                onChange={(e) => {
                  setSlugTouched(true);
                  setSlugAvailable(null);
                  setDraft((prev) => ({ ...prev, slug: e.target.value.toLowerCase().replace(/[^a-z0-9-]/g, '') }));
                }}
                placeholder="ama-and-kofi"
                aria-describedby="event-slug-status"
              />
            </div>
            <p id="event-slug-status" className={slugAvailable === false ? 'field-error' : 'field-hint'} role="status">
              {slugChecking
                ? 'Checking availability…'
                : slugAvailable === true
                ? 'Available'
                : slugAvailable === false
                ? 'Taken. Try another address.'
                : 'Guests will visit this address.'}
            </p>
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            <div>
              <label className="label" htmlFor="event-date">
                Date and time
              </label>
              <input
                id="event-date"
                type="datetime-local"
                className="input"
                value={draft.date}
                onChange={(e) => setDraft((prev) => ({ ...prev, date: e.target.value }))}
              />
            </div>
            <div>
              <label className="label" htmlFor="event-currency">
                Currency
              </label>
              <select
                id="event-currency"
                className="input"
                value={draft.defaultCurrency}
                onChange={(e) => setDraft((prev) => ({ ...prev, defaultCurrency: e.target.value }))}
              >
                {CURRENCIES.map((currency) => (
                  <option key={currency} value={currency}>
                    {currency}
                  </option>
                ))}
              </select>
            </div>
          </div>

          <div>
            <label className="label" htmlFor="event-venue">
              Venue <span className="font-normal text-surface-600">(optional)</span>
            </label>
            <input
              id="event-venue"
              className="input"
              value={draft.venue}
              onChange={(e) => setDraft((prev) => ({ ...prev, venue: e.target.value }))}
            />
          </div>
        </div>
      </Modal>
    </div>
  );
}
