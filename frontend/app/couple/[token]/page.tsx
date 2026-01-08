'use client';

import { useEffect, useState, useRef } from 'react';
import { useParams } from 'next/navigation';
import { coupleApi, API_BASE_URL } from '@/lib/api';
import MediaGallery from '@/components/media/MediaGallery';
import { formatDate, cn } from '@/lib/utils';
import toast from 'react-hot-toast';

// Types
interface Event {
  id: string;
  name: string;
  slug: string;
  date: string;
  venue: string | null;
  currentPhase: string;
  invitationOnly: boolean;
  reelEnabled?: boolean;
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

// SVG Icons
const Icons = {
  video: <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M15 10l4.553-2.276A1 1 0 0121 8.618v6.764a1 1 0 01-1.447.894L15 14M5 18h8a2 2 0 002-2V8a2 2 0 00-2-2H5a2 2 0 00-2 2v8a2 2 0 002 2z" /></svg>,
  audio: <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M19 11a7 7 0 01-7 7m0 0a7 7 0 01-7-7m7 7v4m0 0H8m4 0h4m-4-8a3 3 0 01-3-3V5a3 3 0 116 0v6a3 3 0 01-3 3z" /></svg>,
  photo: <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" /></svg>,
  download: <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" /></svg>,
  play: <svg className="w-6 h-6" fill="currentColor" viewBox="0 0 24 24"><path d="M8 5v14l11-7z" /></svg>,
  pause: <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 24 24"><path d="M6 4h4v16H6V4zm8 0h4v16h-4V4z" /></svg>,
  close: <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg>,
  export: <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 10v6m0 0l-3-3m3 3l3-3m2 8H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" /></svg>,
  rsvp: <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>,
  users: <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M12 4.354a4 4 0 110 5.292M15 21H3v-1a6 6 0 0112 0v1zm0 0h6v-1a6 6 0 00-9-5.197M13 7a4 4 0 11-8 0 4 4 0 018 0z" /></svg>,
  checkin: <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-6 9l2 2 4-4" /></svg>,
  message: <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" /></svg>,
  reel: <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M7 4v16M17 4v16M3 8h4m10 0h4M3 12h18M3 16h4m10 0h4M4 20h16a1 1 0 001-1V5a1 1 0 00-1-1H4a1 1 0 00-1 1v14a1 1 0 001 1z" /></svg>,
  chevronDown: <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" /></svg>,
};

// Custom Video Player
function VideoPlayer({ src, onClose }: { src: string; onClose: () => void }) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const [playing, setPlaying] = useState(true);
  const [progress, setProgress] = useState(0);
  const [duration, setDuration] = useState(0);

  const togglePlay = () => {
    if (videoRef.current) {
      if (playing) videoRef.current.pause();
      else videoRef.current.play();
      setPlaying(!playing);
    }
  };

  const handleSeek = (e: React.MouseEvent<HTMLDivElement>) => {
    if (videoRef.current) {
      const rect = e.currentTarget.getBoundingClientRect();
      videoRef.current.currentTime = ((e.clientX - rect.left) / rect.width) * videoRef.current.duration;
    }
  };

  const formatTime = (s: number) => `${Math.floor(s / 60)}:${Math.floor(s % 60).toString().padStart(2, '0')}`;

