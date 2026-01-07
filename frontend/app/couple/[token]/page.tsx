'use client';

import { useEffect, useState, useRef } from 'react';
import { useParams } from 'next/navigation';
import { coupleApi, API_BASE_URL } from '@/lib/api';
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
type MediaTab = 'all' | 'photos' | 'messages';

// Custom Icons
const Icons = {
  video: <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 10l4.553-2.276A1 1 0 0121 8.618v6.764a1 1 0 01-1.447.894L15 14M5 18h8a2 2 0 002-2V8a2 2 0 00-2-2H5a2 2 0 00-2 2v8a2 2 0 002 2z" /></svg>,
  audio: <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 11a7 7 0 01-7 7m0 0a7 7 0 01-7-7m7 7v4m0 0H8m4 0h4m-4-8a3 3 0 01-3-3V5a3 3 0 116 0v6a3 3 0 01-3 3z" /></svg>,
  photo: <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" /></svg>,
  download: <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" /></svg>,
  play: <svg className="w-8 h-8" fill="currentColor" viewBox="0 0 24 24"><path d="M8 5v14l11-7z" /></svg>,
  pause: <svg className="w-6 h-6" fill="currentColor" viewBox="0 0 24 24"><path d="M6 4h4v16H6V4zm8 0h4v16h-4V4z" /></svg>,
  close: <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg>,
  export: <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 10v6m0 0l-3-3m3 3l3-3m2 8H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" /></svg>,
};

// Custom Video Player Component
function VideoPlayer({ src, onClose }: { src: string; onClose: () => void }) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const [playing, setPlaying] = useState(false);
  const [progress, setProgress] = useState(0);
  const [duration, setDuration] = useState(0);

  const togglePlay = () => {
    if (videoRef.current) {
      if (playing) {
        videoRef.current.pause();
      } else {
        videoRef.current.play();
      }
      setPlaying(!playing);
    }
  };

  const handleTimeUpdate = () => {
    if (videoRef.current) {
      setProgress((videoRef.current.currentTime / videoRef.current.duration) * 100);
    }
  };

  const handleSeek = (e: React.MouseEvent<HTMLDivElement>) => {
    if (videoRef.current) {
      const rect = e.currentTarget.getBoundingClientRect();
      const pos = (e.clientX - rect.left) / rect.width;
      videoRef.current.currentTime = pos * videoRef.current.duration;
    }
  };

  const formatTime = (seconds: number) => {
    const m = Math.floor(seconds / 60);
    const s = Math.floor(seconds % 60);
    return `${m}:${s.toString().padStart(2, '0')}`;
  };

  return (
    <div className="relative bg-black rounded-2xl overflow-hidden max-w-4xl w-full">
      <button onClick={onClose} className="absolute top-4 right-4 z-20 p-2 rounded-full bg-black/50 text-white hover:bg-black/70 transition-colors">
        {Icons.close}
      </button>
      <video
        ref={videoRef}
        src={src}
        className="w-full max-h-[70vh] object-contain"
        onTimeUpdate={handleTimeUpdate}
        onLoadedMetadata={() => setDuration(videoRef.current?.duration || 0)}
        onEnded={() => setPlaying(false)}
        onClick={togglePlay}
      />
      {/* Custom Controls */}
      <div className="absolute bottom-0 left-0 right-0 bg-gradient-to-t from-black/90 to-transparent p-4 pt-12">
        <div onClick={handleSeek} className="h-1.5 bg-white/30 rounded-full cursor-pointer mb-3 group">
          <div className="h-full bg-primary-500 rounded-full relative transition-all" style={{ width: `${progress}%` }}>
            <div className="absolute right-0 top-1/2 -translate-y-1/2 w-4 h-4 bg-white rounded-full opacity-0 group-hover:opacity-100 transition-opacity shadow-lg" />
          </div>
        </div>
        <div className="flex items-center justify-between">
          <button onClick={togglePlay} className="p-3 rounded-full bg-white/10 hover:bg-white/20 text-white transition-colors">
            {playing ? Icons.pause : Icons.play}
          </button>
          <span className="text-white/80 text-sm font-mono">
            {formatTime(videoRef.current?.currentTime || 0)} / {formatTime(duration)}
          </span>
        </div>
      </div>
    </div>
  );
}

