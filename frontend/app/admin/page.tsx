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
  _count: {
    rsvps: number;
    invitations: number;
    checkIns: number;
    mediaAssets: number;
  };
}

interface DashboardStats {
  totalEvents: number;
  activeEvents: number;
  totalRsvps: number;
  pendingRsvps: number;
  totalMedia: number;
}

// Monochrome icons
const Icons = {
  calendar: <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" /></svg>,
  live: <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M5.636 18.364a9 9 0 010-12.728m12.728 0a9 9 0 010 12.728m-9.9-2.829a5 5 0 010-7.07m7.072 0a5 5 0 010 7.07M13 12a1 1 0 11-2 0 1 1 0 012 0z" /></svg>,
  users: <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M12 4.354a4 4 0 110 5.292M15 21H3v-1a6 6 0 0112 0v1zm0 0h6v-1a6 6 0 00-9-5.197M13 7a4 4 0 11-8 0 4 4 0 018 0z" /></svg>,
  media: <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M15 10l4.553-2.276A1 1 0 0121 8.618v6.764a1 1 0 01-1.447.894L15 14M5 18h8a2 2 0 002-2V8a2 2 0 00-2-2H5a2 2 0 00-2 2v8a2 2 0 002 2z" /></svg>,
  plus: <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" /></svg>,
  template: <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M4 5a1 1 0 011-1h14a1 1 0 011 1v2a1 1 0 01-1 1H5a1 1 0 01-1-1V5zM4 13a1 1 0 011-1h6a1 1 0 011 1v6a1 1 0 01-1 1H5a1 1 0 01-1-1v-6zM16 13a1 1 0 011-1h2a1 1 0 011 1v6a1 1 0 01-1 1h-2a1 1 0 01-1-1v-6z" /></svg>,
  arrow: <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" /></svg>,
};