  return (
    <div className="relative bg-black rounded-xl overflow-hidden max-w-4xl w-full">
      <button onClick={onClose} className="absolute top-4 right-4 z-20 p-2 rounded-full bg-black/50 text-white/80 hover:text-white hover:bg-black/70 transition-colors">{Icons.close}</button>
      <video
        ref={videoRef}
        src={src}
        className="w-full max-h-[70vh]"
        autoPlay
        onTimeUpdate={() => videoRef.current && setProgress((videoRef.current.currentTime / videoRef.current.duration) * 100)}
        onLoadedMetadata={() => setDuration(videoRef.current?.duration || 0)}
        onEnded={() => setPlaying(false)}
        onClick={togglePlay}
      />
      <div className="absolute bottom-0 left-0 right-0 bg-gradient-to-t from-black/80 to-transparent p-4 pt-10">
        <div onClick={handleSeek} className="h-1 bg-white/30 rounded-full cursor-pointer mb-3">
          <div className="h-full bg-white rounded-full" style={{ width: `${progress}%` }} />
        </div>
        <div className="flex items-center justify-between">
          <button onClick={togglePlay} className="p-2 rounded-full bg-white/10 hover:bg-white/20 text-white transition-colors">
            {playing ? Icons.pause : Icons.play}
          </button>
          <span className="text-white/70 text-sm font-mono">{formatTime(videoRef.current?.currentTime || 0)} / {formatTime(duration)}</span>
        </div>
      </div>
    </div>
  );
}

// Custom Audio Player
function AudioPlayer({ src, guestName, onClose }: { src: string; guestName: string; onClose: () => void }) {
  const audioRef = useRef<HTMLAudioElement>(null);
  const [playing, setPlaying] = useState(true);
  const [progress, setProgress] = useState(0);

  const togglePlay = () => {
    if (audioRef.current) {
      if (playing) audioRef.current.pause();
      else audioRef.current.play();
      setPlaying(!playing);
    }
  };

  const handleSeek = (e: React.MouseEvent<HTMLDivElement>) => {
    if (audioRef.current) {
      const rect = e.currentTarget.getBoundingClientRect();
      audioRef.current.currentTime = ((e.clientX - rect.left) / rect.width) * audioRef.current.duration;
    }
  };

  return (
    <div className="bg-white rounded-xl p-8 max-w-md w-full shadow-2xl">
      <button onClick={onClose} className="absolute top-4 right-4 p-2 rounded-full bg-surface-100 text-surface-500 hover:bg-surface-200 transition-colors">{Icons.close}</button>
      <audio ref={audioRef} src={src} autoPlay onTimeUpdate={() => audioRef.current && setProgress((audioRef.current.currentTime / audioRef.current.duration) * 100)} onEnded={() => setPlaying(false)} />
      <div className="w-20 h-20 mx-auto mb-6 rounded-full bg-surface-100 flex items-center justify-center text-surface-400">{Icons.audio}</div>
      <h3 className="text-lg font-medium text-navy-900 text-center mb-1">{guestName || 'Voice Message'}</h3>
      <p className="text-sm text-surface-500 text-center mb-6">Audio Message</p>
      <div onClick={handleSeek} className="h-1.5 bg-surface-200 rounded-full cursor-pointer mb-4">
        <div className="h-full bg-navy-900 rounded-full transition-all" style={{ width: `${progress}%` }} />
      </div>
      <button onClick={togglePlay} className="w-full py-3 rounded-lg bg-navy-900 text-white font-medium hover:bg-navy-800 transition-colors flex items-center justify-center gap-2">
        {playing ? Icons.pause : Icons.play}
        {playing ? 'Pause' : 'Play'}
      </button>
    </div>
  );
}