// Custom Audio Player Component
function AudioPlayer({ src, guestName, onClose }: { src: string; guestName: string; onClose: () => void }) {
  const audioRef = useRef<HTMLAudioElement>(null);
  const [playing, setPlaying] = useState(false);
  const [progress, setProgress] = useState(0);
  const [duration, setDuration] = useState(0);

  const togglePlay = () => {
    if (audioRef.current) {
      if (playing) {
        audioRef.current.pause();
      } else {
        audioRef.current.play();
      }
      setPlaying(!playing);
    }
  };

  const handleTimeUpdate = () => {
    if (audioRef.current) {
      setProgress((audioRef.current.currentTime / audioRef.current.duration) * 100);
    }
  };

  const handleSeek = (e: React.MouseEvent<HTMLDivElement>) => {
    if (audioRef.current) {
      const rect = e.currentTarget.getBoundingClientRect();
      const pos = (e.clientX - rect.left) / rect.width;
      audioRef.current.currentTime = pos * audioRef.current.duration;
    }
  };

  const formatTime = (seconds: number) => {
    const m = Math.floor(seconds / 60);
    const s = Math.floor(seconds % 60);
    return `${m}:${s.toString().padStart(2, '0')}`;
  };

  return (
    <div className="bg-gradient-to-br from-navy-900 to-navy-800 rounded-2xl p-8 max-w-md w-full shadow-2xl">
      <button onClick={onClose} className="absolute top-4 right-4 p-2 rounded-full bg-white/10 text-white hover:bg-white/20 transition-colors">
        {Icons.close}
      </button>
      <audio
        ref={audioRef}
        src={src}
        onTimeUpdate={handleTimeUpdate}
        onLoadedMetadata={() => setDuration(audioRef.current?.duration || 0)}
        onEnded={() => setPlaying(false)}
      />
      {/* Album Art Placeholder */}
      <div className="w-40 h-40 mx-auto mb-6 rounded-2xl bg-gradient-to-br from-primary-400 to-primary-600 flex items-center justify-center shadow-lg">
        <div className="w-20 h-20 rounded-full bg-white/20 flex items-center justify-center animate-pulse">
          {Icons.audio}
        </div>
      </div>
      <h3 className="text-white text-xl font-medium text-center mb-2">{guestName || 'Voice Message'}</h3>
      <p className="text-white/60 text-sm text-center mb-6">Audio Message</p>
      {/* Progress Bar */}
      <div onClick={handleSeek} className="h-2 bg-white/20 rounded-full cursor-pointer mb-4 group">
        <div className="h-full bg-primary-500 rounded-full relative transition-all" style={{ width: `${progress}%` }}>
          <div className="absolute right-0 top-1/2 -translate-y-1/2 w-4 h-4 bg-white rounded-full opacity-0 group-hover:opacity-100 transition-opacity shadow-lg" />
        </div>
      </div>
      <div className="flex items-center justify-between text-white/60 text-sm mb-4 font-mono">
        <span>{formatTime(audioRef.current?.currentTime || 0)}</span>
        <span>{formatTime(duration)}</span>
      </div>
      {/* Play Button */}
      <button onClick={togglePlay} className="w-full py-4 rounded-xl bg-primary-500 text-navy-900 font-semibold hover:bg-primary-400 transition-colors flex items-center justify-center gap-2">
        {playing ? Icons.pause : Icons.play}
        {playing ? 'Pause' : 'Play'}
      </button>
    </div>
  );
}

// Photo Viewer Component
function PhotoViewer({ src, guestName, onClose }: { src: string; guestName: string; onClose: () => void }) {
  return (
    <div className="relative max-w-5xl w-full">
      <button onClick={onClose} className="absolute top-4 right-4 z-20 p-2 rounded-full bg-black/50 text-white hover:bg-black/70 transition-colors">
        {Icons.close}
      </button>
      <img src={src} alt="" className="max-h-[80vh] mx-auto rounded-2xl shadow-2xl object-contain" />
      {guestName && (
        <div className="absolute bottom-4 left-1/2 -translate-x-1/2 px-6 py-3 bg-black/60 backdrop-blur-sm rounded-full text-white">
          <span className="font-medium">{guestName}</span>
        </div>
      )}
    </div>
  );
}

