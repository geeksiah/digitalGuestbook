'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { ownerDashboardApi } from '@/lib/api';
import { formatDate, cn } from '@/lib/utils';
import toast from 'react-hot-toast';

interface Event {
  id: string;
  name: string;
  slug: string;
  date: string;
  venue: string | null;
  currentPhase: string;
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

  if (loading) {
    return (
      <div className="text-center py-12">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-navy-900 mx-auto" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-navy-900">Events</h1>
          <p className="text-surface-600 mt-1">Manage and track your events</p>
        </div>
      </div>

      {/* Filters */}
      <div className="flex gap-2">
        <button
          onClick={() => setFilter('all')}
          className={cn(
            'px-4 py-2 rounded-lg text-sm font-medium transition-colors',
            filter === 'all'
              ? 'bg-navy-900 text-white'
              : 'bg-surface-100 text-surface-700 hover:bg-surface-200'
          )}
        >
          All Events
        </button>
        <button
          onClick={() => setFilter('pre')}
          className={cn(
            'px-4 py-2 rounded-lg text-sm font-medium transition-colors',
            filter === 'pre'
              ? 'bg-navy-900 text-white'
              : 'bg-surface-100 text-surface-700 hover:bg-surface-200'
          )}
        >
          Upcoming
        </button>
        <button
          onClick={() => setFilter('live')}
          className={cn(
            'px-4 py-2 rounded-lg text-sm font-medium transition-colors',
            filter === 'live'
              ? 'bg-navy-900 text-white'
              : 'bg-surface-100 text-surface-700 hover:bg-surface-200'
          )}
        >
          Live
        </button>
        <button
          onClick={() => setFilter('post')}
          className={cn(
            'px-4 py-2 rounded-lg text-sm font-medium transition-colors',
            filter === 'post'
              ? 'bg-navy-900 text-white'
              : 'bg-surface-100 text-surface-700 hover:bg-surface-200'
          )}
        >
          Past
        </button>
      </div>

      {/* Events List */}
      {filteredEvents.length === 0 ? (
        <div className="bg-white rounded-lg border border-surface-200 p-12 text-center">
          <div className="inline-flex items-center justify-center w-12 h-12 rounded-full bg-surface-100 mb-4">
            {Icons.calendar}
          </div>
          <p className="text-surface-600">No events found</p>
          <p className="text-sm text-surface-500 mt-1">
            {filter === 'all' ? 'You don\'t have any events yet' : `No ${filter === 'pre' ? 'upcoming' : filter === 'live' ? 'live' : 'past'} events`}
          </p>
        </div>
      ) : (
        <div className="bg-white rounded-lg border border-surface-200 overflow-hidden">
          <div className="divide-y divide-surface-200">
            {filteredEvents.map((event) => (
              <Link
                key={event.id}
                href={`/owner/events/${event.id}`}
                className="block px-6 py-4 hover:bg-surface-50 transition-colors"
              >
                <div className="flex items-center justify-between">
                  <div className="flex-1">
                    <div className="flex items-center gap-3">
                      <h3 className="text-base font-semibold text-navy-900">{event.name}</h3>
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
                  </div>
                  <div className="flex items-center gap-6 ml-4">
                    <div className="text-right">
                      <p className="text-sm font-medium text-navy-900">{event._count.rsvps}</p>
                      <p className="text-xs text-surface-500">RSVPs</p>
                    </div>
                    <div className="text-right">
                      <p className="text-sm font-medium text-navy-900">{event._count.checkIns}</p>
                      <p className="text-xs text-surface-500">Check-ins</p>
                    </div>
                    <div className="text-right">
                      <p className="text-sm font-medium text-navy-900">{event._count.mediaAssets}</p>
                      <p className="text-xs text-surface-500">Media</p>
                    </div>
                    <div className="text-surface-400">
                      {Icons.arrow}
                    </div>
                  </div>
                </div>
              </Link>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

