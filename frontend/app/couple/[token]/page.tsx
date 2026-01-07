'use client';

import { useEffect, useState } from 'react';
import { useParams } from 'next/navigation';
import { coupleApi } from '@/lib/api';
import { useCoupleAuthStore } from '@/lib/store';
import { formatDate, getPhaseLabel, getStatusColor, cn } from '@/lib/utils';
import toast from 'react-hot-toast';

type Tab = 'overview' | 'rsvps' | 'attendance' | 'media';

interface Event {
  id: string;
  name: string;
  slug: string;
  date: string;
  venue: string | null;
  currentPhase: string;
  invitationOnly: boolean;
}

interface RSVP {
  id: string;
  primaryName: string;
  secondaryName: string | null;
  attendance: string;
  guestCount: number;
  status: string;
  submittedAt: string;
  invitation?: { accessCode: string; isCheckedIn: boolean } | null;
}

export default function CouplePortalPage() {
  const params = useParams();
  const token = params.token as string;
  const { setCoupleAuth } = useCoupleAuthStore();
  
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [event, setEvent] = useState<Event | null>(null);
  const [stats, setStats] = useState<any>(null);
  const [rsvps, setRsvps] = useState<RSVP[]>([]);
  const [activeTab, setActiveTab] = useState<Tab>('overview');
  const [rsvpFilter, setRsvpFilter] = useState('all');

  useEffect(() => {
    // Set the couple token in localStorage for API calls
    localStorage.setItem('couple_token', token);
    setCoupleAuth(token, '');
    fetchData();
  }, [token]);

  useEffect(() => {
    if (activeTab === 'rsvps') {
      fetchRsvps();
    }
  }, [activeTab, rsvpFilter]);

  const fetchData = async () => {
    try {
      const response = await coupleApi.getEvent();
      setEvent(response.data.event);
      setStats(response.data.stats);
      setCoupleAuth(token, response.data.event.id);
    } catch (err: any) {
      setError(err.response?.data?.error || 'Invalid access link');
    } finally {
      setLoading(false);
    }
  };

  const fetchRsvps = async () => {
    try {
      const params: any = {};
      if (rsvpFilter !== 'all') params.status = rsvpFilter;
      const response = await coupleApi.getRsvps(params);
      setRsvps(response.data.rsvps);
    } catch (err) {
      toast.error('Failed to load RSVPs');
    }
  };

  const handleApprove = async (id: string) => {
    try {
      await coupleApi.approveRsvp(id);
      toast.success('RSVP approved!');
      fetchRsvps();
      fetchData();
    } catch (err: any) {
      toast.error(err.response?.data?.error || 'Failed to approve');
    }
  };

  const handleReject = async (id: string) => {
    try {
      await coupleApi.rejectRsvp(id);
      toast.success('RSVP rejected');
      fetchRsvps();
      fetchData();
    } catch (err: any) {
      toast.error(err.response?.data?.error || 'Failed to reject');
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-surface-100 flex items-center justify-center">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary-500" />
      </div>
    );
  }

  if (error || !event) {
    return (
      <div className="min-h-screen bg-surface-100 flex items-center justify-center p-4">
        <div className="text-center">
          <h1 className="text-2xl font-display font-bold text-navy-900 mb-4">Access Denied</h1>
          <p className="text-surface-600">{error || 'Invalid access link'}</p>
        </div>
      </div>
    );
  }

  const tabs: { id: Tab; label: string }[] = [
    { id: 'overview', label: 'Overview' },
    { id: 'rsvps', label: 'RSVPs' },
    { id: 'attendance', label: 'Attendance' },
    { id: 'media', label: 'Media' },
  ];

  return (
    <div className="min-h-screen bg-surface-100">
      {/* Header */}
      <header className="bg-white border-b border-surface-200">
        <div className="max-w-5xl mx-auto px-4 py-6">
          <p className="text-sm text-primary-500 font-medium mb-1">Couple Portal</p>
          <h1 className="text-2xl font-display font-bold text-navy-900">{event.name}</h1>
          <div className="flex items-center gap-3 mt-2">
            <span className="text-surface-600">{formatDate(event.date, 'MMMM d, yyyy')}</span>
            <span className={getStatusColor(event.currentPhase)}>
              {getPhaseLabel(event.currentPhase)}
            </span>
          </div>
        </div>
      </header>

      {/* Tabs */}
      <div className="bg-white border-b border-surface-200">
        <div className="max-w-5xl mx-auto px-4">
          <nav className="flex gap-6 -mb-px">
            {tabs.map((tab) => (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                className={cn(
                  'py-4 text-sm font-medium border-b-2 transition-colors',
                  activeTab === tab.id
                    ? 'border-primary-500 text-primary-600'
                    : 'border-transparent text-surface-600 hover:text-navy-900'
                )}
              >
                {tab.label}
              </button>
            ))}
          </nav>
        </div>
      </div>

      {/* Content */}
      <main className="max-w-5xl mx-auto px-4 py-8">
        {activeTab === 'overview' && stats && (
          <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-4">
            <div className="card">
              <p className="text-sm text-surface-600 mb-1">Total RSVPs</p>
              <p className="text-3xl font-bold text-navy-900">{stats.rsvps.total}</p>
            </div>
            <div className="card">
              <p className="text-sm text-surface-600 mb-1">Pending Approval</p>
              <p className="text-3xl font-bold text-yellow-600">{stats.rsvps.pending}</p>
            </div>
            <div className="card">
              <p className="text-sm text-surface-600 mb-1">Expected Guests</p>
              <p className="text-3xl font-bold text-navy-900">{stats.guests.expected}</p>
            </div>
            <div className="card">
              <p className="text-sm text-surface-600 mb-1">Checked In</p>
              <p className="text-3xl font-bold text-green-600">{stats.guests.checkedIn}</p>
            </div>
          </div>
        )}

        {activeTab === 'rsvps' && (
          <div className="space-y-4">
            <div className="flex gap-2">
              {['all', 'PENDING', 'APPROVED', 'REJECTED'].map((status) => (
                <button
                  key={status}
                  onClick={() => setRsvpFilter(status)}
                  className={cn(
                    'px-3 py-1.5 rounded-lg text-sm font-medium transition-colors',
                    rsvpFilter === status
                      ? 'bg-navy-900 text-white'
                      : 'bg-white text-surface-600 hover:bg-surface-100'
                  )}
                >
                  {status === 'all' ? 'All' : status.charAt(0) + status.slice(1).toLowerCase()}
                </button>
              ))}
            </div>

            <div className="card overflow-hidden p-0">
              <div className="overflow-x-auto">
                <table className="w-full">
                  <thead>
                    <tr className="border-b border-surface-200 bg-surface-50">
                      <th className="text-left py-3 px-4 text-sm font-medium text-surface-600">Guest</th>
                      <th className="text-left py-3 px-4 text-sm font-medium text-surface-600">Response</th>
                      <th className="text-left py-3 px-4 text-sm font-medium text-surface-600">Party Size</th>
                      <th className="text-left py-3 px-4 text-sm font-medium text-surface-600">Status</th>
                      <th className="text-right py-3 px-4 text-sm font-medium text-surface-600">Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {rsvps.length === 0 ? (
                      <tr>
                        <td colSpan={5} className="py-12 text-center text-surface-500">
                          No RSVPs found
                        </td>
                      </tr>
                    ) : (
                      rsvps.map((rsvp) => (
                        <tr key={rsvp.id} className="border-b border-surface-100">
                          <td className="py-3 px-4">
                            <p className="font-medium text-navy-900">{rsvp.primaryName}</p>
                            {rsvp.secondaryName && (
                              <p className="text-sm text-surface-500">& {rsvp.secondaryName}</p>
                            )}
                          </td>
                          <td className="py-3 px-4">
                            <span className={getStatusColor(rsvp.attendance)}>{rsvp.attendance}</span>
                          </td>
                          <td className="py-3 px-4 text-surface-600">{rsvp.guestCount}</td>
                          <td className="py-3 px-4">
                            <span className={getStatusColor(rsvp.status)}>{rsvp.status}</span>
                          </td>
                          <td className="py-3 px-4 text-right">
                            {rsvp.status === 'PENDING' && (
                              <div className="flex justify-end gap-2">
                                <button
                                  onClick={() => handleApprove(rsvp.id)}
                                  className="px-3 py-1 text-sm bg-green-100 text-green-700 rounded hover:bg-green-200"
                                >
                                  Approve
                                </button>
                                <button
                                  onClick={() => handleReject(rsvp.id)}
                                  className="px-3 py-1 text-sm bg-red-100 text-red-700 rounded hover:bg-red-200"
                                >
                                  Reject
                                </button>
                              </div>
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

        {activeTab === 'attendance' && (
          <div className="card text-center py-12">
            <svg className="w-12 h-12 mx-auto text-surface-400 mb-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
            <h3 className="text-lg font-medium text-navy-900 mb-2">Attendance Tracking</h3>
            <p className="text-surface-600">See who has checked in during the live event</p>
          </div>
        )}

        {activeTab === 'media' && (
          <div className="card text-center py-12">
            <svg className="w-12 h-12 mx-auto text-surface-400 mb-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 10l4.553-2.276A1 1 0 0121 8.618v6.764a1 1 0 01-1.447.894L15 14M5 18h8a2 2 0 002-2V8a2 2 0 00-2-2H5a2 2 0 00-2 2v8a2 2 0 002 2z" />
            </svg>
            <h3 className="text-lg font-medium text-navy-900 mb-2">Guestbook Media</h3>
            <p className="text-surface-600">View and download messages from your guests</p>
          </div>
        )}
      </main>
    </div>
  );
}
