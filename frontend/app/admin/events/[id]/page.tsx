'use client';

import { useEffect, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import Link from 'next/link';
import { eventsApi, rsvpApi, checkInApi, mediaApi } from '@/lib/api';
import { formatDate, getPhaseLabel, getStatusColor, cn, copyToClipboard } from '@/lib/utils';
import toast from 'react-hot-toast';

interface Event {
  id: string;
  slug: string;
  name: string;
  description: string | null;
  date: string;
  endDate: string | null;
  venue: string | null;
  phase: string;
  currentPhase: string;
  phaseOverride: boolean;
  invitationOnly: boolean;
  coupleAccessToken: string;
  invitationEnabled: boolean;
  rsvpEnabled: boolean;
  guestbookEnabled: boolean;
  checkInEnabled: boolean;
  _count: {
    rsvps: number;
    invitations: number;
    checkIns: number;
    mediaAssets: number;
  };
}

interface RSVP {
  id: string;
  primaryName: string;
  secondaryName: string | null;
  email: string | null;
  attendance: string;
  guestCount: number;
  status: string;
  submittedAt: string;
  invitation?: {
    id: string;
    accessCode: string;
    isCheckedIn: boolean;
  } | null;
}

type Tab = 'overview' | 'rsvps' | 'checkin' | 'media' | 'settings';

export default function EventDetailPage() {
  const params = useParams();
  const router = useRouter();
  const eventId = params.id as string;
  
  const [event, setEvent] = useState<Event | null>(null);
  const [rsvps, setRsvps] = useState<RSVP[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<Tab>('overview');
  const [rsvpFilter, setRsvpFilter] = useState<string>('all');

  useEffect(() => {
    fetchEvent();
  }, [eventId]);

  useEffect(() => {
    if (activeTab === 'rsvps') {
      fetchRsvps();
    }
  }, [activeTab, rsvpFilter]);

  const fetchEvent = async () => {
    try {
      const response = await eventsApi.get(eventId);
      setEvent(response.data.event);
    } catch (error) {
      toast.error('Failed to load event');
      router.push('/admin/events');
    } finally {
      setLoading(false);
    }
  };

  const fetchRsvps = async () => {
    try {
      const params: any = {};
      if (rsvpFilter !== 'all') params.status = rsvpFilter;
      const response = await rsvpApi.list(eventId, params);
      setRsvps(response.data.rsvps);
    } catch (error) {
      toast.error('Failed to load RSVPs');
    }
  };

  const handlePhaseChange = async (phase: string) => {
    try {
      await eventsApi.setPhase(eventId, phase, true);
      toast.success(`Phase changed to ${getPhaseLabel(phase)}`);
      fetchEvent();
    } catch (error) {
      toast.error('Failed to change phase');
    }
  };

  const handleReviewRsvp = async (rsvpId: string, status: 'APPROVED' | 'REJECTED') => {
    try {
      await rsvpApi.review(rsvpId, status);
      toast.success(`RSVP ${status.toLowerCase()}`);
      fetchRsvps();
      fetchEvent();
    } catch (error: any) {
      toast.error(error.response?.data?.error || 'Action failed');
    }
  };

  const handleCopyLink = async (path: string) => {
    const url = `${window.location.origin}${path}`;
    const success = await copyToClipboard(url);
    if (success) {
      toast.success('Link copied!');
    }
  };

  if (loading || !event) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary-500" />
      </div>
    );
  }

  const tabs: { id: Tab; label: string; count?: number }[] = [
    { id: 'overview', label: 'Overview' },
    { id: 'rsvps', label: 'RSVPs', count: event._count.rsvps },
    { id: 'checkin', label: 'Check-In', count: event._count.checkIns },
    { id: 'media', label: 'Media', count: event._count.mediaAssets },
    { id: 'settings', label: 'Settings' },
  ];

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4">
        <div>
          <Link
            href="/admin/events"
            className="inline-flex items-center text-surface-600 hover:text-navy-900 mb-2"
          >
            <svg className="w-4 h-4 mr-1" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
            </svg>
            Events
          </Link>
          <h1 className="text-2xl font-display font-bold text-navy-900">{event.name}</h1>
          <div className="flex items-center gap-3 mt-2">
            <span className={getStatusColor(event.currentPhase)}>
              {getPhaseLabel(event.currentPhase)}
            </span>
            {event.phaseOverride && (
              <span className="text-xs text-surface-500">(Manual Override)</span>
            )}
            {event.invitationOnly && (
              <span className="badge-info">Invite Only</span>
            )}
          </div>
        </div>

        <div className="flex items-center gap-2">
          <Link
            href={`/e/${event.slug}`}
            target="_blank"
            className="btn-outline"
          >
            <svg className="w-4 h-4 mr-2" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" />
            </svg>
            View Public Page
          </Link>
        </div>
      </div>

      {/* Tabs */}
      <div className="border-b border-surface-200">
        <nav className="flex gap-6 -mb-px">
          {tabs.map((tab) => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={cn(
                'pb-3 text-sm font-medium border-b-2 transition-colors',
                activeTab === tab.id
                  ? 'border-primary-500 text-primary-600'
                  : 'border-transparent text-surface-600 hover:text-navy-900'
              )}
            >
              {tab.label}
              {tab.count !== undefined && (
                <span className="ml-2 px-2 py-0.5 rounded-full bg-surface-100 text-xs">
                  {tab.count}
                </span>
              )}
            </button>
          ))}
        </nav>
      </div>

      {/* Tab Content */}
      {activeTab === 'overview' && (
        <div className="grid lg:grid-cols-3 gap-6">
          {/* Stats */}
          <div className="lg:col-span-2 grid sm:grid-cols-2 gap-4">
            <div className="card">
              <p className="text-sm text-surface-600 mb-1">Total RSVPs</p>
              <p className="text-3xl font-bold text-navy-900">{event._count.rsvps}</p>
            </div>
            <div className="card">
              <p className="text-sm text-surface-600 mb-1">Invitations Sent</p>
              <p className="text-3xl font-bold text-navy-900">{event._count.invitations}</p>
            </div>
            <div className="card">
              <p className="text-sm text-surface-600 mb-1">Checked In</p>
              <p className="text-3xl font-bold text-navy-900">{event._count.checkIns}</p>
            </div>
            <div className="card">
              <p className="text-sm text-surface-600 mb-1">Media Captured</p>
              <p className="text-3xl font-bold text-navy-900">{event._count.mediaAssets}</p>
            </div>
          </div>

          {/* Quick Actions */}
          <div className="space-y-4">
            <div className="card">
              <h3 className="font-semibold text-navy-900 mb-4">Phase Control</h3>
              <div className="space-y-2">
                {(['PRE_EVENT', 'LIVE', 'POST_EVENT'] as const).map((phase) => (
                  <button
                    key={phase}
                    onClick={() => handlePhaseChange(phase)}
                    disabled={event.currentPhase === phase}
                    className={cn(
                      'w-full px-4 py-2 rounded-lg text-sm font-medium transition-colors',
                      event.currentPhase === phase
                        ? 'bg-primary-500 text-navy-900'
                        : 'bg-surface-100 text-surface-700 hover:bg-surface-200'
                    )}
                  >
                    {getPhaseLabel(phase)}
                  </button>
                ))}
              </div>
            </div>

            <div className="card">
              <h3 className="font-semibold text-navy-900 mb-4">Quick Links</h3>
              <div className="space-y-2 text-sm">
                <button
                  onClick={() => handleCopyLink(`/e/${event.slug}`)}
                  className="w-full text-left p-2 rounded hover:bg-surface-50 flex items-center justify-between"
                >
                  <span>Invitation Page</span>
                  <svg className="w-4 h-4 text-surface-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z" />
                  </svg>
                </button>
                <button
                  onClick={() => handleCopyLink(`/e/${event.slug}/rsvp`)}
                  className="w-full text-left p-2 rounded hover:bg-surface-50 flex items-center justify-between"
                >
                  <span>RSVP Form</span>
                  <svg className="w-4 h-4 text-surface-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z" />
                  </svg>
                </button>
                <button
                  onClick={() => handleCopyLink(`/couple/${event.coupleAccessToken}`)}
                  className="w-full text-left p-2 rounded hover:bg-surface-50 flex items-center justify-between"
                >
                  <span>Couple Portal</span>
                  <svg className="w-4 h-4 text-surface-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z" />
                  </svg>
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {activeTab === 'rsvps' && (
        <div className="space-y-4">
          {/* Filters */}
          <div className="flex gap-2">
            {['all', 'PENDING', 'APPROVED', 'REJECTED'].map((status) => (
              <button
                key={status}
                onClick={() => setRsvpFilter(status)}
                className={cn(
                  'px-3 py-1.5 rounded-lg text-sm font-medium transition-colors',
                  rsvpFilter === status
                    ? 'bg-navy-900 text-white'
                    : 'bg-surface-100 text-surface-600 hover:bg-surface-200'
                )}
              >
                {status === 'all' ? 'All' : status.charAt(0) + status.slice(1).toLowerCase()}
              </button>
            ))}
          </div>

          {/* RSVP List */}
          <div className="card overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr className="border-b border-surface-200 bg-surface-50">
                    <th className="text-left py-3 px-4 text-sm font-medium text-surface-600">Guest</th>
                    <th className="text-left py-3 px-4 text-sm font-medium text-surface-600">Response</th>
                    <th className="text-left py-3 px-4 text-sm font-medium text-surface-600">Guests</th>
                    <th className="text-left py-3 px-4 text-sm font-medium text-surface-600">Status</th>
                    <th className="text-left py-3 px-4 text-sm font-medium text-surface-600">Submitted</th>
                    <th className="text-right py-3 px-4 text-sm font-medium text-surface-600">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {rsvps.length === 0 ? (
                    <tr>
                      <td colSpan={6} className="py-12 text-center text-surface-500">
                        No RSVPs found
                      </td>
                    </tr>
                  ) : (
                    rsvps.map((rsvp) => (
                      <tr key={rsvp.id} className="border-b border-surface-100 hover:bg-surface-50">
                        <td className="py-3 px-4">
                          <p className="font-medium text-navy-900">{rsvp.primaryName}</p>
                          {rsvp.secondaryName && (
                            <p className="text-sm text-surface-500">& {rsvp.secondaryName}</p>
                          )}
                          {rsvp.email && (
                            <p className="text-xs text-surface-400">{rsvp.email}</p>
                          )}
                        </td>
                        <td className="py-3 px-4">
                          <span className={getStatusColor(rsvp.attendance)}>
                            {rsvp.attendance}
                          </span>
                        </td>
                        <td className="py-3 px-4 text-surface-600">{rsvp.guestCount}</td>
                        <td className="py-3 px-4">
                          <span className={getStatusColor(rsvp.status)}>
                            {rsvp.status}
                          </span>
                          {rsvp.invitation?.isCheckedIn && (
                            <span className="ml-2 text-xs text-green-600">✓ Checked In</span>
                          )}
                        </td>
                        <td className="py-3 px-4 text-sm text-surface-500">
                          {formatDate(rsvp.submittedAt, 'MMM d, h:mm a')}
                        </td>
                        <td className="py-3 px-4 text-right">
                          {rsvp.status === 'PENDING' && (
                            <div className="flex justify-end gap-2">
                              <button
                                onClick={() => handleReviewRsvp(rsvp.id, 'APPROVED')}
                                className="px-3 py-1 text-sm bg-green-100 text-green-700 rounded hover:bg-green-200"
                              >
                                Approve
                              </button>
                              <button
                                onClick={() => handleReviewRsvp(rsvp.id, 'REJECTED')}
                                className="px-3 py-1 text-sm bg-red-100 text-red-700 rounded hover:bg-red-200"
                              >
                                Reject
                              </button>
                            </div>
                          )}
                          {rsvp.invitation && (
                            <span className="text-sm text-surface-500">
                              Code: {rsvp.invitation.accessCode}
                            </span>
                          )}
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {activeTab === 'checkin' && (
        <div className="card text-center py-12">
          <svg className="w-12 h-12 mx-auto text-surface-400 mb-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v1m6 11h2m-6 0h-2v4m0-11v3m0 0h.01M12 12h4.01M16 20h4M4 12h4m12 0h.01M5 8h2a1 1 0 001-1V5a1 1 0 00-1-1H5a1 1 0 00-1 1v2a1 1 0 001 1zm12 0h2a1 1 0 001-1V5a1 1 0 00-1-1h-2a1 1 0 00-1 1v2a1 1 0 001 1zM5 20h2a1 1 0 001-1v-2a1 1 0 00-1-1H5a1 1 0 00-1 1v2a1 1 0 001 1z" />
          </svg>
          <h3 className="text-lg font-medium text-navy-900 mb-2">Check-In Station</h3>
          <p className="text-surface-600 mb-4">Open the check-in page on a tablet at your event</p>
          <Link href={`/e/${event.slug}/checkin`} target="_blank" className="btn-primary">
            Open Check-In Page
          </Link>
        </div>
      )}

      {activeTab === 'media' && (
        <div className="card text-center py-12">
          <svg className="w-12 h-12 mx-auto text-surface-400 mb-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 10l4.553-2.276A1 1 0 0121 8.618v6.764a1 1 0 01-1.447.894L15 14M5 18h8a2 2 0 002-2V8a2 2 0 00-2-2H5a2 2 0 00-2 2v8a2 2 0 002 2z" />
          </svg>
          <h3 className="text-lg font-medium text-navy-900 mb-2">{event._count.mediaAssets} Media Items</h3>
          <p className="text-surface-600 mb-4">View and download captured photos, videos, and audio</p>
          <p className="text-sm text-surface-500">Media gallery coming soon</p>
        </div>
      )}

      {activeTab === 'settings' && (
        <div className="card">
          <h3 className="text-lg font-semibold text-navy-900 mb-4">Event Settings</h3>
          <div className="space-y-4 text-sm">
            <div className="flex justify-between py-2 border-b border-surface-100">
              <span className="text-surface-600">Event Slug</span>
              <span className="font-medium">/{event.slug}</span>
            </div>
            <div className="flex justify-between py-2 border-b border-surface-100">
              <span className="text-surface-600">Date</span>
              <span className="font-medium">{formatDate(event.date, 'PPP')}</span>
            </div>
            <div className="flex justify-between py-2 border-b border-surface-100">
              <span className="text-surface-600">Venue</span>
              <span className="font-medium">{event.venue || '-'}</span>
            </div>
            <div className="flex justify-between py-2 border-b border-surface-100">
              <span className="text-surface-600">Invitation Only</span>
              <span className="font-medium">{event.invitationOnly ? 'Yes' : 'No'}</span>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
