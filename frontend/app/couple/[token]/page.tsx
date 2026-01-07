'use client';

import { useEffect, useState, useRef } from 'react';
import { useParams } from 'next/navigation';
import { coupleApi, API_BASE_URL } from '@/lib/api';
import { formatDate, getStatusColor, cn } from '@/lib/utils';
import toast from 'react-hot-toast';

interface Event {
  id: string;
  name: string;
  slug: string;
  date: string;
  venue: string | null;
  currentPhase: string;
  invitationOnly: boolean;
  _count: { rsvps: number; invitations: number; checkIns: number; mediaAssets: number };
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
  invitation?: { accessCode: string; qrCodeData: string | null; isCheckedIn: boolean } | null;
}

interface MediaAsset {
  id: string;
  type: 'VIDEO' | 'AUDIO' | 'PHOTO';
  guestName: string | null;
  filePath: string;
  duration: number | null;
  createdAt: string;
}

interface CheckIn {
  id: string;
  invitation: { accessCode: string; rsvp: { primaryName: string; secondaryName: string | null; guestCount: number } };
  checkedInAt: string;
}

type Tab = 'dashboard' | 'rsvps' | 'media' | 'checkins';

export default function CouplePortalPage() {
  const params = useParams();
  const token = params.token as string;

  const [event, setEvent] = useState<Event | null>(null);
  const [rsvps, setRsvps] = useState<RSVP[]>([]);
  const [media, setMedia] = useState<MediaAsset[]>([]);
  const [checkIns, setCheckIns] = useState<CheckIn[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<Tab>('dashboard');
  const [rsvpFilter, setRsvpFilter] = useState('all');
  const [previewMedia, setPreviewMedia] = useState<MediaAsset | null>(null);
  const [lastUpdated, setLastUpdated] = useState<Date>(new Date());

  const pollRef = useRef<NodeJS.Timeout | null>(null);

  useEffect(() => {
    fetchEvent();
    pollRef.current = setInterval(() => {
      fetchEvent(true);
      if (activeTab === 'rsvps') fetchRsvps(true);
      if (activeTab === 'media') fetchMedia(true);
      if (activeTab === 'checkins') fetchCheckIns(true);
    }, 10000);
    return () => { if (pollRef.current) clearInterval(pollRef.current); };
  }, [token]);

  useEffect(() => {
    if (event) {
      if (activeTab === 'rsvps' || activeTab === 'dashboard') fetchRsvps();
      if (activeTab === 'media' || activeTab === 'dashboard') fetchMedia();
      if (activeTab === 'checkins') fetchCheckIns();
    }
  }, [activeTab, rsvpFilter, event]);

  const fetchEvent = async (silent = false) => {
    try {
      const r = await coupleApi.getEvent(token);
      setEvent(r.data.event);
      setLastUpdated(new Date());
      if (!silent) setLoading(false);
    } catch (err: any) {
      if (!silent) { setError(err.response?.data?.error || 'Invalid link'); setLoading(false); }
    }
  };

  const fetchRsvps = async (silent = false) => {
    try {
      const p: any = {}; if (rsvpFilter !== 'all') p.status = rsvpFilter;
      const r = await coupleApi.getRsvps(token, p);
      setRsvps(r.data.rsvps || []);
    } catch { if (!silent) toast.error('Failed to load RSVPs'); }
  };

  const fetchMedia = async (silent = false) => {
    try { const r = await coupleApi.getMedia(token); setMedia(r.data.media || []); }
    catch { if (!silent) toast.error('Failed to load media'); }
  };

  const fetchCheckIns = async (silent = false) => {
    try { const r = await coupleApi.getCheckIns(token); setCheckIns(r.data.checkIns || []); }
    catch { if (!silent) toast.error('Failed to load check-ins'); }
  };

  const handleReviewRsvp = async (rsvpId: string, status: 'APPROVED' | 'REJECTED') => {
    try {
      await coupleApi.reviewRsvp(token, rsvpId, status);
      toast.success(`RSVP ${status.toLowerCase()}`);
      fetchRsvps(); fetchEvent();
    } catch (err: any) { toast.error(err.response?.data?.error || 'Failed'); }
  };

  const downloadAllMedia = async () => {
    try {
      toast.loading('Preparing...', { id: 'dl' });
      const r = await coupleApi.downloadMedia(token);
      const b = new Blob([r.data], { type: 'application/zip' });
      const a = document.createElement('a'); a.href = URL.createObjectURL(b); a.download = `media-${event?.slug}.zip`; a.click();
      toast.dismiss('dl'); toast.success('Download started');
    } catch { toast.dismiss('dl'); toast.error('Failed'); }
  };

  const Icon = ({ type }: { type: string }) => {
    if (type === 'VIDEO') return <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 10l4.553-2.276A1 1 0 0121 8.618v6.764a1 1 0 01-1.447.894L15 14M5 18h8a2 2 0 002-2V8a2 2 0 00-2-2H5a2 2 0 00-2 2v8a2 2 0 002 2z" /></svg>;
    if (type === 'AUDIO') return <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 11a7 7 0 01-7 7m0 0a7 7 0 01-7-7m7 7v4m0 0H8m4 0h4m-4-8a3 3 0 01-3-3V5a3 3 0 116 0v6a3 3 0 01-3 3z" /></svg>;
    return <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" /></svg>;
  };

  if (loading) return <div className="min-h-screen bg-gradient-to-br from-navy-900 via-navy-950 to-navy-900 flex items-center justify-center"><div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary-500" /></div>;

  if (error || !event) return (
    <div className="min-h-screen bg-gradient-to-br from-navy-900 via-navy-950 to-navy-900 flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl shadow-2xl max-w-md w-full p-8 text-center">
        <div className="w-16 h-16 mx-auto rounded-full bg-red-100 flex items-center justify-center mb-6">
          <svg className="w-8 h-8 text-red-500" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" /></svg>
        </div>
        <h1 className="text-2xl font-display font-bold text-navy-900 mb-2">Access Denied</h1>
        <p className="text-surface-600">{error || 'Invalid or expired link.'}</p>
      </div>
    </div>
  );

  const tabs: { id: Tab; label: string; count?: number }[] = [
    { id: 'dashboard', label: 'Dashboard' },
    { id: 'rsvps', label: 'RSVPs', count: event._count.rsvps },
    { id: 'media', label: 'Messages', count: event._count.mediaAssets },
    { id: 'checkins', label: 'Check-Ins', count: event._count.checkIns },
  ];

  const pendingCount = rsvps.filter(r => r.status === 'PENDING').length;
  const totalGuests = rsvps.filter(r => r.status === 'APPROVED' && r.attendance === 'YES').reduce((sum, r) => sum + r.guestCount, 0);

  return (
    <div className="min-h-screen bg-surface-50">
      <header className="bg-white border-b border-surface-200 sticky top-0 z-40">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 py-4">
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
            <div>
              <h1 className="text-xl sm:text-2xl font-display font-bold text-navy-900">{event.name}</h1>
              <p className="text-sm text-surface-500">{formatDate(event.date, 'EEEE, MMMM d, yyyy')}</p>
            </div>
            <div className="flex items-center gap-3 text-sm">
              <span className="text-surface-500">Updated {formatDate(lastUpdated, 'h:mm a')}</span>
              <span className={cn('px-3 py-1 rounded-full text-xs font-medium', event.currentPhase === 'LIVE' ? 'bg-green-100 text-green-700' : 'bg-surface-100 text-surface-600')}>
                {event.currentPhase === 'PRE_EVENT' ? 'Pre-Event' : event.currentPhase === 'LIVE' ? 'Live' : 'Ended'}
              </span>
            </div>
          </div>
        </div>
        <div className="max-w-6xl mx-auto px-4 sm:px-6">
          <nav className="flex gap-6 -mb-px overflow-x-auto">
            {tabs.map(tab => (
              <button key={tab.id} onClick={() => setActiveTab(tab.id)} className={cn('pb-3 text-sm font-medium border-b-2 transition-colors whitespace-nowrap', activeTab === tab.id ? 'border-primary-500 text-primary-600' : 'border-transparent text-surface-600 hover:text-navy-900')}>
                {tab.label}
                {tab.count !== undefined && <span className="ml-2 px-2 py-0.5 rounded-full bg-surface-100 text-xs">{tab.count}</span>}
              </button>
            ))}
          </nav>
        </div>
      </header>

      <main className="max-w-6xl mx-auto px-4 sm:px-6 py-6">
        {activeTab === 'dashboard' && (
          <div className="space-y-6">
            <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-4">
              {[{ l: 'Total RSVPs', v: event._count.rsvps }, { l: 'Expected Guests', v: totalGuests }, { l: 'Checked In', v: event._count.checkIns }, { l: 'Messages', v: event._count.mediaAssets }].map(s => (
                <div key={s.l} className="bg-white rounded-xl p-6 shadow-sm border border-surface-200">
                  <p className="text-sm text-surface-600 mb-1">{s.l}</p>
                  <p className="text-3xl font-bold text-navy-900">{s.v}</p>
                </div>
              ))}
            </div>

            {pendingCount > 0 && (
              <div className="bg-amber-50 border border-amber-200 rounded-xl p-4 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-full bg-amber-100 flex items-center justify-center flex-shrink-0">
                    <svg className="w-5 h-5 text-amber-600" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
                  </div>
                  <div>
                    <p className="font-medium text-amber-900">{pendingCount} RSVP(s) pending</p>
                    <p className="text-sm text-amber-700">Review to send invitations</p>
                  </div>
                </div>
                <button onClick={() => { setActiveTab('rsvps'); setRsvpFilter('PENDING'); }} className="px-4 py-2 bg-amber-500 hover:bg-amber-600 text-white rounded-lg text-sm font-medium">Review Now</button>
              </div>
            )}

            <div className="grid lg:grid-cols-2 gap-6">
              <div className="bg-white rounded-xl shadow-sm border border-surface-200 p-6">
                <div className="flex items-center justify-between mb-4">
                  <h3 className="font-semibold text-navy-900">Recent RSVPs</h3>
                  <button onClick={() => setActiveTab('rsvps')} className="text-sm text-primary-600 hover:text-primary-700">View All</button>
                </div>
                {rsvps.length === 0 ? <p className="text-surface-500 text-center py-8">No RSVPs yet</p> : (
                  <div className="space-y-3">
                    {rsvps.slice(0, 5).map(r => (
                      <div key={r.id} className="flex items-center justify-between p-3 bg-surface-50 rounded-lg">
                        <div><p className="font-medium text-navy-900">{r.primaryName}</p><p className="text-xs text-surface-500">{formatDate(r.submittedAt, 'MMM d, h:mm a')}</p></div>
                        <span className={getStatusColor(r.status)}>{r.status}</span>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              <div className="bg-white rounded-xl shadow-sm border border-surface-200 p-6">
                <div className="flex items-center justify-between mb-4">
                  <h3 className="font-semibold text-navy-900">Recent Messages</h3>
                  <button onClick={() => setActiveTab('media')} className="text-sm text-primary-600 hover:text-primary-700">View All</button>
                </div>
                {media.length === 0 ? <p className="text-surface-500 text-center py-8">No messages yet</p> : (
                  <div className="grid grid-cols-3 gap-2">
                    {media.slice(0, 6).map(m => (
                      <div key={m.id} onClick={() => setPreviewMedia(m)} className="aspect-square bg-surface-100 rounded-lg cursor-pointer hover:opacity-80 flex items-center justify-center overflow-hidden">
                        {m.type === 'PHOTO' ? <img src={`${API_BASE_URL}${m.filePath}`} alt="" className="w-full h-full object-cover" /> : (
                          <div className={cn('w-10 h-10 rounded-full flex items-center justify-center', m.type === 'VIDEO' ? 'bg-red-100 text-red-500' : 'bg-purple-100 text-purple-500')}><Icon type={m.type} /></div>
                        )}
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          </div>
        )}

        {activeTab === 'rsvps' && (
          <div className="space-y-4">
            <div className="flex flex-wrap gap-2">
              {['all', 'PENDING', 'APPROVED', 'REJECTED'].map(s => (
                <button key={s} onClick={() => setRsvpFilter(s)} className={cn('px-4 py-2 rounded-lg text-sm font-medium transition-colors', rsvpFilter === s ? 'bg-navy-900 text-white' : 'bg-white text-surface-600 hover:bg-surface-100 border border-surface-200')}>
                  {s === 'all' ? 'All' : s.charAt(0) + s.slice(1).toLowerCase()}
                  {s === 'PENDING' && pendingCount > 0 && <span className="ml-2 px-1.5 py-0.5 rounded-full bg-amber-500 text-white text-xs">{pendingCount}</span>}
                </button>
              ))}
            </div>
            <div className="bg-white rounded-xl shadow-sm border border-surface-200 overflow-hidden">
              <div className="overflow-x-auto">
                <table className="w-full">
                  <thead><tr className="border-b border-surface-200 bg-surface-50">
                    <th className="text-left py-3 px-4 text-sm font-medium text-surface-600">Guest</th>
                    <th className="text-left py-3 px-4 text-sm font-medium text-surface-600">Response</th>
                    <th className="text-left py-3 px-4 text-sm font-medium text-surface-600">Details</th>
                    <th className="text-left py-3 px-4 text-sm font-medium text-surface-600">Status</th>
                    <th className="text-right py-3 px-4 text-sm font-medium text-surface-600">Actions</th>
                  </tr></thead>
                  <tbody>
                    {rsvps.length === 0 ? <tr><td colSpan={5} className="py-12 text-center text-surface-500">No RSVPs found</td></tr> : rsvps.map(r => (
                      <tr key={r.id} className="border-b border-surface-100 hover:bg-surface-50">
                        <td className="py-3 px-4"><p className="font-medium text-navy-900">{r.primaryName}</p>{r.secondaryName && <p className="text-sm text-surface-500">& {r.secondaryName}</p>}{r.email && <p className="text-xs text-surface-400">{r.email}</p>}</td>
                        <td className="py-3 px-4"><span className={getStatusColor(r.attendance)}>{r.attendance}</span><p className="text-sm text-surface-500">{r.guestCount} guest(s)</p></td>
                        <td className="py-3 px-4 text-sm">{r.mealPreference && <p>Meal: {r.mealPreference}</p>}{r.note && <p className="text-surface-500 truncate max-w-[200px]">{r.note}</p>}</td>
                        <td className="py-3 px-4"><span className={getStatusColor(r.status)}>{r.status}</span>{r.invitation?.isCheckedIn && <p className="text-xs text-green-600 mt-1">Checked In</p>}</td>
                        <td className="py-3 px-4 text-right">{r.status === 'PENDING' && <div className="flex justify-end gap-2"><button onClick={() => handleReviewRsvp(r.id, 'APPROVED')} className="px-3 py-1.5 text-sm bg-green-100 text-green-700 rounded-lg hover:bg-green-200">Approve</button><button onClick={() => handleReviewRsvp(r.id, 'REJECTED')} className="px-3 py-1.5 text-sm bg-red-100 text-red-700 rounded-lg hover:bg-red-200">Reject</button></div>}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        )}

        {activeTab === 'media' && (
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <p className="text-surface-600">{media.length} message(s)</p>
              {media.length > 0 && <button onClick={downloadAllMedia} className="btn-primary"><svg className="w-4 h-4 mr-2" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" /></svg>Download All</button>}
            </div>
            {media.length === 0 ? (
              <div className="bg-white rounded-xl shadow-sm border border-surface-200 p-12 text-center">
                <svg className="w-12 h-12 mx-auto text-surface-400 mb-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 10l4.553-2.276A1 1 0 0121 8.618v6.764a1 1 0 01-1.447.894L15 14M5 18h8a2 2 0 002-2V8a2 2 0 00-2-2H5a2 2 0 00-2 2v8a2 2 0 002 2z" /></svg>
                <h3 className="text-lg font-medium text-navy-900 mb-1">No messages yet</h3>
                <p className="text-surface-600">Guest messages will appear here</p>
              </div>
            ) : (
              <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-4">
                {media.map(m => (
                  <div key={m.id} onClick={() => setPreviewMedia(m)} className="bg-white rounded-xl shadow-sm border border-surface-200 overflow-hidden cursor-pointer hover:shadow-md transition-shadow group">
                    <div className="aspect-square bg-surface-100 flex items-center justify-center relative">
                      {m.type === 'PHOTO' ? <img src={`${API_BASE_URL}${m.filePath}`} alt="" className="w-full h-full object-cover" /> : <div className={cn('w-16 h-16 rounded-full flex items-center justify-center', m.type === 'VIDEO' ? 'bg-red-100 text-red-500' : 'bg-purple-100 text-purple-500')}><Icon type={m.type} /></div>}
                      <div className="absolute inset-0 bg-navy-900/0 group-hover:bg-navy-900/30 transition-colors flex items-center justify-center"><svg className="w-10 h-10 text-white opacity-0 group-hover:opacity-100 transition-opacity" fill="currentColor" viewBox="0 0 24 24"><path d="M8 5v14l11-7z" /></svg></div>
                    </div>
                    <div className="p-3"><p className="font-medium text-navy-900 text-sm truncate">{m.guestName || 'Anonymous'}</p><p className="text-xs text-surface-500">{formatDate(m.createdAt, 'MMM d, h:mm a')}</p></div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {activeTab === 'checkins' && (
          <div className="space-y-4">
            <p className="text-surface-600">{checkIns.length} guest(s) checked in</p>
            <div className="bg-white rounded-xl shadow-sm border border-surface-200 overflow-hidden">
              <div className="overflow-x-auto">
                <table className="w-full">
                  <thead><tr className="border-b border-surface-200 bg-surface-50">
                    <th className="text-left py-3 px-4 text-sm font-medium text-surface-600">Guest</th>
                    <th className="text-left py-3 px-4 text-sm font-medium text-surface-600">Party Size</th>
                    <th className="text-left py-3 px-4 text-sm font-medium text-surface-600">Checked In At</th>
                  </tr></thead>
                  <tbody>
                    {checkIns.length === 0 ? <tr><td colSpan={3} className="py-12 text-center text-surface-500">No check-ins yet</td></tr> : checkIns.map(c => (
                      <tr key={c.id} className="border-b border-surface-100 hover:bg-surface-50">
                        <td className="py-3 px-4"><p className="font-medium text-navy-900">{c.invitation.rsvp.primaryName}</p>{c.invitation.rsvp.secondaryName && <p className="text-sm text-surface-500">& {c.invitation.rsvp.secondaryName}</p>}</td>
                        <td className="py-3 px-4 text-surface-600">{c.invitation.rsvp.guestCount}</td>
                        <td className="py-3 px-4 text-surface-600">{formatDate(c.checkedInAt, 'MMM d, h:mm a')}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        )}
      </main>

      {previewMedia && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80" onClick={() => setPreviewMedia(null)}>
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-4xl max-h-[90vh] overflow-hidden" onClick={e => e.stopPropagation()}>
            <div className="flex items-center justify-between px-6 py-4 border-b border-surface-200">
              <div><h2 className="font-semibold text-navy-900">{previewMedia.guestName || 'Anonymous'}</h2><p className="text-sm text-surface-500">{formatDate(previewMedia.createdAt, 'MMMM d, yyyy h:mm a')}</p></div>
              <button onClick={() => setPreviewMedia(null)} className="p-2 rounded-lg hover:bg-surface-100"><svg className="w-6 h-6 text-surface-500" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg></button>
            </div>
            <div className="p-6 bg-surface-100 min-h-[50vh] flex items-center justify-center">
              {previewMedia.type === 'PHOTO' && <img src={`${API_BASE_URL}${previewMedia.filePath}`} alt="" className="max-h-[60vh] mx-auto rounded-lg" />}
              {previewMedia.type === 'VIDEO' && <video src={`${API_BASE_URL}${previewMedia.filePath}`} controls autoPlay className="max-h-[60vh] mx-auto rounded-lg" />}
              {previewMedia.type === 'AUDIO' && <audio src={`${API_BASE_URL}${previewMedia.filePath}`} controls autoPlay className="w-full max-w-md" />}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
