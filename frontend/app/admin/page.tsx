'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { eventsApi } from '@/lib/api';
import { formatDate, getPhaseLabel, getStatusColor } from '@/lib/utils';
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
      
      // Calculate stats from events
      const totalEvents = response.data.events.length;
      const activeEvents = response.data.events.filter(
        (e: Event) => e.currentPhase === 'LIVE'
      ).length;
      const totalRsvps = response.data.events.reduce(
        (sum: number, e: Event) => sum + e._count.rsvps,
        0
      );
      const totalMedia = response.data.events.reduce(
        (sum: number, e: Event) => sum + e._count.mediaAssets,
        0
      );

      setStats({
        totalEvents,
        activeEvents,
        totalRsvps,
        pendingRsvps: 0, // Would need separate API call
        totalMedia,
      });
    } catch (error) {
      toast.error('Failed to load dashboard data');
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary-500" />
      </div>
    );
  }

  return (
    <div className="space-y-8">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-display font-bold text-navy-900">
          Dashboard
        </h1>
        <p className="text-surface-600 mt-1">
          Overview of your events and activity
        </p>
      </div>

      {/* Stats Grid */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {[
          {
            label: 'Total Events',
            value: stats?.totalEvents || 0,
            icon: (
              <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
              </svg>
            ),
            color: 'bg-blue-500',
          },
          {
            label: 'Live Events',
            value: stats?.activeEvents || 0,
            icon: (
              <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5.636 18.364a9 9 0 010-12.728m12.728 0a9 9 0 010 12.728m-9.9-2.829a5 5 0 010-7.07m7.072 0a5 5 0 010 7.07M13 12a1 1 0 11-2 0 1 1 0 012 0z" />
              </svg>
            ),
            color: 'bg-green-500',
          },
          {
            label: 'Total RSVPs',
            value: stats?.totalRsvps || 0,
            icon: (
              <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z" />
              </svg>
            ),
            color: 'bg-purple-500',
          },
          {
            label: 'Media Captured',
            value: stats?.totalMedia || 0,
            icon: (
              <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 10l4.553-2.276A1 1 0 0121 8.618v6.764a1 1 0 01-1.447.894L15 14M5 18h8a2 2 0 002-2V8a2 2 0 00-2-2H5a2 2 0 00-2 2v8a2 2 0 002 2z" />
              </svg>
            ),
            color: 'bg-orange-500',
          },
        ].map((stat, i) => (
          <div key={i} className="card">
            <div className="flex items-center">
              <div className={`w-10 h-10 rounded-lg ${stat.color} flex items-center justify-center text-white`}>
                {stat.icon}
              </div>
              <div className="ml-4">
                <p className="text-2xl font-bold text-navy-900">{stat.value}</p>
                <p className="text-sm text-surface-600">{stat.label}</p>
              </div>
            </div>
          </div>
        ))}
      </div>

      {/* Recent Events */}
      <div className="card">
        <div className="flex items-center justify-between mb-6">
          <h2 className="text-lg font-semibold text-navy-900">Recent Events</h2>
          <Link href="/admin/events" className="text-sm text-primary-600 hover:text-primary-700 font-medium">
            View All →
          </Link>
        </div>

        {events.length === 0 ? (
          <div className="text-center py-12">
            <svg className="w-12 h-12 mx-auto text-surface-400 mb-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
            </svg>
            <h3 className="text-lg font-medium text-navy-900 mb-1">No events yet</h3>
            <p className="text-surface-600 mb-4">Get started by creating your first event</p>
            <Link href="/admin/events/new" className="btn-primary">
              Create Event
            </Link>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="border-b border-surface-200">
                  <th className="text-left py-3 px-4 text-sm font-medium text-surface-600">Event</th>
                  <th className="text-left py-3 px-4 text-sm font-medium text-surface-600">Date</th>
                  <th className="text-left py-3 px-4 text-sm font-medium text-surface-600">Phase</th>
                  <th className="text-left py-3 px-4 text-sm font-medium text-surface-600">RSVPs</th>
                  <th className="text-left py-3 px-4 text-sm font-medium text-surface-600">Media</th>
                  <th className="text-right py-3 px-4 text-sm font-medium text-surface-600">Actions</th>
                </tr>
              </thead>
              <tbody>
                {events.slice(0, 5).map((event) => (
                  <tr key={event.id} className="border-b border-surface-100 hover:bg-surface-50">
                    <td className="py-4 px-4">
                      <div>
                        <p className="font-medium text-navy-900">{event.name}</p>
                        <p className="text-sm text-surface-500">/{event.slug}</p>
                      </div>
                    </td>
                    <td className="py-4 px-4 text-surface-600">
                      {formatDate(event.date, 'MMM d, yyyy')}
                    </td>
                    <td className="py-4 px-4">
                      <span className={getStatusColor(event.currentPhase)}>
                        {getPhaseLabel(event.currentPhase)}
                      </span>
                    </td>
                    <td className="py-4 px-4 text-surface-600">
                      {event._count.rsvps}
                    </td>
                    <td className="py-4 px-4 text-surface-600">
                      {event._count.mediaAssets}
                    </td>
                    <td className="py-4 px-4 text-right">
                      <Link
                        href={`/admin/events/${event.id}`}
                        className="text-primary-600 hover:text-primary-700 font-medium text-sm"
                      >
                        Manage
                      </Link>
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
        <Link href="/admin/events/new" className="card hover:shadow-lg transition-shadow group">
          <div className="flex items-center">
            <div className="w-12 h-12 rounded-xl bg-primary-500/10 flex items-center justify-center text-primary-500 group-hover:bg-primary-500 group-hover:text-white transition-colors">
              <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
              </svg>
            </div>
            <div className="ml-4">
              <p className="font-medium text-navy-900">Create Event</p>
              <p className="text-sm text-surface-500">Set up a new event</p>
            </div>
          </div>
        </Link>

        <Link href="/admin/templates" className="card hover:shadow-lg transition-shadow group">
          <div className="flex items-center">
            <div className="w-12 h-12 rounded-xl bg-blue-500/10 flex items-center justify-center text-blue-500 group-hover:bg-blue-500 group-hover:text-white transition-colors">
              <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 5a1 1 0 011-1h14a1 1 0 011 1v2a1 1 0 01-1 1H5a1 1 0 01-1-1V5zM4 13a1 1 0 011-1h6a1 1 0 011 1v6a1 1 0 01-1 1H5a1 1 0 01-1-1v-6zM16 13a1 1 0 011-1h2a1 1 0 011 1v6a1 1 0 01-1 1h-2a1 1 0 01-1-1v-6z" />
              </svg>
            </div>
            <div className="ml-4">
              <p className="font-medium text-navy-900">Manage Templates</p>
              <p className="text-sm text-surface-500">Customize page designs</p>
            </div>
          </div>
        </Link>

        <a
          href="https://github.com/geeksiah/digitalGuestbook"
          target="_blank"
          rel="noopener noreferrer"
          className="card hover:shadow-lg transition-shadow group"
        >
          <div className="flex items-center">
            <div className="w-12 h-12 rounded-xl bg-surface-200 flex items-center justify-center text-surface-600 group-hover:bg-navy-900 group-hover:text-white transition-colors">
              <svg className="w-6 h-6" fill="currentColor" viewBox="0 0 24 24">
                <path fillRule="evenodd" d="M12 2C6.477 2 2 6.484 2 12.017c0 4.425 2.865 8.18 6.839 9.504.5.092.682-.217.682-.483 0-.237-.008-.868-.013-1.703-2.782.605-3.369-1.343-3.369-1.343-.454-1.158-1.11-1.466-1.11-1.466-.908-.62.069-.608.069-.608 1.003.07 1.531 1.032 1.531 1.032.892 1.53 2.341 1.088 2.91.832.092-.647.35-1.088.636-1.338-2.22-.253-4.555-1.113-4.555-4.951 0-1.093.39-1.988 1.029-2.688-.103-.253-.446-1.272.098-2.65 0 0 .84-.27 2.75 1.026A9.564 9.564 0 0112 6.844c.85.004 1.705.115 2.504.337 1.909-1.296 2.747-1.027 2.747-1.027.546 1.379.202 2.398.1 2.651.64.7 1.028 1.595 1.028 2.688 0 3.848-2.339 4.695-4.566 4.943.359.309.678.92.678 1.855 0 1.338-.012 2.419-.012 2.747 0 .268.18.58.688.482A10.019 10.019 0 0022 12.017C22 6.484 17.522 2 12 2z" clipRule="evenodd" />
              </svg>
            </div>
            <div className="ml-4">
              <p className="font-medium text-navy-900">Documentation</p>
              <p className="text-sm text-surface-500">View on GitHub</p>
            </div>
          </div>
        </a>
      </div>
    </div>
  );
}
