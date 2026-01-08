'use client';

import { useEffect, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import Link from 'next/link';
import { eventsApi, rsvpApi, templatesApi, mediaApi, checkInApi } from '@/lib/api';
import MediaGallery from '@/components/media/MediaGallery';
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
  timezone: string;
  currentPhase: string;
  phaseOverride: boolean;
  invitationOnly: boolean;
  coupleAccessToken: string;
  invitationEnabled: boolean;
  rsvpEnabled: boolean;
  guestbookEnabled: boolean;
  checkInEnabled: boolean;
  reelEnabled: boolean;
  maxRecordingDuration: number;
  minRecordingDuration: number;
  maxPhotosPerGuest: number;
  notifyOnRsvp: boolean;
  notifyOnCheckIn: boolean;
  notifyOnGuestbook: boolean;
  emailNotifications: boolean;
  smsNotifications: boolean;
  whatsappNotifications: boolean;
  invitationTemplateId: string | null;
  rsvpTemplateId: string | null;
  guestbookTemplateId: string | null;
  thankYouTemplateId: string | null;
  // Event branding
  primaryColor?: string;
  secondaryColor?: string;
  accentColor?: string;
  // Couple info
  coupleName1?: string;
  coupleName2?: string;
  coupleEmail?: string;
  couplePhone?: string;
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
  invitation?: { id: string; accessCode: string; token: string; qrCodeData: string | null; isCheckedIn: boolean } | null;
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
  invitation: { guestName: string; guestCount: number; accessCode: string };
  checkedInAt: string;
  method: string;
}

interface Template { id: string; name: string; type: string; isDefault: boolean; }

type Tab = 'overview' | 'rsvps' | 'checkin' | 'media' | 'templates' | 'settings';

// SVG Icons
const Icons = {
  back: <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" /></svg>,
  external: <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" /></svg>,
  copy: <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z" /></svg>,
  download: <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" /></svg>,
  play: <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M14.752 11.168l-3.197-2.132A1 1 0 0010 9.87v4.263a1 1 0 001.555.832l3.197-2.132a1 1 0 000-1.664z" /><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 12a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>,
  edit: <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" /></svg>,
  check: <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" /></svg>,
  close: <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg>,
  video: <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 10l4.553-2.276A1 1 0 0121 8.618v6.764a1 1 0 01-1.447.894L15 14M5 18h8a2 2 0 002-2V8a2 2 0 00-2-2H5a2 2 0 00-2 2v8a2 2 0 002 2z" /></svg>,
  audio: <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 11a7 7 0 01-7 7m0 0a7 7 0 01-7-7m7 7v4m0 0H8m4 0h4m-4-8a3 3 0 01-3-3V5a3 3 0 116 0v6a3 3 0 01-3 3z" /></svg>,
  photo: <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" /></svg>,
  reel: <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 4v16M17 4v16M3 8h4m10 0h4M3 12h18M3 16h4m10 0h4M4 20h16a1 1 0 001-1V5a1 1 0 00-1-1H4a1 1 0 00-1 1v14a1 1 0 001 1z" /></svg>,
};

