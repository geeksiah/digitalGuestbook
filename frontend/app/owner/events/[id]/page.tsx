'use client';

import { useEffect, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import Link from 'next/link';
import { ownerDashboardApi } from '@/lib/api';
import MediaGallery from '@/components/media/MediaGallery';
import { formatDate, getPhaseLabel, cn, copyToClipboard } from '@/lib/utils';
import toast from 'react-hot-toast';

interface Event {
  id: string;
  slug: string;
  name: string;
  description: string | null;
  date: string;
  endDate: string | null;
  venue: string | null;
  timezone: string;
  currentPhase: string;
  invitationOnly: boolean;
  _count: {
    rsvps: number;
    invitations: number;
    checkIns: number;
    mediaAssets: number;
    transactions: number;
  };
  ticketTypes?: Array<{
    id: string;
    name: string;
    description: string | null;
    price: number;
    currency: string;
    quantitySold: number;
    quantityTotal: number;
    isActive: boolean;
  }>;
}

interface RSVP {
  id: string;
  primaryName: string;
  secondaryName: string | null;
  email: string | null;
  phone: string | null;
  attendance: string;
  guestCount: number;
  mealPreference: string | null;
  dietaryNotes: string | null;
  note: string | null;
  status: string;
  submittedAt: string;
  invitation?: { id: string; accessCode: string; token: string; qrCodeData: string | null; isCheckedIn: boolean } | null;
}

interface MediaAsset {
  id: string;
  type: 'VIDEO' | 'AUDIO' | 'PHOTO';
  guestName: string | null;
  filePath: string;
  fileName: string;
  fileSize?: number;
  duration: number | null;
  thumbnailPath: string | null;
  createdAt: string;
}

interface CheckIn {
  id: string;
  invitation: { guestName: string; guestCount: number; accessCode: string };
  checkedInAt: string;
  method: string;
}

type Tab = 'overview' | 'rsvps' | 'checkin' | 'media' | 'tickets';

const Icons = {
  back: <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" /></svg>,
  external: <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" /></svg>,
  copy: <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z" /></svg>,
  download: <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" /></svg>,
  check: <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" /></svg>,
  close: <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg>,
};

export default function OwnerEventDetailPage() {
  const params = useParams();
  const router = useRouter();
  const eventId = params.id as string;

  const [event, setEvent] = useState<Event | null>(null);
  const [rsvps, setRsvps] = useState<RSVP[]>([]);
  const [media, setMedia] = useState<MediaAsset[]>([]);
  const [checkIns, setCheckIns] = useState<CheckIn[]>([]);
  const [tickets, setTickets] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<Tab>('overview');
  const [rsvpFilter, setRsvpFilter] = useState<string>('all');

  const fetchEvent = async () => {
    try {
      const r = await ownerDashboardApi.getEvent(eventId);
      setEvent(r.data.event);
    } catch (error: any) {
      toast.error(error.response?.data?.error || 'Failed to load event');
      router.push('/owner/events');
    } finally {
      setLoading(false);
    }
  };

  const fetchRsvps = async () => {
    try {
      const params: any = {};
      if (rsvpFilter !== 'all') params.status = rsvpFilter;
      const r = await ownerDashboardApi.getRsvps(eventId, params);
      setRsvps(r.data.rsvps || []);
    } catch (error: any) {
      toast.error(error.response?.data?.error || 'Failed to load RSVPs');
    }
  };

  const fetchMedia = async () => {
    try {
      const r = await ownerDashboardApi.getMedia(eventId);
      setMedia(r.data.media || []);
    } catch (error: any) {
      toast.error(error.response?.data?.error || 'Failed to load media');
    }
  };

  const fetchCheckIns = async () => {
    try {
      const r = await ownerDashboardApi.getCheckIns(eventId);
      setCheckIns(r.data.checkIns || []);
    } catch (error: any) {
      toast.error(error.response?.data?.error || 'Failed to load check-ins');
    }
  };

  const fetchTickets = async () => {
    try {
      const r = await ownerDashboardApi.getTickets(eventId);
      setTickets(r.data.tickets || []);
    } catch (error: any) {
      toast.error(error.response?.data?.error || 'Failed to load tickets');
    }
  };

  useEffect(() => {
    fetchEvent();
  }, [eventId]);

  useEffect(() => {
    if (event) {
      if (activeTab === 'rsvps') fetchRsvps();
      if (activeTab === 'media') fetchMedia();
      if (activeTab === 'checkin') fetchCheckIns();
      if (activeTab === 'tickets') fetchTickets();
    }
  }, [activeTab, rsvpFilter, event]);

  const handleCopyLink = async (path: string) => {
    if (await copyToClipboard(`${window.location.origin}${path}`)) {
      toast.success('Link copied!');
    }
  };

  const exportRsvpsToCSV = () => {
    const headers = ['Name', 'Secondary Name', 'Email', 'Phone', 'Attendance', 'Guest Count', 'Meal', 'Dietary', 'Note', 'Status', 'Submitted', 'Code', 'Checked In'];
    const rows = rsvps.map(r => [
      r.primaryName,
      r.secondaryName || '',
      r.email || '',
      r.phone || '',
      r.attendance,
      r.guestCount,
      r.mealPreference || '',
      r.dietaryNotes || '',
      r.note || '',
      r.status,
      formatDate(r.submittedAt, 'yyyy-MM-dd HH:mm'),
      r.invitation?.accessCode || '',
      r.invitation?.isCheckedIn ? 'Yes' : 'No',
    ]);
    const csv = [headers, ...rows].map(r => r.map(c => `"${String(c).replace(/"/g, '""')}"`).join(',')).join('\n');
    const blob = new Blob([csv], { type: 'text/csv' });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = `rsvps-${event?.slug}.csv`;
    a.click();
  };

  const exportCheckInsToCSV = () => {
    const headers = ['Name', 'Guests', 'Code', 'Checked In At', 'Method'];
    const rows = checkIns.map(c => [
      c.invitation.guestName,
      c.invitation.guestCount,
      c.invitation.accessCode,
      formatDate(c.checkedInAt, 'yyyy-MM-dd HH:mm'),
      c.method,
    ]);
    const csv = [headers, ...rows].map(r => r.map(c => `"${String(c).replace(/"/g, '""')}"`).join(',')).join('\n');
    const blob = new Blob([csv], { type: 'text/csv' });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = `checkins-${event?.slug}.csv`;
    a.click();
  };

  const getPhaseStyle = (phase: string) => {
    switch (phase) {
      case 'LIVE': return 'bg-emerald-100 text-emerald-700 border-emerald-300';
      case 'PRE_EVENT': return 'bg-blue-100 text-blue-700 border-blue-300';
      case 'POST_EVENT': return 'bg-surface-100 text-surface-700 border-surface-300';
      default: return 'bg-surface-100 text-surface-700 border-surface-300';
    }
  };

  if (loading || !event) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-navy-900" />
      </div>
    );
  }

  const tabs: { id: Tab; label: string; count?: number }[] = [
    { id: 'overview', label: 'Overview' },
    { id: 'rsvps', label: 'RSVPs', count: event._count.rsvps },
    { id: 'checkin', label: 'Check-In', count: event._count.checkIns },
    { id: 'media', label: 'Media', count: event._count.mediaAssets },
    { id: 'tickets', label: 'Tickets', count: event.ticketTypes?.reduce((sum, t) => sum + t.quantitySold, 0) || 0 },
  ];

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4">
        <div>
          <Link href="/owner/events" className="inline-flex items-center text-surface-500 hover:text-navy-900 mb-2 text-sm transition-colors">
            {Icons.back}
            <span className="ml-1">Back to Events</span>
          </Link>
          <h1 className="text-2xl font-display font-bold text-navy-900">{event.name}</h1>
          <div className="flex items-center gap-3 mt-2">
            <span className={cn('inline-flex px-2 py-0.5 text-xs font-medium rounded border', getPhaseStyle(event.currentPhase))}>
              {getPhaseLabel(event.currentPhase)}
            </span>
            {event.invitationOnly && <span className="badge-info">Invite Only</span>}
          </div>
        </div>
        <Link href={`/e/${event.slug}`} target="_blank" className="btn-outline">
          {Icons.external}
          <span className="ml-2">View Public Page</span>
        </Link>
      </div>

      {/* Tabs */}
      <div className="border-b border-surface-200 overflow-x-auto">
        <nav className="flex gap-1 -mb-px min-w-max">
          {tabs.map(tab => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={cn(
                'px-4 py-3 text-sm font-medium border-b-2 transition-all',
                activeTab === tab.id
                  ? 'border-navy-900 text-navy-900'
                  : 'border-transparent text-surface-500 hover:text-surface-700 hover:border-surface-300'
              )}
            >
              {tab.label}
              {tab.count !== undefined && (
                <span className={cn('ml-2 px-2 py-0.5 rounded text-xs', activeTab === tab.id ? 'bg-navy-100 text-navy-700' : 'bg-surface-100 text-surface-600')}>
                  {tab.count}
                </span>
              )}
            </button>
          ))}
        </nav>
      </div>

      {/* Tab Content */}
      <div>
        {/* Overview Tab */}
        {activeTab === 'overview' && (
          <div className="space-y-6">
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
              <div className="bg-white rounded-lg border border-surface-200 p-6">
                <p className="text-sm font-medium text-surface-600">RSVPs</p>
                <p className="text-2xl font-bold text-navy-900 mt-1">{event._count.rsvps}</p>
              </div>
              <div className="bg-white rounded-lg border border-surface-200 p-6">
                <p className="text-sm font-medium text-surface-600">Check-Ins</p>
                <p className="text-2xl font-bold text-navy-900 mt-1">{event._count.checkIns}</p>
              </div>
              <div className="bg-white rounded-lg border border-surface-200 p-6">
                <p className="text-sm font-medium text-surface-600">Media Assets</p>
                <p className="text-2xl font-bold text-navy-900 mt-1">{event._count.mediaAssets}</p>
              </div>
              <div className="bg-white rounded-lg border border-surface-200 p-6">
                <p className="text-sm font-medium text-surface-600">Event Date</p>
                <p className="text-sm font-medium text-navy-900 mt-1">{formatDate(event.date)}</p>
              </div>
            </div>

            <div className="bg-white rounded-lg border border-surface-200 p-6">
              <h3 className="text-lg font-semibold text-navy-900 mb-4">Event Details</h3>
              <dl className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <dt className="text-sm font-medium text-surface-600">Name</dt>
                  <dd className="mt-1 text-sm text-navy-900">{event.name}</dd>
                </div>
                {event.description && (
                  <div>
                    <dt className="text-sm font-medium text-surface-600">Description</dt>
                    <dd className="mt-1 text-sm text-navy-900">{event.description}</dd>
                  </div>
                )}
                <div>
                  <dt className="text-sm font-medium text-surface-600">Date</dt>
                  <dd className="mt-1 text-sm text-navy-900">{formatDate(event.date)}</dd>
                </div>
                {event.endDate && (
                  <div>
                    <dt className="text-sm font-medium text-surface-600">End Date</dt>
                    <dd className="mt-1 text-sm text-navy-900">{formatDate(event.endDate)}</dd>
                  </div>
                )}
                {event.venue && (
                  <div>
                    <dt className="text-sm font-medium text-surface-600">Venue</dt>
                    <dd className="mt-1 text-sm text-navy-900">{event.venue}</dd>
                  </div>
                )}
                <div>
                  <dt className="text-sm font-medium text-surface-600">Public Link</dt>
                  <dd className="mt-1">
                    <button
                      onClick={() => handleCopyLink(`/e/${event.slug}`)}
                      className="inline-flex items-center text-sm text-primary-600 hover:text-primary-700"
                    >
                      {Icons.copy}
                      <span className="ml-1">Copy Link</span>
                    </button>
                  </dd>
                </div>
              </dl>
            </div>
          </div>
        )}

        {/* RSVPs Tab */}
        {activeTab === 'rsvps' && (
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <div className="flex gap-2">
                <button
                  onClick={() => setRsvpFilter('all')}
                  className={cn('px-3 py-1.5 rounded-lg text-sm font-medium', rsvpFilter === 'all' ? 'bg-navy-900 text-white' : 'bg-surface-100 text-surface-700')}
                >
                  All
                </button>
                <button
                  onClick={() => setRsvpFilter('PENDING')}
                  className={cn('px-3 py-1.5 rounded-lg text-sm font-medium', rsvpFilter === 'PENDING' ? 'bg-navy-900 text-white' : 'bg-surface-100 text-surface-700')}
                >
                  Pending
                </button>
                <button
                  onClick={() => setRsvpFilter('APPROVED')}
                  className={cn('px-3 py-1.5 rounded-lg text-sm font-medium', rsvpFilter === 'APPROVED' ? 'bg-navy-900 text-white' : 'bg-surface-100 text-surface-700')}
                >
                  Approved
                </button>
                <button
                  onClick={() => setRsvpFilter('REJECTED')}
                  className={cn('px-3 py-1.5 rounded-lg text-sm font-medium', rsvpFilter === 'REJECTED' ? 'bg-navy-900 text-white' : 'bg-surface-100 text-surface-700')}
                >
                  Rejected
                </button>
              </div>
              <button onClick={exportRsvpsToCSV} className="btn-outline">
                {Icons.download}
                <span className="ml-2">Export CSV</span>
              </button>
            </div>

            <div className="bg-white rounded-lg border border-surface-200 overflow-hidden">
              <div className="overflow-x-auto">
                <table className="min-w-full divide-y divide-surface-200">
                  <thead className="bg-surface-50">
                    <tr>
                      <th className="px-6 py-3 text-left text-xs font-medium text-surface-500 uppercase tracking-wider">Name</th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-surface-500 uppercase tracking-wider">Email</th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-surface-500 uppercase tracking-wider">Attendance</th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-surface-500 uppercase tracking-wider">Guests</th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-surface-500 uppercase tracking-wider">Status</th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-surface-500 uppercase tracking-wider">Submitted</th>
                    </tr>
                  </thead>
                  <tbody className="bg-white divide-y divide-surface-200">
                    {rsvps.length === 0 ? (
                      <tr>
                        <td colSpan={6} className="px-6 py-4 text-center text-sm text-surface-500">
                          No RSVPs found
                        </td>
                      </tr>
                    ) : (
                      rsvps.map(rsvp => (
                        <tr key={rsvp.id}>
                          <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-navy-900">{rsvp.primaryName}</td>
                          <td className="px-6 py-4 whitespace-nowrap text-sm text-surface-500">{rsvp.email || '-'}</td>
                          <td className="px-6 py-4 whitespace-nowrap text-sm text-surface-500">{rsvp.attendance}</td>
                          <td className="px-6 py-4 whitespace-nowrap text-sm text-surface-500">{rsvp.guestCount}</td>
                          <td className="px-6 py-4 whitespace-nowrap">
                            <span className={cn('inline-flex px-2 py-0.5 text-xs font-medium rounded', rsvp.status === 'APPROVED' ? 'bg-emerald-100 text-emerald-700' : rsvp.status === 'REJECTED' ? 'bg-rose-100 text-rose-700' : 'bg-yellow-100 text-yellow-700')}>
                              {rsvp.status}
                            </span>
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap text-sm text-surface-500">{formatDate(rsvp.submittedAt)}</td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        )}

        {/* Check-Ins Tab */}
        {activeTab === 'checkin' && (
          <div className="space-y-4">
            <div className="flex justify-end">
              <button onClick={exportCheckInsToCSV} className="btn-outline">
                {Icons.download}
                <span className="ml-2">Export CSV</span>
              </button>
            </div>

            <div className="bg-white rounded-lg border border-surface-200 overflow-hidden">
              <div className="overflow-x-auto">
                <table className="min-w-full divide-y divide-surface-200">
                  <thead className="bg-surface-50">
                    <tr>
                      <th className="px-6 py-3 text-left text-xs font-medium text-surface-500 uppercase tracking-wider">Name</th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-surface-500 uppercase tracking-wider">Guests</th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-surface-500 uppercase tracking-wider">Code</th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-surface-500 uppercase tracking-wider">Checked In At</th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-surface-500 uppercase tracking-wider">Method</th>
                    </tr>
                  </thead>
                  <tbody className="bg-white divide-y divide-surface-200">
                    {checkIns.length === 0 ? (
                      <tr>
                        <td colSpan={5} className="px-6 py-4 text-center text-sm text-surface-500">
                          No check-ins found
                        </td>
                      </tr>
                    ) : (
                      checkIns.map(checkIn => (
                        <tr key={checkIn.id}>
                          <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-navy-900">{checkIn.invitation.guestName}</td>
                          <td className="px-6 py-4 whitespace-nowrap text-sm text-surface-500">{checkIn.invitation.guestCount}</td>
                          <td className="px-6 py-4 whitespace-nowrap text-sm text-surface-500 font-mono">{checkIn.invitation.accessCode}</td>
                          <td className="px-6 py-4 whitespace-nowrap text-sm text-surface-500">{formatDate(checkIn.checkedInAt)}</td>
                          <td className="px-6 py-4 whitespace-nowrap text-sm text-surface-500">{checkIn.method}</td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        )}

        {/* Media Tab */}
        {activeTab === 'media' && (
          <div>
            <MediaGallery eventId={eventId} media={media} />
          </div>
        )}

        {/* Tickets Tab */}
        {activeTab === 'tickets' && (
          <div className="space-y-4">
            <div className="bg-white rounded-lg border border-surface-200 overflow-hidden">
              <div className="overflow-x-auto">
                <table className="min-w-full divide-y divide-surface-200">
                  <thead className="bg-surface-50">
                    <tr>
                      <th className="px-6 py-3 text-left text-xs font-medium text-surface-500 uppercase tracking-wider">Name</th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-surface-500 uppercase tracking-wider">Price</th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-surface-500 uppercase tracking-wider">Sold</th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-surface-500 uppercase tracking-wider">Total</th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-surface-500 uppercase tracking-wider">Status</th>
                    </tr>
                  </thead>
                  <tbody className="bg-white divide-y divide-surface-200">
                    {tickets.length === 0 ? (
                      <tr>
                        <td colSpan={5} className="px-6 py-4 text-center text-sm text-surface-500">
                          No tickets found
                        </td>
                      </tr>
                    ) : (
                      tickets.map(ticket => (
                        <tr key={ticket.id}>
                          <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-navy-900">{ticket.name}</td>
                          <td className="px-6 py-4 whitespace-nowrap text-sm text-surface-500">
                            {ticket.price > 0 ? `${ticket.currency} ${ticket.price.toFixed(2)}` : 'Free'}
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap text-sm text-surface-500">{ticket.quantitySold}</td>
                          <td className="px-6 py-4 whitespace-nowrap text-sm text-surface-500">{ticket.quantityTotal}</td>
                          <td className="px-6 py-4 whitespace-nowrap">
                            <span className={cn('inline-flex px-2 py-0.5 text-xs font-medium rounded', ticket.isActive ? 'bg-emerald-100 text-emerald-700' : 'bg-surface-100 text-surface-600')}>
                              {ticket.isActive ? 'Active' : 'Inactive'}
                            </span>
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
      </div>
    </div>
  );
}

