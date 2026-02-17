'use client';

import { ChangeEvent, useEffect, useMemo, useRef, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import Link from 'next/link';
import { itineraryApi, ownerDashboardApi } from '@/lib/api';
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
  defaultCurrency?: string;
  currentPhase: string;
  invitationOnly: boolean;
  strictInviteOnly?: boolean;
  itineraryEnabled?: boolean;
  giftingEnabled?: boolean;
  _count: {
    rsvps: number;
    invitations: number;
    checkIns: number;
    mediaAssets: number;
    transactions: number;
    giftOrders?: number;
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

interface Domain {
  id: string;
  host: string;
  isPrimary: boolean;
  status: 'PENDING_VERIFICATION' | 'VERIFIED' | 'ACTIVE' | 'FAILED';
  verificationToken: string;
  verificationNotes?: string | null;
}

interface GiftOrder {
  id: string;
  guestName: string;
  guestPhone: string | null;
  guestEmail: string | null;
  currency: string;
  totalAmount: number;
  ownerNetAmount: number;
  platformFeeAmount: number;
  packageAmount: number;
  status: string;
  createdAt: string;
}

interface RsvpInvite {
  id: string;
  inviteeName: string | null;
  inviteePhone: string | null;
  inviteeEmail: string | null;
  channel?: 'whatsapp' | 'email' | 'both' | string;
  status: 'SENT' | 'OPENED' | 'RESPONDED' | 'EXPIRED';
  initialResponse: 'YES' | 'NO' | null;
  partySize: number | null;
  note: string | null;
  expiresAt: string | null;
  sentAt?: string;
  createdAt?: string;
  openedAt: string | null;
  respondedAt: string | null;
}

interface ItineraryItem {
  id: string;
  title: string;
  description: string | null;
  startsAt: string | null;
  endsAt: string | null;
  location: string | null;
  sortOrder: number;
  isCompleted: boolean;
  completedAt: string | null;
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

interface EventApproval {
  status: 'PENDING_REVIEW' | 'APPROVED' | 'REJECTED' | string;
  submittedAt: string | null;
  reviewedAt: string | null;
  rejectionReason: string | null;
  reviewedBy?: { id: string; name: string; email: string } | null;
  updatedAt?: string | null;
}

type Tab = 'overview' | 'rsvps' | 'checkin' | 'media' | 'tickets' | 'itinerary' | 'invites' | 'domains' | 'gifts';

const Icons = {
  back: <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" /></svg>,
  external: <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" /></svg>,
  copy: <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z" /></svg>,
  download: <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" /></svg>,
  check: <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" /></svg>,
  close: <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg>,
};

function RsvpActionMenu({
  rsvpId,
  status,
  reviewing,
  onReview,
  onDetails,
}: {
  rsvpId: string;
  status: string;
  reviewing: boolean;
  onReview: (id: string, status: 'PENDING' | 'APPROVED' | 'REJECTED') => void;
  onDetails: () => void;
}) {
  const [open, setOpen] = useState(false);

  return (
    <div className="relative">
      <button
        onClick={() => setOpen(!open)}
        className="flex items-center gap-1.5 px-3 py-2 text-sm font-medium text-surface-600 bg-surface-50 border border-surface-200 rounded-lg hover:bg-surface-100 active:bg-surface-200 transition-colors"
      >
        <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 5v.01M12 12v.01M12 19v.01M12 6a1 1 0 110-2 1 1 0 010 2zm0 7a1 1 0 110-2 1 1 0 010 2zm0 7a1 1 0 110-2 1 1 0 010 2z" /></svg>
        Actions
      </button>
      {open && (
        <>
          <div className="fixed inset-0 z-40" onClick={() => setOpen(false)} />
          <div className="absolute left-0 top-full mt-1 z-50 w-48 rounded-xl border border-surface-200 bg-white shadow-lg py-1">
            <button
              onClick={() => { onDetails(); setOpen(false); }}
              className="w-full flex items-center gap-2.5 px-4 py-2.5 text-sm text-brand-900 hover:bg-surface-50 transition-colors"
            >
              <svg className="w-4 h-4 text-blue-500" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" /><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" /></svg>
              View Details
            </button>
            <div className="h-px bg-surface-100 my-1" />
            <button
              onClick={() => { onReview(rsvpId, 'APPROVED'); setOpen(false); }}
              disabled={reviewing || status === 'APPROVED'}
              className="w-full flex items-center gap-2.5 px-4 py-2.5 text-sm text-emerald-700 hover:bg-emerald-50 transition-colors disabled:opacity-40"
            >
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" /></svg>
              Approve
            </button>
            <button
              onClick={() => { onReview(rsvpId, 'PENDING'); setOpen(false); }}
              disabled={reviewing || status === 'PENDING'}
              className="w-full flex items-center gap-2.5 px-4 py-2.5 text-sm text-yellow-700 hover:bg-yellow-50 transition-colors disabled:opacity-40"
            >
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
              Set Pending
            </button>
            <button
              onClick={() => { onReview(rsvpId, 'REJECTED'); setOpen(false); }}
              disabled={reviewing || status === 'REJECTED'}
              className="w-full flex items-center gap-2.5 px-4 py-2.5 text-sm text-rose-700 hover:bg-rose-50 transition-colors disabled:opacity-40"
            >
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg>
              Reject
            </button>
          </div>
        </>
      )}
    </div>
  );
}

export default function OwnerEventDetailPage() {
  const params = useParams();
  const router = useRouter();
  const eventId = params.id as string;

  const [event, setEvent] = useState<Event | null>(null);
  const [rsvps, setRsvps] = useState<RSVP[]>([]);
  const [media, setMedia] = useState<MediaAsset[]>([]);
  const [checkIns, setCheckIns] = useState<CheckIn[]>([]);
  const [tickets, setTickets] = useState<any[]>([]);
  const [approval, setApproval] = useState<EventApproval | null>(null);
  const [loadingApproval, setLoadingApproval] = useState(false);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<Tab>('overview');
  const [rsvpFilter, setRsvpFilter] = useState<string>('all');
  const [viewingRsvpDetails, setViewingRsvpDetails] = useState<RSVP | null>(null);
  const [reviewingRsvp, setReviewingRsvp] = useState<string | null>(null);
  const [domains, setDomains] = useState<Domain[]>([]);
  const [domainHost, setDomainHost] = useState('');
  const [savingDomain, setSavingDomain] = useState(false);
  const [giftOrders, setGiftOrders] = useState<GiftOrder[]>([]);
  const [loadingGifts, setLoadingGifts] = useState(false);
  const [invites, setInvites] = useState<RsvpInvite[]>([]);
  const [loadingInvites, setLoadingInvites] = useState(false);
  const [sendingInvites, setSendingInvites] = useState(false);
  const [inviteLines, setInviteLines] = useState('');
  const [inviteExpiryHours, setInviteExpiryHours] = useState(240);
  const [inviteChannel, setInviteChannel] = useState<'whatsapp' | 'email' | 'both'>('whatsapp');
  const [importingInvites, setImportingInvites] = useState(false);
  const inviteFileInputRef = useRef<HTMLInputElement | null>(null);
  const [itineraryItems, setItineraryItems] = useState<ItineraryItem[]>([]);
  const [loadingItinerary, setLoadingItinerary] = useState(false);
  const [savingItinerary, setSavingItinerary] = useState(false);
  const [savingItineraryOrder, setSavingItineraryOrder] = useState(false);
  const [draggingItineraryId, setDraggingItineraryId] = useState<string | null>(null);
  const [itineraryDropTargetId, setItineraryDropTargetId] = useState<string | null>(null);
  const [creatingMcSession, setCreatingMcSession] = useState(false);
  const [mcControlUrl, setMcControlUrl] = useState('');
  const [showItineraryDateTimeInputs, setShowItineraryDateTimeInputs] = useState(false);
  const [editingItineraryId, setEditingItineraryId] = useState<string | null>(null);
  const [editingItineraryDateTimeInputs, setEditingItineraryDateTimeInputs] = useState(false);
  const [savingEditedItinerary, setSavingEditedItinerary] = useState(false);
  const [deletingItineraryId, setDeletingItineraryId] = useState<string | null>(null);
  const [newItineraryItem, setNewItineraryItem] = useState({
    title: '',
    description: '',
    startsAt: '',
    endsAt: '',
    location: '',
  });
  const [editItineraryItem, setEditItineraryItem] = useState({
    title: '',
    description: '',
    startsAt: '',
    endsAt: '',
    location: '',
  });

  const toDateTimeLocalInput = (value: string | null) => {
    if (!value) return '';
    const date = new Date(value);
    if (Number.isNaN(date.getTime())) return '';
    const pad = (n: number) => String(n).padStart(2, '0');
    return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}T${pad(date.getHours())}:${pad(date.getMinutes())}`;
  };

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

  const fetchApproval = async () => {
    try {
      setLoadingApproval(true);
      const r = await ownerDashboardApi.getEventApproval(eventId);
      setApproval(r.data.approval || null);
    } catch (error: any) {
      toast.error(error.response?.data?.error || 'Failed to load approval status');
    } finally {
      setLoadingApproval(false);
    }
  };

  const fetchDomains = async () => {
    try {
      const r = await ownerDashboardApi.getDomains(eventId);
      setDomains(r.data.domains || []);
    } catch (error: any) {
      toast.error(error.response?.data?.error || 'Failed to load domains');
    }
  };

  const fetchGiftOrders = async () => {
    try {
      setLoadingGifts(true);
      const r = await ownerDashboardApi.getGiftOrders(eventId);
      setGiftOrders(r.data.orders || []);
    } catch (error: any) {
      toast.error(error.response?.data?.error || 'Failed to load gift orders');
    } finally {
      setLoadingGifts(false);
    }
  };

  const fetchInvites = async () => {
    try {
      setLoadingInvites(true);
      const r = await ownerDashboardApi.getRsvpInvites(eventId);
      setInvites(r.data.invites || []);
    } catch (error: any) {
      toast.error(error.response?.data?.error || 'Failed to load WhatsApp invites');
    } finally {
      setLoadingInvites(false);
    }
  };

  const fetchItinerary = async () => {
    try {
      setLoadingItinerary(true);
      const response = await itineraryApi.getItems(eventId);
      setItineraryItems(response.data.items || []);
    } catch (error: any) {
      toast.error(error.response?.data?.error || 'Failed to load itinerary');
    } finally {
      setLoadingItinerary(false);
    }
  };

  const reorderItineraryItems = (items: ItineraryItem[], sourceId: string, targetId: string) => {
    const sourceIndex = items.findIndex((item) => item.id === sourceId);
    const targetIndex = items.findIndex((item) => item.id === targetId);
    if (sourceIndex < 0 || targetIndex < 0 || sourceIndex === targetIndex) return items;
    const reordered = [...items];
    const [movedItem] = reordered.splice(sourceIndex, 1);
    reordered.splice(targetIndex, 0, movedItem);
    return reordered;
  };

  const handleItineraryDrop = async (targetId: string) => {
    if (!draggingItineraryId || draggingItineraryId === targetId || savingItineraryOrder) {
      setItineraryDropTargetId(null);
      return;
    }

    const previous = itineraryItems;
    const next = reorderItineraryItems(previous, draggingItineraryId, targetId);
    if (next === previous) {
      setItineraryDropTargetId(null);
      setDraggingItineraryId(null);
      return;
    }

    setItineraryItems(next);
    setItineraryDropTargetId(null);
    setDraggingItineraryId(null);

    try {
      setSavingItineraryOrder(true);
      await itineraryApi.reorderItems(eventId, next.map((item) => item.id));
      toast.success('Itinerary order updated');
    } catch (error: any) {
      setItineraryItems(previous);
      toast.error(error.response?.data?.error || 'Failed to reorder itinerary');
    } finally {
      setSavingItineraryOrder(false);
    }
  };

  useEffect(() => {
    fetchEvent();
    fetchApproval();
  }, [eventId]);

  useEffect(() => {
    if (event) {
      if (activeTab === 'rsvps') fetchRsvps();
      if (activeTab === 'media') fetchMedia();
      if (activeTab === 'checkin') fetchCheckIns();
      if (activeTab === 'tickets') fetchTickets();
      if (activeTab === 'itinerary') fetchItinerary();
      if (activeTab === 'invites') fetchInvites();
      if (activeTab === 'domains') fetchDomains();
      if (activeTab === 'gifts') fetchGiftOrders();
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

  const handleReviewRsvp = async (rsvpId: string, status: 'PENDING' | 'APPROVED' | 'REJECTED') => {
    setReviewingRsvp(rsvpId);
    try {
      await ownerDashboardApi.updateRsvpStatus(eventId, rsvpId, status);
      toast.success(
        status === 'APPROVED'
          ? 'RSVP approved'
          : status === 'REJECTED'
            ? 'RSVP rejected'
            : 'RSVP set to pending'
      );
      await Promise.all([fetchRsvps(), fetchEvent()]);
    } catch (error: any) {
      toast.error(error.response?.data?.error || 'Failed to review RSVP');
    } finally {
      setReviewingRsvp(null);
    }
  };

  const handleAddDomain = async () => {
    if (!domainHost.trim()) {
      toast.error('Domain host is required');
      return;
    }
    setSavingDomain(true);
    try {
      await ownerDashboardApi.addDomain(eventId, { host: domainHost.trim() });
      setDomainHost('');
      toast.success('Domain added. Complete DNS setup and verify.');
      await fetchDomains();
    } catch (error: any) {
      toast.error(error.response?.data?.error || 'Failed to add domain');
    } finally {
      setSavingDomain(false);
    }
  };

  const handleVerifyDomain = async (domainId: string) => {
    try {
      await ownerDashboardApi.verifyDomain(eventId, domainId);
      toast.success('Domain verification checked');
      await fetchDomains();
    } catch (error: any) {
      toast.error(error.response?.data?.error || 'Failed to verify domain');
    }
  };

  const handleSetPrimaryDomain = async (domainId: string) => {
    try {
      await ownerDashboardApi.setPrimaryDomain(eventId, domainId);
      toast.success('Primary domain updated');
      await fetchDomains();
    } catch (error: any) {
      toast.error(error.response?.data?.error || 'Failed to set primary domain');
    }
  };

  const handleDeleteDomain = async (domainId: string) => {
    if (!confirm('Remove this domain?')) return;
    try {
      await ownerDashboardApi.deleteDomain(eventId, domainId);
      toast.success('Domain removed');
      await fetchDomains();
    } catch (error: any) {
      toast.error(error.response?.data?.error || 'Failed to remove domain');
    }
  };

  const parseInviteLines = (raw: string) => {
    return raw
      .split('\n')
      .map((line) => line.trim())
      .filter(Boolean)
      .map((line) => {
        const parts = line.split(',').map((part) => part.trim());
        if (parts.length === 1) {
          // Single value: if it looks like an email, treat as email; otherwise phone
          if (parts[0].includes('@')) {
            return { email: parts[0] };
          }
          return { phone: parts[0] };
        }
        if (parts.length === 2) {
          // name,phone or name,email
          if (parts[1].includes('@')) {
            return { name: parts[0], email: parts[1] };
          }
          return { name: parts[0], phone: parts[1] };
        }
        return { name: parts[0], phone: parts[1], email: parts[2] };
      })
      .filter((invite) => invite.phone || invite.email);
  };

  const parseCsvRow = (row: string) => {
    const cols: string[] = [];
    let current = '';
    let inQuotes = false;
    for (let i = 0; i < row.length; i++) {
      const char = row[i];
      if (char === '"') {
        if (inQuotes && row[i + 1] === '"') {
          current += '"';
          i += 1;
        } else {
          inQuotes = !inQuotes;
        }
      } else if (char === ',' && !inQuotes) {
        cols.push(current.trim());
        current = '';
      } else {
        current += char;
      }
    }
    cols.push(current.trim());
    return cols;
  };

  const buildInviteLine = (name: string, phone: string, email: string) => {
    if (inviteChannel === 'whatsapp') {
      if (name && phone && email) return `${name},${phone},${email}`;
      if (name && phone) return `${name},${phone}`;
      if (phone) return phone;
      return '';
    }
    if (inviteChannel === 'email') {
      if (name && email) return `${name},${email}`;
      if (email) return email;
      return '';
    }
    if (name && phone && email) return `${name},${phone},${email}`;
    return '';
  };

  const importInviteRows = (rows: string[][]) => {
    if (!rows.length) return 0;

    const header = rows[0].map((v) => v.toLowerCase());
    const hasHeader = header.some((v) => ['name', 'full name', 'phone', 'mobile', 'tel', 'email', 'e-mail'].includes(v));
    const indexOfHeader = (labels: string[]) => header.findIndex((h) => labels.includes(h));
    const nameIdx = hasHeader ? indexOfHeader(['name', 'full name']) : 0;
    const phoneIdx = hasHeader ? indexOfHeader(['phone', 'mobile', 'tel']) : 1;
    const emailIdx = hasHeader ? indexOfHeader(['email', 'e-mail']) : 2;
    const dataRows = hasHeader ? rows.slice(1) : rows;

    const importedLines = dataRows
      .map((cols) => {
        const name = (nameIdx >= 0 ? cols[nameIdx] : cols[0] || '').trim();
        const phone = (phoneIdx >= 0 ? cols[phoneIdx] : cols[1] || '').trim();
        const email = (emailIdx >= 0 ? cols[emailIdx] : cols[2] || '').trim();
        return buildInviteLine(name, phone, email);
      })
      .filter(Boolean);

    if (!importedLines.length) return 0;

    setInviteLines((prev) => {
      const existing = prev
        .split('\n')
        .map((line) => line.trim())
        .filter(Boolean);
      const unique = Array.from(new Set([...existing, ...importedLines]));
      return unique.join('\n');
    });

    return importedLines.length;
  };

  const importInviteText = (text: string) => {
    const rows = text
      .split(/\r?\n/)
      .map((row) => row.trim())
      .filter(Boolean)
      .map(parseCsvRow);
    return importInviteRows(rows);
  };

  const parseXlsxRows = async (file: File) => {
    const arrayBuffer = await file.arrayBuffer();
    const bytes = new Uint8Array(arrayBuffer);
    const view = new DataView(arrayBuffer);
    const decoder = new TextDecoder();

    const eocdSignature = 0x06054b50;
    const centralSignature = 0x02014b50;
    const localSignature = 0x04034b50;
    let eocdOffset = -1;
    for (let i = bytes.length - 22; i >= Math.max(0, bytes.length - 65557); i--) {
      if (view.getUint32(i, true) === eocdSignature) {
        eocdOffset = i;
        break;
      }
    }
    if (eocdOffset < 0) throw new Error('Invalid XLSX file');

    const centralSize = view.getUint32(eocdOffset + 12, true);
    const centralOffset = view.getUint32(eocdOffset + 16, true);

    const unzipEntryText = async (entryName: string) => {
      let offset = centralOffset;
      const centralEnd = centralOffset + centralSize;
      while (offset < centralEnd) {
        if (view.getUint32(offset, true) !== centralSignature) break;
        const compression = view.getUint16(offset + 10, true);
        const compressedSize = view.getUint32(offset + 20, true);
        const fileNameLength = view.getUint16(offset + 28, true);
        const extraLength = view.getUint16(offset + 30, true);
        const commentLength = view.getUint16(offset + 32, true);
        const localOffset = view.getUint32(offset + 42, true);
        const fileName = decoder.decode(bytes.slice(offset + 46, offset + 46 + fileNameLength));

        if (fileName === entryName) {
          if (view.getUint32(localOffset, true) !== localSignature) throw new Error('Invalid XLSX entry');
          const localNameLen = view.getUint16(localOffset + 26, true);
          const localExtraLen = view.getUint16(localOffset + 28, true);
          const dataStart = localOffset + 30 + localNameLen + localExtraLen;
          const compressed = bytes.slice(dataStart, dataStart + compressedSize);

          let uncompressed: Uint8Array;
          if (compression === 0) {
            uncompressed = compressed;
          } else if (compression === 8) {
            const inflateCtor = (globalThis as { DecompressionStream?: new (format: string) => TransformStream<Uint8Array, Uint8Array> }).DecompressionStream;
            if (!inflateCtor) throw new Error('XLSX decompression not supported on this device');
            const stream = new Blob([compressed]).stream().pipeThrough(new inflateCtor('deflate-raw'));
            const inflated = await new Response(stream).arrayBuffer();
            uncompressed = new Uint8Array(inflated);
          } else {
            throw new Error('Unsupported XLSX compression');
          }
          return decoder.decode(uncompressed);
        }

        offset += 46 + fileNameLength + extraLength + commentLength;
      }
      return '';
    };

    const listEntries = () => {
      const entries: string[] = [];
      let offset = centralOffset;
      const centralEnd = centralOffset + centralSize;
      while (offset < centralEnd) {
        if (view.getUint32(offset, true) !== centralSignature) break;
        const fileNameLength = view.getUint16(offset + 28, true);
        const extraLength = view.getUint16(offset + 30, true);
        const commentLength = view.getUint16(offset + 32, true);
        const fileName = decoder.decode(bytes.slice(offset + 46, offset + 46 + fileNameLength));
        entries.push(fileName);
        offset += 46 + fileNameLength + extraLength + commentLength;
      }
      return entries;
    };

    const entries = listEntries();
    const sharedStringsXml = entries.includes('xl/sharedStrings.xml') ? await unzipEntryText('xl/sharedStrings.xml') : '';
    const worksheetPath = entries.includes('xl/worksheets/sheet1.xml')
      ? 'xl/worksheets/sheet1.xml'
      : (entries.find((name) => name.startsWith('xl/worksheets/') && name.endsWith('.xml')) || '');
    if (!worksheetPath) throw new Error('No worksheet found in XLSX');
    const worksheetXml = await unzipEntryText(worksheetPath);

    const parser = new DOMParser();
    const sharedStrings = sharedStringsXml
      ? Array.from(parser.parseFromString(sharedStringsXml, 'application/xml').getElementsByTagName('si')).map((si) =>
          Array.from(si.getElementsByTagName('t')).map((node) => node.textContent || '').join('')
        )
      : [];

    const worksheetDoc = parser.parseFromString(worksheetXml, 'application/xml');
    const rowNodes = Array.from(worksheetDoc.getElementsByTagName('row'));
    const rows = rowNodes.map((rowNode) => {
      const row: string[] = [];
      const cells = Array.from(rowNode.getElementsByTagName('c'));
      cells.forEach((cell) => {
        const ref = cell.getAttribute('r') || '';
        const colLetters = ref.replace(/[0-9]/g, '');
        let colIndex = row.length;
        if (colLetters) {
          colIndex = 0;
          for (let i = 0; i < colLetters.length; i++) {
            colIndex = colIndex * 26 + (colLetters.charCodeAt(i) - 64);
          }
          colIndex -= 1;
        }

        const type = cell.getAttribute('t');
        let value = '';
        if (type === 's') {
          const idx = Number(cell.getElementsByTagName('v')[0]?.textContent || '-1');
          value = idx >= 0 ? String(sharedStrings[idx] || '') : '';
        } else if (type === 'inlineStr') {
          value = Array.from(cell.getElementsByTagName('t')).map((node) => node.textContent || '').join('');
        } else {
          value = cell.getElementsByTagName('v')[0]?.textContent || '';
        }
        row[colIndex] = value.trim();
      });
      return row;
    });

    return rows.filter((row) => row.some((value) => String(value || '').trim()));
  };

  const handleImportInviteFile = async (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    const resetInput = () => {
      if (inviteFileInputRef.current) inviteFileInputRef.current.value = '';
    };

    try {
      setImportingInvites(true);
      const lowerName = file.name.toLowerCase();
      if (lowerName.endsWith('.xls') && !lowerName.endsWith('.xlsx')) {
        toast.error('Legacy .xls is not supported. Use .xlsx or .csv');
        return;
      }
      const imported = lowerName.endsWith('.xlsx')
        ? importInviteRows(await parseXlsxRows(file))
        : importInviteText(await file.text());
      if (!imported) {
        toast.error('No valid invite rows found in file');
        return;
      }
      toast.success(`Imported ${imported} invite row(s)`);
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Failed to import invite file';
      toast.error(message);
    } finally {
      setImportingInvites(false);
      resetInput();
    }
  };

  const downloadInviteTemplate = () => {
    const header = 'name,phone,email';
    const sample = 'Ama Serwaa,+233240000001,ama@example.com';
    const csv = `${header}\n${sample}`;
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement('a');
    anchor.href = url;
    anchor.download = 'invite-template.csv';
    anchor.click();
    URL.revokeObjectURL(url);
  };

  const syncContacts = async () => {
    const contactPicker = (navigator as Navigator & {
      contacts?: { select: (props: string[], options: { multiple: boolean }) => Promise<Array<{ name?: string[]; email?: string[]; tel?: string[] }>> };
    }).contacts;
    if (!contactPicker?.select) {
      toast.error('Contact sync is not supported on this device/browser');
      return;
    }
    try {
      const contacts = await contactPicker.select(['name', 'email', 'tel'], { multiple: true });
      const lines = contacts
        .map((contact) => {
          const name = String(contact.name?.[0] || '').trim();
          const phone = String(contact.tel?.[0] || '').trim();
          const email = String(contact.email?.[0] || '').trim();
          return buildInviteLine(name, phone, email);
        })
        .filter(Boolean);

      if (!lines.length) {
        toast.error('No compatible contacts selected');
        return;
      }

      setInviteLines((prev) => {
        const existing = prev
          .split('\n')
          .map((line) => line.trim())
          .filter(Boolean);
        return Array.from(new Set([...existing, ...lines])).join('\n');
      });
      toast.success(`Synced ${lines.length} contact(s)`);
    } catch {
      toast.error('Contact sync canceled or failed');
    }
  };

  const handleSendInvites = async () => {
    const parsedInvites = parseInviteLines(inviteLines);
    if (!parsedInvites.length) {
      toast.error('Add at least one invite line');
      return;
    }

    setSendingInvites(true);
    try {
      const r = await ownerDashboardApi.sendRsvpInvites(eventId, {
        invites: parsedInvites,
        expiresInHours: inviteExpiryHours,
        channel: inviteChannel,
      });
      toast.success(`Sent ${r.data.sentCount || 0} invite(s)`);
      setInviteLines('');
      await fetchInvites();
    } catch (error: any) {
      toast.error(error.response?.data?.error || 'Failed to send invites');
    } finally {
      setSendingInvites(false);
    }
  };

  const handleResendInvite = async (inviteId: string) => {
    try {
      await ownerDashboardApi.resendRsvpInvite(eventId, inviteId);
      toast.success('Invite resent');
      await fetchInvites();
    } catch (error: any) {
      toast.error(error.response?.data?.error || 'Failed to resend invite');
    }
  };

  const handleAddItineraryItem = async () => {
    if (!newItineraryItem.title.trim()) {
      toast.error('Itinerary item title is required');
      return;
    }

    setSavingItinerary(true);
    try {
      const startsAtIso = showItineraryDateTimeInputs && newItineraryItem.startsAt
        ? new Date(newItineraryItem.startsAt).toISOString()
        : undefined;
      const endsAtIso = showItineraryDateTimeInputs && newItineraryItem.endsAt
        ? new Date(newItineraryItem.endsAt).toISOString()
        : undefined;

      await itineraryApi.createItem(eventId, {
        title: newItineraryItem.title.trim(),
        description: newItineraryItem.description.trim() || undefined,
        startsAt: startsAtIso,
        endsAt: endsAtIso,
        location: newItineraryItem.location.trim() || undefined,
      });
      toast.success('Itinerary item added');
      setNewItineraryItem({
        title: '',
        description: '',
        startsAt: '',
        endsAt: '',
        location: '',
      });
      setShowItineraryDateTimeInputs(false);
      await fetchItinerary();
    } catch (error: any) {
      toast.error(error.response?.data?.error || 'Failed to add itinerary item');
    } finally {
      setSavingItinerary(false);
    }
  };

  const handleStartEditItineraryItem = (item: ItineraryItem) => {
    setEditingItineraryId(item.id);
    setEditingItineraryDateTimeInputs(Boolean(item.startsAt || item.endsAt));
    setEditItineraryItem({
      title: item.title,
      description: item.description || '',
      startsAt: toDateTimeLocalInput(item.startsAt),
      endsAt: toDateTimeLocalInput(item.endsAt),
      location: item.location || '',
    });
  };

  const handleCancelEditItineraryItem = () => {
    setEditingItineraryId(null);
    setEditingItineraryDateTimeInputs(false);
    setEditItineraryItem({
      title: '',
      description: '',
      startsAt: '',
      endsAt: '',
      location: '',
    });
  };

  const handleUpdateItineraryItem = async (itemId: string) => {
    if (!editItineraryItem.title.trim()) {
      toast.error('Itinerary item title is required');
      return;
    }

    setSavingEditedItinerary(true);
    try {
      await itineraryApi.updateItem(eventId, itemId, {
        title: editItineraryItem.title.trim(),
        description: editItineraryItem.description.trim() || null,
        location: editItineraryItem.location.trim() || null,
        startsAt: editingItineraryDateTimeInputs
          ? (editItineraryItem.startsAt ? new Date(editItineraryItem.startsAt).toISOString() : null)
          : null,
        endsAt: editingItineraryDateTimeInputs
          ? (editItineraryItem.endsAt ? new Date(editItineraryItem.endsAt).toISOString() : null)
          : null,
      });
      toast.success('Itinerary item updated');
      handleCancelEditItineraryItem();
      await fetchItinerary();
    } catch (error: any) {
      toast.error(error.response?.data?.error || 'Failed to update itinerary item');
    } finally {
      setSavingEditedItinerary(false);
    }
  };

  const handleDeleteItineraryItem = async (itemId: string) => {
    const confirmed = typeof window !== 'undefined'
      ? window.confirm('Delete this itinerary activity?')
      : true;
    if (!confirmed) return;

    setDeletingItineraryId(itemId);
    try {
      await itineraryApi.deleteItem(eventId, itemId);
      toast.success('Itinerary item deleted');
      if (editingItineraryId === itemId) {
        handleCancelEditItineraryItem();
      }
      await fetchItinerary();
    } catch (error: any) {
      toast.error(error.response?.data?.error || 'Failed to delete itinerary item');
    } finally {
      setDeletingItineraryId(null);
    }
  };

  const handleCreateMcControlLink = async () => {
    setCreatingMcSession(true);
    try {
      const response = await itineraryApi.createMcSession(eventId);
      if (response.data?.mcUrl) {
        setMcControlUrl(response.data.mcUrl);
        await copyToClipboard(response.data.mcUrl);
      }
      toast.success('MC control link generated');
    } catch (error: any) {
      toast.error(error.response?.data?.error || 'Failed to generate MC link');
    } finally {
      setCreatingMcSession(false);
    }
  };

  const getPhaseStyle = (phase: string) => {
    switch (phase) {
      case 'LIVE': return 'bg-emerald-100 text-emerald-700 border-emerald-300';
      case 'PRE_EVENT': return 'bg-blue-100 text-blue-700 border-blue-300';
      case 'POST_EVENT': return 'bg-surface-100 text-surface-700 border-surface-300';
      default: return 'bg-surface-100 text-surface-700 border-surface-300';
    }
  };

  const getRsvpStatusStyle = (status: string) => {
    if (status === 'APPROVED') return 'bg-emerald-100 text-emerald-700';
    if (status === 'REJECTED') return 'bg-rose-100 text-rose-700';
    return 'bg-yellow-100 text-yellow-700';
  };

  const getApprovalStatusStyle = (status: string) => {
    if (status === 'APPROVED') return 'bg-emerald-100 text-emerald-700 border-emerald-200';
    if (status === 'REJECTED') return 'bg-rose-100 text-rose-700 border-rose-200';
    return 'bg-amber-100 text-amber-700 border-amber-200';
  };

  const inviteStats = useMemo(() => {
    const byStatus = invites.reduce((acc, invite) => {
      acc[invite.status] = (acc[invite.status] || 0) + 1;
      return acc;
    }, {} as Record<RsvpInvite['status'], number>);

    return {
      total: invites.length,
      sent: byStatus.SENT || 0,
      opened: byStatus.OPENED || 0,
      responded: byStatus.RESPONDED || 0,
      expired: byStatus.EXPIRED || 0,
    };
  }, [invites]);

  if (loading || !event) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-brand-900" />
      </div>
    );
  }

  const tabs: { id: Tab; label: string; count?: number }[] = [
    { id: 'overview', label: 'Overview' },
    { id: 'rsvps', label: 'RSVPs', count: event._count.rsvps },
    { id: 'checkin', label: 'Check-In', count: event._count.checkIns },
    { id: 'media', label: 'Media', count: event._count.mediaAssets },
    { id: 'tickets', label: 'Tickets', count: event.ticketTypes?.reduce((sum, t) => sum + t.quantitySold, 0) || 0 },
    { id: 'itinerary', label: 'Itinerary', count: itineraryItems.length || undefined },
    { id: 'invites', label: 'Invites', count: invites.length },
    { id: 'domains', label: 'Domains', count: domains.length },
    { id: 'gifts', label: 'Gifts', count: event._count.giftOrders || 0 },
  ];

  return (
    <div className="space-y-7">
      {/* Header */}
      <div className="rounded-xl border border-surface-200/80 bg-white shadow-soft px-4 sm:px-5 py-3.5 sm:py-4">
        <Link href="/owner/events" className="inline-flex items-center text-surface-500 hover:text-brand-900 mb-2 text-sm transition-colors">
          {Icons.back}
          <span className="ml-1">Events</span>
        </Link>
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <h1 className="text-xl sm:text-2xl font-display font-bold text-brand-900 truncate">{event.name}</h1>
            <div className="flex flex-wrap items-center gap-1.5 mt-1.5">
              <span className={cn('inline-flex px-2 py-0.5 text-xs font-medium rounded border', getPhaseStyle(event.currentPhase))}>
                {getPhaseLabel(event.currentPhase)}
              </span>
              {event.invitationOnly && <span className="inline-flex px-2 py-0.5 text-xs font-medium rounded border bg-blue-50 text-blue-700 border-blue-200">Invite Only</span>}
              <span className="text-xs text-surface-400 font-mono">/{event.slug}</span>
            </div>
          </div>
          <Link href={`/e/${event.slug}`} target="_blank" className="btn-outline text-sm flex-shrink-0">
            {Icons.external}
            <span className="ml-1.5 hidden sm:inline">View Page</span>
          </Link>
        </div>
      </div>

      {/* Tabs */}
      <div className="rounded-xl border border-surface-200/80 bg-white shadow-soft p-1.5 -mx-4 sm:mx-0">
        <nav className="flex gap-1 overflow-x-auto scrollbar-hide px-2.5 sm:px-0.5">
          {tabs.map(tab => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={cn(
                'px-3 sm:px-4 py-2 sm:py-2.5 text-sm font-medium rounded-lg transition-all border whitespace-nowrap flex-shrink-0',
                activeTab === tab.id
                  ? 'bg-brand-50 border-brand-100 text-brand-900 shadow-sm'
                  : 'border-transparent text-surface-500 hover:text-surface-700 hover:border-surface-200'
              )}
            >
              {tab.label}
              {tab.count !== undefined && (
                <span className={cn('ml-1.5 px-1.5 py-0.5 rounded-full text-xs', activeTab === tab.id ? 'bg-white text-brand-700 border border-brand-100' : 'bg-surface-100 text-surface-600')}>
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
          <div className="space-y-5">
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
              <div className="bg-white rounded-xl border border-surface-200/80 shadow-soft p-4">
                <p className="text-xs font-semibold uppercase tracking-widest text-surface-400 mb-1">RSVPs</p>
                <p className="text-2xl sm:text-3xl font-bold text-brand-900">{event._count.rsvps}</p>
              </div>
              <div className="bg-white rounded-xl border border-surface-200/80 shadow-soft p-4">
                <p className="text-xs font-semibold uppercase tracking-widest text-surface-400 mb-1">Check-Ins</p>
                <p className="text-2xl sm:text-3xl font-bold text-brand-900">{event._count.checkIns}</p>
              </div>
              <div className="bg-white rounded-xl border border-surface-200/80 shadow-soft p-4">
                <p className="text-xs font-semibold uppercase tracking-widest text-surface-400 mb-1">Media</p>
                <p className="text-2xl sm:text-3xl font-bold text-brand-900">{event._count.mediaAssets}</p>
              </div>
              <div className="bg-white rounded-xl border border-surface-200/80 shadow-soft p-4">
                <p className="text-xs font-semibold uppercase tracking-widest text-surface-400 mb-1">Date</p>
                <p className="text-sm font-semibold text-brand-900 mt-1">{formatDate(event.date)}</p>
              </div>
            </div>

            <div className="bg-white rounded-lg border border-surface-200 p-6">
              <h3 className="text-lg font-semibold text-brand-900 mb-4">Approval Status</h3>
              {loadingApproval ? (
                <div className="flex items-center gap-3 text-sm text-surface-500">
                  <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-brand-900" />
                  <span>Loading approval timeline...</span>
                </div>
              ) : approval ? (
                <div className="space-y-3">
                  <div className="flex flex-wrap items-center gap-3">
                    <span className={cn('inline-flex px-2.5 py-1 rounded-full border text-xs font-medium', getApprovalStatusStyle(approval.status))}>
                      {approval.status.replaceAll('_', ' ')}
                    </span>
                    {approval.reviewedBy?.name ? (
                      <span className="text-xs text-surface-500">
                        Reviewed by {approval.reviewedBy.name}
                      </span>
                    ) : null}
                  </div>
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-3 text-sm">
                    <div className="rounded-xl border border-surface-200 bg-surface-50 p-3">
                      <p className="text-xs uppercase tracking-wide text-surface-500">Submitted</p>
                      <p className="mt-1 text-brand-900">
                        {approval.submittedAt ? formatDate(approval.submittedAt) : 'Not submitted'}
                      </p>
                    </div>
                    <div className="rounded-xl border border-surface-200 bg-surface-50 p-3">
                      <p className="text-xs uppercase tracking-wide text-surface-500">Reviewed</p>
                      <p className="mt-1 text-brand-900">
                        {approval.reviewedAt ? formatDate(approval.reviewedAt) : 'Awaiting admin review'}
                      </p>
                    </div>
                    <div className="rounded-xl border border-surface-200 bg-surface-50 p-3">
                      <p className="text-xs uppercase tracking-wide text-surface-500">Last Updated</p>
                      <p className="mt-1 text-brand-900">
                        {approval.updatedAt ? formatDate(approval.updatedAt) : '-'}
                      </p>
                    </div>
                  </div>
                  {approval.rejectionReason ? (
                    <div className="rounded-xl border border-rose-200 bg-rose-50 p-3 text-sm text-rose-800">
                      <p className="font-medium">Rejection reason</p>
                      <p className="mt-1">{approval.rejectionReason}</p>
                    </div>
                  ) : null}
                </div>
              ) : (
                <p className="text-sm text-surface-500">Approval information is unavailable for this event.</p>
              )}
            </div>

            <div className="bg-white rounded-lg border border-surface-200 p-6">
              <h3 className="text-lg font-semibold text-brand-900 mb-4">Event Details</h3>
              <dl className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <dt className="text-sm font-medium text-surface-600">Name</dt>
                  <dd className="mt-1 text-sm text-brand-900">{event.name}</dd>
                </div>
                {event.description && (
                  <div>
                    <dt className="text-sm font-medium text-surface-600">Description</dt>
                    <dd className="mt-1 text-sm text-brand-900">{event.description}</dd>
                  </div>
                )}
                <div>
                  <dt className="text-sm font-medium text-surface-600">Date</dt>
                  <dd className="mt-1 text-sm text-brand-900">{formatDate(event.date)}</dd>
                </div>
                <div>
                  <dt className="text-sm font-medium text-surface-600">Default Currency</dt>
                  <dd className="mt-1 text-sm text-brand-900">{event.defaultCurrency || 'USD'}</dd>
                </div>
                {event.endDate && (
                  <div>
                    <dt className="text-sm font-medium text-surface-600">End Date</dt>
                    <dd className="mt-1 text-sm text-brand-900">{formatDate(event.endDate)}</dd>
                  </div>
                )}
                {event.venue && (
                  <div>
                    <dt className="text-sm font-medium text-surface-600">Venue</dt>
                    <dd className="mt-1 text-sm text-brand-900">{event.venue}</dd>
                  </div>
                )}
              </dl>
              {/* Shareable Links */}
              <div className="mt-5 pt-5 border-t border-surface-100">
                <h4 className="text-sm font-semibold text-surface-600 mb-3">Shareable Links</h4>
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                  {[
                    { label: 'Event Page', path: `/e/${event.slug}` },
                    { label: 'RSVP Page', path: `/e/${event.slug}/rsvp` },
                    { label: 'Gift Page', path: `/gift/${event.slug}` },
                    { label: 'Itinerary', path: `/e/${event.slug}/itinerary` },
                  ].map((link) => (
                    <button
                      key={link.label}
                      onClick={() => handleCopyLink(link.path)}
                      className="flex items-center gap-2 px-3 py-2.5 rounded-lg border border-surface-200 hover:border-brand-200 hover:bg-brand-50/30 transition-all text-left"
                    >
                      {Icons.copy}
                      <span className="text-sm font-medium text-brand-900 truncate">{link.label}</span>
                    </button>
                  ))}
                </div>
              </div>
            </div>
          </div>
        )}

        {/* RSVPs Tab */}
        {activeTab === 'rsvps' && (
          <div className="space-y-4">
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
              <div className="flex flex-wrap gap-2">
                <button
                  onClick={() => setRsvpFilter('all')}
                  className={cn('px-3 py-1.5 rounded-lg text-sm font-medium', rsvpFilter === 'all' ? 'bg-brand-900 text-white' : 'bg-surface-100 text-surface-700')}
                >
                  All
                </button>
                <button
                  onClick={() => setRsvpFilter('PENDING')}
                  className={cn('px-3 py-1.5 rounded-lg text-sm font-medium', rsvpFilter === 'PENDING' ? 'bg-brand-900 text-white' : 'bg-surface-100 text-surface-700')}
                >
                  Pending
                </button>
                <button
                  onClick={() => setRsvpFilter('APPROVED')}
                  className={cn('px-3 py-1.5 rounded-lg text-sm font-medium', rsvpFilter === 'APPROVED' ? 'bg-brand-900 text-white' : 'bg-surface-100 text-surface-700')}
                >
                  Approved
                </button>
                <button
                  onClick={() => setRsvpFilter('REJECTED')}
                  className={cn('px-3 py-1.5 rounded-lg text-sm font-medium', rsvpFilter === 'REJECTED' ? 'bg-brand-900 text-white' : 'bg-surface-100 text-surface-700')}
                >
                  Rejected
                </button>
              </div>
              <button onClick={exportRsvpsToCSV} className="btn-outline self-start">
                {Icons.download}
                <span className="ml-2">Export CSV</span>
              </button>
            </div>

            <div className="bg-white rounded-lg border border-surface-200 overflow-hidden">
              {rsvps.length === 0 ? (
                <div className="px-6 py-8 text-center text-sm text-surface-500">
                  No RSVPs found
                </div>
              ) : (
                <>
                  {/* Mobile card view */}
                  <div className="divide-y divide-surface-200 md:hidden">
                    {rsvps.map(rsvp => (
                      <div key={rsvp.id} className="p-4 space-y-2.5">
                        <div className="flex items-start justify-between gap-2">
                          <div className="min-w-0">
                            <p className="text-base font-semibold text-brand-900 truncate">{rsvp.primaryName}</p>
                            <p className="text-sm text-surface-500 truncate">{rsvp.email || '-'}</p>
                          </div>
                          <span className={cn('inline-flex px-2 py-0.5 text-xs font-medium rounded flex-shrink-0', getRsvpStatusStyle(rsvp.status))}>
                            {rsvp.status}
                          </span>
                        </div>
                        <div className="flex flex-wrap gap-x-4 gap-y-1 text-sm text-surface-600">
                          <span>{rsvp.attendance}</span>
                          <span>{rsvp.guestCount} guest(s)</span>
                          <span>{formatDate(rsvp.submittedAt)}</span>
                        </div>
                        {/* Action dropdown */}
                        <RsvpActionMenu
                          rsvpId={rsvp.id}
                          status={rsvp.status}
                          reviewing={reviewingRsvp === rsvp.id}
                          onReview={handleReviewRsvp}
                          onDetails={() => setViewingRsvpDetails(rsvp)}
                        />
                      </div>
                    ))}
                  </div>

                  {/* Desktop table view */}
                  <div className="overflow-x-auto hidden md:block">
                    <table className="min-w-full divide-y divide-surface-200">
                      <thead className="bg-surface-50">
                        <tr>
                          <th className="px-6 py-3 text-left text-xs font-medium text-surface-500 uppercase tracking-wider">Name</th>
                          <th className="px-6 py-3 text-left text-xs font-medium text-surface-500 uppercase tracking-wider">Email</th>
                          <th className="px-6 py-3 text-left text-xs font-medium text-surface-500 uppercase tracking-wider">Attendance</th>
                          <th className="px-6 py-3 text-left text-xs font-medium text-surface-500 uppercase tracking-wider">Guests</th>
                          <th className="px-6 py-3 text-left text-xs font-medium text-surface-500 uppercase tracking-wider">Status</th>
                          <th className="px-6 py-3 text-left text-xs font-medium text-surface-500 uppercase tracking-wider">Submitted</th>
                          <th className="px-6 py-3 text-right text-xs font-medium text-surface-500 uppercase tracking-wider">Actions</th>
                        </tr>
                      </thead>
                      <tbody className="bg-white divide-y divide-surface-200">
                        {rsvps.map(rsvp => (
                          <tr key={rsvp.id}>
                            <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-brand-900">{rsvp.primaryName}</td>
                            <td className="px-6 py-4 whitespace-nowrap text-sm text-surface-500">{rsvp.email || '-'}</td>
                            <td className="px-6 py-4 whitespace-nowrap text-sm text-surface-500">{rsvp.attendance}</td>
                            <td className="px-6 py-4 whitespace-nowrap text-sm text-surface-500">{rsvp.guestCount}</td>
                            <td className="px-6 py-4 whitespace-nowrap">
                              <span className={cn('inline-flex px-2 py-0.5 text-xs font-medium rounded', getRsvpStatusStyle(rsvp.status))}>
                                {rsvp.status}
                              </span>
                            </td>
                            <td className="px-6 py-4 whitespace-nowrap text-sm text-surface-500">{formatDate(rsvp.submittedAt)}</td>
                            <td className="px-4 py-4 whitespace-nowrap text-right text-sm">
                              <RsvpActionMenu
                                rsvpId={rsvp.id}
                                status={rsvp.status}
                                reviewing={reviewingRsvp === rsvp.id}
                                onReview={handleReviewRsvp}
                                onDetails={() => setViewingRsvpDetails(rsvp)}
                              />
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </>
              )}
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

            <div className="bg-white rounded-xl border border-surface-200/80 shadow-soft overflow-hidden">
              {checkIns.length === 0 ? (
                <div className="px-4 py-8 text-center text-sm text-surface-500">No check-ins found</div>
              ) : (
                <>
                  {/* Mobile card view */}
                  <div className="divide-y divide-surface-100 md:hidden">
                    {checkIns.map(checkIn => (
                      <div key={checkIn.id} className="px-4 py-3.5 space-y-1.5">
                        <div className="flex items-start justify-between gap-2">
                          <p className="text-sm font-semibold text-brand-900">{checkIn.invitation.guestName}</p>
                          <span className="text-[10px] font-mono text-surface-500 bg-surface-100 px-1.5 py-0.5 rounded flex-shrink-0">{checkIn.invitation.accessCode}</span>
                        </div>
                        <div className="flex flex-wrap gap-x-3 text-xs text-surface-500">
                          <span>{checkIn.invitation.guestCount} guest(s)</span>
                          <span>{checkIn.method}</span>
                          <span>{formatDate(checkIn.checkedInAt)}</span>
                        </div>
                      </div>
                    ))}
                  </div>
                  {/* Desktop table view */}
                  <div className="overflow-x-auto hidden md:block">
                    <table className="min-w-full divide-y divide-surface-200">
                      <thead className="bg-surface-50">
                        <tr>
                          <th className="px-4 py-3 text-left text-xs font-medium text-surface-500 uppercase">Name</th>
                          <th className="px-4 py-3 text-left text-xs font-medium text-surface-500 uppercase">Guests</th>
                          <th className="px-4 py-3 text-left text-xs font-medium text-surface-500 uppercase">Code</th>
                          <th className="px-4 py-3 text-left text-xs font-medium text-surface-500 uppercase">Checked In</th>
                          <th className="px-4 py-3 text-left text-xs font-medium text-surface-500 uppercase">Method</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-surface-100">
                        {checkIns.map(checkIn => (
                          <tr key={checkIn.id}>
                            <td className="px-4 py-3 text-sm font-medium text-brand-900">{checkIn.invitation.guestName}</td>
                            <td className="px-4 py-3 text-sm text-surface-500">{checkIn.invitation.guestCount}</td>
                            <td className="px-4 py-3 text-sm text-surface-500 font-mono">{checkIn.invitation.accessCode}</td>
                            <td className="px-4 py-3 text-sm text-surface-500">{formatDate(checkIn.checkedInAt)}</td>
                            <td className="px-4 py-3 text-sm text-surface-500">{checkIn.method}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </>
              )}
            </div>
          </div>
        )}

        {/* RSVP Details Modal */}
        {viewingRsvpDetails && (
          <div className="fixed inset-0 z-50 bg-black/50 flex items-center justify-center p-4" onClick={() => setViewingRsvpDetails(null)}>
            <div className="bg-white rounded-xl max-w-2xl w-full max-h-[90vh] overflow-y-auto" onClick={(e) => e.stopPropagation()}>
              <div className="sticky top-0 bg-white border-b border-surface-200 px-6 py-4 flex items-center justify-between">
                <h3 className="text-lg font-semibold text-brand-900">RSVP Details</h3>
                <button onClick={() => setViewingRsvpDetails(null)} className="p-2 rounded-lg hover:bg-surface-100">
                  {Icons.close}
                </button>
              </div>
              <div className="p-6">
                <div className="grid sm:grid-cols-2 gap-4">
                  <div>
                    <label className="text-sm font-medium text-surface-500">Primary Name</label>
                    <p className="text-brand-900 font-medium">{viewingRsvpDetails.primaryName}</p>
                  </div>
                  {viewingRsvpDetails.secondaryName && (
                    <div>
                      <label className="text-sm font-medium text-surface-500">Secondary Name</label>
                      <p className="text-brand-900 font-medium">{viewingRsvpDetails.secondaryName}</p>
                    </div>
                  )}
                  {viewingRsvpDetails.email && (
                    <div>
                      <label className="text-sm font-medium text-surface-500">Email</label>
                      <p className="text-brand-900">{viewingRsvpDetails.email}</p>
                    </div>
                  )}
                  {viewingRsvpDetails.phone && (
                    <div>
                      <label className="text-sm font-medium text-surface-500">Phone</label>
                      <p className="text-brand-900">{viewingRsvpDetails.phone}</p>
                    </div>
                  )}
                  <div>
                    <label className="text-sm font-medium text-surface-500">Attendance</label>
                    <p className="text-brand-900">{viewingRsvpDetails.attendance}</p>
                  </div>
                  <div>
                    <label className="text-sm font-medium text-surface-500">Guest Count</label>
                    <p className="text-brand-900">{viewingRsvpDetails.guestCount}</p>
                  </div>
                  {viewingRsvpDetails.mealPreference && (
                    <div>
                      <label className="text-sm font-medium text-surface-500">Meal Preference</label>
                      <p className="text-brand-900">{viewingRsvpDetails.mealPreference}</p>
                    </div>
                  )}
                  {viewingRsvpDetails.dietaryNotes && (
                    <div>
                      <label className="text-sm font-medium text-surface-500">Dietary Notes</label>
                      <p className="text-brand-900">{viewingRsvpDetails.dietaryNotes}</p>
                    </div>
                  )}
                  {viewingRsvpDetails.note && (
                    <div className="sm:col-span-2">
                      <label className="text-sm font-medium text-surface-500">Note</label>
                      <p className="text-brand-900">{viewingRsvpDetails.note}</p>
                    </div>
                  )}
                  <div>
                    <label className="text-sm font-medium text-surface-500">Submitted At</label>
                    <p className="text-brand-900">{formatDate(viewingRsvpDetails.submittedAt, 'MMM d, yyyy h:mm a')}</p>
                  </div>
                  <div>
                    <label className="text-sm font-medium text-surface-500">Status</label>
                    <span className={cn('inline-flex px-2 py-0.5 text-xs font-medium rounded', getRsvpStatusStyle(viewingRsvpDetails.status))}>
                      {viewingRsvpDetails.status}
                    </span>
                  </div>
                  {viewingRsvpDetails.invitation?.accessCode && (
                    <div>
                      <label className="text-sm font-medium text-surface-500">Access Code</label>
                      <p className="text-brand-900 font-mono">{viewingRsvpDetails.invitation.accessCode}</p>
                    </div>
                  )}
                  {viewingRsvpDetails.invitation?.isCheckedIn !== undefined && (
                    <div>
                      <label className="text-sm font-medium text-surface-500">Checked In</label>
                      <p className="text-brand-900">{viewingRsvpDetails.invitation.isCheckedIn ? 'Yes' : 'No'}</p>
                    </div>
                  )}
                </div>
                
                {/* QR Code Display */}
                {viewingRsvpDetails.invitation?.qrCodeData && (
                  <div className="border-t border-surface-200 pt-4 mt-4">
                    <h4 className="text-sm font-semibold text-brand-900 mb-3">QR Code</h4>
                    <div className="flex flex-col items-center gap-3">
                      <img
                        src={viewingRsvpDetails.invitation.qrCodeData}
                        alt="QR Code"
                        className="w-48 h-48 bg-white p-2 rounded-lg border border-surface-200"
                      />
                      <p className="text-xs text-surface-500 text-center">
                        Scan this QR code for check-in
                      </p>
                    </div>
                  </div>
                )}
              </div>
            </div>
          </div>
        )}

        {/* Media Tab */}
        {activeTab === 'media' && (
          <div>
            <MediaGallery eventId={eventId} eventSlug={event?.slug} media={media} isAdmin={false} onRefresh={fetchMedia} />
          </div>
        )}

        {/* Tickets Tab */}
        {activeTab === 'tickets' && (
          <div className="bg-white rounded-xl border border-surface-200/80 shadow-soft overflow-hidden">
            {tickets.length === 0 ? (
              <div className="px-4 py-8 text-center text-sm text-surface-500">No tickets found</div>
            ) : (
              <>
                {/* Mobile card view */}
                <div className="divide-y divide-surface-100 md:hidden">
                  {tickets.map((ticket: any) => (
                    <div key={ticket.id} className="px-4 py-3.5 space-y-1.5">
                      <div className="flex items-start justify-between gap-2">
                        <p className="text-sm font-semibold text-brand-900">{ticket.name}</p>
                        <span className={cn('inline-flex px-1.5 py-0.5 text-[10px] font-medium rounded border leading-none flex-shrink-0', ticket.isActive ? 'bg-emerald-50 text-emerald-700 border-emerald-200' : 'bg-surface-100 text-surface-600 border-surface-200')}>
                          {ticket.isActive ? 'Active' : 'Inactive'}
                        </span>
                      </div>
                      <div className="flex flex-wrap gap-x-3 text-xs text-surface-500">
                        <span className="font-semibold text-brand-900">{ticket.price > 0 ? `${ticket.currency} ${ticket.price.toFixed(2)}` : 'Free'}</span>
                        <span>{ticket.quantitySold} / {ticket.quantityTotal} sold</span>
                      </div>
                    </div>
                  ))}
                </div>
                {/* Desktop table view */}
                <div className="overflow-x-auto hidden md:block">
                  <table className="min-w-full divide-y divide-surface-200">
                    <thead className="bg-surface-50">
                      <tr>
                        <th className="px-4 py-3 text-left text-xs font-medium text-surface-500 uppercase">Name</th>
                        <th className="px-4 py-3 text-left text-xs font-medium text-surface-500 uppercase">Price</th>
                        <th className="px-4 py-3 text-left text-xs font-medium text-surface-500 uppercase">Sold</th>
                        <th className="px-4 py-3 text-left text-xs font-medium text-surface-500 uppercase">Total</th>
                        <th className="px-4 py-3 text-left text-xs font-medium text-surface-500 uppercase">Status</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-surface-100">
                      {tickets.map((ticket: any) => (
                        <tr key={ticket.id}>
                          <td className="px-4 py-3 text-sm font-medium text-brand-900">{ticket.name}</td>
                          <td className="px-4 py-3 text-sm text-surface-500">
                            {ticket.price > 0 ? `${ticket.currency} ${ticket.price.toFixed(2)}` : 'Free'}
                          </td>
                          <td className="px-4 py-3 text-sm text-surface-500">{ticket.quantitySold}</td>
                          <td className="px-4 py-3 text-sm text-surface-500">{ticket.quantityTotal}</td>
                          <td className="px-4 py-3">
                            <span className={cn('inline-flex px-2 py-0.5 text-xs font-medium rounded', ticket.isActive ? 'bg-emerald-100 text-emerald-700' : 'bg-surface-100 text-surface-600')}>
                              {ticket.isActive ? 'Active' : 'Inactive'}
                            </span>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </>
            )}
          </div>
        )}

        {/* Itinerary Tab */}
        {activeTab === 'itinerary' && (
          <div className="space-y-4">
            <div className="bg-white rounded-lg border border-surface-200 p-4 space-y-3">
              <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-3">
                <div>
                  <h3 className="font-semibold text-brand-900">Event Itinerary</h3>
                  <p className="text-sm text-surface-600">
                    Add activities for guests and generate a secure MC control link.
                  </p>
                </div>
                <button
                  className="btn-primary"
                  disabled={creatingMcSession}
                  onClick={handleCreateMcControlLink}
                >
                  {creatingMcSession ? 'Generating...' : 'Generate MC Link'}
                </button>
              </div>
              {mcControlUrl && (
                <div className="rounded-lg border border-surface-200 bg-surface-50 p-3">
                  <p className="text-xs uppercase tracking-wider text-surface-500 font-medium">MC Control URL</p>
                  <div className="mt-2 flex flex-col sm:flex-row gap-2">
                    <input className="input text-sm" readOnly value={mcControlUrl} />
                    <button className="btn-outline" onClick={() => copyToClipboard(mcControlUrl)}>
                      Copy
                    </button>
                  </div>
                </div>
              )}
            </div>

            <div className="bg-white rounded-lg border border-surface-200 p-4 space-y-3">
              <h4 className="font-medium text-brand-900">Add Item</h4>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                <input
                  className="input"
                  placeholder="Activity title"
                  value={newItineraryItem.title}
                  onChange={(e) => setNewItineraryItem((prev) => ({ ...prev, title: e.target.value }))}
                />
                <input
                  className="input"
                  placeholder="Location (optional)"
                  value={newItineraryItem.location}
                  onChange={(e) => setNewItineraryItem((prev) => ({ ...prev, location: e.target.value }))}
                />
              </div>
              <div className="flex items-center justify-between gap-3 rounded-lg border border-surface-200 bg-surface-50 px-3 py-2">
                <div>
                  <p className="text-sm font-medium text-brand-900">Add date/time</p>
                  <p className="text-xs text-surface-500">Optional. Keep off for same-day activities without fixed times.</p>
                </div>
                <button
                  type="button"
                  className={cn(
                    'px-3 py-1.5 rounded-lg text-xs font-semibold border transition-colors',
                    showItineraryDateTimeInputs
                      ? 'bg-brand-900 text-white border-brand-900'
                      : 'bg-white text-surface-700 border-surface-200 hover:bg-surface-100'
                  )}
                  onClick={() => {
                    const next = !showItineraryDateTimeInputs;
                    setShowItineraryDateTimeInputs(next);
                    if (!next) {
                      setNewItineraryItem((prev) => ({ ...prev, startsAt: '', endsAt: '' }));
                    }
                  }}
                >
                  {showItineraryDateTimeInputs ? 'Hide Date/Time' : 'Add Date/Time'}
                </button>
              </div>
              {showItineraryDateTimeInputs && (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                  <input
                    type="datetime-local"
                    className="input"
                    value={newItineraryItem.startsAt}
                    onChange={(e) => setNewItineraryItem((prev) => ({ ...prev, startsAt: e.target.value }))}
                  />
                  <input
                    type="datetime-local"
                    className="input"
                    value={newItineraryItem.endsAt}
                    onChange={(e) => setNewItineraryItem((prev) => ({ ...prev, endsAt: e.target.value }))}
                  />
                </div>
              )}
              <textarea
                className="input min-h-[88px]"
                placeholder="Description (optional)"
                value={newItineraryItem.description}
                onChange={(e) => setNewItineraryItem((prev) => ({ ...prev, description: e.target.value }))}
              />
              <div className="flex justify-end">
                <button className="btn-primary" disabled={savingItinerary} onClick={handleAddItineraryItem}>
                  {savingItinerary ? 'Saving...' : 'Add Item'}
                </button>
              </div>
            </div>

            {loadingItinerary ? (
              <div className="text-center py-12">
                <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-brand-900 mx-auto" />
              </div>
            ) : itineraryItems.length === 0 ? (
              <div className="bg-white rounded-lg border border-surface-200 p-10 text-center text-surface-500">
                No itinerary items yet.
              </div>
            ) : (
              <div className="bg-white rounded-lg border border-surface-200 overflow-hidden">
                <div className="px-4 py-2 border-b border-surface-200 bg-surface-50 text-xs text-surface-600 flex items-center justify-between gap-3">
                  <span>Drag and drop itinerary items to reorder.</span>
                  {savingItineraryOrder ? <span className="font-medium text-brand-900">Saving order...</span> : null}
                </div>
                <div className="divide-y divide-surface-200">
                  {itineraryItems.map((item) => (
                    <div
                      key={item.id}
                      draggable={editingItineraryId !== item.id && !savingItineraryOrder}
                      onDragStart={() => setDraggingItineraryId(item.id)}
                      onDragEnd={() => {
                        setDraggingItineraryId(null);
                        setItineraryDropTargetId(null);
                      }}
                      onDragOver={(e) => {
                        if (editingItineraryId === item.id || savingItineraryOrder) return;
                        e.preventDefault();
                        if (itineraryDropTargetId !== item.id) {
                          setItineraryDropTargetId(item.id);
                        }
                      }}
                      onDrop={(e) => {
                        e.preventDefault();
                        handleItineraryDrop(item.id);
                      }}
                      className={cn(
                        'px-4 py-3 flex flex-col md:flex-row md:items-start md:justify-between gap-3',
                        itineraryDropTargetId === item.id ? 'bg-brand-50' : ''
                      )}
                    >
                      {editingItineraryId === item.id ? (
                        <div className="w-full space-y-3">
                          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                            <input
                              className="input"
                              placeholder="Activity title"
                              value={editItineraryItem.title}
                              onChange={(e) => setEditItineraryItem((prev) => ({ ...prev, title: e.target.value }))}
                            />
                            <input
                              className="input"
                              placeholder="Location (optional)"
                              value={editItineraryItem.location}
                              onChange={(e) => setEditItineraryItem((prev) => ({ ...prev, location: e.target.value }))}
                            />
                          </div>
                          <div className="flex items-center justify-between gap-3 rounded-lg border border-surface-200 bg-surface-50 px-3 py-2">
                            <div>
                              <p className="text-sm font-medium text-brand-900">Edit date/time</p>
                              <p className="text-xs text-surface-500">Optional for this itinerary activity.</p>
                            </div>
                            <button
                              type="button"
                              className={cn(
                                'px-3 py-1.5 rounded-lg text-xs font-semibold border transition-colors',
                                editingItineraryDateTimeInputs
                                  ? 'bg-brand-900 text-white border-brand-900'
                                  : 'bg-white text-surface-700 border-surface-200 hover:bg-surface-100'
                              )}
                              onClick={() => {
                                const next = !editingItineraryDateTimeInputs;
                                setEditingItineraryDateTimeInputs(next);
                                if (!next) {
                                  setEditItineraryItem((prev) => ({ ...prev, startsAt: '', endsAt: '' }));
                                }
                              }}
                            >
                              {editingItineraryDateTimeInputs ? 'Hide Date/Time' : 'Add Date/Time'}
                            </button>
                          </div>
                          {editingItineraryDateTimeInputs && (
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                              <input
                                type="datetime-local"
                                className="input"
                                value={editItineraryItem.startsAt}
                                onChange={(e) => setEditItineraryItem((prev) => ({ ...prev, startsAt: e.target.value }))}
                              />
                              <input
                                type="datetime-local"
                                className="input"
                                value={editItineraryItem.endsAt}
                                onChange={(e) => setEditItineraryItem((prev) => ({ ...prev, endsAt: e.target.value }))}
                              />
                            </div>
                          )}
                          <textarea
                            className="input min-h-[80px]"
                            placeholder="Description (optional)"
                            value={editItineraryItem.description}
                            onChange={(e) => setEditItineraryItem((prev) => ({ ...prev, description: e.target.value }))}
                          />
                          <div className="flex items-center justify-end gap-2">
                            <button className="btn-ghost" onClick={handleCancelEditItineraryItem}>
                              Cancel
                            </button>
                            <button
                              className="btn-primary"
                              disabled={savingEditedItinerary}
                              onClick={() => handleUpdateItineraryItem(item.id)}
                            >
                              {savingEditedItinerary ? 'Saving...' : 'Save Changes'}
                            </button>
                          </div>
                        </div>
                      ) : (
                        <>
                          <div>
                            <div className="text-[11px] uppercase tracking-wide text-surface-400 mb-1">
                              Drag to move
                            </div>
                            <div className="flex items-center gap-2">
                              <span
                                className={cn(
                                  'w-2 h-2 rounded-full',
                                  item.isCompleted ? 'bg-emerald-500' : 'bg-surface-300'
                                )}
                              />
                              <p className={cn('font-medium', item.isCompleted ? 'text-surface-500 line-through' : 'text-brand-900')}>
                                {item.title}
                              </p>
                            </div>
                            {item.description && (
                              <p className="text-sm text-surface-600 mt-1">{item.description}</p>
                            )}
                            {(item.startsAt || item.location) && (
                              <p className="text-xs text-surface-500 mt-1">
                                {item.startsAt ? formatDate(item.startsAt, 'MMM d, yyyy p') : ''}
                                {item.startsAt && item.location ? ' • ' : ''}
                                {item.location ? item.location : ''}
                              </p>
                            )}
                          </div>
                          <div className="flex flex-col items-end gap-2">
                            <div className="text-xs text-surface-500">
                              {item.isCompleted
                                ? `Completed ${item.completedAt ? formatDate(item.completedAt) : 'recently'}`
                                : 'Pending'}
                            </div>
                            <div className="flex items-center gap-2">
                              <button className="btn-ghost" onClick={() => handleStartEditItineraryItem(item)}>
                                Edit
                              </button>
                              <button
                                className="btn-ghost text-rose-600 hover:text-rose-700"
                                disabled={deletingItineraryId === item.id}
                                onClick={() => handleDeleteItineraryItem(item.id)}
                              >
                                {deletingItineraryId === item.id ? 'Deleting...' : 'Delete'}
                              </button>
                            </div>
                          </div>
                        </>
                      )}
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}

        {/* WhatsApp Invites Tab */}
        {activeTab === 'invites' && (
          <div className="space-y-4">
            <div className="bg-white rounded-lg border border-surface-200 p-4 space-y-3">
              <h3 className="font-semibold text-brand-900">Send RSVP Invites</h3>
              <div className="grid grid-cols-3 sm:grid-cols-5 gap-2 text-xs">
                <div className="rounded-md border border-surface-200 bg-surface-50 px-3 py-2">
                  <p className="text-surface-500">Total</p>
                  <p className="font-semibold text-brand-900">{inviteStats.total}</p>
                </div>
                <div className="rounded-md border border-surface-200 bg-amber-50 px-3 py-2">
                  <p className="text-amber-700">Sent</p>
                  <p className="font-semibold text-amber-800">{inviteStats.sent}</p>
                </div>
                <div className="rounded-md border border-surface-200 bg-blue-50 px-3 py-2">
                  <p className="text-blue-700">Opened</p>
                  <p className="font-semibold text-blue-800">{inviteStats.opened}</p>
                </div>
                <div className="rounded-md border border-surface-200 bg-emerald-50 px-3 py-2">
                  <p className="text-emerald-700">Responded</p>
                  <p className="font-semibold text-emerald-800">{inviteStats.responded}</p>
                </div>
                <div className="rounded-md border border-surface-200 bg-rose-50 px-3 py-2">
                  <p className="text-rose-700">Expired</p>
                  <p className="font-semibold text-rose-800">{inviteStats.expired}</p>
                </div>
              </div>

              {/* Channel selector */}
              <div>
                <label className="text-sm font-medium text-surface-600 mb-1.5 block">Send via</label>
                <div className="inline-flex rounded-lg border border-surface-200 bg-surface-100 p-1 gap-0.5">
                  {([
                    { value: 'whatsapp' as const, label: 'WhatsApp' },
                    { value: 'email' as const, label: 'Email' },
                    { value: 'both' as const, label: 'Both' },
                  ]).map((opt) => (
                    <button
                      key={opt.value}
                      type="button"
                      onClick={() => setInviteChannel(opt.value)}
                      className={cn(
                        'px-3 py-1.5 rounded-md text-sm font-medium transition-colors',
                        inviteChannel === opt.value
                          ? 'bg-white text-brand-900 shadow-sm'
                          : 'text-surface-600 hover:text-brand-900'
                      )}
                    >
                      {opt.label}
                    </button>
                  ))}
                </div>
              </div>

              <p className="text-sm text-surface-600">
                One invite per line. Format:{' '}
                {inviteChannel === 'whatsapp' && (
                  <><span className="font-mono">phone</span> or <span className="font-mono">name,phone</span> or <span className="font-mono">name,phone,email</span></>
                )}
                {inviteChannel === 'email' && (
                  <><span className="font-mono">email</span> or <span className="font-mono">name,email</span></>
                )}
                {inviteChannel === 'both' && (
                  <><span className="font-mono">name,phone,email</span> (both phone and email required)</>
                )}
              </p>
              <div className="flex flex-wrap items-center gap-2">
                <button type="button" className="btn-outline" onClick={syncContacts}>
                  Sync Contacts
                </button>
                <button
                  type="button"
                  className="btn-outline"
                  disabled={importingInvites}
                  onClick={() => inviteFileInputRef.current?.click()}
                >
                  {importingInvites ? 'Importing...' : 'Import CSV/XLSX'}
                </button>
                <button type="button" className="btn-ghost" onClick={downloadInviteTemplate}>
                  Download CSV Template
                </button>
                <input
                  ref={inviteFileInputRef}
                  type="file"
                  accept=".csv,.xlsx,.xls,text/csv"
                  className="hidden"
                  onChange={handleImportInviteFile}
                />
              </div>
              <textarea
                className="input min-h-[140px]"
                placeholder={
                  inviteChannel === 'whatsapp'
                    ? '+233xxxxxxxxx\nAma Serwaa,+233xxxxxxxxx,ama@email.com'
                    : inviteChannel === 'email'
                    ? 'ama@email.com\nAma Serwaa,ama@email.com'
                    : 'Ama Serwaa,+233xxxxxxxxx,ama@email.com'
                }
                value={inviteLines}
                onChange={(e) => setInviteLines(e.target.value)}
              />
              <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
                <div className="flex items-center gap-3">
                  <label className="text-sm text-surface-600">Expires in</label>
                  <select
                    className="input w-[180px]"
                    value={inviteExpiryHours}
                    onChange={(e) => setInviteExpiryHours(Math.max(1, Number(e.target.value || 240)))}
                  >
                    <option value={24}>24 hours</option>
                    <option value={72}>3 days</option>
                    <option value={168}>7 days</option>
                    <option value={240}>10 days</option>
                    <option value={720}>30 days</option>
                  </select>
                </div>
                <button className="btn-primary" disabled={sendingInvites} onClick={handleSendInvites}>
                  {sendingInvites ? 'Sending...' : 'Send Invites'}
                </button>
              </div>
            </div>

            {loadingInvites ? (
              <div className="text-center py-12">
                <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-brand-900 mx-auto" />
              </div>
            ) : (
              <div className="bg-white rounded-lg border border-surface-200 overflow-hidden">
                {invites.length === 0 ? (
                  <div className="px-6 py-6 text-center text-sm text-surface-500">
                    No invites sent yet
                  </div>
                ) : (
                  <>
                    {/* Mobile card view */}
                    <div className="divide-y divide-surface-200 md:hidden">
                      {invites.map((invite) => (
                        <div key={invite.id} className="p-4 space-y-2">
                          <div className="flex items-start justify-between gap-2">
                            <div className="min-w-0">
                              <p className="text-sm font-semibold text-brand-900 truncate">{invite.inviteeName || '-'}</p>
                              <p className="text-xs text-surface-500">{invite.inviteePhone || invite.inviteeEmail || '-'}</p>
                            </div>
                            <span
                              className={cn(
                                'inline-flex px-2 py-0.5 rounded text-xs font-medium border flex-shrink-0',
                                invite.status === 'RESPONDED' && 'bg-emerald-50 text-emerald-700 border-emerald-200',
                                invite.status === 'OPENED' && 'bg-blue-50 text-blue-700 border-blue-200',
                                invite.status === 'SENT' && 'bg-amber-50 text-amber-700 border-amber-200',
                                invite.status === 'EXPIRED' && 'bg-rose-50 text-rose-700 border-rose-200'
                              )}
                            >
                              {invite.status}
                            </span>
                          </div>
                          <div className="flex flex-wrap gap-x-3 gap-y-1 text-xs text-surface-600">
                            <span>Channel: {(invite.channel || 'whatsapp').toUpperCase()}</span>
                            <span>Response: {invite.initialResponse || '-'}</span>
                            <span>Sent: {formatDate(invite.sentAt || invite.createdAt || '')}</span>
                          </div>
                          <button
                            className="btn-outline !text-xs !px-2.5 !py-1.5"
                            onClick={() => handleResendInvite(invite.id)}
                            disabled={invite.status === 'RESPONDED'}
                          >
                            Resend
                          </button>
                        </div>
                      ))}
                    </div>

                    {/* Desktop table view */}
                    <div className="overflow-x-auto hidden md:block">
                      <table className="min-w-full divide-y divide-surface-200">
                        <thead className="bg-surface-50">
                          <tr>
                            <th className="px-6 py-3 text-left text-xs font-medium text-surface-500 uppercase tracking-wider">Invitee</th>
                            <th className="px-6 py-3 text-left text-xs font-medium text-surface-500 uppercase tracking-wider">Contact</th>
                            <th className="px-6 py-3 text-left text-xs font-medium text-surface-500 uppercase tracking-wider">Channel</th>
                            <th className="px-6 py-3 text-left text-xs font-medium text-surface-500 uppercase tracking-wider">Status</th>
                            <th className="px-6 py-3 text-left text-xs font-medium text-surface-500 uppercase tracking-wider">Response</th>
                            <th className="px-6 py-3 text-left text-xs font-medium text-surface-500 uppercase tracking-wider">Sent</th>
                            <th className="px-6 py-3 text-left text-xs font-medium text-surface-500 uppercase tracking-wider">Expires</th>
                            <th className="px-6 py-3 text-right text-xs font-medium text-surface-500 uppercase tracking-wider">Action</th>
                          </tr>
                        </thead>
                        <tbody className="bg-white divide-y divide-surface-200">
                          {invites.map((invite) => (
                            <tr key={invite.id}>
                              <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-brand-900">{invite.inviteeName || '-'}</td>
                              <td className="px-6 py-4 whitespace-nowrap text-sm text-surface-600">{invite.inviteePhone || invite.inviteeEmail || '-'}</td>
                              <td className="px-6 py-4 whitespace-nowrap text-sm text-surface-600">{(invite.channel || 'whatsapp').toUpperCase()}</td>
                              <td className="px-6 py-4 whitespace-nowrap">
                                <span
                                  className={cn(
                                    'inline-flex px-2 py-0.5 rounded text-xs font-medium border',
                                    invite.status === 'RESPONDED' && 'bg-emerald-50 text-emerald-700 border-emerald-200',
                                    invite.status === 'OPENED' && 'bg-blue-50 text-blue-700 border-blue-200',
                                    invite.status === 'SENT' && 'bg-amber-50 text-amber-700 border-amber-200',
                                    invite.status === 'EXPIRED' && 'bg-rose-50 text-rose-700 border-rose-200'
                                  )}
                                >
                                  {invite.status}
                                </span>
                              </td>
                              <td className="px-6 py-4 whitespace-nowrap text-sm text-surface-600">
                                {invite.initialResponse || '-'}
                              </td>
                              <td className="px-6 py-4 whitespace-nowrap text-sm text-surface-600">
                                {formatDate(invite.sentAt || invite.createdAt || '')}
                              </td>
                              <td className="px-6 py-4 whitespace-nowrap text-sm text-surface-600">
                                {invite.expiresAt ? formatDate(invite.expiresAt) : '-'}
                              </td>
                              <td className="px-6 py-4 whitespace-nowrap text-right">
                                <button
                                  className="btn-outline"
                                  onClick={() => handleResendInvite(invite.id)}
                                  disabled={invite.status === 'RESPONDED'}
                                >
                                  Resend
                                </button>
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </>
                )}
              </div>
            )}
          </div>
        )}

        {/* Domains Tab */}
        {activeTab === 'domains' && (
          <div className="space-y-4">
            <div className="bg-white rounded-lg border border-surface-200 p-4">
              <p className="text-sm text-surface-600 mb-3">Connect your own domain via TXT + CNAME verification.</p>
              <div className="flex flex-col sm:flex-row gap-3">
                <input
                  type="text"
                  className="input flex-1"
                  placeholder="e.g. wedding.example.com"
                  value={domainHost}
                  onChange={(e) => setDomainHost(e.target.value)}
                />
                <button className="btn-primary" disabled={savingDomain} onClick={handleAddDomain}>
                  {savingDomain ? 'Adding...' : 'Add Domain'}
                </button>
              </div>
            </div>

            {domains.length === 0 ? (
              <div className="bg-white rounded-lg border border-surface-200 p-10 text-center text-surface-500">
                No domains connected yet.
              </div>
            ) : (
              <div className="space-y-3">
                {domains.map((domain) => (
                  <div key={domain.id} className="bg-white rounded-lg border border-surface-200 p-4">
                    <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-3">
                      <div>
                        <div className="flex items-center gap-2 flex-wrap">
                          <span className="font-semibold text-brand-900">{domain.host}</span>
                          {domain.isPrimary && <span className="px-2 py-0.5 rounded text-xs bg-brand-100 text-brand-700">Primary</span>}
                          <span
                            className={cn(
                              'px-2 py-0.5 rounded text-xs font-medium border',
                              domain.status === 'ACTIVE' && 'bg-emerald-50 text-emerald-700 border-emerald-200',
                              domain.status === 'VERIFIED' && 'bg-blue-50 text-blue-700 border-blue-200',
                              domain.status === 'FAILED' && 'bg-rose-50 text-rose-700 border-rose-200',
                              domain.status === 'PENDING_VERIFICATION' && 'bg-amber-50 text-amber-700 border-amber-200'
                            )}
                          >
                            {domain.status.replace(/_/g, ' ')}
                          </span>
                        </div>
                        <div className="mt-2 text-xs text-surface-500 space-y-1">
                          <p>TXT: <span className="font-mono text-surface-700">_eventpeepo.{domain.host}</span> = <span className="font-mono text-surface-700">{domain.verificationToken}</span></p>
                          <p>CNAME: <span className="font-mono text-surface-700">{domain.host.startsWith('www.') ? domain.host : `www.${domain.host}`}</span> = <span className="font-mono text-surface-700">{process.env.NEXT_PUBLIC_DOMAIN_CNAME_TARGET || 'cname.eventpeepo.com'}</span></p>
                        </div>
                      </div>
                      <div className="flex items-center gap-2">
                        <button className="btn-outline" onClick={() => handleVerifyDomain(domain.id)}>Verify</button>
                        {!domain.isPrimary && (
                          <button
                            className="btn-outline"
                            disabled={!['VERIFIED', 'ACTIVE'].includes(domain.status)}
                            onClick={() => handleSetPrimaryDomain(domain.id)}
                          >
                            Make Primary
                          </button>
                        )}
                        <button className="btn-ghost text-rose-600 hover:text-rose-700" onClick={() => handleDeleteDomain(domain.id)}>
                          Remove
                        </button>
                      </div>
                    </div>
                    {domain.verificationNotes && (
                      <p className="text-xs text-rose-600 mt-2">{domain.verificationNotes}</p>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {/* Gifts Tab */}
        {activeTab === 'gifts' && (
          <div className="space-y-4">
            {loadingGifts ? (
              <div className="text-center py-12">
                <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-brand-900 mx-auto" />
              </div>
            ) : (
              <div className="bg-white rounded-lg border border-surface-200 overflow-hidden">
                {giftOrders.length === 0 ? (
                  <div className="px-6 py-6 text-center text-sm text-surface-500">No gift orders yet</div>
                ) : (
                  <>
                    {/* Mobile card view */}
                    <div className="divide-y divide-surface-200 md:hidden">
                      {giftOrders.map((order) => (
                        <div key={order.id} className="p-4 space-y-2">
                          <div className="flex items-start justify-between gap-2">
                            <div className="min-w-0">
                              <p className="text-sm font-semibold text-brand-900 truncate">{order.guestName}</p>
                              <p className="text-xs text-surface-500 truncate">{order.guestEmail || order.guestPhone || '-'}</p>
                            </div>
                            <span className={cn('inline-flex px-2 py-0.5 rounded text-xs font-medium flex-shrink-0', order.status === 'PAID' ? 'bg-emerald-100 text-emerald-700' : 'bg-amber-100 text-amber-700')}>
                              {order.status}
                            </span>
                          </div>
                          <div className="flex flex-wrap gap-x-4 gap-y-1 text-xs">
                            <span className="text-surface-700">Total: {order.currency} {order.totalAmount.toFixed(2)}</span>
                            <span className="font-semibold text-brand-900">Net: {order.currency} {order.ownerNetAmount.toFixed(2)}</span>
                            <span className="text-surface-500">{formatDate(order.createdAt)}</span>
                          </div>
                        </div>
                      ))}
                    </div>

                    {/* Desktop table view */}
                    <div className="overflow-x-auto hidden md:block">
                      <table className="min-w-full divide-y divide-surface-200">
                        <thead className="bg-surface-50">
                          <tr>
                            <th className="px-6 py-3 text-left text-xs font-medium text-surface-500 uppercase tracking-wider">Guest</th>
                            <th className="px-6 py-3 text-left text-xs font-medium text-surface-500 uppercase tracking-wider">Contact</th>
                            <th className="px-6 py-3 text-left text-xs font-medium text-surface-500 uppercase tracking-wider">Total Gift</th>
                            <th className="px-6 py-3 text-left text-xs font-medium text-surface-500 uppercase tracking-wider">Your Net</th>
                            <th className="px-6 py-3 text-left text-xs font-medium text-surface-500 uppercase tracking-wider">Status</th>
                            <th className="px-6 py-3 text-left text-xs font-medium text-surface-500 uppercase tracking-wider">Date</th>
                          </tr>
                        </thead>
                        <tbody className="bg-white divide-y divide-surface-200">
                          {giftOrders.map((order) => (
                            <tr key={order.id}>
                              <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-brand-900">{order.guestName}</td>
                              <td className="px-6 py-4 whitespace-nowrap text-sm text-surface-500">{order.guestEmail || order.guestPhone || '-'}</td>
                              <td className="px-6 py-4 whitespace-nowrap text-sm text-surface-700">{order.currency} {order.totalAmount.toFixed(2)}</td>
                              <td className="px-6 py-4 whitespace-nowrap text-sm font-semibold text-brand-900">{order.currency} {order.ownerNetAmount.toFixed(2)}</td>
                              <td className="px-6 py-4 whitespace-nowrap">
                                <span className={cn('inline-flex px-2 py-0.5 rounded text-xs font-medium', order.status === 'PAID' ? 'bg-emerald-100 text-emerald-700' : 'bg-amber-100 text-amber-700')}>
                                  {order.status}
                                </span>
                              </td>
                              <td className="px-6 py-4 whitespace-nowrap text-sm text-surface-500">{formatDate(order.createdAt)}</td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </>
                )}
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