export default function EventDetailPage() {
  const params = useParams();
  const router = useRouter();
  const eventId = params.id as string;

  const [event, setEvent] = useState<Event | null>(null);
  const [rsvps, setRsvps] = useState<RSVP[]>([]);
  const [media, setMedia] = useState<MediaAsset[]>([]);
  const [checkIns, setCheckIns] = useState<CheckIn[]>([]);
  const [templates, setTemplates] = useState<Template[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<Tab>('overview');
  const [rsvpFilter, setRsvpFilter] = useState<string>('all');
  const [savingTemplates, setSavingTemplates] = useState(false);
  const [editingSettings, setEditingSettings] = useState(false);
  const [savingSettings, setSavingSettings] = useState(false);

  const [eventSettings, setEventSettings] = useState({
    name: '', description: '', date: '', time: '', endDate: '', endTime: '',
    venue: '', timezone: '', invitationOnly: false, reelEnabled: false,
    maxRecordingDuration: 120, minRecordingDuration: 30, maxPhotosPerGuest: 5,
    notifyOnRsvp: true, notifyOnCheckIn: false, notifyOnGuestbook: false,
    emailNotifications: true, smsNotifications: false, whatsappNotifications: false,
    primaryColor: '#FFD700', secondaryColor: '#1a1a2e', accentColor: '#ffffff',
    coupleName1: '', coupleName2: '', coupleEmail: '', couplePhone: '',
  });

  const [selectedTemplates, setSelectedTemplates] = useState({
    invitationTemplateId: '', rsvpTemplateId: '', guestbookTemplateId: '',
    guestbookVideoTemplateId: '', guestbookAudioTemplateId: '', guestbookPhotoTemplateId: '',
    boothTemplateId: '', thankYouTemplateId: '',
  });

  useEffect(() => { fetchEvent(); fetchTemplates(); }, [eventId]);
  
  useEffect(() => {
    if (activeTab === 'rsvps') fetchRsvps();
    if (activeTab === 'media') fetchMedia();
    if (activeTab === 'checkin') fetchCheckIns();
  }, [activeTab, rsvpFilter]);

  useEffect(() => {
    if (event) {
      setSelectedTemplates({
        invitationTemplateId: event.invitationTemplateId || '',
        rsvpTemplateId: event.rsvpTemplateId || '',
        guestbookTemplateId: event.guestbookTemplateId || '',
        guestbookVideoTemplateId: (event as any).guestbookVideoTemplateId || '',
        guestbookAudioTemplateId: (event as any).guestbookAudioTemplateId || '',
        guestbookPhotoTemplateId: (event as any).guestbookPhotoTemplateId || '',
        boothTemplateId: (event as any).boothTemplateId || '',
        thankYouTemplateId: event.thankYouTemplateId || '',
      });
      const d = new Date(event.date);
      const ed = event.endDate ? new Date(event.endDate) : null;
      setEventSettings({
        name: event.name, description: event.description || '',
        date: d.toISOString().split('T')[0], time: d.toTimeString().slice(0, 5),
        endDate: ed ? ed.toISOString().split('T')[0] : '', endTime: ed ? ed.toTimeString().slice(0, 5) : '',
        venue: event.venue || '', timezone: event.timezone, invitationOnly: event.invitationOnly,
        reelEnabled: event.reelEnabled || false,
        primaryColor: event.primaryColor || '#FFD700', secondaryColor: event.secondaryColor || '#1a1a2e', accentColor: event.accentColor || '#ffffff',
        coupleName1: event.coupleName1 || '', coupleName2: event.coupleName2 || '', coupleEmail: event.coupleEmail || '', couplePhone: event.couplePhone || '',
        maxRecordingDuration: event.maxRecordingDuration, minRecordingDuration: event.minRecordingDuration, maxPhotosPerGuest: event.maxPhotosPerGuest,
        notifyOnRsvp: event.notifyOnRsvp ?? true, notifyOnCheckIn: event.notifyOnCheckIn ?? false, notifyOnGuestbook: event.notifyOnGuestbook ?? false,
        emailNotifications: event.emailNotifications ?? true, smsNotifications: event.smsNotifications ?? false, whatsappNotifications: event.whatsappNotifications ?? false,
      });
    }
  }, [event]);

  const fetchEvent = async () => {
    try { const r = await eventsApi.get(eventId); setEvent(r.data.event); }
    catch { toast.error('Failed to load event'); router.push('/admin/events'); }
    finally { setLoading(false); }
  };
  const fetchTemplates = async () => { try { const r = await templatesApi.list(); setTemplates(r.data.templates); } catch {} };
  const fetchRsvps = async () => { try { const p: any = {}; if (rsvpFilter !== 'all') p.status = rsvpFilter; const r = await rsvpApi.list(eventId, p); setRsvps(r.data.rsvps); } catch { toast.error('Failed to load RSVPs'); } };
  const fetchMedia = async () => { try { const r = await mediaApi.list(eventId); setMedia(r.data.media || []); } catch { toast.error('Failed to load media'); } };
  const fetchCheckIns = async () => { try { const r = await checkInApi.list(eventId); setCheckIns(r.data.checkIns || []); } catch { toast.error('Failed to load check-ins'); } };

  const handlePhaseChange = async (phase: string) => {
    try { await eventsApi.setPhase(eventId, phase, true); toast.success(`Phase: ${getPhaseLabel(phase)}`); fetchEvent(); }
    catch { toast.error('Failed'); }
  };

  const handleReviewRsvp = async (id: string, status: 'APPROVED' | 'REJECTED') => {
    try { await rsvpApi.review(id, status); toast.success(`RSVP ${status.toLowerCase()}`); fetchRsvps(); fetchEvent(); }
    catch (e: any) { toast.error(e.response?.data?.error || 'Failed'); }
  };

  const handleSaveTemplates = async () => {
    setSavingTemplates(true);
    try {
      await templatesApi.assign(eventId, {
        invitationTemplateId: selectedTemplates.invitationTemplateId || null,
        rsvpTemplateId: selectedTemplates.rsvpTemplateId || null,
        guestbookTemplateId: selectedTemplates.guestbookTemplateId || null,
        guestbookVideoTemplateId: selectedTemplates.guestbookVideoTemplateId || null,
        guestbookAudioTemplateId: selectedTemplates.guestbookAudioTemplateId || null,
        guestbookPhotoTemplateId: selectedTemplates.guestbookPhotoTemplateId || null,
        boothTemplateId: selectedTemplates.boothTemplateId || null,
        thankYouTemplateId: selectedTemplates.thankYouTemplateId || null,
      });
      toast.success('Templates updated'); fetchEvent();
    } catch (e: any) { toast.error(e.response?.data?.error || 'Failed'); }
    finally { setSavingTemplates(false); }
  };

  const handleSaveSettings = async () => {
    setSavingSettings(true);
    try {
      const dt = new Date(`${eventSettings.date}T${eventSettings.time}`);
      const edt = eventSettings.endDate ? new Date(`${eventSettings.endDate}T${eventSettings.endTime || '23:59'}`) : null;
      await eventsApi.update(eventId, {
        name: eventSettings.name, description: eventSettings.description || null,
        date: dt.toISOString(), endDate: edt?.toISOString() || null,
        venue: eventSettings.venue || null, timezone: eventSettings.timezone,
        invitationOnly: eventSettings.invitationOnly,
        reelEnabled: eventSettings.reelEnabled,
        maxRecordingDuration: eventSettings.maxRecordingDuration, minRecordingDuration: eventSettings.minRecordingDuration, maxPhotosPerGuest: eventSettings.maxPhotosPerGuest,
        notifyOnRsvp: eventSettings.notifyOnRsvp, notifyOnCheckIn: eventSettings.notifyOnCheckIn, notifyOnGuestbook: eventSettings.notifyOnGuestbook,
        emailNotifications: eventSettings.emailNotifications, smsNotifications: eventSettings.smsNotifications, whatsappNotifications: eventSettings.whatsappNotifications,
        primaryColor: eventSettings.primaryColor, secondaryColor: eventSettings.secondaryColor, accentColor: eventSettings.accentColor,
        coupleName1: eventSettings.coupleName1 || null, coupleName2: eventSettings.coupleName2 || null, coupleEmail: eventSettings.coupleEmail || null, couplePhone: eventSettings.couplePhone || null,
      });
      toast.success('Settings saved'); setEditingSettings(false); fetchEvent();
    } catch (e: any) { toast.error(e.response?.data?.error || 'Failed'); }
    finally { setSavingSettings(false); }
  };

  const handleCopyLink = async (path: string) => { if (await copyToClipboard(`${window.location.origin}${path}`)) toast.success('Link copied!'); };
  const getTemplatesByType = (t: string) => templates.filter(x => x.type === t);

  const exportRsvpsToCSV = () => {
    const h = ['Name','Secondary Name','Email','Phone','Attendance','Guest Count','Meal','Dietary','Note','Status','Submitted','Code','Checked In'];
    const rows = rsvps.map(r => [r.primaryName, r.secondaryName||'', r.email||'', r.phone||'', r.attendance, r.guestCount, r.mealPreference||'', r.dietaryNotes||'', r.note||'', r.status, formatDate(r.submittedAt,'yyyy-MM-dd HH:mm'), r.invitation?.accessCode||'', r.invitation?.isCheckedIn?'Yes':'No']);
    downloadCSV([h,...rows].map(r => r.map(c => `"${String(c).replace(/"/g,'""')}"`).join(',')).join('\n'), `rsvps-${event?.slug}.csv`);
  };

  const exportCheckInsToCSV = () => {
    const h = ['Name','Guests','Code','Checked In At','Method'];
    const rows = checkIns.map(c => [c.invitation.guestName, c.invitation.guestCount, c.invitation.accessCode, formatDate(c.checkedInAt,'yyyy-MM-dd HH:mm'), c.method]);
    downloadCSV([h,...rows].map(r => r.map(c => `"${String(c).replace(/"/g,'""')}"`).join(',')).join('\n'), `checkins-${event?.slug}.csv`);
  };

  const downloadCSV = (content: string, filename: string) => {
    const b = new Blob([content], { type: 'text/csv' });
    const a = document.createElement('a'); a.href = URL.createObjectURL(b); a.download = filename; a.click();
  };


  if (loading || !event) return <div className="flex items-center justify-center h-64"><div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary-500" /></div>;

  const tabs: { id: Tab; label: string; count?: number }[] = [
    { id: 'overview', label: 'Overview' },
    { id: 'rsvps', label: 'RSVPs', count: event._count.rsvps },
    { id: 'checkin', label: 'Check-In', count: event._count.checkIns },
    { id: 'media', label: 'Media', count: event._count.mediaAssets },
    { id: 'templates', label: 'Templates' },
    { id: 'settings', label: 'Settings' },
  ];

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4">
        <div>
          <Link href="/admin/events" className="inline-flex items-center text-surface-500 hover:text-navy-900 mb-2 text-sm transition-colors">
            {Icons.back}
            <span className="ml-1">Back to Events</span>
          </Link>
          <h1 className="text-2xl font-display font-bold text-navy-900">{event.name}</h1>
          <div className="flex items-center gap-3 mt-2">
            <span className={getStatusColor(event.currentPhase)}>{getPhaseLabel(event.currentPhase)}</span>
            {event.phaseOverride && <span className="text-xs text-surface-500">(Override)</span>}
            {event.invitationOnly && <span className="badge-info">Invite Only</span>}
            {event.reelEnabled && <span className="px-2 py-0.5 rounded text-xs bg-surface-100 text-surface-600">Reel Enabled</span>}
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
              {tab.count !== undefined && <span className="ml-2 px-2 py-0.5 rounded-full bg-surface-100 text-xs">{tab.count}</span>}
            </button>
          ))}
        </nav>
      </div>

      {/* Overview */}
      {activeTab === 'overview' && (
        <div className="grid lg:grid-cols-3 gap-6">
          <div className="lg:col-span-2 grid sm:grid-cols-2 gap-4">
            {[
              { l: 'Total RSVPs', v: event._count.rsvps, icon: Icons.check },
              { l: 'Invitations', v: event._count.invitations, icon: Icons.copy },
              { l: 'Checked In', v: event._count.checkIns, icon: Icons.check },
              { l: 'Media', v: event._count.mediaAssets, icon: Icons.video },
            ].map(s => (
              <div key={s.l} className="bg-white rounded-xl border border-surface-200 p-5 hover:border-surface-300 transition-colors">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm text-surface-500 mb-1">{s.l}</p>
                    <p className="text-3xl font-bold text-navy-900">{s.v}</p>
                  </div>
                  <div className="w-10 h-10 rounded-lg bg-surface-100 flex items-center justify-center text-surface-500">
                    {s.icon}
                  </div>
                </div>
              </div>
            ))}
          </div>
          <div className="space-y-4">
            <div className="bg-white rounded-xl border border-surface-200 p-5">
              <h3 className="font-semibold text-navy-900 mb-4">Phase Control</h3>
              <div className="space-y-2">
                {(['PRE_EVENT', 'LIVE', 'POST_EVENT'] as const).map(p => (
                  <button 
                    key={p} 
                    onClick={() => handlePhaseChange(p)} 
                    disabled={event.currentPhase === p} 
                    className={cn(
                      'w-full px-4 py-2.5 rounded-lg text-sm font-medium transition-all',
                      event.currentPhase === p 
                        ? 'bg-navy-900 text-white' 
                        : 'bg-surface-50 text-surface-700 hover:bg-surface-100'
                    )}
                  >
                    {getPhaseLabel(p)}
                  </button>
                ))}
              </div>
            </div>
            <div className="bg-white rounded-xl border border-surface-200 p-5">
              <h3 className="font-semibold text-navy-900 mb-4">Quick Links</h3>
              <div className="space-y-1 text-sm">
                {[
                  { l: 'Invitation', p: `/e/${event.slug}` },
                  { l: 'RSVP Form', p: `/e/${event.slug}/rsvp` },
                  { l: 'Guestbook', p: `/e/${event.slug}/guestbook` },
                  { l: 'Check-In', p: `/e/${event.slug}/checkin` },
                  { l: 'Couple Portal', p: `/couple/${event.coupleAccessToken}` },
                ].map(x => (
                  <button 
                    key={x.p} 
                    onClick={() => handleCopyLink(x.p)} 
                    className="w-full text-left p-2.5 rounded-lg hover:bg-surface-50 flex items-center justify-between text-surface-600 hover:text-navy-900 transition-colors"
                  >
                    <span>{x.l}</span>
                    <span className="text-surface-400">{Icons.copy}</span>
                  </button>
                ))}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* RSVPs */}
      {activeTab === 'rsvps' && (
        <div className="space-y-4">
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
            <div className="flex gap-1 bg-surface-100 p-1 rounded-lg">
              {['all', 'PENDING', 'APPROVED', 'REJECTED'].map(s => (
                <button 
                  key={s} 
                  onClick={() => setRsvpFilter(s)} 
                  className={cn(
                    'px-3 py-1.5 rounded-md text-sm font-medium transition-all',
                    rsvpFilter === s ? 'bg-white text-navy-900 shadow-sm' : 'text-surface-600 hover:text-surface-900'
                  )}
                >
                  {s === 'all' ? 'All' : s.charAt(0) + s.slice(1).toLowerCase()}
                </button>
              ))}
            </div>
            <button onClick={exportRsvpsToCSV} className="btn-outline">
              {Icons.download}
              <span className="ml-2">Export CSV</span>
            </button>
          </div>
          <div className="bg-white rounded-xl border border-surface-200 overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead><tr className="border-b border-surface-200 bg-surface-50">
                  <th className="text-left py-3 px-4 text-xs font-medium text-surface-500 uppercase tracking-wider">Guest</th>
                  <th className="text-left py-3 px-4 text-xs font-medium text-surface-500 uppercase tracking-wider">Contact</th>
                  <th className="text-left py-3 px-4 text-xs font-medium text-surface-500 uppercase tracking-wider">Response</th>
                  <th className="text-left py-3 px-4 text-xs font-medium text-surface-500 uppercase tracking-wider">Details</th>
                  <th className="text-left py-3 px-4 text-xs font-medium text-surface-500 uppercase tracking-wider">Status</th>
                  <th className="text-right py-3 px-4 text-xs font-medium text-surface-500 uppercase tracking-wider">Actions</th>
                </tr></thead>
                <tbody className="divide-y divide-surface-100">
                  {rsvps.length === 0 ? <tr><td colSpan={6} className="py-12 text-center text-surface-500">No RSVPs found</td></tr> : rsvps.map(r => (
                    <tr key={r.id} className="hover:bg-surface-50 transition-colors">
                      <td className="py-3 px-4"><p className="font-medium text-navy-900">{r.primaryName}</p>{r.secondaryName && <p className="text-sm text-surface-500">& {r.secondaryName}</p>}</td>
                      <td className="py-3 px-4">{r.email && <p className="text-sm text-surface-600">{r.email}</p>}{r.phone && <p className="text-sm text-surface-500">{r.phone}</p>}</td>
                      <td className="py-3 px-4"><span className={getStatusColor(r.attendance)}>{r.attendance}</span><p className="text-sm text-surface-500">{r.guestCount} guest(s)</p></td>
                      <td className="py-3 px-4 text-sm">{r.mealPreference && <p>Meal: {r.mealPreference}</p>}{r.note && <p className="text-xs text-surface-500 truncate max-w-[150px]">{r.note}</p>}</td>
                      <td className="py-3 px-4"><span className={getStatusColor(r.status)}>{r.status}</span>{r.invitation?.isCheckedIn && <span className="ml-2 text-xs text-green-600">{Icons.check} In</span>}{r.invitation?.accessCode && <p className="text-xs text-surface-400 mt-1 font-mono">{r.invitation.accessCode}</p>}</td>
                      <td className="py-3 px-4 text-right">{r.status === 'PENDING' && <div className="flex justify-end gap-2"><button onClick={() => handleReviewRsvp(r.id, 'APPROVED')} className="px-3 py-1.5 text-sm bg-green-50 text-green-700 rounded-lg hover:bg-green-100 transition-colors">Approve</button><button onClick={() => handleReviewRsvp(r.id, 'REJECTED')} className="px-3 py-1.5 text-sm bg-red-50 text-red-700 rounded-lg hover:bg-red-100 transition-colors">Reject</button></div>}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* Check-In */}
      {activeTab === 'checkin' && (
        <div className="space-y-4">
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
            <p className="text-surface-600">{checkIns.length} guest(s) checked in</p>
            <div className="flex gap-2">
              <button onClick={exportCheckInsToCSV} className="btn-outline">
                {Icons.download}
                <span className="ml-2">Export CSV</span>
              </button>
              <Link href={`/e/${event.slug}/checkin`} target="_blank" className="btn-primary">Open Check-In Station</Link>
            </div>
          </div>
          <div className="bg-white rounded-xl border border-surface-200 overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead><tr className="border-b border-surface-200 bg-surface-50">
                  <th className="text-left py-3 px-4 text-xs font-medium text-surface-500 uppercase tracking-wider">Guest</th>
                  <th className="text-left py-3 px-4 text-xs font-medium text-surface-500 uppercase tracking-wider">Party</th>
                  <th className="text-left py-3 px-4 text-xs font-medium text-surface-500 uppercase tracking-wider">Code</th>
                  <th className="text-left py-3 px-4 text-xs font-medium text-surface-500 uppercase tracking-wider">Time</th>
                  <th className="text-left py-3 px-4 text-xs font-medium text-surface-500 uppercase tracking-wider">Method</th>
                </tr></thead>
                <tbody className="divide-y divide-surface-100">
                  {checkIns.length === 0 ? <tr><td colSpan={5} className="py-12 text-center text-surface-500">No check-ins yet</td></tr> : checkIns.map(c => (
                    <tr key={c.id} className="hover:bg-surface-50 transition-colors">
                      <td className="py-3 px-4"><p className="font-medium text-navy-900">{c.invitation.guestName}</p></td>
                      <td className="py-3 px-4 text-surface-600">{c.invitation.guestCount}</td>
                      <td className="py-3 px-4 font-mono text-surface-600">{c.invitation.accessCode}</td>
                      <td className="py-3 px-4 text-surface-600">{formatDate(c.checkedInAt, 'MMM d, h:mm a')}</td>
                      <td className="py-3 px-4">
                        <span className={cn(
                          'px-2 py-1 rounded text-xs font-medium',
                          c.method === 'QR_SCAN' ? 'bg-blue-50 text-blue-700' : 'bg-surface-100 text-surface-600'
                        )}>
                          {c.method === 'QR_SCAN' ? 'QR' : 'Code'}
                        </span>
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
          eventId={eventId} 
          eventSlug={event.slug}
          media={media} 
          reelEnabled={event.reelEnabled} 
          onRefresh={fetchMedia}
          isAdmin={true}
        />
      )}

      {/* Templates */}
      {activeTab === 'templates' && (
        <div className="bg-white rounded-xl border border-surface-200 p-6">
          <div className="flex items-center justify-between mb-6">
            <div><h3 className="text-lg font-semibold text-navy-900">Page Templates</h3><p className="text-sm text-surface-500">Customize each page's appearance</p></div>
            <Link href="/admin/templates" className="text-sm text-surface-600 hover:text-navy-900 transition-colors">Manage Templates</Link>
          </div>
          <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {[
              { t: 'INVITATION', l: 'Invitation Page', f: 'invitationTemplateId', e: event.invitationEnabled },
              { t: 'RSVP', l: 'RSVP Form', f: 'rsvpTemplateId', e: event.rsvpEnabled },
              { t: 'GUESTBOOK', l: 'Guestbook Menu', f: 'guestbookTemplateId', e: event.guestbookEnabled },
              { t: 'GUESTBOOK_VIDEO', l: 'Video Recording', f: 'guestbookVideoTemplateId', e: event.guestbookEnabled },
              { t: 'GUESTBOOK_AUDIO', l: 'Audio Recording', f: 'guestbookAudioTemplateId', e: event.guestbookEnabled },
              { t: 'GUESTBOOK_PHOTO', l: 'Photo Upload', f: 'guestbookPhotoTemplateId', e: event.guestbookEnabled },
              { t: 'BOOTH', l: 'Booth/Kiosk', f: 'boothTemplateId', e: event.guestbookEnabled },
              { t: 'THANK_YOU', l: 'Thank You Page', f: 'thankYouTemplateId', e: true },
            ].map(x => (
              <div key={x.t} className={cn(!x.e && 'opacity-50')}>
                <label className="label">{x.l}</label>
                <select className="input" value={(selectedTemplates as any)[x.f] || ''} onChange={e => setSelectedTemplates({ ...selectedTemplates, [x.f]: e.target.value })} disabled={!x.e}>
                  <option value="">Default</option>
                  {getTemplatesByType(x.t).map(t => <option key={t.id} value={t.id}>{t.name}{t.isDefault && ' (Default)'}</option>)}
                </select>
              </div>
            ))}
          </div>
          <div className="flex justify-end mt-6 pt-6 border-t border-surface-100">
            <button onClick={handleSaveTemplates} disabled={savingTemplates} className="btn-primary">{savingTemplates ? 'Saving...' : 'Save Changes'}</button>
          </div>
        </div>
      )}

      {/* Settings */}
      {activeTab === 'settings' && (
        <div className="bg-white rounded-xl border border-surface-200 p-6">
          <div className="flex items-center justify-between mb-6">
            <h3 className="text-lg font-semibold text-navy-900">Event Settings</h3>
            {!editingSettings ? (
              <button onClick={() => setEditingSettings(true)} className="btn-outline">
                {Icons.edit}
                <span className="ml-2">Edit</span>
              </button>
            ) : (
              <div className="flex gap-2">
                <button onClick={() => setEditingSettings(false)} className="btn-ghost">Cancel</button>
                <button onClick={handleSaveSettings} disabled={savingSettings} className="btn-primary">{savingSettings ? 'Saving...' : 'Save'}</button>
              </div>
            )}
          </div>
          {editingSettings ? (
            <div className="space-y-6">
              <div className="grid sm:grid-cols-2 gap-4">
                <div className="sm:col-span-2"><label className="label">Event Name</label><input type="text" className="input" value={eventSettings.name} onChange={e => setEventSettings({ ...eventSettings, name: e.target.value })} /></div>
                <div className="sm:col-span-2"><label className="label">Description</label><textarea rows={3} className="input" value={eventSettings.description} onChange={e => setEventSettings({ ...eventSettings, description: e.target.value })} /></div>
                <div><label className="label">Event Date</label><input type="date" className="input" value={eventSettings.date} onChange={e => setEventSettings({ ...eventSettings, date: e.target.value })} /></div>
                <div><label className="label">Start Time</label><input type="time" className="input" value={eventSettings.time} onChange={e => setEventSettings({ ...eventSettings, time: e.target.value })} /></div>
                <div><label className="label">End Date</label><input type="date" className="input" value={eventSettings.endDate} onChange={e => setEventSettings({ ...eventSettings, endDate: e.target.value })} /></div>
                <div><label className="label">End Time</label><input type="time" className="input" value={eventSettings.endTime} onChange={e => setEventSettings({ ...eventSettings, endTime: e.target.value })} /></div>
                <div className="sm:col-span-2"><label className="label">Venue</label><input type="text" className="input" value={eventSettings.venue} onChange={e => setEventSettings({ ...eventSettings, venue: e.target.value })} /></div>
                <div><label className="label">Timezone</label><select className="input" value={eventSettings.timezone} onChange={e => setEventSettings({ ...eventSettings, timezone: e.target.value })}><option value="UTC">UTC</option><option value="America/New_York">Eastern Time</option><option value="America/Chicago">Central Time</option><option value="America/Denver">Mountain Time</option><option value="America/Los_Angeles">Pacific Time</option><option value="Europe/London">London</option><option value="Africa/Accra">Ghana (GMT)</option></select></div>
              </div>
              
              <div className="border-t border-surface-100 pt-6">
                <h4 className="font-medium text-navy-900 mb-4">Couple Contact Information</h4>
                <p className="text-sm text-surface-500 mb-4">Notifications will be sent to this contact for RSVPs, check-ins, and guestbook entries.</p>
                <div className="grid sm:grid-cols-2 gap-4">
                  <div><label className="label">Couple Name 1</label><input type="text" className="input" placeholder="e.g., Sarah" value={eventSettings.coupleName1} onChange={e => setEventSettings({ ...eventSettings, coupleName1: e.target.value })} /></div>
                  <div><label className="label">Couple Name 2</label><input type="text" className="input" placeholder="e.g., John" value={eventSettings.coupleName2} onChange={e => setEventSettings({ ...eventSettings, coupleName2: e.target.value })} /></div>
                  <div><label className="label">Email</label><input type="email" className="input" placeholder="couple@example.com" value={eventSettings.coupleEmail} onChange={e => setEventSettings({ ...eventSettings, coupleEmail: e.target.value })} /></div>
                  <div><label className="label">Phone</label><input type="tel" className="input" placeholder="+1234567890" value={eventSettings.couplePhone} onChange={e => setEventSettings({ ...eventSettings, couplePhone: e.target.value })} /></div>
                </div>
              </div>

              <div className="border-t border-surface-100 pt-6">
                <h4 className="font-medium text-navy-900 mb-4">Event Colors</h4>
                <p className="text-sm text-surface-500 mb-4">Used for invitations, reel generation, and branding.</p>
                <div className="grid sm:grid-cols-3 gap-4">
                  <div>
                    <label className="label">Primary Color</label>
                    <div className="flex items-center gap-2">
                      <input type="color" className="w-10 h-10 rounded border border-surface-300 cursor-pointer" value={eventSettings.primaryColor} onChange={e => setEventSettings({ ...eventSettings, primaryColor: e.target.value })} />
                      <input type="text" className="input flex-1" value={eventSettings.primaryColor} onChange={e => setEventSettings({ ...eventSettings, primaryColor: e.target.value })} />
                    </div>
                  </div>
                  <div>
                    <label className="label">Secondary Color</label>
                    <div className="flex items-center gap-2">
                      <input type="color" className="w-10 h-10 rounded border border-surface-300 cursor-pointer" value={eventSettings.secondaryColor} onChange={e => setEventSettings({ ...eventSettings, secondaryColor: e.target.value })} />
                      <input type="text" className="input flex-1" value={eventSettings.secondaryColor} onChange={e => setEventSettings({ ...eventSettings, secondaryColor: e.target.value })} />
                    </div>
                  </div>
                  <div>
                    <label className="label">Accent Color</label>
                    <div className="flex items-center gap-2">
                      <input type="color" className="w-10 h-10 rounded border border-surface-300 cursor-pointer" value={eventSettings.accentColor} onChange={e => setEventSettings({ ...eventSettings, accentColor: e.target.value })} />
                      <input type="text" className="input flex-1" value={eventSettings.accentColor} onChange={e => setEventSettings({ ...eventSettings, accentColor: e.target.value })} />
                    </div>
                  </div>
                </div>
                <div className="mt-4 p-4 rounded-lg flex items-center gap-4" style={{ backgroundColor: eventSettings.primaryColor, color: eventSettings.secondaryColor }}>
                  <span className="text-sm font-medium">Preview:</span>
                  <span className="text-lg font-semibold">{eventSettings.name || 'Event Name'}</span>
                  <span className="px-3 py-1 rounded-full text-sm font-medium" style={{ backgroundColor: eventSettings.secondaryColor, color: eventSettings.accentColor }}>Sample Button</span>
                </div>
              </div>

              <div className="border-t border-surface-100 pt-6">
                <h4 className="font-medium text-navy-900 mb-4">Access & Features</h4>
                <div className="space-y-3">
                  <label className="flex items-center gap-3 cursor-pointer p-3 rounded-lg hover:bg-surface-50 transition-colors">
                    <input type="checkbox" className="w-5 h-5 rounded border-surface-300 text-navy-900" checked={eventSettings.invitationOnly} onChange={e => setEventSettings({ ...eventSettings, invitationOnly: e.target.checked })} />
                    <div><span className="font-medium text-navy-900">Invitation Only</span><p className="text-sm text-surface-500">Guests must be approved before accessing event features</p></div>
                  </label>
                  <label className="flex items-center gap-3 cursor-pointer p-3 rounded-lg hover:bg-surface-50 transition-colors">
                    <input type="checkbox" className="w-5 h-5 rounded border-surface-300 text-navy-900" checked={eventSettings.reelEnabled} onChange={e => setEventSettings({ ...eventSettings, reelEnabled: e.target.checked })} />
                    <div><span className="font-medium text-navy-900">Enable Reel Generation</span><p className="text-sm text-surface-500">Allow generating video compilations from guest videos</p></div>
                  </label>
                </div>
              </div>

              <div className="border-t border-surface-100 pt-6">
                <h4 className="font-medium text-navy-900 mb-4">Notifications</h4>
                <div className="space-y-4">
                  <div>
                    <p className="text-sm text-surface-600 mb-3">Send notifications when:</p>
                    <div className="grid sm:grid-cols-3 gap-3">
                      <label className="flex items-center gap-2 p-3 rounded-lg border border-surface-200 hover:bg-surface-50 cursor-pointer">
                        <input type="checkbox" className="w-4 h-4 rounded border-surface-300 text-navy-900" checked={eventSettings.notifyOnRsvp} onChange={e => setEventSettings({ ...eventSettings, notifyOnRsvp: e.target.checked })} />
                        <span className="text-sm font-medium">New RSVP</span>
                      </label>
                      <label className="flex items-center gap-2 p-3 rounded-lg border border-surface-200 hover:bg-surface-50 cursor-pointer">
                        <input type="checkbox" className="w-4 h-4 rounded border-surface-300 text-navy-900" checked={eventSettings.notifyOnCheckIn} onChange={e => setEventSettings({ ...eventSettings, notifyOnCheckIn: e.target.checked })} />
                        <span className="text-sm font-medium">Guest Check-in</span>
                      </label>
                      <label className="flex items-center gap-2 p-3 rounded-lg border border-surface-200 hover:bg-surface-50 cursor-pointer">
                        <input type="checkbox" className="w-4 h-4 rounded border-surface-300 text-navy-900" checked={eventSettings.notifyOnGuestbook} onChange={e => setEventSettings({ ...eventSettings, notifyOnGuestbook: e.target.checked })} />
                        <span className="text-sm font-medium">Guestbook Entry</span>
                      </label>
                    </div>
                  </div>
                  <div>
                    <p className="text-sm text-surface-600 mb-3">Notification channels:</p>
                    <div className="grid sm:grid-cols-3 gap-3">
                      <label className="flex items-center gap-2 p-3 rounded-lg border border-surface-200 hover:bg-surface-50 cursor-pointer">
                        <input type="checkbox" className="w-4 h-4 rounded border-surface-300 text-emerald-600" checked={eventSettings.emailNotifications} onChange={e => setEventSettings({ ...eventSettings, emailNotifications: e.target.checked })} />
                        <svg className="w-4 h-4 text-emerald-600" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" /></svg>
                        <span className="text-sm font-medium">Email</span>
                      </label>
                      <label className="flex items-center gap-2 p-3 rounded-lg border border-surface-200 hover:bg-surface-50 cursor-pointer">
                        <input type="checkbox" className="w-4 h-4 rounded border-surface-300 text-blue-600" checked={eventSettings.smsNotifications} onChange={e => setEventSettings({ ...eventSettings, smsNotifications: e.target.checked })} />
                        <svg className="w-4 h-4 text-blue-600" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M3 5a2 2 0 012-2h3.28a1 1 0 01.948.684l1.498 4.493a1 1 0 01-.502 1.21l-2.257 1.13a11.042 11.042 0 005.516 5.516l1.13-2.257a1 1 0 011.21-.502l4.493 1.498a1 1 0 01.684.949V19a2 2 0 01-2 2h-1C9.716 21 3 14.284 3 6V5z" /></svg>
                        <span className="text-sm font-medium">SMS</span>
                      </label>
                      <label className="flex items-center gap-2 p-3 rounded-lg border border-surface-200 hover:bg-surface-50 cursor-pointer">
                        <input type="checkbox" className="w-4 h-4 rounded border-surface-300 text-green-600" checked={eventSettings.whatsappNotifications} onChange={e => setEventSettings({ ...eventSettings, whatsappNotifications: e.target.checked })} />
                        <svg className="w-4 h-4 text-green-600" fill="currentColor" viewBox="0 0 24 24"><path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z"/></svg>
                        <span className="text-sm font-medium">WhatsApp</span>
                      </label>
                    </div>
                    <p className="text-xs text-surface-400 mt-2">Configure channels in Admin → Settings</p>
                  </div>
                </div>
              </div>

              <div className="border-t border-surface-100 pt-6">
                <h4 className="font-medium text-navy-900 mb-4">Guestbook Limits</h4>
                <div className="grid sm:grid-cols-3 gap-4">
                  <div><label className="label">Min Recording (sec)</label><input type="number" min="10" max="60" className="input" value={eventSettings.minRecordingDuration} onChange={e => setEventSettings({ ...eventSettings, minRecordingDuration: parseInt(e.target.value) })} /></div>
                  <div><label className="label">Max Recording (sec)</label><input type="number" min="30" max="300" className="input" value={eventSettings.maxRecordingDuration} onChange={e => setEventSettings({ ...eventSettings, maxRecordingDuration: parseInt(e.target.value) })} /></div>
                  <div><label className="label">Max Photos/Guest</label><input type="number" min="1" max="20" className="input" value={eventSettings.maxPhotosPerGuest} onChange={e => setEventSettings({ ...eventSettings, maxPhotosPerGuest: parseInt(e.target.value) })} /></div>
                </div>
              </div>
            </div>
          ) : (
            <div className="grid lg:grid-cols-2 gap-8">
              <div className="space-y-3">
                {[
                  { l: 'Slug', v: `/${event.slug}` },
                  { l: 'Date', v: formatDate(event.date, 'PPP') },
                  { l: 'Venue', v: event.venue || '—' },
                  { l: 'Timezone', v: event.timezone },
                ].map((r, i) => (
                  <div key={i} className="flex justify-between py-2 border-b border-surface-100 last:border-0">
                    <span className="text-surface-500">{r.l}</span>
                    <span className="font-medium text-navy-900">{r.v}</span>
                  </div>
                ))}
              </div>
              <div className="space-y-3">
                {[
                  { l: 'Invitation Only', v: event.invitationOnly ? 'Yes' : 'No' },
                  { l: 'Reel Generation', v: event.reelEnabled ? 'Enabled' : 'Disabled' },
                  { l: 'Recording Limits', v: `${event.minRecordingDuration}s – ${event.maxRecordingDuration}s` },
                  { l: 'Max Photos/Guest', v: event.maxPhotosPerGuest },
                ].map((r, i) => (
                  <div key={i} className="flex justify-between py-2 border-b border-surface-100 last:border-0">
                    <span className="text-surface-500">{r.l}</span>
                    <span className="font-medium text-navy-900">{r.v}</span>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      )}

    </div>
  );
}