// Media Thumbnail Component
function MediaThumbnail({ media, onClick, onDownload }: { media: MediaAsset; onClick: () => void; onDownload: (e: React.MouseEvent) => void }) {
  const getMediaIcon = () => {
    switch (media.type) {
      case 'VIDEO': return <div className="w-12 h-12 rounded-full bg-red-500/90 flex items-center justify-center text-white">{Icons.video}</div>;
      case 'AUDIO': return <div className="w-12 h-12 rounded-full bg-purple-500/90 flex items-center justify-center text-white">{Icons.audio}</div>;
      default: return null;
    }
  };

  return (
    <div onClick={onClick} className="group relative bg-white rounded-xl shadow-sm border border-surface-200 overflow-hidden cursor-pointer hover:shadow-lg transition-all duration-300 hover:-translate-y-1">
      <div className="aspect-square bg-surface-100 flex items-center justify-center relative overflow-hidden">
        {media.type === 'PHOTO' ? (
          <img src={`${API_BASE_URL}${media.filePath}`} alt="" className="w-full h-full object-cover transition-transform duration-300 group-hover:scale-105" />
        ) : (
          <div className={cn(
            'w-full h-full flex items-center justify-center',
            media.type === 'VIDEO' ? 'bg-gradient-to-br from-red-50 to-red-100' : 'bg-gradient-to-br from-purple-50 to-purple-100'
          )}>
            {getMediaIcon()}
          </div>
        )}
        {/* Hover Overlay */}
        <div className="absolute inset-0 bg-navy-900/0 group-hover:bg-navy-900/40 transition-colors flex items-center justify-center">
          <div className="w-12 h-12 rounded-full bg-white/90 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity scale-75 group-hover:scale-100">
            {Icons.play}
          </div>
        </div>
        {/* Download Button */}
        <button 
          onClick={onDownload}
          className="absolute top-2 right-2 p-2 rounded-lg bg-white/90 text-surface-700 opacity-0 group-hover:opacity-100 transition-opacity hover:bg-white shadow-sm z-10"
        >
          {Icons.download}
        </button>
        {/* Duration Badge */}
        {media.duration && (
          <div className="absolute bottom-2 right-2 px-2 py-1 rounded bg-black/70 text-white text-xs font-mono">
            {Math.floor(media.duration / 60)}:{(media.duration % 60).toString().padStart(2, '0')}
          </div>
        )}
      </div>
      <div className="p-3">
        <p className="font-medium text-navy-900 text-sm truncate">{media.guestName || 'Anonymous'}</p>
        <p className="text-xs text-surface-500">{formatDate(media.createdAt, 'MMM d, h:mm a')}</p>
      </div>
    </div>
  );
}

