'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { ownerDashboardApi } from '@/lib/api';
import { formatDate, cn } from '@/lib/utils';
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

  const createEvent = async () => {
    if (!createData.name.trim() || !createData.slug.trim() || !createData.date) {
      toast.error('Name, slug and date are required');
      return;
    }

    setCreating(true);
    try {
      await ownerDashboardApi.createEvent({
        name: createData.name.trim(),
        slug: createData.slug.trim().toLowerCase().replace(/\s+/g, '-'),
        date: new Date(createData.date).toISOString(),
        timezone: createData.timezone || 'UTC',
        defaultCurrency: createData.defaultCurrency || 'USD',
        venue: createData.venue || undefined,
      });
      toast.success('Event created and submitted for admin approval');
      setShowCreate(false);
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
    <div className="space-y-7">
      <DashboardPageHeader title="Events" subtitle="Manage RSVP, guestbook media, itinerary, invites, tickets, and payouts" />

      <DashboardSection
        title="Create Event"
        subtitle="Quick create wizard (events start in pending admin approval)"
        action={(
          <button className="btn-outline" onClick={() => setShowCreate((prev) => !prev)}>
            {showCreate ? 'Close' : 'Quick create'}
          </button>
        )}
      >
        {showCreate ? (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            <input
              className="input"
              placeholder="Event name"
              value={createData.name}
              onChange={(event) => setCreateData((prev) => ({ ...prev, name: event.target.value }))}
            />
            <input
              className="input"
              placeholder="event-slug"
              value={createData.slug}
              onChange={(event) => setCreateData((prev) => ({ ...prev, slug: event.target.value }))}
            />
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
              className="input"
              placeholder="Venue (optional)"
              value={createData.venue}
              onChange={(event) => setCreateData((prev) => ({ ...prev, venue: event.target.value }))}
            />
            <div className="md:col-span-2 flex justify-end">
              <button className="btn-primary" onClick={createEvent} disabled={creating}>
                {creating ? 'Creating...' : 'Create Event'}
              </button>
            </div>
          </div>
        ) : (
          <p className="text-sm text-surface-600">Use quick create for new events. Admin approval is required before activation.</p>
        )}
      </DashboardSection>

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        <div className="card py-4">
          <p className="text-[11px] uppercase tracking-[0.12em] text-surface-500 font-semibold">Showing</p>
          <p className="text-2xl font-bold text-brand-900 mt-1">{filteredEvents.length}</p>
        </div>
        <div className="card py-4">
          <p className="text-[11px] uppercase tracking-[0.12em] text-surface-500 font-semibold">Upcoming</p>
          <p className="text-2xl font-bold text-brand-900 mt-1">{events.filter((event) => event.currentPhase === 'PRE_EVENT').length}</p>
        </div>
        <div className="card py-4">
          <p className="text-[11px] uppercase tracking-[0.12em] text-surface-500 font-semibold">Live</p>
          <p className="text-2xl font-bold text-brand-900 mt-1">{events.filter((event) => event.currentPhase === 'LIVE').length}</p>
        </div>
        <div className="card py-4">
          <p className="text-[11px] uppercase tracking-[0.12em] text-surface-500 font-semibold">Past</p>
          <p className="text-2xl font-bold text-brand-900 mt-1">{events.filter((event) => event.currentPhase === 'POST_EVENT').length}</p>
        </div>
      </div>

      <DashboardSection
        title="Event List"
        subtitle="Select an event to manage operations and guest experience flows"
        action={(
          <div className="flex gap-1 bg-surface-100 p-1 rounded-xl">
            {[
              { key: 'all', label: 'All Events' },
              { key: 'pre', label: 'Upcoming' },
              { key: 'live', label: 'Live' },
              { key: 'post', label: 'Past' },
            ].map((option) => (
              <button
                key={option.key}
                onClick={() => setFilter(option.key as 'all' | 'pre' | 'live' | 'post')}
                className={cn(
                  'px-3 py-2 rounded-lg text-sm font-medium transition-colors',
                  filter === option.key
                    ? 'bg-white text-brand-900 shadow-sm'
                    : 'text-surface-700 hover:text-brand-900'
                )}
              >
                {option.label}
              </button>
            ))}
          </div>
        )}
        contentClassName="p-0"
      >
        {filteredEvents.length === 0 ? (
          <div className="text-center py-16 px-6">
            <div className="inline-flex items-center justify-center w-12 h-12 rounded-full bg-surface-100 mb-4">
              {Icons.calendar}
            </div>
            <p className="text-surface-600">No events found</p>
            <p className="text-sm text-surface-500 mt-1">
              {filter === 'all' ? 'You do not have any events yet' : `No ${filter === 'pre' ? 'upcoming' : filter === 'live' ? 'live' : 'past'} events`}
            </p>
          </div>
        ) : (
          <div className="p-4 space-y-3">
            {filteredEvents.map((event) => (
              <Link
                key={event.id}
                href={`/owner/events/${event.id}`}
                className="group block rounded-2xl border border-surface-200 bg-white px-5 py-4 shadow-soft hover:border-brand-200 hover:-translate-y-0.5 transition-all"
              >
                <div className="flex items-center justify-between gap-4">
                  <div className="flex-1 min-w-0">
                    <div className="flex flex-wrap items-center gap-3">
                      <h3 className="text-base font-semibold text-brand-900">{event.name}</h3>
                      <span
                        className={cn(
                          'inline-flex px-2 py-0.5 text-xs font-medium rounded border',
                          getPhaseStyle(event.currentPhase)
                        )}
                      >
                        {getPhaseLabel(event.currentPhase)}
                      </span>
                    </div>
                    <div className="flex items-center gap-4 mt-2 text-sm text-surface-600">
                      <span className="flex items-center">
                        {Icons.calendar}
                        <span className="ml-1">{formatDate(event.date)}</span>
                      </span>
                      {event.venue && (
                        <span className="flex items-center">
                          {Icons.location}
                          <span className="ml-1">{event.venue}</span>
                        </span>
                      )}
                    </div>
                    {event.approvalStatus ? (
                      <p className="text-xs text-surface-500 mt-1">Approval: {event.approvalStatus}</p>
                    ) : null}
                    {event.defaultCurrency ? (
                      <p className="text-xs text-surface-500 mt-1">Default currency: {event.defaultCurrency}</p>
                    ) : null}
                  </div>
                  <div className="flex items-center gap-6 ml-4">
                    <div className="text-right">
                      <p className="text-sm font-semibold text-brand-900">{event._count.rsvps}</p>
                      <p className="text-xs text-surface-500">RSVPs</p>
                    </div>
                    <div className="text-right">
                      <p className="text-sm font-semibold text-brand-900">{event._count.checkIns}</p>
                      <p className="text-xs text-surface-500">Check-ins</p>
                    </div>
                    <div className="text-right">
                      <p className="text-sm font-semibold text-brand-900">{event._count.mediaAssets}</p>
                      <p className="text-xs text-surface-500">Media</p>
                    </div>
                    <div className="text-surface-400 group-hover:text-brand-600 transition-colors">
                      {Icons.arrow}
                    </div>
                  </div>
                </div>
              </Link>
            ))}
          </div>
        )}
      </DashboardSection>
    </div>
  );
}

