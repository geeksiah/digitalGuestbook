'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { eventsApi } from '@/lib/api';
import { formatDate, getPhaseLabel, getStatusColor, cn } from '@/lib/utils';
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

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-display font-bold text-navy-900">Events</h1>
          <p className="text-surface-600 mt-1">Manage your events and their settings</p>
        </div>
        <Link href="/admin/events/new" className="btn-primary">
          <svg className="w-4 h-4 mr-2" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
          </svg>
          New Event
        </Link>
      </div>

      {/* Filters */}
      <div className="flex gap-2">
        {(['active', 'archived', 'all'] as const).map((f) => (
          <button
            key={f}
            onClick={() => setFilter(f)}
            className={cn(
              'px-4 py-2 rounded-lg text-sm font-medium transition-colors',
              filter === f
                ? 'bg-navy-900 text-white'
                : 'bg-surface-100 text-surface-600 hover:bg-surface-200'
            )}
          >
            {f.charAt(0).toUpperCase() + f.slice(1)}
          </button>
        ))}
      </div>

      {/* Events Grid */}
      {loading ? (
        <div className="flex items-center justify-center h-64">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary-500" />
        </div>
      ) : events.length === 0 ? (
        <div className="card text-center py-12">
          <svg className="w-12 h-12 mx-auto text-surface-400 mb-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
          </svg>
          <h3 className="text-lg font-medium text-navy-900 mb-1">No events found</h3>
          <p className="text-surface-600 mb-4">
            {filter === 'archived' ? 'No archived events' : 'Get started by creating your first event'}
          </p>
          {filter !== 'archived' && (
            <Link href="/admin/events/new" className="btn-primary">Create Event</Link>
          )}
        </div>
      ) : (
        <div className="grid gap-4">
          {events.map((event) => (
            <div key={event.id} className="card hover:shadow-lg transition-shadow">
              <div className="flex flex-col lg:flex-row lg:items-center gap-4">
                {/* Event Info */}
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-3 mb-2">
                    <h3 className="text-lg font-semibold text-navy-900 truncate">
                      {event.name}
                    </h3>
                    <span className={getStatusColor(event.currentPhase)}>
                      {getPhaseLabel(event.currentPhase)}
                    </span>
                    {event.invitationOnly && (
                      <span className="badge-info">Invite Only</span>
                    )}
                    {event.isArchived && (
                      <span className="badge-neutral">Archived</span>
                    )}
                  </div>
                  <div className="flex flex-wrap items-center gap-4 text-sm text-surface-600">
                    <span className="flex items-center">
                      <svg className="w-4 h-4 mr-1.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
                      </svg>
                      {formatDate(event.date, 'MMM d, yyyy')}
                    </span>
                    {event.venue && (
                      <span className="flex items-center">
                        <svg className="w-4 h-4 mr-1.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" />
                        </svg>
                        {event.venue}
                      </span>
                    )}
                    <span className="text-surface-400">/{event.slug}</span>
                  </div>
                </div>

                {/* Stats */}
                <div className="flex items-center gap-6 text-sm">
                  <div className="text-center">
                    <p className="text-2xl font-bold text-navy-900">{event._count.rsvps}</p>
                    <p className="text-surface-500">RSVPs</p>
                  </div>
                  <div className="text-center">
                    <p className="text-2xl font-bold text-navy-900">{event._count.checkIns}</p>
                    <p className="text-surface-500">Check-ins</p>
                  </div>
                  <div className="text-center">
                    <p className="text-2xl font-bold text-navy-900">{event._count.mediaAssets}</p>
                    <p className="text-surface-500">Media</p>
                  </div>
                </div>

                {/* Actions */}
                <div className="flex items-center gap-2">
                  <Link
                    href={`/admin/events/${event.id}`}
                    className="btn-primary"
                  >
                    Manage
                  </Link>
                  <Link
                    href={`/e/${event.slug}`}
                    target="_blank"
                    className="btn-ghost"
                    title="View public page"
                  >
                    <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" />
                    </svg>
                  </Link>
                  <button
                    onClick={() => handleArchive(event.id, !event.isArchived)}
                    className="btn-ghost"
                    title={event.isArchived ? 'Restore' : 'Archive'}
                  >
                    <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 8h14M5 8a2 2 0 110-4h14a2 2 0 110 4M5 8v10a2 2 0 002 2h10a2 2 0 002-2V8m-9 4h4" />
                    </svg>
                  </button>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
