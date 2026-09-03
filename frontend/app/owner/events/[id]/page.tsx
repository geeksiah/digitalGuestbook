'use client';

import { ChangeEvent, useEffect, useMemo, useRef, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import Link from 'next/link';
import { itineraryApi, ownerDashboardApi } from '@/lib/api';
import MediaGallery from '@/components/media/MediaGallery';
import { formatDate, formatCount, getPhaseLabel, getPhaseTone, getStatusTone, getErrorMessage, humanizeEnum, cn, copyToClipboard, formatCurrencyAmount, getEventPublicUrl, pickLiveEventDomain, toAbsoluteAppUrl } from '@/lib/utils';
import {
  DetailRow,
  PageSkeleton,
  EmptyState,
  ListSkeleton,
  PageHeader,
  Panel,
  PublicPageRow,
  ShareButton,
  SegmentedControl,
  StatRow,
  StatusBadge,
  SubmitButton,
  Switch,
  Tabs,
  Td,
  Th,
  Toolbar,
} from '@/components/ui/Primitives';
import { ConfirmDialog, Menu, MenuItem, MenuSeparator, Modal } from '@/components/ui/Overlay';
import { ExternalLink } from '@/components/ui/icons';
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
  invitationEnabled?: boolean;
  rsvpEnabled?: boolean;
  guestbookEnabled?: boolean;
  checkInEnabled?: boolean;
  ticketingEnabled?: boolean;
  rsvpMode?: 'free' | 'paid';
  itineraryEnabled?: boolean;
  giftingEnabled?: boolean;
  votingPageTemplateId?: string | null;
  nominationPageTemplateId?: string | null;
  nomineesPageTemplateId?: string | null;
  leaderboardPageTemplateId?: string | null;
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

/** Delivery channels an RSVP invite can go out on. Any combination is valid. */
type InviteChannel = 'whatsapp' | 'sms' | 'email';

const INVITE_CHANNEL_OPTIONS: Array<{ value: InviteChannel; label: string }> = [
  { value: 'whatsapp', label: 'WhatsApp' },
  { value: 'sms', label: 'SMS' },
  { value: 'email', label: 'Email' },
];

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

type Tab = 'overview' | 'rsvps' | 'checkin' | 'media' | 'tickets' | 'itinerary' | 'invites' | 'domains' | 'voting' | 'gifts';


/** Row actions for one RSVP. Uses the shared Menu so it flips, traps keys,
 *  and becomes a bottom sheet on phones. */
function RsvpActionMenu({
  rsvpId,
  guestName,
  status,
  reviewing,
  onReview,
  onDetails,
}: {
  rsvpId: string;
  guestName: string;
  status: string;
  reviewing: boolean;
  onReview: (id: string, status: 'PENDING' | 'APPROVED' | 'REJECTED') => void;
  onDetails: () => void;
}) {
  return (
    <Menu label={`Actions for ${guestName}`} sheetTitle={guestName}>
      <MenuItem onClick={onDetails}>View details</MenuItem>
      <MenuSeparator />
      <MenuItem disabled={reviewing || status === 'APPROVED'} onClick={() => onReview(rsvpId, 'APPROVED')}>
        Approve
      </MenuItem>
      <MenuItem disabled={reviewing || status === 'PENDING'} onClick={() => onReview(rsvpId, 'PENDING')}>
        Move back to pending
      </MenuItem>
      <MenuItem danger disabled={reviewing || status === 'REJECTED'} onClick={() => onReview(rsvpId, 'REJECTED')}>
        Reject
      </MenuItem>
    </Menu>
  );
}

/** Invite delivery states map onto the shared status tones. */
function getInviteTone(status: string): 'success' | 'info' | 'warning' | 'danger' | 'neutral' {
  if (status === 'RESPONDED') return 'success';
  if (status === 'OPENED') return 'info';
  if (status === 'SENT') return 'warning';
  if (status === 'EXPIRED') return 'danger';
  return 'neutral';
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
  const [votingEnabled, setVotingEnabled] = useState(false);
  const [loadingGifts, setLoadingGifts] = useState(false);
  const [invites, setInvites] = useState<RsvpInvite[]>([]);
  const [loadingInvites, setLoadingInvites] = useState(false);
  const [sendingInvites, setSendingInvites] = useState(false);
  const [inviteLines, setInviteLines] = useState('');
  const [inviteExpiryHours, setInviteExpiryHours] = useState(240);
  const [inviteChannels, setInviteChannels] = useState<InviteChannel[]>(['whatsapp']);
  const [importingInvites, setImportingInvites] = useState(false);
  const inviteFileInputRef = useRef<HTMLInputElement | null>(null);
  const [itineraryItems, setItineraryItems] = useState<ItineraryItem[]>([]);
  const [loadingItinerary, setLoadingItinerary] = useState(false);
  const [savingItinerary, setSavingItinerary] = useState(false);
  const [savingItineraryOrder, setSavingItineraryOrder] = useState(false);
  const [removingDomain, setRemovingDomain] = useState<Domain | null>(null);
  const [showAddItinerary, setShowAddItinerary] = useState(false);
  const [deletingItinerary, setDeletingItinerary] = useState<ItineraryItem | null>(null);
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
      const nextEvent = r.data.event;
      setEvent(nextEvent);

      // The voting switch is authoritative. Assigned voting templates only act
      // as a hint when the config could not be read at all, otherwise turning
      // voting off would leave it visible for any event that still has one.
      const templateBasedVoting = Boolean(
        nextEvent?.votingPageTemplateId
          || nextEvent?.nominationPageTemplateId
          || nextEvent?.nomineesPageTemplateId
          || nextEvent?.leaderboardPageTemplateId
      );
      try {
        const votingResponse = await ownerDashboardApi.getVotingConfig(eventId);
        const config = votingResponse.data?.config;
        setVotingEnabled(config ? Boolean(config.isEnabled) : templateBasedVoting);
      } catch {
        setVotingEnabled(templateBasedVoting);
      }
    } catch (error: any) {
      toast.error(getErrorMessage(error, 'Failed to load event'));
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
      toast.error(getErrorMessage(error, 'Failed to load RSVPs'));
    }
  };

  const fetchMedia = async () => {
    try {
      const r = await ownerDashboardApi.getMedia(eventId);
      setMedia(r.data.media || []);
    } catch (error: any) {
      toast.error(getErrorMessage(error, 'Failed to load media'));
    }
  };

  const fetchCheckIns = async () => {
    try {
      const r = await ownerDashboardApi.getCheckIns(eventId);
      setCheckIns(r.data.checkIns || []);
    } catch (error: any) {
      toast.error(getErrorMessage(error, 'Failed to load check-ins'));
    }
  };

  const fetchTickets = async () => {
    try {
      const r = await ownerDashboardApi.getTickets(eventId);
      setTickets(r.data.tickets || []);
    } catch (error: any) {
      toast.error(getErrorMessage(error, 'Failed to load tickets'));
    }
  };

  const fetchApproval = async () => {
    try {
      setLoadingApproval(true);
      const r = await ownerDashboardApi.getEventApproval(eventId);
      setApproval(r.data.approval || null);
    } catch (error: any) {
      toast.error(getErrorMessage(error, 'Failed to load approval status'));
    } finally {
      setLoadingApproval(false);
    }
  };

  const fetchDomains = async () => {
    try {
      const r = await ownerDashboardApi.getDomains(eventId);
      setDomains(r.data.domains || []);
    } catch (error: any) {
      toast.error(getErrorMessage(error, 'Failed to load domains'));
    }
  };

  const fetchGiftOrders = async () => {
    try {
      setLoadingGifts(true);
      const r = await ownerDashboardApi.getGiftOrders(eventId);
      setGiftOrders(r.data.orders || []);
    } catch (error: any) {
      toast.error(getErrorMessage(error, 'Failed to load gift orders'));
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
      toast.error(getErrorMessage(error, 'Failed to load WhatsApp invites'));
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
      toast.error(getErrorMessage(error, 'Failed to load itinerary'));
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
      toast.error(getErrorMessage(error, 'Failed to reorder itinerary'));
    } finally {
      setSavingItineraryOrder(false);
    }
  };

  useEffect(() => {
    fetchEvent();
    fetchApproval();
    // Overview shows the address guests actually visit, so domains load up front.
    fetchDomains();
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

  useEffect(() => {
    if (!event || activeTab !== 'gifts') return;
    const refresh = () => {
      if (document.visibilityState !== 'visible') return;
      void fetchGiftOrders();
    };
    const interval = window.setInterval(refresh, 12000);
    window.addEventListener('focus', refresh);
    document.addEventListener('visibilitychange', refresh);
    return () => {
      window.clearInterval(interval);
      window.removeEventListener('focus', refresh);
      document.removeEventListener('visibilitychange', refresh);
    };
  }, [activeTab, event]);

  /** Copy an already-resolved absolute URL (custom domain aware). */
  const handleCopyUrl = async (url: string) => {
    if (await copyToClipboard(url)) toast.success('Link copied');
    else toast.error('Could not copy. Select the link and copy it manually.');
  };

  const handleCopyLink = async (path: string) => {
    if (await copyToClipboard(`${window.location.origin}${path}`)) {
      toast.success('Link copied');
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
      toast.error(getErrorMessage(error, 'Failed to review RSVP'));
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
      toast.error(getErrorMessage(error, 'Failed to add domain'));
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
      toast.error(getErrorMessage(error, 'Failed to verify domain'));
    }
  };

  const handleSetPrimaryDomain = async (domainId: string) => {
    try {
      await ownerDashboardApi.setPrimaryDomain(eventId, domainId);
      toast.success('Primary domain updated');
      await fetchDomains();
    } catch (error: any) {
      toast.error(getErrorMessage(error, 'Failed to set primary domain'));
    }
  };

  const handleDeleteDomain = async (domainId: string) => {
    try {
      await ownerDashboardApi.deleteDomain(eventId, domainId);
      toast.success('Domain removed');
      await fetchDomains();
    } catch (error: any) {
      toast.error(getErrorMessage(error, 'Failed to remove domain'));
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

  // Which contact details a recipient row must carry, given the chosen channels.
  const inviteNeedsPhone = inviteChannels.includes('whatsapp') || inviteChannels.includes('sms');
  const inviteNeedsEmail = inviteChannels.includes('email');

  const buildInviteLine = (name: string, phone: string, email: string) => {
    if (inviteNeedsPhone && inviteNeedsEmail) {
      return name && phone && email ? `${name},${phone},${email}` : '';
    }
    if (inviteNeedsPhone) {
      if (name && phone && email) return `${name},${phone},${email}`;
      if (name && phone) return `${name},${phone}`;
      return phone || '';
    }
    if (inviteNeedsEmail) {
      if (name && email) return `${name},${email}`;
      return email || '';
    }
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
        channel: inviteChannels.join(','),
      });
      toast.success(`Sent ${r.data.sentCount || 0} invite(s)`);
      setInviteLines('');
      await fetchInvites();
    } catch (error: any) {
      toast.error(getErrorMessage(error, 'Failed to send invites'));
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
      toast.error(getErrorMessage(error, 'Failed to resend invite'));
    }
  };

  /** Keyboard and touch friendly reordering. Same persistence as drag and drop. */
  const moveItineraryItem = async (index: number, delta: number) => {
    const target = index + delta;
    if (target < 0 || target >= itineraryItems.length || savingItineraryOrder) return;

    const previous = itineraryItems;
    const next = [...previous];
    const [moved] = next.splice(index, 1);
    next.splice(target, 0, moved);
    setItineraryItems(next);

    try {
      setSavingItineraryOrder(true);
      await itineraryApi.reorderItems(eventId, next.map((item) => item.id));
    } catch (e: any) {
      setItineraryItems(previous);
      toast.error(getErrorMessage(e, 'Could not reorder the itinerary.'));
    } finally {
      setSavingItineraryOrder(false);
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
      toast.error(getErrorMessage(error, 'Failed to add itinerary item'));
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
      toast.error(getErrorMessage(error, 'Failed to update itinerary item'));
    } finally {
      setSavingEditedItinerary(false);
    }
  };

  const handleDeleteItineraryItem = async (itemId: string) => {
    setDeletingItineraryId(itemId);
    try {
      await itineraryApi.deleteItem(eventId, itemId);
      toast.success('Itinerary item deleted');
      if (editingItineraryId === itemId) {
        handleCancelEditItineraryItem();
      }
      await fetchItinerary();
    } catch (error: any) {
      toast.error(getErrorMessage(error, 'Failed to delete itinerary item'));
    } finally {
      setDeletingItineraryId(null);
    }
  };

  const handleCreateMcControlLink = async () => {
    setCreatingMcSession(true);
    try {
      const response = await itineraryApi.createMcSession(eventId);
      if (response.data?.mcUrl) {
        setMcControlUrl(toAbsoluteAppUrl(response.data.mcUrl));
        await copyToClipboard(toAbsoluteAppUrl(response.data.mcUrl));
      }
      toast.success('MC control link generated');
    } catch (error: any) {
      toast.error(getErrorMessage(error, 'Failed to generate MC link'));
    } finally {
      setCreatingMcSession(false);
    }
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

  const tabs: { id: Tab; label: string; count?: number }[] = useMemo(() => {
    if (!event) {
      return [{ id: 'overview', label: 'Overview' }];
    }

    const rsvpEnabled = event.rsvpEnabled !== false;
    const checkInEnabled = event.checkInEnabled !== false;
    const guestbookEnabled = event.guestbookEnabled !== false;
    const itineraryEnabled = Boolean(event.itineraryEnabled);
    const giftingEnabled = Boolean(event.giftingEnabled);
    const ticketingEnabled = Boolean(event.ticketingEnabled) || (rsvpEnabled && event.rsvpMode === 'paid');

    return [
      { id: 'overview', label: 'Overview' },
      ...(rsvpEnabled ? [{ id: 'rsvps' as Tab, label: 'RSVPs', count: event._count.rsvps }] : []),
      ...(checkInEnabled ? [{ id: 'checkin' as Tab, label: 'Check-In', count: event._count.checkIns }] : []),
      ...(guestbookEnabled ? [{ id: 'media' as Tab, label: 'Media', count: event._count.mediaAssets }] : []),
      ...(ticketingEnabled
        ? [{ id: 'tickets' as Tab, label: 'Tickets', count: event.ticketTypes?.reduce((sum, t) => sum + t.quantitySold, 0) || 0 }]
        : []),
      ...(itineraryEnabled ? [{ id: 'itinerary' as Tab, label: 'Itinerary', count: itineraryItems.length || undefined }] : []),
      ...(rsvpEnabled ? [{ id: 'invites' as Tab, label: 'Invites', count: invites.length }] : []),
      { id: 'domains', label: 'Domains', count: domains.length },
      ...(votingEnabled ? [{ id: 'voting' as Tab, label: 'Voting' }] : []),
      ...(giftingEnabled ? [{ id: 'gifts' as Tab, label: 'Gifts', count: event._count.giftOrders || 0 }] : []),
    ];
  }, [
    event?.rsvpEnabled,
    event?.checkInEnabled,
    event?.guestbookEnabled,
    event?.ticketingEnabled,
    event?.rsvpMode,
    event?.itineraryEnabled,
    event?.giftingEnabled,
    event?._count?.rsvps,
    event?._count?.checkIns,
    event?._count?.mediaAssets,
    event?._count?.giftOrders,
    event?.ticketTypes,
    itineraryItems.length,
    invites.length,
    domains.length,
    votingEnabled,
  ]);

  useEffect(() => {
    if (!tabs.some((tab) => tab.id === activeTab)) {
      setActiveTab('overview');
    }
  }, [activeTab, tabs]);

  if (loading || !event) {
    return <PageSkeleton stats={4} rows={4} />;
  }

  // Guest links follow the event's connected domain when it has one, so the
  // address shown here is the one a guest actually visits.
  const liveDomain = pickLiveEventDomain(domains);
  const publicUrl = (path: string) => getEventPublicUrl(event.slug, path, domains);

  const guestPages = [
    { label: 'Event home', page: '/', enabled: true },
    { label: 'RSVP', page: '/rsvp', enabled: event.rsvpEnabled !== false },
    { label: 'Guestbook', page: '/guestbook', enabled: event.guestbookEnabled !== false },
    { label: 'Check-in', page: '/checkin', enabled: event.checkInEnabled !== false },
    { label: 'Itinerary', page: '/itinerary', enabled: Boolean(event.itineraryEnabled) },
    { label: 'Gifts', page: '/gift', enabled: Boolean(event.giftingEnabled) },
    { label: 'Vote', page: '/vote', enabled: votingEnabled },
  ]
    .filter((entry) => entry.enabled)
    .map((entry) => ({ ...entry, url: publicUrl(entry.page) }));

  return (
    <div className="page">
      <PageHeader
        title={event.name}
        backHref="/owner/events"
        backLabel="Events"
        meta={
          <>
            <StatusBadge tone={getPhaseTone(event.currentPhase)} dot>
              {getPhaseLabel(event.currentPhase)}
            </StatusBadge>
            {event.invitationOnly ? <StatusBadge tone="brand">Invite only</StatusBadge> : null}
            <span className="truncate font-mono text-[12px]">/{event.slug}</span>
          </>
        }
        actions={
          <a href={`/e/${event.slug}`} target="_blank" rel="noopener noreferrer" className="btn-outline">
            View event
          </a>
        }
        mobileActions={
          <a
            href={`/e/${event.slug}`}
            target="_blank"
            rel="noopener noreferrer"
            className="icon-btn"
            aria-label="View public event page"
          >
            <ExternalLink className="h-5 w-5" strokeWidth={1.75} aria-hidden="true" />
          </a>
        }
      />

      <Tabs items={tabs} active={activeTab} onChange={(id) => setActiveTab(id as Tab)} label="Event sections" />

      {/* Tab Content */}
      <div>
        {/* Overview Tab */}
        {activeTab === 'overview' && (
          <div className="space-y-4">
            <StatRow
              items={[
                { label: 'RSVPs', value: formatCount(event._count.rsvps) },
                { label: 'Check-ins', value: formatCount(event._count.checkIns) },
                { label: 'Media', value: formatCount(event._count.mediaAssets) },
                { label: 'Date', value: <span className="text-lg">{formatDate(event.date, 'MMM d')}</span>, hint: formatDate(event.date, 'yyyy') },
              ]}
            />

            {approval && approval.status !== 'APPROVED' ? (
              <Panel title="Approval">
                {loadingApproval ? (
                  <div className="space-y-2">
                    <div className="skeleton h-4 w-32" />
                    <div className="skeleton h-4 w-48" />
                  </div>
                ) : (
                  <>
                    <div className="flex flex-wrap items-center gap-2">
                      <StatusBadge tone={getStatusTone(approval.status === 'PENDING_REVIEW' ? 'PENDING' : approval.status)}>
                        {humanizeEnum(approval.status)}
                      </StatusBadge>
                      {approval.reviewedBy?.name ? (
                        <span className="meta">Reviewed by {approval.reviewedBy.name}</span>
                      ) : null}
                    </div>
                    <dl className="mt-2 divide-y divide-surface-200">
                      <DetailRow label="Submitted">
                        {approval.submittedAt ? formatDate(approval.submittedAt, 'MMM d, yyyy') : 'Not submitted'}
                      </DetailRow>
                      <DetailRow label="Reviewed">
                        {approval.reviewedAt ? formatDate(approval.reviewedAt, 'MMM d, yyyy') : 'Awaiting review'}
                      </DetailRow>
                    </dl>
                    {approval.rejectionReason ? (
                      <div className="banner-error mt-3" role="status">
                        <span>
                          <span className="font-semibold">Needs changes: </span>
                          {approval.rejectionReason}
                        </span>
                      </div>
                    ) : null}
                  </>
                )}
              </Panel>
            ) : null}

            <div className="grid gap-4 xl:grid-cols-[minmax(0,1.2fr)_minmax(280px,1fr)]">
              <Panel
                title="Guest pages"
                action={
                  liveDomain ? <StatusBadge tone="success">{liveDomain.host}</StatusBadge> : null
                }
                flush
              >
                <div className="divide-y divide-surface-200">
                  {guestPages.map((page) => (
                    <PublicPageRow
                      key={page.page}
                      label={page.label}
                      path={page.page}
                      url={page.url}
                      onCopy={() => handleCopyUrl(page.url)}
                    />
                  ))}
                </div>
                {liveDomain ? null : (
                  <p className="field-hint px-4 py-2.5">
                    Connect a domain to serve these from your own address.
                  </p>
                )}
              </Panel>

              <div className="space-y-4">
                <Panel title="Details">
                  <dl className="divide-y divide-surface-200">
                    <DetailRow label="Date">{formatDate(event.date, 'MMM d, yyyy p')}</DetailRow>
                    {event.endDate ? (
                      <DetailRow label="Ends">{formatDate(event.endDate, 'MMM d, yyyy p')}</DetailRow>
                    ) : null}
                    {event.venue ? <DetailRow label="Venue">{event.venue}</DetailRow> : null}
                    <DetailRow label="Currency">{event.defaultCurrency || 'USD'}</DetailRow>
                    <DetailRow label="Time zone">{event.timezone}</DetailRow>
                  </dl>
                  {event.description ? (
                    <p className="mt-3 border-t border-surface-200 pt-3 text-[13px] leading-5 text-surface-700">
                      {event.description}
                    </p>
                  ) : null}
                </Panel>

                {votingEnabled ? (
                  <Panel
                    title="Voting"
                    action={
                      <Link href={`/owner/events/${event.id}/voting`} className="btn-primary btn-sm">
                        Open
                      </Link>
                    }
                  >
                    <p className="meta">Categories, nominees and live results.</p>
                  </Panel>
                ) : null}
              </div>
            </div>
          </div>
        )}

        {/* RSVPs Tab */}
        {activeTab === 'rsvps' && (
          <div className="space-y-4">
            <Toolbar
              end={
                <button onClick={exportRsvpsToCSV} className="btn-outline btn-sm" disabled={rsvps.length === 0}>
                  Export CSV
                </button>
              }
            >
              <SegmentedControl
                label="RSVP status"
                value={rsvpFilter}
                onChange={setRsvpFilter}
                options={[
                  { value: 'all', label: 'All' },
                  { value: 'PENDING', label: 'Pending' },
                  { value: 'APPROVED', label: 'Approved' },
                  { value: 'REJECTED', label: 'Rejected' },
                ]}
              />
              <span className="meta num hidden sm:inline">{formatCount(rsvps.length)} shown</span>
            </Toolbar>

            {rsvps.length === 0 ? (
              <EmptyState
                title={rsvpFilter === 'all' ? 'No RSVPs yet' : 'No RSVPs with this status'}
                action={
                  rsvpFilter === 'all' ? null : (
                    <button type="button" className="btn-outline btn-sm" onClick={() => setRsvpFilter('all')}>
                      Show all
                    </button>
                  )
                }
              />
            ) : (
              <>
                <div className="divide-y divide-surface-200 overflow-hidden rounded-xl border border-surface-200 bg-white md:hidden">
                  {rsvps.map((rsvp) => (
                    <div key={rsvp.id} className="flex items-center gap-3 px-4 py-3">
                      <button
                        type="button"
                        onClick={() => setViewingRsvpDetails(rsvp)}
                        className="min-w-0 flex-1 text-left"
                      >
                        <div className="flex min-w-0 items-center gap-2">
                          <span className="truncate text-[15px] font-semibold text-brand-900">{rsvp.primaryName}</span>
                          <StatusBadge tone={getStatusTone(rsvp.status)}>{humanizeEnum(rsvp.status)}</StatusBadge>
                        </div>
                        <p className="mt-0.5 meta truncate">
                          {humanizeEnum(rsvp.attendance)} &middot; {rsvp.guestCount}{' '}
                          {rsvp.guestCount === 1 ? 'guest' : 'guests'}
                          {rsvp.email ? ` · ${rsvp.email}` : ''}
                        </p>
                      </button>
                      <RsvpActionMenu
                        rsvpId={rsvp.id}
                        guestName={rsvp.primaryName}
                        status={rsvp.status}
                        reviewing={reviewingRsvp === rsvp.id}
                        onReview={handleReviewRsvp}
                        onDetails={() => setViewingRsvpDetails(rsvp)}
                      />
                    </div>
                  ))}
                </div>

                <div className="hidden overflow-hidden rounded-xl border border-surface-200 bg-white md:block">
                  <div className="overflow-x-auto">
                    <table className="data-table" style={{ minWidth: 780 }}>
                      <thead>
                        <tr>
                          <Th>Guest</Th>
                          <Th>Email</Th>
                          <Th>Response</Th>
                          <Th align="right">Guests</Th>
                          <Th>Status</Th>
                          <Th>Submitted</Th>
                          <Th align="right">Actions</Th>
                        </tr>
                      </thead>
                      <tbody>
                        {rsvps.map((rsvp) => (
                          <tr key={rsvp.id} className="table-row">
                            <Td className="font-medium text-brand-900">{rsvp.primaryName}</Td>
                            <Td>{rsvp.email || <span className="text-surface-500">&mdash;</span>}</Td>
                            <Td>{humanizeEnum(rsvp.attendance)}</Td>
                            <Td align="right" className="num">
                              {rsvp.guestCount}
                            </Td>
                            <Td>
                              <StatusBadge tone={getStatusTone(rsvp.status)}>{humanizeEnum(rsvp.status)}</StatusBadge>
                            </Td>
                            <Td>{formatDate(rsvp.submittedAt, 'MMM d, yyyy')}</Td>
                            <Td align="right">
                              <div className="flex justify-end">
                                <RsvpActionMenu
                                  rsvpId={rsvp.id}
                                  guestName={rsvp.primaryName}
                                  status={rsvp.status}
                                  reviewing={reviewingRsvp === rsvp.id}
                                  onReview={handleReviewRsvp}
                                  onDetails={() => setViewingRsvpDetails(rsvp)}
                                />
                              </div>
                            </Td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              </>
            )}
          </div>
        )}

        {/* Check-Ins Tab */}
        {activeTab === 'checkin' && (
          <div className="space-y-4">
            <Toolbar
              end={
                <button onClick={exportCheckInsToCSV} className="btn-outline btn-sm" disabled={checkIns.length === 0}>
                  Export CSV
                </button>
              }
            >
              <span className="meta num">{formatCount(checkIns.length)} checked in</span>
            </Toolbar>

            {checkIns.length === 0 ? (
              <EmptyState title="No check-ins yet" hint="Guests appear here as they arrive." />
            ) : (
              <>
                <div className="divide-y divide-surface-200 overflow-hidden rounded-xl border border-surface-200 bg-white md:hidden">
                  {checkIns.map((checkIn) => (
                    <div key={checkIn.id} className="px-4 py-3">
                      <div className="flex items-start justify-between gap-2">
                        <span className="truncate text-[15px] font-semibold text-brand-900">
                          {checkIn.invitation.guestName}
                        </span>
                        <span className="shrink-0 font-mono text-[12px] text-surface-600">
                          {checkIn.invitation.accessCode}
                        </span>
                      </div>
                      <p className="mt-0.5 meta">
                        {formatDate(checkIn.checkedInAt, 'MMM d, h:mm a')} &middot; {checkIn.invitation.guestCount}{' '}
                        {checkIn.invitation.guestCount === 1 ? 'guest' : 'guests'} &middot; {humanizeEnum(checkIn.method)}
                      </p>
                    </div>
                  ))}
                </div>

                <div className="hidden overflow-hidden rounded-xl border border-surface-200 bg-white md:block">
                  <div className="overflow-x-auto">
                    <table className="data-table" style={{ minWidth: 640 }}>
                      <thead>
                        <tr>
                          <Th>Guest</Th>
                          <Th align="right">Party</Th>
                          <Th>Code</Th>
                          <Th>Time</Th>
                          <Th>Method</Th>
                        </tr>
                      </thead>
                      <tbody>
                        {checkIns.map((checkIn) => (
                          <tr key={checkIn.id} className="table-row">
                            <Td className="font-medium text-brand-900">{checkIn.invitation.guestName}</Td>
                            <Td align="right" className="num">
                              {checkIn.invitation.guestCount}
                            </Td>
                            <Td className="font-mono">{checkIn.invitation.accessCode}</Td>
                            <Td>{formatDate(checkIn.checkedInAt, 'MMM d, h:mm a')}</Td>
                            <Td>{humanizeEnum(checkIn.method)}</Td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              </>
            )}
          </div>
        )}

        <Modal
          open={Boolean(viewingRsvpDetails)}
          onClose={() => setViewingRsvpDetails(null)}
          title={viewingRsvpDetails?.primaryName || 'RSVP'}
          size="lg"
        >
          {viewingRsvpDetails ? (
            <div className="space-y-5">
              <dl className="divide-y divide-surface-200">
                <DetailRow label="Response">
                  <StatusBadge tone={getStatusTone(viewingRsvpDetails.attendance)}>
                    {humanizeEnum(viewingRsvpDetails.attendance)}
                  </StatusBadge>
                </DetailRow>
                <DetailRow label="Status">
                  <StatusBadge tone={getStatusTone(viewingRsvpDetails.status)}>
                    {humanizeEnum(viewingRsvpDetails.status)}
                  </StatusBadge>
                </DetailRow>
                <DetailRow label="Guests">{viewingRsvpDetails.guestCount}</DetailRow>
                {viewingRsvpDetails.secondaryName ? (
                  <DetailRow label="Plus one">{viewingRsvpDetails.secondaryName}</DetailRow>
                ) : null}
                {viewingRsvpDetails.email ? (
                  <DetailRow label="Email">
                    <span className="break-all">{viewingRsvpDetails.email}</span>
                  </DetailRow>
                ) : null}
                {viewingRsvpDetails.phone ? <DetailRow label="Phone">{viewingRsvpDetails.phone}</DetailRow> : null}
                {viewingRsvpDetails.mealPreference ? (
                  <DetailRow label="Meal">{viewingRsvpDetails.mealPreference}</DetailRow>
                ) : null}
                {viewingRsvpDetails.dietaryNotes ? (
                  <DetailRow label="Dietary notes">{viewingRsvpDetails.dietaryNotes}</DetailRow>
                ) : null}
                {viewingRsvpDetails.note ? <DetailRow label="Note">{viewingRsvpDetails.note}</DetailRow> : null}
                <DetailRow label="Submitted">
                  {formatDate(viewingRsvpDetails.submittedAt, 'MMM d, yyyy h:mm a')}
                </DetailRow>
                {viewingRsvpDetails.invitation?.accessCode ? (
                  <DetailRow label="Access code">
                    <span className="font-mono">{viewingRsvpDetails.invitation.accessCode}</span>
                  </DetailRow>
                ) : null}
                {viewingRsvpDetails.invitation ? (
                  <DetailRow label="Checked in">
                    {viewingRsvpDetails.invitation.isCheckedIn ? 'Yes' : 'Not yet'}
                  </DetailRow>
                ) : null}
              </dl>

              {viewingRsvpDetails.invitation?.qrCodeData ? (
                <div className="flex justify-center border-t border-surface-200 pt-4">
                  <img
                    src={viewingRsvpDetails.invitation.qrCodeData}
                    alt={`Check-in QR code for ${viewingRsvpDetails.primaryName}`}
                    className="h-44 w-44 rounded-lg border border-surface-200 bg-white p-2"
                  />
                </div>
              ) : null}
            </div>
          ) : null}
        </Modal>

        {/* Media Tab */}
        {activeTab === 'media' && (
          <div>
            <MediaGallery eventId={eventId} eventSlug={event?.slug} media={media} isAdmin={false} onRefresh={fetchMedia} />
          </div>
        )}

        {/* Tickets Tab */}
        {activeTab === 'tickets' && (
          <div className="space-y-4">
            {tickets.length === 0 ? (
              <EmptyState title="No ticket types" hint="Your admin sets up ticket types for this event." />
            ) : (
              <>
                <div className="divide-y divide-surface-200 overflow-hidden rounded-xl border border-surface-200 bg-white md:hidden">
                  {tickets.map((ticket: any) => (
                    <div key={ticket.id} className="px-4 py-3">
                      <div className="flex items-start justify-between gap-2">
                        <span className="truncate text-[15px] font-semibold text-brand-900">{ticket.name}</span>
                        <StatusBadge tone={ticket.isActive ? 'success' : 'neutral'}>
                          {ticket.isActive ? 'On sale' : 'Off'}
                        </StatusBadge>
                      </div>
                      <p className="mt-0.5 meta num">
                        {ticket.price > 0 ? formatCurrencyAmount(ticket.price, ticket.currency) : 'Free'} &middot;{' '}
                        {formatCount(ticket.quantitySold)} of {formatCount(ticket.quantityTotal)} sold
                      </p>
                    </div>
                  ))}
                </div>

                <div className="hidden overflow-hidden rounded-xl border border-surface-200 bg-white md:block">
                  <div className="overflow-x-auto">
                    <table className="data-table" style={{ minWidth: 620 }}>
                      <thead>
                        <tr>
                          <Th>Ticket</Th>
                          <Th align="right">Price</Th>
                          <Th align="right">Sold</Th>
                          <Th align="right">Available</Th>
                          <Th>Status</Th>
                        </tr>
                      </thead>
                      <tbody>
                        {tickets.map((ticket: any) => (
                          <tr key={ticket.id} className="table-row">
                            <Td className="font-medium text-brand-900">{ticket.name}</Td>
                            <Td align="right" className="num">
                              {ticket.price > 0 ? formatCurrencyAmount(ticket.price, ticket.currency) : 'Free'}
                            </Td>
                            <Td align="right" className="num">
                              {formatCount(ticket.quantitySold)}
                            </Td>
                            <Td align="right" className="num">
                              {formatCount(ticket.quantityTotal)}
                            </Td>
                            <Td>
                              <StatusBadge tone={ticket.isActive ? 'success' : 'neutral'}>
                                {ticket.isActive ? 'On sale' : 'Off'}
                              </StatusBadge>
                            </Td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              </>
            )}
          </div>
        )}

        {/* Itinerary Tab */}
        {activeTab === 'itinerary' && (
          <div className="space-y-4">
            <Toolbar
              end={
                <>
                  <button className="btn-outline btn-sm" disabled={creatingMcSession} onClick={handleCreateMcControlLink}>
                    {creatingMcSession ? 'Generating…' : 'MC link'}
                  </button>
                  <button className="btn-primary btn-sm" onClick={() => setShowAddItinerary(true)}>
                    Add item
                  </button>
                </>
              }
            >
              <span className="meta num">
                {formatCount(itineraryItems.length)} {itineraryItems.length === 1 ? 'item' : 'items'}
              </span>
              {savingItineraryOrder ? <span className="meta">Saving order…</span> : null}
            </Toolbar>

            {mcControlUrl ? (
              <div className="surface p-3">
                <div className="flex items-start justify-between gap-2">
                  <div className="min-w-0">
                    <p className="text-[13px] font-medium text-surface-900">MC control link</p>
                    <p className="field-hint mt-0.5">
                      Anyone with this link can mark items done. Send it to your MC only.
                    </p>
                  </div>
                  <button
                    type="button"
                    className="icon-btn icon-btn-sm shrink-0"
                    aria-label="Hide MC link"
                    title="Hide"
                    onClick={() => setMcControlUrl('')}
                  >
                    <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" aria-hidden="true">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.8} d="M6 18L18 6M6 6l12 12" />
                    </svg>
                  </button>
                </div>

                <p className="mt-2 truncate rounded-lg bg-surface-50 px-2.5 py-2 font-mono text-[12px] text-surface-700" title={mcControlUrl}>
                  {mcControlUrl.replace(/^https?:\/\//, '')}
                </p>

                <div className="actions-split mt-2">
                  <a
                    href={mcControlUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="btn-outline btn-sm"
                  >
                    Open
                  </a>
                  <button
                    className="btn-outline btn-sm"
                    onClick={async () => {
                      if (await copyToClipboard(mcControlUrl)) toast.success('Link copied');
                      else toast.error('Could not copy. Select the link and copy it manually.');
                    }}
                  >
                    Copy
                  </button>
                  <ShareButton
                    url={mcControlUrl}
                    title="MC control link"
                    text="Use this link to run the event itinerary."
                    showLabel
                    />
                </div>
              </div>
            ) : null}

            {loadingItinerary ? (
              <ListSkeleton rows={4} />
            ) : itineraryItems.length === 0 ? (
              <EmptyState
                title="No itinerary items"
                action={
                  <button className="btn-primary btn-sm" onClick={() => setShowAddItinerary(true)}>
                    Add item
                  </button>
                }
              />
            ) : (
              <div className="divide-y divide-surface-200 overflow-hidden rounded-xl border border-surface-200 bg-white">
                {itineraryItems.map((item, index) => (
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
                      if (itineraryDropTargetId !== item.id) setItineraryDropTargetId(item.id);
                    }}
                    onDrop={(e) => {
                      e.preventDefault();
                      handleItineraryDrop(item.id);
                    }}
                    className={cn('px-4 py-3', itineraryDropTargetId === item.id && 'bg-brand-50')}
                  >
                    {editingItineraryId === item.id ? (
                      <div className="space-y-3">
                        <div className="grid gap-3 md:grid-cols-2">
                          <div>
                            <label className="label" htmlFor={`edit-title-${item.id}`}>
                              Title
                            </label>
                            <input
                              id={`edit-title-${item.id}`}
                              className="input"
                              value={editItineraryItem.title}
                              onChange={(e) => setEditItineraryItem((prev) => ({ ...prev, title: e.target.value }))}
                            />
                          </div>
                          <div>
                            <label className="label" htmlFor={`edit-location-${item.id}`}>
                              Location <span className="font-normal text-surface-600">(optional)</span>
                            </label>
                            <input
                              id={`edit-location-${item.id}`}
                              className="input"
                              value={editItineraryItem.location}
                              onChange={(e) => setEditItineraryItem((prev) => ({ ...prev, location: e.target.value }))}
                            />
                          </div>
                        </div>

                        <Switch
                          label="Scheduled time"
                          description="Leave off for activities without a fixed time."
                          checked={editingItineraryDateTimeInputs}
                          onChange={(next) => {
                            setEditingItineraryDateTimeInputs(next);
                            if (!next) setEditItineraryItem((prev) => ({ ...prev, startsAt: '', endsAt: '' }));
                          }}
                        />

                        {editingItineraryDateTimeInputs ? (
                          <div className="grid gap-3 md:grid-cols-2">
                            <div>
                              <label className="label" htmlFor={`edit-start-${item.id}`}>
                                Starts
                              </label>
                              <input
                                id={`edit-start-${item.id}`}
                                type="datetime-local"
                                className="input"
                                value={editItineraryItem.startsAt}
                                onChange={(e) => setEditItineraryItem((prev) => ({ ...prev, startsAt: e.target.value }))}
                              />
                            </div>
                            <div>
                              <label className="label" htmlFor={`edit-end-${item.id}`}>
                                Ends
                              </label>
                              <input
                                id={`edit-end-${item.id}`}
                                type="datetime-local"
                                className="input"
                                value={editItineraryItem.endsAt}
                                onChange={(e) => setEditItineraryItem((prev) => ({ ...prev, endsAt: e.target.value }))}
                              />
                            </div>
                          </div>
                        ) : null}

                        <div>
                          <label className="label" htmlFor={`edit-desc-${item.id}`}>
                            Description <span className="font-normal text-surface-600">(optional)</span>
                          </label>
                          <textarea
                            id={`edit-desc-${item.id}`}
                            className="input"
                            rows={3}
                            value={editItineraryItem.description}
                            onChange={(e) => setEditItineraryItem((prev) => ({ ...prev, description: e.target.value }))}
                          />
                        </div>

                        <div className="flex justify-end gap-2">
                          <button className="btn-outline btn-sm" onClick={handleCancelEditItineraryItem}>
                            Cancel
                          </button>
                          <SubmitButton
                            loading={savingEditedItinerary}
                            className="btn-primary btn-sm"
                            onClick={() => handleUpdateItineraryItem(item.id)}
                          >
                            Save
                          </SubmitButton>
                        </div>
                      </div>
                    ) : (
                      <div className="flex items-start gap-3">
                        <div className="flex shrink-0 flex-col">
                          <button
                            type="button"
                            className="icon-btn icon-btn-sm"
                            aria-label={`Move ${item.title} up`}
                            disabled={index === 0 || savingItineraryOrder}
                            onClick={() => void moveItineraryItem(index, -1)}
                          >
                            <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" aria-hidden="true">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="m5 15 7-7 7 7" />
                            </svg>
                          </button>
                          <button
                            type="button"
                            className="icon-btn icon-btn-sm"
                            aria-label={`Move ${item.title} down`}
                            disabled={index === itineraryItems.length - 1 || savingItineraryOrder}
                            onClick={() => void moveItineraryItem(index, 1)}
                          >
                            <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" aria-hidden="true">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="m19 9-7 7-7-7" />
                            </svg>
                          </button>
                        </div>

                        <div className="min-w-0 flex-1">
                          <div className="flex min-w-0 items-center gap-2">
                            <span
                              className={cn('status-dot', item.isCompleted ? 'bg-emerald-500' : 'bg-surface-400')}
                              aria-hidden="true"
                            />
                            <p
                              className={cn(
                                'truncate text-[15px] font-semibold',
                                item.isCompleted ? 'text-surface-600 line-through' : 'text-brand-900'
                              )}
                            >
                              {item.title}
                            </p>
                            <StatusBadge tone={item.isCompleted ? 'success' : 'neutral'}>
                              {item.isCompleted ? 'Done' : 'Pending'}
                            </StatusBadge>
                          </div>
                          {item.startsAt || item.location ? (
                            <p className="mt-0.5 meta truncate">
                              {item.startsAt ? formatDate(item.startsAt, 'MMM d, p') : ''}
                              {item.startsAt && item.location ? ' · ' : ''}
                              {item.location || ''}
                            </p>
                          ) : null}
                          {item.description ? (
                            <p className="mt-1 text-[13px] leading-5 text-surface-700">{item.description}</p>
                          ) : null}
                        </div>

                        <Menu label={`Actions for ${item.title}`} sheetTitle={item.title}>
                          <MenuItem onClick={() => handleStartEditItineraryItem(item)}>Edit</MenuItem>
                          <MenuItem
                            danger
                            disabled={deletingItineraryId === item.id}
                            onClick={() => setDeletingItinerary(item)}
                          >
                            Delete
                          </MenuItem>
                        </Menu>
                      </div>
                    )}
                  </div>
                ))}
              </div>
            )}

            <Modal
              open={showAddItinerary}
              onClose={() => setShowAddItinerary(false)}
              title="Add itinerary item"
              size="md"
              footer={
                <>
                  <button className="btn-outline" onClick={() => setShowAddItinerary(false)} disabled={savingItinerary}>
                    Cancel
                  </button>
                  <SubmitButton loading={savingItinerary} onClick={handleAddItineraryItem}>
                    Add item
                  </SubmitButton>
                </>
              }
            >
              <div className="space-y-4">
                <div>
                  <label className="label" htmlFor="itinerary-title">
                    Title
                  </label>
                  <input
                    id="itinerary-title"
                    data-autofocus
                    className="input"
                    value={newItineraryItem.title}
                    onChange={(e) => setNewItineraryItem((prev) => ({ ...prev, title: e.target.value }))}
                    placeholder="First dance"
                  />
                </div>

                <div>
                  <label className="label" htmlFor="itinerary-location">
                    Location <span className="font-normal text-surface-600">(optional)</span>
                  </label>
                  <input
                    id="itinerary-location"
                    className="input"
                    value={newItineraryItem.location}
                    onChange={(e) => setNewItineraryItem((prev) => ({ ...prev, location: e.target.value }))}
                  />
                </div>

                <Switch
                  label="Scheduled time"
                  description="Leave off for activities without a fixed time."
                  checked={showItineraryDateTimeInputs}
                  onChange={(next) => {
                    setShowItineraryDateTimeInputs(next);
                    if (!next) setNewItineraryItem((prev) => ({ ...prev, startsAt: '', endsAt: '' }));
                  }}
                />

                {showItineraryDateTimeInputs ? (
                  <div className="grid gap-4 sm:grid-cols-2">
                    <div>
                      <label className="label" htmlFor="itinerary-start">
                        Starts
                      </label>
                      <input
                        id="itinerary-start"
                        type="datetime-local"
                        className="input"
                        value={newItineraryItem.startsAt}
                        onChange={(e) => setNewItineraryItem((prev) => ({ ...prev, startsAt: e.target.value }))}
                      />
                    </div>
                    <div>
                      <label className="label" htmlFor="itinerary-end">
                        Ends
                      </label>
                      <input
                        id="itinerary-end"
                        type="datetime-local"
                        className="input"
                        value={newItineraryItem.endsAt}
                        onChange={(e) => setNewItineraryItem((prev) => ({ ...prev, endsAt: e.target.value }))}
                      />
                    </div>
                  </div>
                ) : null}

                <div>
                  <label className="label" htmlFor="itinerary-desc">
                    Description <span className="font-normal text-surface-600">(optional)</span>
                  </label>
                  <textarea
                    id="itinerary-desc"
                    className="input"
                    rows={3}
                    value={newItineraryItem.description}
                    onChange={(e) => setNewItineraryItem((prev) => ({ ...prev, description: e.target.value }))}
                  />
                </div>
              </div>
            </Modal>

            <ConfirmDialog
              open={Boolean(deletingItinerary)}
              onClose={() => setDeletingItinerary(null)}
              onConfirm={() => {
                if (deletingItinerary) handleDeleteItineraryItem(deletingItinerary.id);
                setDeletingItinerary(null);
              }}
              title={`Delete "${deletingItinerary?.title || ''}"?`}
              body="This removes the item from the public itinerary and the MC view."
              confirmLabel="Delete item"
              busy={Boolean(deletingItinerary && deletingItineraryId === deletingItinerary.id)}
            />
          </div>
        )}

        {/* WhatsApp Invites Tab */}
        {activeTab === 'invites' && (
          <div className="space-y-4">
            <StatRow
              items={[
                { label: 'Invites', value: formatCount(inviteStats.total) },
                { label: 'Sent', value: formatCount(inviteStats.sent) },
                { label: 'Opened', value: formatCount(inviteStats.opened) },
                { label: 'Responded', value: formatCount(inviteStats.responded), tone: 'positive' },
              ]}
            />

            <Panel
              title="Send invites"
              action={
                <SubmitButton
                  loading={sendingInvites}
                  className="btn-primary btn-sm"
                  onClick={handleSendInvites}
                  disabled={!inviteLines.trim()}
                >
                  Send
                </SubmitButton>
              }
            >
              <div className="space-y-4">
                <div>
                  <p className="label">Send via</p>
                  <div className="grid grid-cols-1 gap-2 sm:grid-cols-3">
                    {INVITE_CHANNEL_OPTIONS.map((option) => {
                      const checked = inviteChannels.includes(option.value);
                      return (
                        <label
                          key={option.value}
                          className={cn(
                            'flex min-h-[44px] cursor-pointer items-center gap-2.5 rounded-lg border px-3 transition-colors',
                            checked ? 'border-brand-900 bg-brand-50' : 'border-surface-300 hover:bg-surface-50'
                          )}
                        >
                          <input
                            type="checkbox"
                            className="shrink-0"
                            checked={checked}
                            onChange={(event) => {
                              // Keep at least one channel selected.
                              setInviteChannels((current) => {
                                if (event.target.checked) return [...current, option.value];
                                const next = current.filter((entry) => entry !== option.value);
                                return next.length ? next : current;
                              });
                            }}
                          />
                          <span className="text-sm font-medium text-brand-900">{option.label}</span>
                        </label>
                      );
                    })}
                  </div>
                  <p className="field-hint">
                    SMS and WhatsApp use the providers set up by your EventPeepo admin.
                  </p>
                </div>

                <div>
                  <label className="label" htmlFor="invite-lines">
                    Recipients
                  </label>
                  <textarea
                    id="invite-lines"
                    className="input min-h-[140px] font-mono text-[13px]"
                    placeholder={
                      inviteNeedsPhone && inviteNeedsEmail
                        ? 'Ama Serwaa,+233xxxxxxxxx,ama@email.com'
                        : inviteNeedsPhone
                        ? '+233xxxxxxxxx\nAma Serwaa,+233xxxxxxxxx'
                        : 'ama@email.com\nAma Serwaa,ama@email.com'
                    }
                    value={inviteLines}
                    onChange={(e) => setInviteLines(e.target.value)}
                    aria-describedby="invite-format"
                  />
                  <p id="invite-format" className="field-hint">
                    One per line:{' '}
                    {inviteNeedsPhone && inviteNeedsEmail
                      ? 'name,phone,email'
                      : inviteNeedsPhone
                      ? 'phone, or name,phone'
                      : 'email, or name,email'}
                    .
                  </p>
                </div>

                <div className="actions-row">
                  <button type="button" className="btn-outline btn-sm" onClick={syncContacts}>
                    Sync contacts
                  </button>
                  <button
                    type="button"
                    className="btn-outline btn-sm"
                    disabled={importingInvites}
                    onClick={() => inviteFileInputRef.current?.click()}
                  >
                    {importingInvites ? 'Importing…' : 'Import file'}
                  </button>
                  <button type="button" className="btn-ghost btn-sm" onClick={downloadInviteTemplate}>
                    CSV template
                  </button>
                  <input
                    ref={inviteFileInputRef}
                    type="file"
                    accept=".csv,.xlsx,.xls,text/csv"
                    className="hidden"
                    onChange={handleImportInviteFile}
                  />
                </div>

                <div>
                  <label className="label" htmlFor="invite-expiry">
                    Link expires after
                  </label>
                  <select
                    id="invite-expiry"
                    className="input sm:max-w-[200px]"
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
              </div>
            </Panel>

            {loadingInvites ? (
              <ListSkeleton rows={4} />
            ) : invites.length === 0 ? (
              <EmptyState title="No invites sent yet" />
            ) : (
              <>
                <div className="divide-y divide-surface-200 overflow-hidden rounded-xl border border-surface-200 bg-white md:hidden">
                  {invites.map((invite) => (
                    <div key={invite.id} className="flex items-center gap-3 px-4 py-3">
                      <div className="min-w-0 flex-1">
                        <div className="flex min-w-0 items-center gap-2">
                          <span className="truncate text-[15px] font-semibold text-brand-900">
                            {invite.inviteeName || invite.inviteePhone || invite.inviteeEmail || 'Guest'}
                          </span>
                          <StatusBadge tone={getInviteTone(invite.status)}>{humanizeEnum(invite.status)}</StatusBadge>
                        </div>
                        <p className="mt-0.5 meta truncate">
                          {invite.inviteePhone || invite.inviteeEmail || '—'} &middot;{' '}
                          {humanizeEnum(invite.channel || 'whatsapp')}
                          {invite.sentAt || invite.createdAt
                            ? ` · ${formatDate(invite.sentAt || invite.createdAt || '', 'MMM d')}`
                            : ''}
                        </p>
                      </div>
                      <button
                        type="button"
                        className="btn-outline btn-sm shrink-0"
                        onClick={() => handleResendInvite(invite.id)}
                        disabled={invite.status === 'RESPONDED'}
                      >
                        Resend
                      </button>
                    </div>
                  ))}
                </div>

                <div className="hidden overflow-hidden rounded-xl border border-surface-200 bg-white md:block">
                  <div className="overflow-x-auto">
                    <table className="data-table" style={{ minWidth: 880 }}>
                      <thead>
                        <tr>
                          <Th>Invitee</Th>
                          <Th>Contact</Th>
                          <Th>Channel</Th>
                          <Th>Status</Th>
                          <Th>Response</Th>
                          <Th>Sent</Th>
                          <Th>Expires</Th>
                          <Th align="right">Action</Th>
                        </tr>
                      </thead>
                      <tbody>
                        {invites.map((invite) => (
                          <tr key={invite.id} className="table-row">
                            <Td className="font-medium text-brand-900">{invite.inviteeName || '—'}</Td>
                            <Td>{invite.inviteePhone || invite.inviteeEmail || '—'}</Td>
                            <Td>{humanizeEnum(invite.channel || 'whatsapp')}</Td>
                            <Td>
                              <StatusBadge tone={getInviteTone(invite.status)}>{humanizeEnum(invite.status)}</StatusBadge>
                            </Td>
                            <Td>{invite.initialResponse ? humanizeEnum(invite.initialResponse) : '—'}</Td>
                            <Td>
                              {invite.sentAt || invite.createdAt
                                ? formatDate(invite.sentAt || invite.createdAt || '', 'MMM d, yyyy')
                                : '—'}
                            </Td>
                            <Td>{invite.expiresAt ? formatDate(invite.expiresAt, 'MMM d, yyyy') : '—'}</Td>
                            <Td align="right">
                              <button
                                type="button"
                                className="btn-outline btn-sm"
                                onClick={() => handleResendInvite(invite.id)}
                                disabled={invite.status === 'RESPONDED'}
                              >
                                Resend
                              </button>
                            </Td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              </>
            )}
          </div>
        )}

        {/* Domains Tab */}
        {activeTab === 'domains' && (
          <div className="space-y-4">
            <Panel title="Connect a domain">
              <div className="flex flex-col gap-2 sm:flex-row">
                <input
                  type="text"
                  className="input flex-1"
                  placeholder="wedding.example.com"
                  aria-label="Domain to connect"
                  value={domainHost}
                  onChange={(e) => setDomainHost(e.target.value)}
                />
                <SubmitButton
                  loading={savingDomain}
                  className="btn-primary shrink-0"
                  onClick={handleAddDomain}
                  disabled={!domainHost.trim()}
                >
                  Connect
                </SubmitButton>
              </div>
              <p className="field-hint">
                You will add three DNS records. HTTPS is set up automatically once they verify.
              </p>
            </Panel>

            {domains.length === 0 ? (
              <EmptyState title="No domains connected" hint="Guests reach this event at its EventPeepo address." />
            ) : (
              <div className="divide-y divide-surface-200 overflow-hidden rounded-xl border border-surface-200 bg-white">
                {domains.map((domain) => (
                  <div key={domain.id} className="px-4 py-3">
                    <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
                      <div className="flex min-w-0 flex-wrap items-center gap-2">
                        <span className="truncate text-[15px] font-semibold text-brand-900">{domain.host}</span>
                        {domain.isPrimary ? <StatusBadge tone="brand">Primary</StatusBadge> : null}
                        <StatusBadge
                          tone={
                            domain.status === 'ACTIVE' ? 'success' : domain.status === 'FAILED' ? 'danger' : 'warning'
                          }
                        >
                          {humanizeEnum(domain.status)}
                        </StatusBadge>
                      </div>
                      <span className="hidden flex-1 sm:block" />
                      <div className="flex items-center gap-2">
                        {/* ACTIVE means DNS and HTTPS are both done, so there is nothing
                            left to verify. VERIFIED still needs its HTTPS check to land. */}
                        <button
                          type="button"
                          className="btn-outline btn-sm flex-1 sm:flex-none"
                          disabled={domain.status === 'ACTIVE'}
                          title={
                            domain.status === 'ACTIVE'
                              ? 'This domain is live'
                              : 'Check the DNS records for this domain'
                          }
                          onClick={() => handleVerifyDomain(domain.id)}
                        >
                          {domain.status === 'ACTIVE'
                            ? 'Verified'
                            : domain.status === 'VERIFIED'
                            ? 'Recheck'
                            : 'Verify'}
                        </button>
                        <Menu label={`Actions for ${domain.host}`} sheetTitle={domain.host}>
                          <MenuItem
                            disabled={domain.isPrimary || domain.status !== 'ACTIVE'}
                            onClick={() => handleSetPrimaryDomain(domain.id)}
                          >
                            Make primary
                          </MenuItem>
                          <MenuItem danger onClick={() => setRemovingDomain(domain)}>
                            Remove domain
                          </MenuItem>
                        </Menu>
                      </div>
                    </div>

                    {domain.verificationNotes ? (
                      <p
                        className={cn(
                          'mt-1.5 text-[13px]',
                          domain.status === 'VERIFIED' ? 'text-amber-800' : 'text-red-600'
                        )}
                      >
                        {domain.verificationNotes}
                      </p>
                    ) : null}

                    <details className="mt-2">
                      <summary className="cursor-pointer text-[13px] font-medium text-surface-700 hover:text-brand-900">
                        DNS records
                      </summary>
                      <div className="mt-2 space-y-1 text-[12px] text-surface-700">
                        <p>
                          TXT <span className="font-mono">_eventpeepo</span> &rarr;{' '}
                          <span className="font-mono">{domain.verificationToken}</span>
                        </p>
                        <p>
                          CNAME <span className="font-mono">www</span> &rarr;{' '}
                          <span className="font-mono">
                            {process.env.NEXT_PUBLIC_DOMAIN_CNAME_TARGET || 'cname.eventpeepo.com'}
                          </span>
                        </p>
                        <p>
                          A <span className="font-mono">@</span> &rarr;{' '}
                          <span className="font-mono">{process.env.NEXT_PUBLIC_DOMAIN_APEX_IP || '75.2.60.5'}</span>
                        </p>
                      </div>
                    </details>
                  </div>
                ))}
              </div>
            )}

            <ConfirmDialog
              open={Boolean(removingDomain)}
              onClose={() => setRemovingDomain(null)}
              onConfirm={() => {
                if (removingDomain) void handleDeleteDomain(removingDomain.id);
                setRemovingDomain(null);
              }}
              title={`Remove ${removingDomain?.host || 'domain'}?`}
              body="Guests using this address will stop reaching the event until it is connected again."
              confirmLabel="Remove domain"
            />
          </div>
        )}

        {/* Voting Tab */}
        {activeTab === 'voting' && (
          <div className="space-y-4">
            <Toolbar
              end={
                <>
                  <Link href={`/e/${event.slug}/vote`} target="_blank" className="btn-outline btn-sm">
                    Public vote page
                  </Link>
                  <Link href={`/owner/events/${event.id}/voting`} className="btn-primary btn-sm">
                    Open voting console
                  </Link>
                </>
              }
            >
              <span className="meta">Categories, nominees and results live in the voting console.</span>
            </Toolbar>

            <Panel title="Voting links" flush>
              <div className="divide-y divide-surface-200">
                <PublicPageRow label="Vote" path="/vote" url={publicUrl('/vote')} onCopy={() => handleCopyUrl(publicUrl('/vote'))} />
                <PublicPageRow label="Nominations" path="/nominate" url={publicUrl('/nominate')} onCopy={() => handleCopyUrl(publicUrl('/nominate'))} />
                <PublicPageRow label="Nominees" path="/nominees" url={publicUrl('/nominees')} onCopy={() => handleCopyUrl(publicUrl('/nominees'))} />
                <PublicPageRow label="Leaderboard" path="/leaderboard" url={publicUrl('/leaderboard')} onCopy={() => handleCopyUrl(publicUrl('/leaderboard'))} />
                <PublicPageRow label="Embed script" path="/embed/vote.js" onCopy={handleCopyLink} />
              </div>
            </Panel>
          </div>
        )}

        {activeTab === 'gifts' && (
          <div className="space-y-4">
            {loadingGifts ? (
              <ListSkeleton rows={5} />
            ) : giftOrders.length === 0 ? (
              <EmptyState title="No gift orders yet" hint="Gifts guests send appear here." />
            ) : (
              <>
                <div className="divide-y divide-surface-200 overflow-hidden rounded-xl border border-surface-200 bg-white md:hidden">
                  {giftOrders.map((order) => (
                    <div key={order.id} className="px-4 py-3">
                      <div className="flex items-start justify-between gap-3">
                        <div className="min-w-0">
                          <p className="truncate text-[15px] font-semibold text-brand-900">{order.guestName}</p>
                          <p className="mt-0.5 meta truncate">
                            {order.guestEmail || order.guestPhone || 'No contact'} &middot;{' '}
                            {formatDate(order.createdAt, 'MMM d, yyyy')}
                          </p>
                        </div>
                        <div className="shrink-0 text-right">
                          <p className="num text-[15px] font-semibold text-brand-900">
                            {formatCurrencyAmount(order.ownerNetAmount, order.currency)}
                          </p>
                          <StatusBadge tone={getStatusTone(order.status)} className="mt-1">
                            {humanizeEnum(order.status)}
                          </StatusBadge>
                        </div>
                      </div>
                      <p className="mt-1 meta num">
                        Gift total {formatCurrencyAmount(order.totalAmount, order.currency)}
                      </p>
                    </div>
                  ))}
                </div>

                <div className="hidden overflow-hidden rounded-xl border border-surface-200 bg-white md:block">
                  <div className="overflow-x-auto">
                    <table className="data-table" style={{ minWidth: 760 }}>
                      <thead>
                        <tr>
                          <Th>Guest</Th>
                          <Th>Contact</Th>
                          <Th align="right">Gift total</Th>
                          <Th align="right">Your net</Th>
                          <Th>Status</Th>
                          <Th>Date</Th>
                        </tr>
                      </thead>
                      <tbody>
                        {giftOrders.map((order) => (
                          <tr key={order.id} className="table-row">
                            <Td className="font-medium text-brand-900">{order.guestName}</Td>
                            <Td>{order.guestEmail || order.guestPhone || <span className="text-surface-500">&mdash;</span>}</Td>
                            <Td align="right" className="num">
                              {formatCurrencyAmount(order.totalAmount, order.currency)}
                            </Td>
                            <Td align="right" className="num font-semibold text-brand-900">
                              {formatCurrencyAmount(order.ownerNetAmount, order.currency)}
                            </Td>
                            <Td>
                              <StatusBadge tone={getStatusTone(order.status)}>{humanizeEnum(order.status)}</StatusBadge>
                            </Td>
                            <Td>{formatDate(order.createdAt, 'MMM d, yyyy')}</Td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              </>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

