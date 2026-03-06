'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { ownerDashboardApi, API_BASE_URL } from '@/lib/api';
import { formatDate, cn, slugify } from '@/lib/utils';
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

export default function OwnerEventsPage() {
  const [events, setEvents] = useState<Event[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<'all' | 'pre' | 'live' | 'post'>('all');
  const [showCreate, setShowCreate] = useState(false);
  const [creating, setCreating] = useState(false);
  const [slugManuallyEdited, setSlugManuallyEdited] = useState(false);
  const [slugAvailable, setSlugAvailable] = useState<boolean | null>(null);
  const [slugChecking, setSlugChecking] = useState(false);
  const [createData, setCreateData] = useState({
    name: '',
    slug: '',
    date: '',
    timezone: 'UTC',
    defaultCurrency: 'USD',
    venue: '',
  });

  useEffect(() => {
    void fetchEvents();
  }, []);

  const fetchEvents = async () => {
    try {
      setLoading(true);
      const response = await ownerDashboardApi.getEvents();
      setEvents(response.data.events);
    } catch {
      toast.error('Failed to load events');
    } finally {
      setLoading(false);
    }
  };

  const filteredEvents = filter === 'all'
    ? events
    : events.filter((e) => {
        if (filter === 'pre') return e.currentPhase === 'PRE_EVENT';
        if (filter === 'live') return e.currentPhase === 'LIVE';
        if (filter === 'post') return e.currentPhase === 'POST_EVENT';
        return true;
      });

  const checkSlug = async (slug: string) => {
    if (!slug || slug.length < 2) {
      setSlugAvailable(null);
      return;
    }
    setSlugChecking(true);
    try {
      const res = await ownerDashboardApi.checkSlugAvailability(slug);
      setSlugAvailable(res.data.available);
    } catch {
      setSlugAvailable(null);
    } finally {
      setSlugChecking(false);
    }
  };

  const handleNameChange = (value: string) => {
    setCreateData((prev) => {
      const next = { ...prev, name: value };
      if (!slugManuallyEdited) next.slug = slugify(value);
      return next;
    });
  };

  const handleSlugChange = (value: string) => {
    setSlugManuallyEdited(true);
    setSlugAvailable(null);
    setCreateData((prev) => ({ ...prev, slug: value.toLowerCase().replace(/[^a-z0-9-]/g, '') }));
  };

  const createEvent = async () => {
    if (!createData.name.trim() || !createData.slug.trim() || !createData.date) {
      toast.error('Name, slug and date are required');
      return;
    }

    const normalizedSlug = createData.slug.trim().toLowerCase().replace(/\s+/g, '-');
    try {
      const slugCheck = await ownerDashboardApi.checkSlugAvailability(normalizedSlug);
      if (!slugCheck.data?.available) {
        setSlugAvailable(false);
        toast.error('Slug already exists. Please choose another.');
        return;
      }
    } catch {
      toast.error('Could not verify slug availability');
      return;
    }

    setCreating(true);
    try {
      await ownerDashboardApi.createEvent({
        name: createData.name.trim(),
        slug: normalizedSlug,
        date: new Date(createData.date).toISOString(),
        timezone: createData.timezone || 'UTC',
        defaultCurrency: createData.defaultCurrency || 'USD',
        venue: createData.venue || undefined,
      });
      toast.success('Event created and submitted for admin approval');
      setShowCreate(false);
      setSlugManuallyEdited(false);
      setSlugAvailable(null);
      setCreateData({ name: '', slug: '', date: '', timezone: 'UTC', defaultCurrency: 'USD', venue: '' });
      await fetchEvents();
    } catch (error: any) {
      toast.error(error?.response?.data?.error || 'Failed to create event');
    } finally {
      setCreating(false);
    }
  };

  const liveCount = events.filter((e) => e.currentPhase === 'LIVE').length;
  const pendingCount = events.filter((e) => e.approvalStatus && e.approvalStatus !== 'APPROVED').length;

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
        eyebrow="Owner events"
        title="Manage your events"
        subtitle="Create new events, monitor approvals, and jump back into the event workspaces your guests are already using."
        action={<button className="btn-primary" onClick={() => setShowCreate((prev) => !prev)}>{showCreate ? 'Close' : 'New Event'}</button>}
      />

      <MetricStrip>
        <DashboardKpiCard label="All events" value={events.length} hint="Every event in your workspace" />
        <DashboardKpiCard label="Live" value={liveCount} tone="emerald" hint="Events guests can currently interact with" />
        <DashboardKpiCard label="Awaiting review" value={pendingCount} tone="blue" hint="Events pending admin approval or changes" />
        <DashboardKpiCard label="Filtered view" value={filteredEvents.length} tone="violet" hint="Events shown in the list below" />
      </MetricStrip>

      <SplitPanelLayout
        main={(
          <div className="space-y-4">
            {showCreate ? (
              <DashboardSection title="Create an event" subtitle="Fill the basics first. You can refine the full experience inside the event workspace after approval.">
                <div className="grid gap-3 md:grid-cols-2">
                  <input className="input" placeholder="Event name" value={createData.name} onChange={(event) => handleNameChange(event.target.value)} />
                  <div className="relative">
                    <input
                      className={cn(
                        'input pr-16',
                        slugAvailable === true && 'border-emerald-400 focus:border-emerald-500',
                        slugAvailable === false && 'border-red-400 focus:border-red-500'
                      )}
                      placeholder="event-slug"
                      value={createData.slug}
                      onChange={(event) => handleSlugChange(event.target.value)}
                      onBlur={() => checkSlug(createData.slug)}
                    />
                    <span className="absolute right-4 top-1/2 -translate-y-1/2 text-xs font-semibold">
                      {slugChecking ? <span className="text-surface-400">...</span> : null}
                      {!slugChecking && slugAvailable === true ? <span className="text-emerald-600">OK</span> : null}
                      {!slugChecking && slugAvailable === false ? <span className="text-red-500">Taken</span> : null}
                    </span>
                  </div>
                  <input className="input" type="datetime-local" value={createData.date} onChange={(event) => setCreateData((prev) => ({ ...prev, date: event.target.value }))} />
                  <select className="input" value={createData.defaultCurrency} onChange={(event) => setCreateData((prev) => ({ ...prev, defaultCurrency: event.target.value }))}>
                    <option value="USD">USD</option>
                    <option value="EUR">EUR</option>
                    <option value="GBP">GBP</option>
                    <option value="GHS">GHS</option>
                    <option value="KES">KES</option>
                    <option value="NGN">NGN</option>
                  </select>
                  <input className="input md:col-span-2" placeholder="Venue (optional)" value={createData.venue} onChange={(event) => setCreateData((prev) => ({ ...prev, venue: event.target.value }))} />
                </div>
                <div className="mt-4 flex justify-end">
                  <button className="btn-primary w-full sm:w-auto" onClick={createEvent} disabled={creating}>
                    {creating ? 'Creating...' : 'Create Event'}
                  </button>
                </div>
              </DashboardSection>
            ) : null}

            <DashboardSection
              title="Your events"
              subtitle="Open any event to manage the guest journey, content, and voting setup."
              action={(
                <AppShellSectionNav
                  items={[
                    { label: 'All', active: filter === 'all', onClick: () => setFilter('all') },
                    { label: 'Upcoming', active: filter === 'pre', onClick: () => setFilter('pre') },
                    { label: 'Live', active: filter === 'live', onClick: () => setFilter('live') },
                    { label: 'Past', active: filter === 'post', onClick: () => setFilter('post') },
                  ]}
                />
              )}
            >
              {filteredEvents.length === 0 ? (
                <div className="rounded-3xl border border-dashed border-surface-200 bg-surface-50 px-6 py-12 text-center">
                  <p className="text-base font-semibold text-brand-900">No events found</p>
                  <p className="mt-1 text-sm text-surface-500">
                    {filter === 'all' ? 'Create your first event to get started.' : 'No events match this view right now.'}
                  </p>
                </div>
              ) : (
                <div className="space-y-3">
                  {filteredEvents.map((event) => {
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
                              event.currentPhase === 'PRE_EVENT' ? 'bg-blue-50 text-blue-700' :
                              'bg-surface-100 text-surface-700'
                            )}>
                              {event.currentPhase === 'PRE_EVENT' ? 'Upcoming' : event.currentPhase === 'POST_EVENT' ? 'Past' : 'Live'}
                            </span>
                            {event.approvalStatus && event.approvalStatus !== 'APPROVED' ? (
                              <span className="rounded-full bg-amber-50 px-2.5 py-1 text-xs font-semibold text-amber-700">
                                {event.approvalStatus.replace(/_/g, ' ')}
                              </span>
                            ) : null}
                          </div>
                        )}
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
                            <div className="text-sm text-surface-500"><span className="font-semibold text-brand-900">{event._count.mediaAssets}</span> Media</div>
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
          <InsightPanel title="What to do next" subtitle="Keep the most important owner actions clear and close by.">
            <div className="space-y-3 text-sm text-surface-600">
              <div className="rounded-2xl bg-surface-50 px-4 py-4">
                <p className="font-semibold text-brand-900">Need a public page fast?</p>
                <p className="mt-1">Open any event and use the public links section to preview the guest-facing pages.</p>
              </div>
              <div className="rounded-2xl bg-surface-50 px-4 py-4">
                <p className="font-semibold text-brand-900">Waiting on approval?</p>
                <p className="mt-1">Events marked pending remain visible here so you can keep preparing content and details.</p>
              </div>
            </div>
          </InsightPanel>
        )}
      />
    </div>
  );
}