// Export helper
function exportToCSV(data: any[], filename: string, columns: { key: string; label: string }[]) {
  const getValue = (row: any, key: string) => key.split('.').reduce((obj, k) => obj?.[k], row);
  const header = columns.map(c => c.label).join(',');
  const rows = data.map(row => columns.map(c => {
    const val = getValue(row, c.key);
    return typeof val === 'string' && val.includes(',') ? `"${val}"` : val ?? '';
  }).join(','));
  const blob = new Blob([[header, ...rows].join('\n')], { type: 'text/csv' });
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob);
  a.download = filename;
  a.click();
}

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
  const [lastUpdated, setLastUpdated] = useState<Date>(new Date());
  const [exportOpen, setExportOpen] = useState(false);

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
      if (activeTab === 'rsvps') fetchRsvps();
      if (activeTab === 'media') fetchMedia();
      if (activeTab === 'checkins') fetchCheckIns();
    }
  }, [activeTab, event]);

  const fetchEvent = async (silent = false) => {
    try {
      const response = await coupleApi.getEvent(token);
      setEvent(response.data.event);
      if (!silent) setLoading(false);
      setLastUpdated(new Date());
    } catch (err: any) {
      if (!silent) { setError(err.response?.data?.error || 'Invalid access token'); setLoading(false); }
    }
  };

  const fetchRsvps = async (silent = false) => {
    try {
      const response = await coupleApi.getRsvps(token, rsvpFilter !== 'all' ? { status: rsvpFilter } : undefined);
      setRsvps(response.data.rsvps);
    } catch { if (!silent) toast.error('Failed to load RSVPs'); }
  };

  const fetchMedia = async (silent = false) => {
    try { const response = await coupleApi.getMedia(token); setMedia(response.data.media); }
    catch { if (!silent) toast.error('Failed to load media'); }
  };

  const fetchCheckIns = async (silent = false) => {
    try { const response = await coupleApi.getCheckIns(token); setCheckIns(response.data.checkIns); }
    catch { if (!silent) toast.error('Failed to load check-ins'); }
  };

  const handleReviewRsvp = async (rsvpId: string, status: 'APPROVED' | 'REJECTED') => {
    try {
      await coupleApi.reviewRsvp(token, rsvpId, status);
      toast.success(`RSVP ${status.toLowerCase()}`);
      fetchRsvps(); fetchEvent();
    } catch (err: any) { toast.error(err.response?.data?.error || 'Failed'); }
  };

  const exportRsvps = (filter: string) => {
    const filtered = filter === 'all' ? rsvps : rsvps.filter(r => r.status === filter);
    exportToCSV(filtered, `rsvps-${filter}.csv`, [
      { key: 'primaryName', label: 'Name' }, { key: 'secondaryName', label: 'Guest' },
      { key: 'email', label: 'Email' }, { key: 'phone', label: 'Phone' },
      { key: 'attendance', label: 'Attendance' }, { key: 'guestCount', label: 'Guests' },
      { key: 'status', label: 'Status' }, { key: 'submittedAt', label: 'Submitted' },
    ]);
    toast.success(`Exported ${filtered.length} RSVPs`);
    setExportOpen(false);
  };

  const exportCheckIns = () => {
    exportToCSV(checkIns, 'checkins.csv', [
      { key: 'invitation.rsvp.primaryName', label: 'Guest' },
      { key: 'invitation.rsvp.guestCount', label: 'Party Size' },
      { key: 'checkedInAt', label: 'Checked In' },
    ]);
    toast.success(`Exported ${checkIns.length} check-ins`);
  };

  const pendingCount = rsvps.filter(r => r.status === 'PENDING').length;

  const getStatusBadge = (status: string) => {
    const styles: Record<string, string> = {
      PENDING: 'bg-amber-50 text-amber-700 border-amber-200',
      APPROVED: 'bg-green-50 text-green-700 border-green-200',
      REJECTED: 'bg-red-50 text-red-700 border-red-200',
      YES: 'bg-green-50 text-green-700 border-green-200',
      NO: 'bg-red-50 text-red-700 border-red-200',
      MAYBE: 'bg-blue-50 text-blue-700 border-blue-200',
    };
    return `px-2 py-0.5 rounded border text-xs font-medium ${styles[status] || 'bg-surface-50 text-surface-600 border-surface-200'}`;
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-surface-50 flex items-center justify-center">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-navy-900" />
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen bg-surface-50 flex items-center justify-center p-4">
        <div className="text-center max-w-sm">
          <div className="w-14 h-14 mx-auto rounded-full bg-red-50 flex items-center justify-center mb-4 text-red-500">{Icons.close}</div>
          <h1 className="text-xl font-semibold text-navy-900 mb-2">Access Denied</h1>
          <p className="text-surface-500">{error}</p>
        </div>
      </div>
    );
  }

  if (!event) return null;

  return (
    <div className="min-h-screen bg-surface-50">
      {/* Header */}
      <header className="bg-white border-b border-surface-200 sticky top-0 z-40">
        <div className="max-w-6xl mx-auto px-4 sm:px-6">
          <div className="flex items-center justify-between h-14">
            <div className="min-w-0">
              <h1 className="text-lg font-semibold text-navy-900 truncate">{event.name}</h1>
            </div>
            <div className="flex items-center gap-3">
              <span className="text-xs text-surface-400 hidden sm:block">Updated {formatDate(lastUpdated.toISOString(), 'h:mm a')}</span>
              <span className={cn(
                'px-2 py-1 rounded text-xs font-medium',
                event.currentPhase === 'LIVE' ? 'bg-green-50 text-green-700' : 'bg-surface-100 text-surface-600'
              )}>
                {event.currentPhase === 'LIVE' && <span className="inline-block w-1.5 h-1.5 rounded-full bg-green-500 mr-1.5 animate-pulse" />}
                {event.currentPhase.replace('_', ' ')}
              </span>
            </div>
          </div>
        </div>
      </header>

      {/* Tabs */}
      <nav className="bg-white border-b border-surface-200 sticky top-14 z-30">
        <div className="max-w-6xl mx-auto px-4 sm:px-6">
          <div className="flex gap-1 -mb-px overflow-x-auto py-1">
            {([
              { id: 'dashboard', label: 'Overview', icon: Icons.rsvp },
              { id: 'rsvps', label: 'RSVPs', icon: Icons.users, badge: pendingCount },
              { id: 'media', label: 'Media', icon: Icons.message },
              { id: 'checkins', label: 'Check-ins', icon: Icons.checkin },
            ] as { id: Tab; label: string; icon: JSX.Element; badge?: number }[]).map(tab => (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                className={cn(
                  'flex items-center gap-2 px-4 py-2.5 text-sm font-medium rounded-lg transition-colors whitespace-nowrap',
                  activeTab === tab.id ? 'bg-navy-900 text-white' : 'text-surface-600 hover:bg-surface-100'
                )}
              >
                {tab.icon}
                {tab.label}
                {tab.badge !== undefined && tab.badge > 0 && (
                  <span className={cn('px-1.5 py-0.5 rounded-full text-xs', activeTab === tab.id ? 'bg-white/20' : 'bg-amber-100 text-amber-700')}>{tab.badge}</span>
                )}
              </button>
            ))}
          </div>
        </div>
      </nav>

      {/* Content */}
      <main className="max-w-6xl mx-auto px-4 sm:px-6 py-6">
        {/* Dashboard */}
        {activeTab === 'dashboard' && (
          <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-4">
            {[
              { label: 'Total RSVPs', value: event._count.rsvps, icon: Icons.rsvp },
              { label: 'Approved', value: event._count.invitations, icon: Icons.users },
              { label: 'Checked In', value: event._count.checkIns, icon: Icons.checkin },
              { label: 'Messages', value: event._count.mediaAssets, icon: Icons.message },
            ].map(stat => (
              <div key={stat.label} className="bg-white rounded-xl border border-surface-200 p-5 hover:border-surface-300 transition-colors">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm text-surface-500 mb-1">{stat.label}</p>
                    <p className="text-2xl font-bold text-navy-900">{stat.value}</p>
                  </div>
                  <div className="w-10 h-10 rounded-lg bg-surface-50 flex items-center justify-center text-surface-400">{stat.icon}</div>
                </div>
              </div>
            ))}

            <div className="sm:col-span-2 lg:col-span-4 bg-white rounded-xl border border-surface-200 p-5">
              <div className="flex items-center justify-between mb-4">
                <h3 className="font-medium text-navy-900">Recent Messages</h3>
                <button onClick={() => setActiveTab('media')} className="text-sm text-surface-500 hover:text-navy-900 transition-colors">View all</button>
              </div>
              {media.length === 0 ? (
                <p className="text-surface-400 text-center py-8">No messages yet</p>
              ) : (
                <div className="grid grid-cols-4 sm:grid-cols-6 gap-2">
                  {media.slice(0, 6).map(m => (
                    <div key={m.id} onClick={() => setPreviewMedia(m)} className="aspect-square bg-surface-100 rounded-lg cursor-pointer hover:opacity-80 transition-opacity flex items-center justify-center overflow-hidden">
                      {m.type === 'PHOTO' ? (
                        <img src={`${API_BASE_URL}${m.filePath}`} alt="" className="w-full h-full object-cover" />
                      ) : (
                        <div className="text-surface-400">{m.type === 'VIDEO' ? Icons.video : Icons.audio}</div>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        )}

        {/* RSVPs */}
        {activeTab === 'rsvps' && (
          <div className="space-y-4">
            <div className="flex flex-wrap items-center justify-between gap-4">
              <div className="flex gap-1 bg-white rounded-lg p-1 border border-surface-200">
                {['all', 'PENDING', 'APPROVED', 'REJECTED'].map(s => (
                  <button key={s} onClick={() => { setRsvpFilter(s); fetchRsvps(); }} className={cn(
                    'px-3 py-1.5 rounded-md text-sm font-medium transition-colors',
                    rsvpFilter === s ? 'bg-navy-900 text-white' : 'text-surface-600 hover:bg-surface-50'
                  )}>
                    {s === 'all' ? 'All' : s.charAt(0) + s.slice(1).toLowerCase()}
                  </button>
                ))}
              </div>
              <div className="relative">
                <button onClick={() => setExportOpen(!exportOpen)} className="btn-outline flex items-center gap-2">
                  {Icons.export} Export {Icons.chevronDown}
                </button>
                {exportOpen && (
                  <div className="absolute right-0 top-full mt-1 bg-white rounded-lg shadow-lg border border-surface-200 py-1 min-w-[140px] z-10">
                    {['all', 'PENDING', 'APPROVED', 'REJECTED'].map(f => (
                      <button key={f} onClick={() => exportRsvps(f)} className="w-full px-4 py-2 text-left text-sm hover:bg-surface-50 transition-colors">
                        {f === 'all' ? 'All RSVPs' : f.charAt(0) + f.slice(1).toLowerCase()}
                      </button>
                    ))}
                  </div>
                )}
              </div>
            </div>

            <div className="bg-white rounded-xl border border-surface-200 overflow-hidden">
              <div className="overflow-x-auto">
                <table className="w-full">
                  <thead><tr className="border-b border-surface-100 bg-surface-50">
                    <th className="text-left py-3 px-4 text-xs font-medium text-surface-500 uppercase tracking-wider">Guest</th>
                    <th className="text-left py-3 px-4 text-xs font-medium text-surface-500 uppercase tracking-wider">Response</th>
                    <th className="text-left py-3 px-4 text-xs font-medium text-surface-500 uppercase tracking-wider">Status</th>
                    <th className="text-right py-3 px-4 text-xs font-medium text-surface-500 uppercase tracking-wider">Actions</th>
                  </tr></thead>
                  <tbody className="divide-y divide-surface-100">
                    {rsvps.length === 0 ? <tr><td colSpan={4} className="py-12 text-center text-surface-400">No RSVPs</td></tr> : rsvps.map(r => (
                      <tr key={r.id} className="hover:bg-surface-50 transition-colors">
                        <td className="py-3 px-4">
                          <p className="font-medium text-navy-900">{r.primaryName}</p>
                          {r.secondaryName && <p className="text-sm text-surface-500">& {r.secondaryName}</p>}
                          {r.email && <p className="text-xs text-surface-400">{r.email}</p>}
                        </td>
                        <td className="py-3 px-4">
                          <span className={getStatusBadge(r.attendance)}>{r.attendance}</span>
                          <p className="text-sm text-surface-500 mt-1">{r.guestCount} guest(s)</p>
                        </td>
                        <td className="py-3 px-4">
                          <span className={getStatusBadge(r.status)}>{r.status}</span>
                          {r.invitation?.isCheckedIn && <p className="text-xs text-green-600 mt-1">Checked in</p>}
                        </td>
                        <td className="py-3 px-4 text-right">
                          {r.status === 'PENDING' && (
                            <div className="flex justify-end gap-2">
                              <button onClick={() => handleReviewRsvp(r.id, 'APPROVED')} className="px-3 py-1.5 text-sm bg-green-50 text-green-700 rounded-lg hover:bg-green-100 transition-colors font-medium">Approve</button>
                              <button onClick={() => handleReviewRsvp(r.id, 'REJECTED')} className="px-3 py-1.5 text-sm bg-surface-100 text-surface-600 rounded-lg hover:bg-surface-200 transition-colors font-medium">Reject</button>
                            </div>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        )}

        {/* Media */}
        {activeTab === 'media' && (
          <MediaGallery
            eventId={event.id}
            eventSlug={event.slug}
            media={media.map(m => ({ ...m, fileName: m.filePath.split('/').pop() || '', thumbnailPath: null, fileSize: undefined }))}
            reelEnabled={event.reelEnabled}
            onRefresh={fetchMedia}
            isAdmin={false}
            coupleToken={token as string}
          />
        )}

        {/* Check-ins */}
        {activeTab === 'checkins' && (
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <p className="text-surface-500">{checkIns.length} guest(s) checked in</p>
              {checkIns.length > 0 && (
                <button onClick={exportCheckIns} className="btn-outline flex items-center gap-2">{Icons.export} Export</button>
              )}
            </div>
            <div className="bg-white rounded-xl border border-surface-200 overflow-hidden">
              <div className="overflow-x-auto">
                <table className="w-full">
                  <thead><tr className="border-b border-surface-100 bg-surface-50">
                    <th className="text-left py-3 px-4 text-xs font-medium text-surface-500 uppercase tracking-wider">Guest</th>
                    <th className="text-left py-3 px-4 text-xs font-medium text-surface-500 uppercase tracking-wider">Party</th>
                    <th className="text-left py-3 px-4 text-xs font-medium text-surface-500 uppercase tracking-wider">Time</th>
                  </tr></thead>
                  <tbody className="divide-y divide-surface-100">
                    {checkIns.length === 0 ? <tr><td colSpan={3} className="py-12 text-center text-surface-400">No check-ins yet</td></tr> : checkIns.map(c => (
                      <tr key={c.id} className="hover:bg-surface-50 transition-colors">
                        <td className="py-3 px-4">
                          <p className="font-medium text-navy-900">{c.invitation.rsvp.primaryName}</p>
                          {c.invitation.rsvp.secondaryName && <p className="text-sm text-surface-500">& {c.invitation.rsvp.secondaryName}</p>}
                        </td>
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

      {/* Media Preview Modal */}
      {previewMedia && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/90" onClick={() => setPreviewMedia(null)}>
          <div onClick={e => e.stopPropagation()} className="relative">
            {previewMedia.type === 'PHOTO' && (
              <div className="relative">
                <button onClick={() => setPreviewMedia(null)} className="absolute top-4 right-4 z-10 p-2 rounded-full bg-black/50 text-white/80 hover:text-white transition-colors">{Icons.close}</button>
                <img src={`${API_BASE_URL}${previewMedia.filePath}`} alt="" className="max-h-[80vh] rounded-xl shadow-2xl" />
              </div>
            )}
            {previewMedia.type === 'VIDEO' && <VideoPlayer src={`${API_BASE_URL}${previewMedia.filePath}`} onClose={() => setPreviewMedia(null)} />}
            {previewMedia.type === 'AUDIO' && <AudioPlayer src={`${API_BASE_URL}${previewMedia.filePath}`} guestName={previewMedia.guestName || ''} onClose={() => setPreviewMedia(null)} />}
          </div>
        </div>
      )}
    </div>
  );
}
