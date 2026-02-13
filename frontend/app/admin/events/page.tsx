'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { eventsApi } from '@/lib/api';
import { formatDate, getPhaseLabel, cn } from '@/lib/utils';
import { DashboardPageHeader, DashboardSection } from '@/components/dashboard/ui';
import toast from 'react-hot-toast';

interface Event {
  id: string;
  slug: string;
  name: string;
  date: string;
  venue: string | null;
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
}

// Monochrome icons
const Icons = {
  plus: <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" /></svg>,
  calendar: <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" /></svg>,
  location: <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" /></svg>,
  external: <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" /></svg>,
  archive: <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 8h14M5 8a2 2 0 110-4h14a2 2 0 110 4M5 8v10a2 2 0 002 2h10a2 2 0 002-2V8m-9 4h4" /></svg>,
};

export default function EventsPage() {
  const [events, setEvents] = useState<Event[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<'all' | 'active' | 'archived'>('active');

  useEffect(() => {
    fetchEvents();
  }, [filter]);

  const fetchEvents = async () => {
    try {
      setLoading(true);
      const params: any = {};
      if (filter === 'active') params.archived = false;
      if (filter === 'archived') params.archived = true;
      
      const response = await eventsApi.list(params);
      setEvents(response.data.events);
    } catch (error) {
      toast.error('Failed to load events');
    } finally {
      setLoading(false);
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
      fetchEvents();
    } catch (error) {
      toast.error('Action failed');
    }
  };

  const getPhaseStyle = (phase: string) => {
    switch (phase) {
      case 'LIVE': return 'bg-emerald-50 text-emerald-700 border-emerald-200';
      case 'PRE_EVENT': return 'bg-sky-50 text-sky-700 border-sky-200';
      case 'POST_EVENT': return 'bg-surface-100 text-surface-600 border-surface-200';
      default: return 'bg-surface-100 text-surface-600 border-surface-200';
    }
  };

  const liveCount = events.filter((event) => event.currentPhase === 'LIVE').length;
  const archivedCount = events.filter((event) => event.isArchived).length;

  return (
    <div className="space-y-7">
      <DashboardPageHeader
        title="Events"
        subtitle="Manage lifecycle, status, and experience settings across all events"
        action={(
          <Link href="/admin/events/new" className="btn-primary">
            {Icons.plus}
            <span className="ml-2">New Event</span>
          </Link>
        )}
      />

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        <div className="card py-4">
          <p className="text-[11px] uppercase tracking-[0.12em] text-surface-500 font-semibold">Showing</p>
          <p className="text-2xl font-bold text-brand-900 mt-1">{events.length}</p>
        </div>
        <div className="card py-4">
          <p className="text-[11px] uppercase tracking-[0.12em] text-surface-500 font-semibold">Live In View</p>
          <p className="text-2xl font-bold text-brand-900 mt-1">{liveCount}</p>
        </div>
        <div className="card py-4">
          <p className="text-[11px] uppercase tracking-[0.12em] text-surface-500 font-semibold">Archived In View</p>
          <p className="text-2xl font-bold text-brand-900 mt-1">{archivedCount}</p>
        </div>
        <div className="card py-4">
          <p className="text-[11px] uppercase tracking-[0.12em] text-surface-500 font-semibold">Filter</p>
          <p className="text-lg font-semibold text-brand-900 mt-1 capitalize">{filter}</p>
        </div>
      </div>

      <DashboardSection
        title="Event List"
        subtitle="Open any event to manage pages, templates, metadata, media, and operations"
        action={(
          <div className="flex gap-1 bg-surface-100 p-1 rounded-xl">
            {(['active', 'archived', 'all'] as const).map((f) => (
              <button
                key={f}
                onClick={() => setFilter(f)}
                className={cn(
                  'px-4 py-2 rounded-lg text-sm font-medium transition-all',
                  filter === f ? 'bg-white text-brand-900 shadow-sm' : 'text-surface-600 hover:text-brand-900'
                )}
              >
                {f.charAt(0).toUpperCase() + f.slice(1)}
              </button>
            ))}
          </div>
        )}
        contentClassName="p-0"
      >
        {loading ? (
          <div className="flex items-center justify-center h-64">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-brand-900" />
          </div>
        ) : events.length === 0 ? (
          <div className="text-center py-16 px-6">
            <div className="w-12 h-12 mx-auto rounded-lg bg-surface-100 flex items-center justify-center text-surface-400 mb-4">
              {Icons.calendar}
            </div>
            <h3 className="text-lg font-semibold text-brand-900 mb-1">No events found</h3>
            <p className="text-surface-500 mb-4">
              {filter === 'archived' ? 'No archived events' : 'Get started by creating your first event'}
            </p>
            {filter !== 'archived' && (
              <Link href="/admin/events/new" className="btn-primary">Create Event</Link>
            )}
          </div>
        ) : (
          <div className="space-y-3 p-4">
            {events.map((event) => (
              <div key={event.id} className="rounded-2xl border border-surface-200 bg-white px-5 py-4 shadow-soft hover:border-brand-200 hover:-translate-y-0.5 transition-all">
                <div className="flex flex-col xl:flex-row xl:items-center gap-4">
                  <div className="flex-1 min-w-0">
                    <div className="flex flex-wrap items-center gap-2 mb-2">
                      <h3 className="text-lg font-semibold text-brand-900">{event.name}</h3>
                      <span className={cn('px-2 py-0.5 rounded border text-xs font-medium', getPhaseStyle(event.currentPhase))}>
                        {event.currentPhase === 'LIVE' && <span className="inline-block w-1.5 h-1.5 rounded-full bg-emerald-500 mr-1.5 animate-pulse" />}
                        {getPhaseLabel(event.currentPhase)}
                      </span>
                      {event.invitationOnly && (
                        <span className="px-2 py-0.5 rounded border text-xs font-medium bg-sky-50 text-sky-700 border-sky-200">Invite Only</span>
                      )}
                      {event.isArchived && (
                        <span className="px-2 py-0.5 rounded border text-xs font-medium bg-surface-100 text-surface-500 border-surface-200">Archived</span>
                      )}
                    </div>
                    <div className="flex flex-wrap items-center gap-4 text-sm text-surface-500">
                      <span className="flex items-center gap-1.5">
                        {Icons.calendar}
                        {formatDate(event.date, 'MMM d, yyyy')}
                      </span>
                      {event.venue && (
                        <span className="flex items-center gap-1.5">
                          {Icons.location}
                          {event.venue}
                        </span>
                      )}
                      <span className="text-surface-400 font-mono text-xs">/{event.slug}</span>
                    </div>
                  </div>

                  <div className="flex items-center gap-5 text-sm xl:border-l xl:border-surface-100 xl:pl-5">
                    <div className="text-center">
                      <p className="text-lg font-bold text-brand-900">{event._count.rsvps}</p>
                      <p className="text-surface-500 text-xs">RSVPs</p>
                    </div>
                    <div className="text-center">
                      <p className="text-lg font-bold text-brand-900">{event._count.checkIns}</p>
                      <p className="text-surface-500 text-xs">Check-ins</p>
                    </div>
                    <div className="text-center">
                      <p className="text-lg font-bold text-brand-900">{event._count.mediaAssets}</p>
                      <p className="text-surface-500 text-xs">Media</p>
                    </div>
                  </div>

                  <div className="flex items-center gap-2">
                    <Link href={`/admin/events/${event.id}`} className="btn-primary">Manage</Link>
                    <Link href={`/e/${event.slug}`} target="_blank" className="btn-ghost hover:text-brand-900" title="View public page">
                      {Icons.external}
                    </Link>
                    <button onClick={() => handleArchive(event.id, !event.isArchived)} className="btn-ghost hover:text-brand-900" title={event.isArchived ? 'Restore' : 'Archive'}>
                      {Icons.archive}
                    </button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </DashboardSection>
    </div>
  );
}