export default function AdminDashboard() {
  const [events, setEvents] = useState<Event[]>([]);
  const [stats, setStats] = useState<DashboardStats | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchData();
  }, []);

  const fetchData = async () => {
    try {
      const response = await eventsApi.list({ archived: false });
      setEvents(response.data.events);
      
      const totalEvents = response.data.events.length;
      const activeEvents = response.data.events.filter((e: Event) => e.currentPhase === 'LIVE').length;
      const totalRsvps = response.data.events.reduce((sum: number, e: Event) => sum + e._count.rsvps, 0);
      const totalMedia = response.data.events.reduce((sum: number, e: Event) => sum + e._count.mediaAssets, 0);

      setStats({ totalEvents, activeEvents, totalRsvps, pendingRsvps: 0, totalMedia });
    } catch (error) {
      toast.error('Failed to load dashboard data');
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-navy-900" />
      </div>
    );
  }

  return (
    <div className="space-y-8">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-display font-bold text-navy-900">Dashboard</h1>
        <p className="text-surface-500 mt-1">Overview of your events and activity</p>
      </div>

      {/* Stats Grid */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {[
          { label: 'Total Events', value: stats?.totalEvents || 0, icon: Icons.calendar },
          { label: 'Live Events', value: stats?.activeEvents || 0, icon: Icons.live },
          { label: 'Total RSVPs', value: stats?.totalRsvps || 0, icon: Icons.users },
          { label: 'Media Captured', value: stats?.totalMedia || 0, icon: Icons.media },
        ].map((stat, i) => (
          <div key={i} className="bg-white rounded-xl border border-surface-200 p-5 hover:border-surface-300 transition-colors">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-surface-500 mb-1">{stat.label}</p>
                <p className="text-2xl font-bold text-navy-900">{stat.value}</p>
              </div>
              <div className="w-10 h-10 rounded-lg bg-surface-100 flex items-center justify-center text-surface-500">
                {stat.icon}
              </div>
            </div>
          </div>
        ))}
      </div>

      {/* Recent Events */}
      <div className="bg-white rounded-xl border border-surface-200 overflow-hidden">
        <div className="flex items-center justify-between px-6 py-4 border-b border-surface-100">
          <h2 className="text-lg font-semibold text-navy-900">Recent Events</h2>
          <Link href="/admin/events" className="text-sm text-surface-500 hover:text-navy-900 font-medium flex items-center gap-1 transition-colors">
            View All {Icons.arrow}
          </Link>
        </div>

        {events.length === 0 ? (
          <div className="text-center py-16">
            <div className="w-12 h-12 mx-auto rounded-lg bg-surface-100 flex items-center justify-center text-surface-400 mb-4">
              {Icons.calendar}
            </div>
            <h3 className="text-lg font-medium text-navy-900 mb-1">No events yet</h3>
            <p className="text-surface-500 mb-4">Get started by creating your first event</p>
            <Link href="/admin/events/new" className="btn-primary">Create Event</Link>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="bg-surface-50 border-b border-surface-100">
                  <th className="text-left py-3 px-4 text-xs font-medium text-surface-500 uppercase tracking-wider">Event</th>
                  <th className="text-left py-3 px-4 text-xs font-medium text-surface-500 uppercase tracking-wider">Date</th>
                  <th className="text-left py-3 px-4 text-xs font-medium text-surface-500 uppercase tracking-wider">Phase</th>
                  <th className="text-left py-3 px-4 text-xs font-medium text-surface-500 uppercase tracking-wider">RSVPs</th>
                  <th className="text-left py-3 px-4 text-xs font-medium text-surface-500 uppercase tracking-wider">Media</th>
                  <th className="text-right py-3 px-4 text-xs font-medium text-surface-500 uppercase tracking-wider">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-surface-100">
                {events.slice(0, 5).map((event) => (
                  <tr key={event.id} className="hover:bg-surface-50 transition-colors">
                    <td className="py-4 px-4">
                      <div>
                        <p className="font-medium text-navy-900">{event.name}</p>
                        <p className="text-sm text-surface-400">/{event.slug}</p>
                      </div>
                    </td>
                    <td className="py-4 px-4 text-surface-600">{formatDate(event.date, 'MMM d, yyyy')}</td>
                    <td className="py-4 px-4">
                      <span className={cn(
                        'px-2 py-1 rounded text-xs font-medium',
                        event.currentPhase === 'LIVE' ? 'bg-emerald-50 text-emerald-700' :
                        event.currentPhase === 'PRE_EVENT' ? 'bg-sky-50 text-sky-700' :
                        'bg-surface-100 text-surface-600'
                      )}>
                        {event.currentPhase === 'LIVE' && <span className="inline-block w-1.5 h-1.5 rounded-full bg-emerald-500 mr-1.5 animate-pulse" />}
                        {getPhaseLabel(event.currentPhase)}
                      </span>
                    </td>
                    <td className="py-4 px-4 text-surface-600">{event._count.rsvps}</td>
                    <td className="py-4 px-4 text-surface-600">{event._count.mediaAssets}</td>
                    <td className="py-4 px-4 text-right">
                      <Link href={`/admin/events/${event.id}`} className="text-navy-900 hover:text-navy-700 font-medium text-sm">Manage</Link>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Quick Links */}
      <div className="grid md:grid-cols-3 gap-4">
        <Link href="/admin/events/new" className="bg-white rounded-xl border border-surface-200 p-5 hover:border-surface-300 hover:shadow-sm transition-all group">
          <div className="flex items-center">
            <div className="w-12 h-12 rounded-xl bg-surface-100 flex items-center justify-center text-surface-500 group-hover:bg-navy-900 group-hover:text-white transition-colors">
              {Icons.plus}
            </div>
            <div className="ml-4">
              <p className="font-medium text-navy-900">Create Event</p>
              <p className="text-sm text-surface-500">Set up a new event</p>
            </div>
          </div>
        </Link>

        <Link href="/admin/templates" className="bg-white rounded-xl border border-surface-200 p-5 hover:border-surface-300 hover:shadow-sm transition-all group">
          <div className="flex items-center">
            <div className="w-12 h-12 rounded-xl bg-surface-100 flex items-center justify-center text-surface-500 group-hover:bg-navy-900 group-hover:text-white transition-colors">
              {Icons.template}
            </div>
            <div className="ml-4">
              <p className="font-medium text-navy-900">Manage Templates</p>
              <p className="text-sm text-surface-500">Customize page designs</p>
            </div>
          </div>
        </Link>

        <Link href="/admin/events" className="bg-white rounded-xl border border-surface-200 p-5 hover:border-surface-300 hover:shadow-sm transition-all group">
          <div className="flex items-center">
            <div className="w-12 h-12 rounded-xl bg-surface-100 flex items-center justify-center text-surface-500 group-hover:bg-navy-900 group-hover:text-white transition-colors">
              {Icons.calendar}
            </div>
            <div className="ml-4">
              <p className="font-medium text-navy-900">All Events</p>
              <p className="text-sm text-surface-500">View and manage events</p>
            </div>
          </div>
        </Link>
      </div>
    </div>
  );
}