// Export helper
function exportToCSV(data: any[], filename: string, columns: { key: string; label: string }[]) {
  const header = columns.map(c => c.label).join(',');
  const rows = data.map(row => 
    columns.map(c => {
      const value = c.key.split('.').reduce((obj, key) => obj?.[key], row);
      return typeof value === 'string' && value.includes(',') ? `"${value}"` : value ?? '';
    }).join(',')
  );
  const csv = [header, ...rows].join('\n');
  const blob = new Blob([csv], { type: 'text/csv' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
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
  const [mediaTab, setMediaTab] = useState<MediaTab>('all');
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
      if (!silent) {
        setError(err.response?.data?.error || 'Invalid access token');
        setLoading(false);
      }
    }
  };

  const fetchRsvps = async (silent = false) => {
    try {
      const response = await coupleApi.getRsvps(token, rsvpFilter !== 'all' ? { status: rsvpFilter } : undefined);
      setRsvps(response.data.rsvps);
    } catch (err) {
      if (!silent) toast.error('Failed to load RSVPs');
    }
  };

  const fetchMedia = async (silent = false) => {
    try {
      const response = await coupleApi.getMedia(token);
      setMedia(response.data.media);
    } catch (err) {
      if (!silent) toast.error('Failed to load media');
    }
  };

  const fetchCheckIns = async (silent = false) => {
    try {
      const response = await coupleApi.getCheckIns(token);
      setCheckIns(response.data.checkIns);
    } catch (err) {
      if (!silent) toast.error('Failed to load check-ins');
    }
  };

  const handleReviewRsvp = async (rsvpId: string, status: 'APPROVED' | 'REJECTED') => {
    try {
      await coupleApi.reviewRsvp(token, rsvpId, status);
      toast.success(`RSVP ${status.toLowerCase()}`);
      fetchRsvps();
      fetchEvent();
    } catch (err: any) {
      toast.error(err.response?.data?.error || 'Failed to review RSVP');
    }
  };

  const downloadMedia = async (mediaItem: MediaAsset) => {
    try {
      const link = document.createElement('a');
      link.href = `${API_BASE_URL}${mediaItem.filePath}`;
      link.download = `${mediaItem.guestName || 'media'}-${mediaItem.id}.${mediaItem.filePath.split('.').pop()}`;
      link.click();
    } catch (err) {
      toast.error('Failed to download');
    }
  };

  const downloadAllMedia = async () => {
    try {
      const response = await coupleApi.downloadMedia(token);
      const url = URL.createObjectURL(response.data);
      const a = document.createElement('a');
      a.href = url;
      a.download = `${event?.slug}-media.zip`;
      a.click();
      URL.revokeObjectURL(url);
    } catch (err) {
      toast.error('Failed to download media');
    }
  };

  const exportRsvps = (filter: string) => {
    const filtered = filter === 'all' ? rsvps : rsvps.filter(r => r.status === filter);
    const columns = [
      { key: 'primaryName', label: 'Name' },
      { key: 'secondaryName', label: 'Guest Name' },
      { key: 'email', label: 'Email' },
      { key: 'phone', label: 'Phone' },
      { key: 'attendance', label: 'Attendance' },
      { key: 'guestCount', label: 'Guest Count' },
      { key: 'mealPreference', label: 'Meal Preference' },
      { key: 'dietaryNotes', label: 'Dietary Notes' },
      { key: 'note', label: 'Note' },
      { key: 'status', label: 'Status' },
      { key: 'submittedAt', label: 'Submitted At' },
    ];
    exportToCSV(filtered, `rsvps-${filter}.csv`, columns);
    toast.success(`Exported ${filtered.length} RSVPs`);
  };

  const exportCheckIns = () => {
    const columns = [
      { key: 'invitation.rsvp.primaryName', label: 'Guest Name' },
      { key: 'invitation.rsvp.secondaryName', label: 'Plus One' },
      { key: 'invitation.rsvp.guestCount', label: 'Party Size' },
      { key: 'invitation.accessCode', label: 'Access Code' },
      { key: 'checkedInAt', label: 'Checked In At' },
    ];
    exportToCSV(checkIns, 'checkins.csv', columns);
    toast.success(`Exported ${checkIns.length} check-ins`);
  };

  // Filter media by category
  const filteredMedia = mediaTab === 'photos' 
    ? media.filter(m => m.type === 'PHOTO')
    : mediaTab === 'messages'
    ? media.filter(m => m.type === 'VIDEO' || m.type === 'AUDIO')
    : media;

  const getStatusColor = (status: string) => {
    const colors: Record<string, string> = {
      PENDING: 'bg-amber-100 text-amber-700',
      APPROVED: 'bg-green-100 text-green-700',
      REJECTED: 'bg-red-100 text-red-700',
      YES: 'bg-green-100 text-green-700',
      NO: 'bg-red-100 text-red-700',
      MAYBE: 'bg-blue-100 text-blue-700',
    };
    return `px-2 py-1 rounded-full text-xs font-medium ${colors[status] || 'bg-surface-100 text-surface-700'}`;
  };

  const pendingCount = rsvps.filter(r => r.status === 'PENDING').length;

  if (loading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-surface-50 to-surface-100 flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary-500 mx-auto mb-4" />
          <p className="text-surface-600">Loading your portal...</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-navy-900 to-navy-950 flex items-center justify-center p-4">
        <div className="text-center max-w-md">
          <div className="w-16 h-16 mx-auto rounded-full bg-red-500/20 flex items-center justify-center mb-6">
            <svg className="w-8 h-8 text-red-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
            </svg>
          </div>
          <h1 className="text-2xl font-display font-bold text-white mb-2">Access Denied</h1>
          <p className="text-surface-400">{error}</p>
        </div>
      </div>
    );
  }

  if (!event) return null;

  return (
    <div className="min-h-screen bg-gradient-to-br from-surface-50 via-white to-surface-50">
      {/* Header */}
      <header className="bg-white/80 backdrop-blur-md border-b border-surface-200 sticky top-0 z-40">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between h-16">
            <div>
              <h1 className="text-xl font-display font-bold text-navy-900">{event.name}</h1>
              <p className="text-xs text-surface-500">Last updated: {formatDate(lastUpdated.toISOString(), 'h:mm:ss a')}</p>
            </div>
            <div className={cn('px-3 py-1.5 rounded-full text-sm font-medium', 
              event.currentPhase === 'LIVE' ? 'bg-green-100 text-green-700' : 
              event.currentPhase === 'POST_EVENT' ? 'bg-surface-100 text-surface-700' : 
              'bg-blue-100 text-blue-700'
            )}>
              {event.currentPhase === 'LIVE' && <span className="inline-block w-2 h-2 rounded-full bg-green-500 mr-2 animate-pulse" />}
              {event.currentPhase.replace('_', ' ')}
            </div>
          </div>
        </div>
      </header>

      {/* Navigation Tabs */}
      <nav className="bg-white border-b border-surface-200 sticky top-16 z-30">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex gap-1 overflow-x-auto py-2">
            {(['dashboard', 'rsvps', 'media', 'checkins'] as Tab[]).map(tab => (
              <button
                key={tab}
                onClick={() => setActiveTab(tab)}
                className={cn(
                  'px-4 py-2 rounded-lg text-sm font-medium transition-all whitespace-nowrap',
                  activeTab === tab
                    ? 'bg-navy-900 text-white shadow-lg'
                    : 'text-surface-600 hover:bg-surface-100'
                )}
              >
                {tab === 'rsvps' ? 'RSVPs' : tab === 'checkins' ? 'Check-ins' : tab.charAt(0).toUpperCase() + tab.slice(1)}
                {tab === 'rsvps' && pendingCount > 0 && (
                  <span className="ml-2 px-2 py-0.5 rounded-full bg-amber-500 text-white text-xs">{pendingCount}</span>
                )}
              </button>
            ))}
          </div>
        </div>
      </nav>

      {/* Main Content */}
      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Dashboard Tab */}
        {activeTab === 'dashboard' && (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
            {/* Stats Cards */}
            {[
              { label: 'Total RSVPs', value: event._count.rsvps, icon: '📋', color: 'from-blue-500 to-blue-600' },
              { label: 'Approved', value: event._count.invitations, icon: '✅', color: 'from-green-500 to-green-600' },
              { label: 'Checked In', value: event._count.checkIns, icon: '🎫', color: 'from-purple-500 to-purple-600' },
              { label: 'Messages', value: event._count.mediaAssets, icon: '💬', color: 'from-pink-500 to-pink-600' },
            ].map(stat => (
              <div key={stat.label} className="bg-white rounded-2xl shadow-sm border border-surface-200 p-6 hover:shadow-lg transition-shadow">
                <div className="flex items-center justify-between mb-4">
                  <span className="text-2xl">{stat.icon}</span>
                  <div className={cn('w-12 h-12 rounded-xl bg-gradient-to-br flex items-center justify-center text-white font-bold text-lg', stat.color)}>
                    {stat.value}
                  </div>
                </div>
                <p className="text-surface-600 text-sm">{stat.label}</p>
              </div>
            ))}

            {/* Quick Actions */}
            <div className="md:col-span-2 bg-white rounded-2xl shadow-sm border border-surface-200 p-6">
              <h3 className="font-semibold text-navy-900 mb-4">Quick Actions</h3>
              <div className="grid grid-cols-2 gap-3">
                <button onClick={() => setActiveTab('rsvps')} className="p-4 rounded-xl bg-surface-50 hover:bg-surface-100 text-left transition-colors">
                  <span className="text-2xl mb-2 block">📋</span>
                  <span className="font-medium text-navy-900">Review RSVPs</span>
                  {pendingCount > 0 && <span className="block text-sm text-amber-600">{pendingCount} pending</span>}
                </button>
                <button onClick={() => setActiveTab('media')} className="p-4 rounded-xl bg-surface-50 hover:bg-surface-100 text-left transition-colors">
                  <span className="text-2xl mb-2 block">💬</span>
                  <span className="font-medium text-navy-900">View Messages</span>
                  <span className="block text-sm text-surface-500">{media.length} total</span>
                </button>
              </div>
            </div>

            {/* Recent Activity */}
            <div className="md:col-span-2 bg-white rounded-2xl shadow-sm border border-surface-200 p-6">
              <div className="flex items-center justify-between mb-4">
                <h3 className="font-semibold text-navy-900">Recent Messages</h3>
                <button onClick={() => setActiveTab('media')} className="text-sm text-primary-600 hover:text-primary-700">View All</button>
              </div>
              {media.length === 0 ? (
                <p className="text-surface-500 text-center py-8">No messages yet</p>
              ) : (
                <div className="grid grid-cols-4 gap-2">
                  {media.slice(0, 4).map(m => (
                    <div 
                      key={m.id} 
                      onClick={() => setPreviewMedia(m)} 
                      className="aspect-square bg-surface-100 rounded-lg cursor-pointer hover:opacity-80 flex items-center justify-center overflow-hidden"
                    >
                      {m.type === 'PHOTO' ? (
                        <img src={`${API_BASE_URL}${m.filePath}`} alt="" className="w-full h-full object-cover" />
                      ) : (
                        <div className={cn('w-10 h-10 rounded-full flex items-center justify-center', 
                          m.type === 'VIDEO' ? 'bg-red-100 text-red-500' : 'bg-purple-100 text-purple-500'
                        )}>
                          {m.type === 'VIDEO' ? Icons.video : Icons.audio}
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        )}

        {/* RSVPs Tab */}
        {activeTab === 'rsvps' && (
          <div className="space-y-4">
            <div className="flex flex-wrap items-center justify-between gap-4">
              <div className="flex flex-wrap gap-2">
                {['all', 'PENDING', 'APPROVED', 'REJECTED'].map(s => (
                  <button 
                    key={s} 
                    onClick={() => { setRsvpFilter(s); fetchRsvps(); }} 
                    className={cn(
                      'px-4 py-2 rounded-lg text-sm font-medium transition-colors',
                      rsvpFilter === s 
                        ? 'bg-navy-900 text-white' 
                        : 'bg-white text-surface-600 hover:bg-surface-100 border border-surface-200'
                    )}
                  >
                    {s === 'all' ? 'All' : s.charAt(0) + s.slice(1).toLowerCase()}
                    {s === 'PENDING' && pendingCount > 0 && (
                      <span className="ml-2 px-1.5 py-0.5 rounded-full bg-amber-500 text-white text-xs">{pendingCount}</span>
                    )}
                  </button>
                ))}
              </div>
              {/* Export Dropdown */}
              <div className="relative group">
                <button className="btn-secondary flex items-center gap-2">
                  {Icons.export}
                  Export
                  <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" /></svg>
                </button>
                <div className="absolute right-0 top-full mt-1 bg-white rounded-lg shadow-lg border border-surface-200 py-1 min-w-[140px] opacity-0 invisible group-hover:opacity-100 group-hover:visible transition-all z-10">
                  {['all', 'PENDING', 'APPROVED', 'REJECTED'].map(filter => (
                    <button key={filter} onClick={() => exportRsvps(filter)} className="w-full px-4 py-2 text-left text-sm hover:bg-surface-50">
                      {filter === 'all' ? 'All RSVPs' : `${filter.charAt(0)}${filter.slice(1).toLowerCase()} Only`}
                    </button>
                  ))}
                </div>
              </div>
            </div>

            <div className="bg-white rounded-2xl shadow-sm border border-surface-200 overflow-hidden">
              <div className="overflow-x-auto">
                <table className="w-full">
                  <thead>
                    <tr className="border-b border-surface-200 bg-surface-50">
                      <th className="text-left py-4 px-6 text-sm font-semibold text-surface-700">Guest</th>
                      <th className="text-left py-4 px-6 text-sm font-semibold text-surface-700">Response</th>
                      <th className="text-left py-4 px-6 text-sm font-semibold text-surface-700">Details</th>
                      <th className="text-left py-4 px-6 text-sm font-semibold text-surface-700">Status</th>
                      <th className="text-right py-4 px-6 text-sm font-semibold text-surface-700">Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {rsvps.length === 0 ? (
                      <tr>
                        <td colSpan={5} className="py-12 text-center text-surface-500">No RSVPs found</td>
                      </tr>
                    ) : rsvps.map(r => (
                      <tr key={r.id} className="border-b border-surface-100 hover:bg-surface-50 transition-colors">
                        <td className="py-4 px-6">
                          <p className="font-medium text-navy-900">{r.primaryName}</p>
                          {r.secondaryName && <p className="text-sm text-surface-500">& {r.secondaryName}</p>}
                          {r.email && <p className="text-xs text-surface-400">{r.email}</p>}
                        </td>
                        <td className="py-4 px-6">
                          <span className={getStatusColor(r.attendance)}>{r.attendance}</span>
                          <p className="text-sm text-surface-500 mt-1">{r.guestCount} guest(s)</p>
                        </td>
                        <td className="py-4 px-6 text-sm">
                          {r.mealPreference && <p>Meal: {r.mealPreference}</p>}
                          {r.note && <p className="text-surface-500 truncate max-w-[200px]">{r.note}</p>}
                        </td>
                        <td className="py-4 px-6">
                          <span className={getStatusColor(r.status)}>{r.status}</span>
                          {r.invitation?.isCheckedIn && <p className="text-xs text-green-600 mt-1">✓ Checked In</p>}
                        </td>
                        <td className="py-4 px-6 text-right">
                          {r.status === 'PENDING' && (
                            <div className="flex justify-end gap-2">
                              <button onClick={() => handleReviewRsvp(r.id, 'APPROVED')} className="px-4 py-2 text-sm bg-green-500 text-white rounded-lg hover:bg-green-600 transition-colors font-medium">
                                Approve
                              </button>
                              <button onClick={() => handleReviewRsvp(r.id, 'REJECTED')} className="px-4 py-2 text-sm bg-red-100 text-red-700 rounded-lg hover:bg-red-200 transition-colors font-medium">
                                Reject
                              </button>
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

        {/* Media Tab */}
        {activeTab === 'media' && (
          <div className="space-y-6">
            <div className="flex flex-wrap items-center justify-between gap-4">
              {/* Media Category Tabs */}
              <div className="flex bg-white rounded-xl p-1 border border-surface-200">
                {(['all', 'photos', 'messages'] as MediaTab[]).map(tab => (
                  <button
                    key={tab}
                    onClick={() => setMediaTab(tab)}
                    className={cn(
                      'px-4 py-2 rounded-lg text-sm font-medium transition-colors',
                      mediaTab === tab ? 'bg-navy-900 text-white' : 'text-surface-600 hover:bg-surface-50'
                    )}
                  >
                    {tab === 'all' ? `All (${media.length})` : 
                     tab === 'photos' ? `Photos (${media.filter(m => m.type === 'PHOTO').length})` :
                     `Messages (${media.filter(m => m.type !== 'PHOTO').length})`}
                  </button>
                ))}
              </div>
              
              {media.length > 0 && (
                <button onClick={downloadAllMedia} className="btn-primary flex items-center gap-2">
                  {Icons.download}
                  Download All
                </button>
              )}
            </div>

            {filteredMedia.length === 0 ? (
              <div className="bg-white rounded-2xl shadow-sm border border-surface-200 p-16 text-center">
                <div className="w-16 h-16 mx-auto rounded-full bg-surface-100 flex items-center justify-center mb-4">
                  {mediaTab === 'photos' ? Icons.photo : mediaTab === 'messages' ? Icons.video : Icons.video}
                </div>
                <h3 className="text-lg font-medium text-navy-900 mb-1">
                  No {mediaTab === 'all' ? 'media' : mediaTab} yet
                </h3>
                <p className="text-surface-600">Guest {mediaTab === 'photos' ? 'photos' : 'messages'} will appear here</p>
              </div>
            ) : (
              <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-4">
                {filteredMedia.map(m => (
                  <MediaThumbnail
                    key={m.id}
                    media={m}
                    onClick={() => setPreviewMedia(m)}
                    onDownload={(e) => { e.stopPropagation(); downloadMedia(m); }}
                  />
                ))}
              </div>
            )}
          </div>
        )}

        {/* Check-ins Tab */}
        {activeTab === 'checkins' && (
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <p className="text-surface-600">{checkIns.length} guest(s) checked in</p>
              {checkIns.length > 0 && (
                <button onClick={exportCheckIns} className="btn-secondary flex items-center gap-2">
                  {Icons.export}
                  Export Check-ins
                </button>
              )}
            </div>
            <div className="bg-white rounded-2xl shadow-sm border border-surface-200 overflow-hidden">
              <div className="overflow-x-auto">
                <table className="w-full">
                  <thead>
                    <tr className="border-b border-surface-200 bg-surface-50">
                      <th className="text-left py-4 px-6 text-sm font-semibold text-surface-700">Guest</th>
                      <th className="text-left py-4 px-6 text-sm font-semibold text-surface-700">Party Size</th>
                      <th className="text-left py-4 px-6 text-sm font-semibold text-surface-700">Checked In At</th>
                    </tr>
                  </thead>
                  <tbody>
                    {checkIns.length === 0 ? (
                      <tr><td colSpan={3} className="py-12 text-center text-surface-500">No check-ins yet</td></tr>
                    ) : checkIns.map(c => (
                      <tr key={c.id} className="border-b border-surface-100 hover:bg-surface-50 transition-colors">
                        <td className="py-4 px-6">
                          <p className="font-medium text-navy-900">{c.invitation.rsvp.primaryName}</p>
                          {c.invitation.rsvp.secondaryName && <p className="text-sm text-surface-500">& {c.invitation.rsvp.secondaryName}</p>}
                        </td>
                        <td className="py-4 px-6 text-surface-600">{c.invitation.rsvp.guestCount}</td>
                        <td className="py-4 px-6 text-surface-600">{formatDate(c.checkedInAt, 'MMM d, h:mm a')}</td>
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
        <div 
          className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/90 backdrop-blur-sm"
          onClick={() => setPreviewMedia(null)}
        >
          <div onClick={e => e.stopPropagation()} className="relative">
            {previewMedia.type === 'PHOTO' && (
              <PhotoViewer
                src={`${API_BASE_URL}${previewMedia.filePath}`}
                guestName={previewMedia.guestName || ''}
                onClose={() => setPreviewMedia(null)}
              />
            )}
            {previewMedia.type === 'VIDEO' && (
              <VideoPlayer
                src={`${API_BASE_URL}${previewMedia.filePath}`}
                onClose={() => setPreviewMedia(null)}
              />
            )}
            {previewMedia.type === 'AUDIO' && (
              <AudioPlayer
                src={`${API_BASE_URL}${previewMedia.filePath}`}
                guestName={previewMedia.guestName || ''}
                onClose={() => setPreviewMedia(null)}
              />
            )}
          </div>
        </div>
      )}
    </div>
  );
}
