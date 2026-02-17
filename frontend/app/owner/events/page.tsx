'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { ownerDashboardApi } from '@/lib/api';
import { formatDate, cn, slugify } from '@/lib/utils';
import { DashboardPageHeader, DashboardSection } from '@/components/dashboard/ui';
import toast from 'react-hot-toast';

interface Event {
  id: string;
  name: string;
  slug: string;
  date: string;
  defaultCurrency?: string;
  venue: string | null;
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

const Icons = {
  calendar: <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" /></svg>,
  location: <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" /></svg>,
  arrow: <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" /></svg>,
};

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
    fetchEvents();
  }, []);

  const fetchEvents = async () => {
    try {
      setLoading(true);
      const response = await ownerDashboardApi.getEvents();
      setEvents(response.data.events);
    } catch (error) {
      toast.error('Failed to load events');
    } finally {
      setLoading(false);
    }
  };

  const getPhaseStyle = (phase: string) => {
    switch (phase) {
      case 'LIVE': return 'bg-emerald-50 text-emerald-700 border-emerald-200';
      case 'PRE_EVENT': return 'bg-blue-50 text-blue-700 border-blue-200';
      case 'POST_EVENT': return 'bg-surface-50 text-surface-700 border-surface-200';
      default: return 'bg-surface-50 text-surface-700 border-surface-200';
    }
  };

  const getPhaseLabel = (phase: string) => {
    switch (phase) {
      case 'LIVE': return 'Live';
      case 'PRE_EVENT': return 'Upcoming';
      case 'POST_EVENT': return 'Past';
      default: return phase;
    }
  };

  const filteredEvents = filter === 'all'
    ? events
    : events.filter(e => {
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
      if (!slugManuallyEdited) {
        next.slug = slugify(value);
      }
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

  if (loading) {
    return (
      <div className="text-center py-12">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-brand-900 mx-auto" />
      </div>
    );
  }

  return (
    <div className="space-y-5 sm:space-y-7">
      <DashboardPageHeader
        title="Events"
        subtitle="Manage your events and guest experiences"
        action={(
          <button className="btn-outline text-sm" onClick={() => setShowCreate((prev) => !prev)}>
            {showCreate ? 'Cancel' : '+ New Event'}
          </button>
        )}
      />

      {/* Quick Create */}
      {showCreate && (
        <DashboardSection title="Create Event" subtitle="Admin approval is required before activation">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <input
              className="input"
              placeholder="Event name"
              value={createData.name}
              onChange={(event) => handleNameChange(event.target.value)}
            />
            <div className="relative">
              <input
                className={cn(
                  'input pr-8',
                  slugAvailable === true && 'border-emerald-400 focus:border-emerald-500',
                  slugAvailable === false && 'border-red-400 focus:border-red-500'
                )}
                placeholder="event-slug"
                value={createData.slug}
                onChange={(event) => handleSlugChange(event.target.value)}
                onBlur={() => checkSlug(createData.slug)}
              />
              <span className="absolute right-3 top-1/2 -translate-y-1/2 text-xs">
                {slugChecking && <span className="text-surface-400">...</span>}
                {!slugChecking && slugAvailable === true && <span className="text-emerald-600">&#10003;</span>}
                {!slugChecking && slugAvailable === false && <span className="text-red-500">taken</span>}
              </span>
            </div>
            <input
              className="input"
              type="datetime-local"
              value={createData.date}
              onChange={(event) => setCreateData((prev) => ({ ...prev, date: event.target.value }))}
            />
            <select
              className="input"
              value={createData.defaultCurrency}
              onChange={(event) => setCreateData((prev) => ({ ...prev, defaultCurrency: event.target.value }))}
            >
              <option value="USD">USD</option>
              <option value="EUR">EUR</option>
              <option value="GBP">GBP</option>
              <option value="GHS">GHS</option>
              <option value="KES">KES</option>
              <option value="NGN">NGN</option>
            </select>
            <input
              className="input sm:col-span-2"
              placeholder="Venue (optional)"
              value={createData.venue}
              onChange={(event) => setCreateData((prev) => ({ ...prev, venue: event.target.value }))}
            />
            <div className="sm:col-span-2 flex justify-end">
              <button className="btn-primary w-full sm:w-auto" onClick={createEvent} disabled={creating}>
                {creating ? 'Creating...' : 'Create Event'}
              </button>
            </div>
          </div>
        </DashboardSection>
      )}

      {/* Filter + Count */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
        <div className="flex flex-wrap gap-1 bg-surface-100 p-1.5 rounded-xl">
          {[
            { key: 'all', label: 'All' },
            { key: 'pre', label: 'Upcoming' },
            { key: 'live', label: 'Live' },
            { key: 'post', label: 'Past' },
          ].map((option) => (
            <button
              key={option.key}
              onClick={() => setFilter(option.key as 'all' | 'pre' | 'live' | 'post')}
              className={cn(
                'px-4 py-2 rounded-lg text-sm font-medium transition-colors min-h-[36px]',
                filter === option.key
                  ? 'bg-white text-brand-900 shadow-sm'
                  : 'text-surface-600 hover:text-brand-900'
              )}
            >
              {option.label}
            </button>
          ))}
        </div>
        <p className="text-sm text-surface-500 tabular-nums">
          {filteredEvents.length} event{filteredEvents.length !== 1 ? 's' : ''}
        </p>
      </div>

      {/* Event List */}
      <DashboardSection contentClassName="p-0">
        {filteredEvents.length === 0 ? (
          <div className="text-center py-12 px-4">
            <div className="inline-flex items-center justify-center w-12 h-12 rounded-full bg-surface-100 mb-3">
              {Icons.calendar}
            </div>
            <p className="text-base font-medium text-surface-600">No events found</p>
            <p className="text-sm text-surface-400 mt-1">
              {filter === 'all' ? 'Create your first event to get started' : `No ${filter === 'pre' ? 'upcoming' : filter === 'live' ? 'live' : 'past'} events`}
            </p>
          </div>
        ) : (
          <div className="divide-y divide-surface-100">
            {filteredEvents.map((event) => (
              <Link
                key={event.id}
                href={`/owner/events/${event.id}`}
                className="group flex items-center gap-3 px-4 sm:px-5 py-4 hover:bg-surface-50 active:bg-surface-100 transition-colors"
              >
                <div className="flex-1 min-w-0">
                  <div className="flex flex-wrap items-center gap-2">
                    <h3 className="text-base font-semibold text-brand-900 truncate">{event.name}</h3>
                    <span
                      className={cn(
                        'inline-flex px-2 py-0.5 text-xs font-medium rounded border',
                        getPhaseStyle(event.currentPhase)
                      )}
                    >
                      {getPhaseLabel(event.currentPhase)}
                    </span>
                    {event.approvalStatus && event.approvalStatus !== 'APPROVED' && (
                      <span className="inline-flex px-2 py-0.5 text-xs font-medium rounded border bg-amber-50 text-amber-700 border-amber-200">
                        {event.approvalStatus.replace(/_/g, ' ')}
                      </span>
                    )}
                  </div>
                  <div className="flex flex-wrap items-center gap-x-3 gap-y-0.5 mt-1.5 text-sm text-surface-500">
                    <span className="flex items-center gap-1">
                      {Icons.calendar}
                      {formatDate(event.date)}
                    </span>
                    {event.venue && (
                      <span className="flex items-center gap-1">
                        {Icons.location}
                        {event.venue}
                      </span>
                    )}
                  </div>
                  <div className="flex gap-4 mt-2 text-sm">
                    <span className="text-surface-500"><span className="font-semibold text-brand-900">{event._count.rsvps}</span> RSVPs</span>
                    <span className="text-surface-500"><span className="font-semibold text-brand-900">{event._count.checkIns}</span> Check-ins</span>
                    <span className="text-surface-500"><span className="font-semibold text-brand-900">{event._count.mediaAssets}</span> Media</span>
                  </div>
                </div>
                <div className="text-surface-300 group-hover:text-brand-600 transition-colors flex-shrink-0">
                  {Icons.arrow}
                </div>
              </Link>
            ))}
          </div>
        )}
      </DashboardSection>
    </div>
  );
}

