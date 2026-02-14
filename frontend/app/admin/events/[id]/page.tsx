'use client';

import { useEffect, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import Link from 'next/link';
import { eventsApi, rsvpApi, templatesApi, mediaApi, checkInApi, ticketingApi, ownersApi, adminApi, giftingApi, itineraryApi, paymentGatewaysApi, API_BASE_URL } from '@/lib/api';
import MediaGallery from '@/components/media/MediaGallery';
import TicketsTab from '@/components/tickets/TicketsTab';
import PaymentGatewaySelector from '@/components/tickets/PaymentGatewaySelector';
import { formatDate, getPhaseLabel, getStatusColor, cn, copyToClipboard } from '@/lib/utils';
import { CURRENCY_OPTIONS, getCurrencyOption, uniqueCurrencyCodes } from '@/lib/paymentGatewayConfig';
import toast from 'react-hot-toast';

interface Event {
  id: string;
  slug: string;
  name: string;
  description: string | null;
  socialTitle: string | null;
  socialDescription: string | null;
  coverImagePath: string | null;
  coverImageAlt: string | null;
  coverImageUrl?: string | null;
  date: string;
  endDate: string | null;
  venue: string | null;
  timezone: string;
  currentPhase: string;
  phaseOverride: boolean;
  invitationOnly: boolean;
  strictInviteOnly: boolean;
  itineraryEnabled: boolean;
  giftingEnabled: boolean;
  ownerAccessToken: string;
  invitationEnabled: boolean;
  rsvpEnabled: boolean;
  guestbookEnabled: boolean;
  checkInEnabled: boolean;
  reelEnabled: boolean;
  rsvpMode: 'free' | 'paid';
  ticketingEnabled: boolean;
  feeOverridesEnabled?: boolean;
  platformFeePercent: number;
  platformFeeMode: 'PERCENTAGE' | 'FIXED';
  platformFeeFixed: number | null;
  processingFeePercent: number;
  processingFeeFixed: number;
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
  liveLandingTemplateId: string | null;
  eventEndedTemplateId: string | null;
  itineraryPageTemplateId: string | null;
  giftingPageTemplateId: string | null;
  // Event branding
  primaryColor?: string;
  secondaryColor?: string;
  accentColor?: string;
  // Event Owner info
  ownerId?: string | null;
  ownerName?: string;
  ownerEmail?: string;
  ownerPhone?: string;
  organizationName?: string;
  domains?: Domain[];
  _count: { rsvps: number; invitations: number; checkIns: number; mediaAssets: number; giftOrders?: number };
}

interface Domain {
  id: string;
  host: string;
  isPrimary: boolean;
  status: 'PENDING_VERIFICATION' | 'VERIFIED' | 'ACTIVE' | 'FAILED';
  verificationToken: string;
  verificationNotes?: string | null;
}

type FeeDefaults = {
  platformFeeMode: 'PERCENTAGE' | 'FIXED';
  platformFeePercent: number;
  platformFeeFixed: number;
  processingFeePercent: number;
  processingFeeFixed: number;
};

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
  customFields: string | null;
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

interface Template { id: string; name: string; type: string; isDefault: boolean; }
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
interface GiftPackage {
  id: string;
  name: string;
  description: string | null;
  price: number;
  currency: string;
  thumbnailPath: string | null;
  isActive: boolean;
  assigned?: boolean;
}

interface GiftOrder {
  id: string;
  guestName: string;
  guestEmail: string | null;
  guestPhone: string | null;
  currency: string;
  totalAmount: number;
  cashGiftAmount: number | null;
  packageAmount: number;
  ownerNetAmount: number;
  adminRetainedAmount: number;
  status: string;
  createdAt: string;
}

type Tab = 'overview' | 'rsvps' | 'checkin' | 'media' | 'templates' | 'tickets' | 'itinerary' | 'formFields' | 'sales' | 'gifts' | 'settings';

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
  const resolveGiftThumbnailUrl = (path: string | null | undefined) => {
    if (!path) return null;
    if (path.startsWith('http://') || path.startsWith('https://') || path.startsWith('data:')) return path;
    return `${API_BASE_URL}${path.startsWith('/') ? '' : '/'}${path}`;
  };

  const [event, setEvent] = useState<Event | null>(null);
  const [rsvps, setRsvps] = useState<RSVP[]>([]);
  const [media, setMedia] = useState<MediaAsset[]>([]);
  const [checkIns, setCheckIns] = useState<CheckIn[]>([]);
  const [templates, setTemplates] = useState<Template[]>([]);
  const [owners, setOwners] = useState<any[]>([]);
  const [loadingOwners, setLoadingOwners] = useState(false);
  const [showNewOwnerForm, setShowNewOwnerForm] = useState(false);
  const [newOwner, setNewOwner] = useState({ name: '', email: '', phone: '', company: '' });
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<Tab>('overview');
  const [rsvpFilter, setRsvpFilter] = useState<string>('all');
  const [savingTemplates, setSavingTemplates] = useState(false);
  const [editingSettings, setEditingSettings] = useState(false);
  const [savingSettings, setSavingSettings] = useState(false);
  const [tickets, setTickets] = useState<any[]>([]);
  const [loadingTickets, setLoadingTickets] = useState(false);
  const [sales, setSales] = useState<any[]>([]);
  const [salesStats, setSalesStats] = useState<any>(null);
  const [loadingSales, setLoadingSales] = useState(false);
  const [giftPackages, setGiftPackages] = useState<GiftPackage[]>([]);
  const [giftOrders, setGiftOrders] = useState<GiftOrder[]>([]);
  const [loadingGifts, setLoadingGifts] = useState(false);
  const [savingGiftAssignments, setSavingGiftAssignments] = useState(false);
  const [savingGiftPackage, setSavingGiftPackage] = useState(false);
  const [newGiftPackage, setNewGiftPackage] = useState({
    name: '',
    description: '',
    price: '',
    currency: 'GHS',
  });
  const [eventGatewayCurrencies, setEventGatewayCurrencies] = useState<string[]>([]);
  const [newGiftPackagePhoto, setNewGiftPackagePhoto] = useState<File | null>(null);
  const [newGiftPackagePhotoPreview, setNewGiftPackagePhotoPreview] = useState<string | null>(null);
  const [itineraryItems, setItineraryItems] = useState<ItineraryItem[]>([]);
  const [loadingItinerary, setLoadingItinerary] = useState(false);
  const [savingItinerary, setSavingItinerary] = useState(false);
  const [savingItineraryOrder, setSavingItineraryOrder] = useState(false);
  const [draggingItineraryId, setDraggingItineraryId] = useState<string | null>(null);
  const [itineraryDropTargetId, setItineraryDropTargetId] = useState<string | null>(null);
  const [showItineraryDateTimeInputs, setShowItineraryDateTimeInputs] = useState(false);
  const [creatingMcSession, setCreatingMcSession] = useState(false);
  const [mcControlUrl, setMcControlUrl] = useState('');
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
  const [loadingRsvps, setLoadingRsvps] = useState(false);
  const [reviewingRsvp, setReviewingRsvp] = useState<string | null>(null);
  const [viewingRsvpDetails, setViewingRsvpDetails] = useState<RSVP | null>(null);
  const [formFields, setFormFields] = useState<any[]>([]);
  const [loadingFormFields, setLoadingFormFields] = useState(false);
  const [showFormFieldModal, setShowFormFieldModal] = useState(false);
  const [editingFormField, setEditingFormField] = useState<any | null>(null);
  const [formFieldData, setFormFieldData] = useState({
    fieldName: '',
    label: '',
    type: 'text' as 'text' | 'email' | 'phone' | 'number' | 'select' | 'checkbox' | 'radio' | 'textarea' | 'date',
    placeholder: '',
    helpText: '',
    options: [] as string[],
    required: false,
    minLength: undefined as number | undefined,
    maxLength: undefined as number | undefined,
    pattern: '',
    sortOrder: 0,
    isActive: true,
    showOnConfirmation: true,
  });

  const [eventSettings, setEventSettings] = useState({
    name: '', description: '', date: '', time: '', endDate: '', endTime: '',
    socialTitle: '', socialDescription: '', coverImageAlt: '',
    venue: '', timezone: '', invitationOnly: false, reelEnabled: false,
    strictInviteOnly: false, itineraryEnabled: false, giftingEnabled: false,
    // Feature toggles
    invitationEnabled: true, rsvpEnabled: true, guestbookEnabled: true, checkInEnabled: true,
    // RSVP Mode & Ticketing
    rsvpMode: 'free' as 'free' | 'paid', ticketingEnabled: false,
    feeOverridesEnabled: true,
    platformFeeMode: 'PERCENTAGE' as 'PERCENTAGE' | 'FIXED',
    platformFeePercent: 5,
    platformFeeFixed: 0,
    processingFeePercent: 2.9,
    processingFeeFixed: 0.30,
    // Limits
    maxRecordingDuration: 120, minRecordingDuration: 30, maxPhotosPerGuest: 5,
    maxPhotosPerBoothSession: 10, boothShutterCountdown: 3,
    // Notifications
    notifyOnRsvp: true, notifyOnCheckIn: false, notifyOnGuestbook: false,
    emailNotifications: true, smsNotifications: false, whatsappNotifications: false,
    // Colors
    primaryColor: '#FFD700', secondaryColor: '#1a1a2e', accentColor: '#ffffff',
    // Owner
    ownerId: '', ownerName: '', ownerEmail: '', ownerPhone: '', organizationName: '',
  });
  const [defaultFeeSettings, setDefaultFeeSettings] = useState<FeeDefaults>({
    platformFeeMode: 'PERCENTAGE',
    platformFeePercent: 5,
    platformFeeFixed: 0,
    processingFeePercent: 2.9,
    processingFeeFixed: 0.3,
  });
  const [coverFile, setCoverFile] = useState<File | null>(null);
  const [uploadingCover, setUploadingCover] = useState(false);
  const [domains, setDomains] = useState<Domain[]>([]);
  const [domainHost, setDomainHost] = useState('');
  const [savingDomain, setSavingDomain] = useState(false);

  const [selectedTemplates, setSelectedTemplates] = useState({
    invitationTemplateId: '', rsvpTemplateId: '', guestbookTemplateId: '',
    guestbookVideoTemplateId: '', guestbookAudioTemplateId: '', guestbookPhotoTemplateId: '',
    boothTemplateId: '', boothVideoTemplateId: '', boothAudioTemplateId: '', boothPhotoTemplateId: '',
    thankYouTemplateId: '',
    liveLandingTemplateId: '',
    eventEndedTemplateId: '',
    itineraryPageTemplateId: '',
    giftingPageTemplateId: '',
  });

  const availableEventCurrencies = eventGatewayCurrencies.length > 0
    ? eventGatewayCurrencies
    : CURRENCY_OPTIONS.map((currency) => currency.code);
  const primaryEventCurrency = availableEventCurrencies[0] || 'USD';

  const toDateTimeLocalInput = (value: string | null) => {
    if (!value) return '';
    const date = new Date(value);
    if (Number.isNaN(date.getTime())) return '';
    const pad = (n: number) => String(n).padStart(2, '0');
    return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}T${pad(date.getHours())}:${pad(date.getMinutes())}`;
  };

  useEffect(() => {
    if (!newGiftPackagePhoto) {
      setNewGiftPackagePhotoPreview(null);
      return;
    }
    const objectUrl = URL.createObjectURL(newGiftPackagePhoto);
    setNewGiftPackagePhotoPreview(objectUrl);
    return () => URL.revokeObjectURL(objectUrl);
  }, [newGiftPackagePhoto]);

  useEffect(() => {
    fetchEvent();
    fetchTemplates();
    fetchOwners();
    fetchEventGatewayCurrencies();
    fetchDefaultFeeSettings();
  }, [eventId]);
  
  useEffect(() => {
    if (activeTab === 'rsvps') fetchRsvps();
    if (activeTab === 'media') fetchMedia();
    if (activeTab === 'checkin') fetchCheckIns();
    if (activeTab === 'sales') fetchSales();
    if (activeTab === 'gifts') fetchGifts();
    if (activeTab === 'itinerary') fetchItinerary();
    if (activeTab === 'formFields') fetchFormFields();
    if (activeTab === 'settings') fetchDomains();
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
        boothVideoTemplateId: (event as any).boothVideoTemplateId || '',
        boothAudioTemplateId: (event as any).boothAudioTemplateId || '',
        boothPhotoTemplateId: (event as any).boothPhotoTemplateId || '',
        thankYouTemplateId: event.thankYouTemplateId || '',
        liveLandingTemplateId: event.liveLandingTemplateId || '',
        eventEndedTemplateId: event.eventEndedTemplateId || '',
        itineraryPageTemplateId: (event as any).itineraryPageTemplateId || '',
        giftingPageTemplateId: (event as any).giftingPageTemplateId || '',
      });
      const d = new Date(event.date);
      const ed = event.endDate ? new Date(event.endDate) : null;
      setEventSettings({
        name: event.name, description: event.description || '',
        socialTitle: event.socialTitle || '',
        socialDescription: event.socialDescription || '',
        coverImageAlt: event.coverImageAlt || '',
        date: d.toISOString().split('T')[0], time: d.toTimeString().slice(0, 5),
        endDate: ed ? ed.toISOString().split('T')[0] : '', endTime: ed ? ed.toTimeString().slice(0, 5) : '',
        venue: event.venue || '', timezone: event.timezone, invitationOnly: event.invitationOnly,
        reelEnabled: event.reelEnabled || false, strictInviteOnly: event.strictInviteOnly || false,
        itineraryEnabled: event.itineraryEnabled || false, giftingEnabled: event.giftingEnabled || false,
        // Feature toggles
        invitationEnabled: event.invitationEnabled ?? true,
        rsvpEnabled: event.rsvpEnabled ?? true,
        guestbookEnabled: event.guestbookEnabled ?? true,
        checkInEnabled: event.checkInEnabled ?? true,
        // RSVP Mode & Ticketing
        rsvpMode: (event.rsvpMode as 'free' | 'paid') || 'free',
        ticketingEnabled: event.ticketingEnabled ?? false,
        feeOverridesEnabled: event.feeOverridesEnabled ?? true,
        platformFeeMode: (event.platformFeeMode as 'PERCENTAGE' | 'FIXED') || 'PERCENTAGE',
        platformFeePercent: event.platformFeePercent ?? 5,
        platformFeeFixed: event.platformFeeFixed ?? 0,
        processingFeePercent: event.processingFeePercent ?? 2.9,
        processingFeeFixed: event.processingFeeFixed ?? 0.30,
        // Limits
        maxRecordingDuration: event.maxRecordingDuration, minRecordingDuration: event.minRecordingDuration, maxPhotosPerGuest: event.maxPhotosPerGuest,
        maxPhotosPerBoothSession: (event as any).maxPhotosPerBoothSession ?? 10,
        boothShutterCountdown: (event as any).boothShutterCountdown ?? 3,
        // Colors
        primaryColor: event.primaryColor || '#FFD700', secondaryColor: event.secondaryColor || '#1a1a2e', accentColor: event.accentColor || '#ffffff',
        // Owner
        ownerId: (event as any).ownerId || '', ownerName: event.ownerName || '', ownerEmail: event.ownerEmail || '', ownerPhone: event.ownerPhone || '', organizationName: event.organizationName || '',
        // Notifications
        notifyOnRsvp: event.notifyOnRsvp ?? true, notifyOnCheckIn: event.notifyOnCheckIn ?? false, notifyOnGuestbook: event.notifyOnGuestbook ?? false,
        emailNotifications: event.emailNotifications ?? true, smsNotifications: event.smsNotifications ?? false, whatsappNotifications: event.whatsappNotifications ?? false,
      });
      setDomains(event.domains || []);
    }
  }, [event]);

  const fetchEvent = async () => {
    try { const r = await eventsApi.get(eventId); setEvent(r.data.event); }
    catch { toast.error('Failed to load event'); router.push('/admin/events'); }
    finally { setLoading(false); }
  };
  const fetchDefaultFeeSettings = async () => {
    try {
      const token = typeof window !== 'undefined' ? localStorage.getItem('admin_token') : null;
      const response = await fetch(`${API_BASE_URL}/api/settings`, {
        headers: token ? { Authorization: `Bearer ${token}` } : undefined,
      });
      if (!response.ok) return;
      const payload = await response.json();
      const settings = payload?.settings || {};
      setDefaultFeeSettings({
        platformFeeMode: settings.platformFeeMode === 'FIXED' ? 'FIXED' : 'PERCENTAGE',
        platformFeePercent: Number(settings.platformFeePercent ?? 5),
        platformFeeFixed: Number(settings.platformFeeFixed ?? 0),
        processingFeePercent: Number(settings.processingFeePercent ?? 2.9),
        processingFeeFixed: Number(settings.processingFeeFixed ?? 0.3),
      });
    } catch (error) {
      console.error('Failed to load default fee settings:', error);
    }
  };
  const fetchDomains = async () => {
    try {
      const r = await eventsApi.getDomains(eventId);
      setDomains(r.data.domains || []);
    } catch (e: any) {
      toast.error(e.response?.data?.error || 'Failed to load domains');
    }
  };
  const fetchTemplates = async () => { try { const r = await templatesApi.list(); setTemplates(r.data.templates); } catch {} };
  const fetchOwners = async () => { 
    try { 
      setLoadingOwners(true);
      const r = await ownersApi.list({ isActive: true }); 
      setOwners(r.data.owners || []); 
    } catch { 
      toast.error('Failed to load owners'); 
    } finally {
      setLoadingOwners(false);
    }
  };
  const handleCreateOwner = async () => {
    if (!newOwner.name || !newOwner.email) {
      toast.error('Name and email are required');
      return;
    }
    try {
      const r = await ownersApi.create(newOwner);
      toast.success('Owner created');
      setOwners([...owners, r.data.owner]);
      setEventSettings({ ...eventSettings, ownerId: r.data.owner.id, ownerName: r.data.owner.name, ownerEmail: r.data.owner.email, ownerPhone: r.data.owner.phone || '', organizationName: r.data.owner.company || '' });
      setNewOwner({ name: '', email: '', phone: '', company: '' });
      setShowNewOwnerForm(false);
    } catch (e: any) {
      toast.error(e.response?.data?.error || 'Failed to create owner');
    }
  };
  const fetchRsvps = async () => {
    setLoadingRsvps(true);
    try {
      const p: any = {};
      if (rsvpFilter !== 'all') p.status = rsvpFilter;
      const r = await rsvpApi.list(eventId, p);
      setRsvps(r.data.rsvps);
    } catch (e: any) {
      toast.error(e.response?.data?.error || 'Failed to load RSVPs');
    } finally {
      setLoadingRsvps(false);
    }
  };
  const fetchMedia = async () => { try { const r = await mediaApi.list(eventId); setMedia(r.data.media || []); } catch { toast.error('Failed to load media'); } };
  const fetchCheckIns = async () => { try { const r = await checkInApi.list(eventId); setCheckIns(r.data.checkIns || []); } catch { toast.error('Failed to load check-ins'); } };
  const fetchTickets = async () => {
    try {
      setLoadingTickets(true);
      const r = await ticketingApi.getTicketTypes(eventId);
      setTickets(r.data.tickets || []);
    } catch {
      toast.error('Failed to load tickets');
    } finally {
      setLoadingTickets(false);
    }
  };

  const fetchEventGatewayCurrencies = async () => {
    try {
      const response = await paymentGatewaysApi.getEventGateways(eventId);
      const eventGateways = response.data.eventGateways || [];
      const currencies = uniqueCurrencyCodes(
        eventGateways.map((item: any) => item?.paymentGateway?.currency)
      );
      setEventGatewayCurrencies(currencies);

      if (currencies.length > 0) {
        setNewGiftPackage((prev) => {
          if (prev.currency && currencies.includes(prev.currency.toUpperCase())) return prev;
          return { ...prev, currency: currencies[0] };
        });
      }
    } catch (error) {
      console.error('Failed to load event gateways for currencies:', error);
      setEventGatewayCurrencies([]);
    }
  };

  const fetchSales = async () => {
    try {
      setLoadingSales(true);
      const r = await adminApi.sales({ eventId });
      setSales(r.data.sales || []);
      setSalesStats(r.data.stats || null);
    } catch {
      toast.error('Failed to load sales');
    } finally {
      setLoadingSales(false);
    }
  };

  const fetchGifts = async () => {
    try {
      setLoadingGifts(true);
      const [packagesResponse, ordersResponse] = await Promise.all([
        giftingApi.listEventPackages(eventId),
        giftingApi.listOrders(eventId),
      ]);
      setGiftPackages(packagesResponse.data.packages || []);
      setGiftOrders(ordersResponse.data.orders || []);
    } catch (e: any) {
      toast.error(e.response?.data?.error || 'Failed to load gifting data');
    } finally {
      setLoadingGifts(false);
    }
  };

  const handleToggleGiftPackageAssignment = (id: string) => {
    setGiftPackages((current) =>
      current.map((pkg) => (pkg.id === id ? { ...pkg, assigned: !pkg.assigned } : pkg))
    );
  };

  const handleSaveGiftAssignments = async () => {
    try {
      setSavingGiftAssignments(true);
      const packageIds = giftPackages.filter((pkg) => pkg.assigned).map((pkg) => pkg.id);
      await giftingApi.setEventPackages(eventId, packageIds);
      toast.success('Gift package assignment saved');
      await fetchGifts();
    } catch (e: any) {
      toast.error(e.response?.data?.error || 'Failed to save gift package assignment');
    } finally {
      setSavingGiftAssignments(false);
    }
  };

  const handleCreateGiftPackage = async () => {
    if (!newGiftPackage.name.trim()) {
      toast.error('Package name is required');
      return;
    }
    const price = Number(newGiftPackage.price);
    if (!Number.isFinite(price) || price <= 0) {
      toast.error('Package price must be greater than 0');
      return;
    }

    try {
      setSavingGiftPackage(true);
      let uploadedThumbnailPath: string | null = null;

      if (newGiftPackagePhoto) {
        const uploadResponse = await giftingApi.uploadPackageImage(newGiftPackagePhoto);
        uploadedThumbnailPath = uploadResponse.data?.thumbnailPath || null;
      }

      await giftingApi.createPackage({
        name: newGiftPackage.name.trim(),
        description: newGiftPackage.description.trim() || null,
        price,
        currency: (newGiftPackage.currency || primaryEventCurrency).toUpperCase(),
        thumbnailPath: uploadedThumbnailPath,
      });
      setNewGiftPackage({
        name: '',
        description: '',
        price: '',
        currency: (newGiftPackage.currency || primaryEventCurrency).toUpperCase(),
      });
      setNewGiftPackagePhoto(null);
      setNewGiftPackagePhotoPreview(null);
      toast.success('Gift package created');
      await fetchGifts();
    } catch (e: any) {
      toast.error(e.response?.data?.error || 'Failed to create gift package');
    } finally {
      setSavingGiftPackage(false);
    }
  };

  const handleToggleGiftPackageActive = async (pkg: GiftPackage) => {
    try {
      await giftingApi.updatePackage(pkg.id, { isActive: !pkg.isActive });
      toast.success(!pkg.isActive ? 'Package activated' : 'Package disabled');
      await fetchGifts();
    } catch (e: any) {
      toast.error(e.response?.data?.error || 'Failed to update package');
    }
  };

  const fetchItinerary = async () => {
    try {
      setLoadingItinerary(true);
      const response = await itineraryApi.getItems(eventId);
      setItineraryItems(response.data.items || []);
    } catch (e: any) {
      toast.error(e.response?.data?.error || 'Failed to load itinerary');
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
    } catch (e: any) {
      setItineraryItems(previous);
      toast.error(e.response?.data?.error || 'Failed to reorder itinerary');
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
    } catch (e: any) {
      toast.error(e.response?.data?.error || 'Failed to add itinerary item');
    } finally {
      setSavingItinerary(false);
    }
  };

  const handleCreateMcControlLink = async () => {
    setCreatingMcSession(true);
    try {
      const response = await itineraryApi.createMcSession(eventId);
      if (response.data?.mcUrl) {
        setMcControlUrl(response.data.mcUrl);
      }
      toast.success('MC control link generated');
    } catch (e: any) {
      toast.error(e.response?.data?.error || 'Failed to generate MC link');
    } finally {
      setCreatingMcSession(false);
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
    } catch (e: any) {
      toast.error(e.response?.data?.error || 'Failed to update itinerary item');
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
    } catch (e: any) {
      toast.error(e.response?.data?.error || 'Failed to delete itinerary item');
    } finally {
      setDeletingItineraryId(null);
    }
  };

  const fetchFormFields = async () => {
    setLoadingFormFields(true);
    try {
      const r = await ticketingApi.getCustomFields(eventId);
      const fields = r.data.fields.map((f: any) => ({
        ...f,
        options: f.options ? JSON.parse(f.options) : null,
      }));
      setFormFields(fields);
    } catch (e: any) {
      toast.error(e.response?.data?.error || 'Failed to load form fields');
    } finally {
      setLoadingFormFields(false);
    }
  };

  const handleUploadCover = async () => {
    if (!coverFile) return;
    setUploadingCover(true);
    try {
      const formData = new FormData();
      formData.append('cover', coverFile);
      if (eventSettings.coverImageAlt) formData.append('alt', eventSettings.coverImageAlt);
      await eventsApi.uploadCover(eventId, formData);
      setCoverFile(null);
      toast.success('Cover image updated');
      await fetchEvent();
    } catch (e: any) {
      toast.error(e.response?.data?.error || 'Failed to upload cover');
    } finally {
      setUploadingCover(false);
    }
  };

  const handleDeleteCover = async () => {
    try {
      await eventsApi.deleteCover(eventId);
      toast.success('Cover image removed');
      await fetchEvent();
    } catch (e: any) {
      toast.error(e.response?.data?.error || 'Failed to remove cover');
    }
  };

  const handleAddDomain = async () => {
    if (!domainHost.trim()) {
      toast.error('Domain host is required');
      return;
    }
    setSavingDomain(true);
    try {
      await eventsApi.addDomain(eventId, { host: domainHost.trim() });
      setDomainHost('');
      toast.success('Domain added. Complete DNS verification next.');
      await fetchDomains();
    } catch (e: any) {
      toast.error(e.response?.data?.error || 'Failed to add domain');
    } finally {
      setSavingDomain(false);
    }
  };

  const handleVerifyDomain = async (domainId: string) => {
    try {
      await eventsApi.verifyDomain(eventId, domainId);
      toast.success('Verification check complete');
      await fetchDomains();
    } catch (e: any) {
      toast.error(e.response?.data?.error || 'Failed to verify domain');
    }
  };

  const handleSetPrimaryDomain = async (domainId: string) => {
    try {
      await eventsApi.setPrimaryDomain(eventId, domainId);
      toast.success('Primary domain updated');
      await fetchDomains();
    } catch (e: any) {
      toast.error(e.response?.data?.error || 'Failed to update primary domain');
    }
  };

  const handleDeleteDomain = async (domainId: string) => {
    try {
      await eventsApi.deleteDomain(eventId, domainId);
      toast.success('Domain removed');
      await fetchDomains();
    } catch (e: any) {
      toast.error(e.response?.data?.error || 'Failed to remove domain');
    }
  };

  const handleSaveFormField = async () => {
    try {
      const data = {
        ...formFieldData,
        options: formFieldData.options.length > 0 ? formFieldData.options : undefined,
      };
      if (editingFormField) {
        await ticketingApi.updateCustomField(eventId, editingFormField.id, data);
        toast.success('Form field updated', { icon: '✅' });
      } else {
        await ticketingApi.createCustomField(eventId, data);
        toast.success('Form field created', { icon: '✅' });
      }
      setShowFormFieldModal(false);
      setEditingFormField(null);
      setFormFieldData({
        fieldName: '', label: '', type: 'text', placeholder: '', helpText: '',
        options: [], required: false, minLength: undefined, maxLength: undefined,
        pattern: '', sortOrder: formFields.length, isActive: true, showOnConfirmation: true,
      });
      await fetchFormFields();
    } catch (e: any) {
      toast.error(e.response?.data?.error || 'Failed to save form field');
    }
  };

  const handleDeleteFormField = async (id: string) => {
    if (!confirm('Are you sure you want to delete this field?')) return;
    try {
      await ticketingApi.deleteCustomField(eventId, id);
      toast.success('Form field deleted', { icon: '✅' });
      await fetchFormFields();
    } catch (e: any) {
      toast.error(e.response?.data?.error || 'Failed to delete form field');
    }
  };

  const handlePhaseChange = async (phase: string) => {
    try { await eventsApi.setPhase(eventId, phase, true); toast.success(`Phase: ${getPhaseLabel(phase)}`); fetchEvent(); }
    catch { toast.error('Failed'); }
  };

  const handleReviewRsvp = async (id: string, status: 'APPROVED' | 'REJECTED') => {
    setReviewingRsvp(id);
    try {
      await rsvpApi.review(id, status);
      toast.success(`RSVP ${status.toLowerCase()} successfully`, {
        icon: status === 'APPROVED' ? '✅' : '❌',
        duration: 3000,
      });
      await Promise.all([fetchRsvps(), fetchEvent()]);
    } catch (e: any) {
      toast.error(e.response?.data?.error || 'Failed to review RSVP');
    } finally {
      setReviewingRsvp(null);
    }
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
        boothVideoTemplateId: selectedTemplates.boothVideoTemplateId || null,
        boothAudioTemplateId: selectedTemplates.boothAudioTemplateId || null,
        boothPhotoTemplateId: selectedTemplates.boothPhotoTemplateId || null,
        thankYouTemplateId: selectedTemplates.thankYouTemplateId || null,
        liveLandingTemplateId: selectedTemplates.liveLandingTemplateId || null,
        eventEndedTemplateId: selectedTemplates.eventEndedTemplateId || null,
        itineraryPageTemplateId: selectedTemplates.itineraryPageTemplateId || null,
        giftingPageTemplateId: selectedTemplates.giftingPageTemplateId || null,
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
      
      // Enforce logic: check-in disabled when invitation-only is false
      const checkInEnabled = eventSettings.invitationOnly ? eventSettings.checkInEnabled : false;
      
      await eventsApi.update(eventId, {
        name: eventSettings.name, description: eventSettings.description || null,
        socialTitle: eventSettings.socialTitle || null,
        socialDescription: eventSettings.socialDescription || null,
        coverImageAlt: eventSettings.coverImageAlt || null,
        date: dt.toISOString(), endDate: edt?.toISOString() || null,
        venue: eventSettings.venue || null, timezone: eventSettings.timezone,
        invitationOnly: eventSettings.invitationOnly,
        reelEnabled: eventSettings.reelEnabled,
        strictInviteOnly: eventSettings.strictInviteOnly,
        itineraryEnabled: eventSettings.itineraryEnabled,
        giftingEnabled: eventSettings.giftingEnabled,
        // Feature toggles
        invitationEnabled: eventSettings.invitationEnabled,
        rsvpEnabled: eventSettings.rsvpEnabled,
        guestbookEnabled: eventSettings.guestbookEnabled,
        checkInEnabled: checkInEnabled,
        // RSVP Mode & Ticketing
        rsvpMode: eventSettings.rsvpMode,
        ticketingEnabled: eventSettings.ticketingEnabled,
        feeOverridesEnabled: eventSettings.feeOverridesEnabled,
        platformFeeMode: eventSettings.platformFeeMode,
        platformFeePercent: eventSettings.platformFeePercent,
        platformFeeFixed: eventSettings.platformFeeFixed,
        processingFeePercent: eventSettings.processingFeePercent,
        processingFeeFixed: eventSettings.processingFeeFixed,
        // Limits
        maxRecordingDuration: eventSettings.maxRecordingDuration, minRecordingDuration: eventSettings.minRecordingDuration, maxPhotosPerGuest: eventSettings.maxPhotosPerGuest,
        maxPhotosPerBoothSession: eventSettings.maxPhotosPerBoothSession, boothShutterCountdown: eventSettings.boothShutterCountdown,
        // Notifications
        notifyOnRsvp: eventSettings.notifyOnRsvp, notifyOnCheckIn: eventSettings.notifyOnCheckIn, notifyOnGuestbook: eventSettings.notifyOnGuestbook,
        emailNotifications: eventSettings.emailNotifications, smsNotifications: eventSettings.smsNotifications, whatsappNotifications: eventSettings.whatsappNotifications,
        // Colors
        primaryColor: eventSettings.primaryColor, secondaryColor: eventSettings.secondaryColor, accentColor: eventSettings.accentColor,
        // Owner
        ownerId: eventSettings.ownerId || null, ownerName: eventSettings.ownerName || null, ownerEmail: eventSettings.ownerEmail || null, ownerPhone: eventSettings.ownerPhone || null, organizationName: eventSettings.organizationName || null,
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
    { id: 'tickets', label: 'Tickets' },
    { id: 'itinerary', label: 'Itinerary', count: itineraryItems.length || undefined },
    { id: 'formFields', label: 'Form Fields', count: formFields.length },
    { id: 'gifts', label: 'Gifts', count: event._count.giftOrders || undefined },
    { id: 'settings', label: 'Settings' },
  ];

  const giftSummary = giftOrders.reduce(
    (acc, order) => {
      acc.orders += 1;
      acc.gross += Number(order.totalAmount || 0);
      acc.ownerNet += Number(order.ownerNetAmount || 0);
      acc.adminRetained += Number(order.adminRetainedAmount || 0);
      acc.cash += Number(order.cashGiftAmount || 0);
      acc.packageAmount += Number(order.packageAmount || 0);
      return acc;
    },
    { orders: 0, gross: 0, ownerNet: 0, adminRetained: 0, cash: 0, packageAmount: 0 }
  );
  const giftCurrency = giftOrders[0]?.currency || primaryEventCurrency;

  return (
    <div className="space-y-7">
      {/* Header */}
      <div className="rounded-2xl border border-surface-200 bg-white shadow-soft px-5 py-4 flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4">
        <div className="min-w-0">
          <Link href="/admin/events" className="inline-flex items-center text-surface-500 hover:text-brand-900 mb-2 text-sm transition-colors">
            {Icons.back}
            <span className="ml-1">Back to Events</span>
          </Link>
          <h1 className="text-2xl font-display font-bold text-brand-900 truncate">{event.name}</h1>
          <div className="flex flex-wrap items-center gap-2 mt-2">
            <span className={getStatusColor(event.currentPhase)}>{getPhaseLabel(event.currentPhase)}</span>
            {event.phaseOverride && <span className="text-xs text-surface-500">(Override)</span>}
            {event.invitationOnly && <span className="badge-info">Invite Only</span>}
            {event.reelEnabled && <span className="px-2 py-0.5 rounded text-xs bg-surface-100 text-surface-600 border border-surface-200">Reel Enabled</span>}
            <span className="text-xs text-surface-400 font-mono">/{event.slug}</span>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <Link href={`/e/${event.slug}`} target="_blank" className="btn-outline">
            {Icons.external}
            <span className="ml-2">View Public Page</span>
          </Link>
        </div>
      </div>

      {/* Tabs */}
      <div className="overflow-x-auto rounded-2xl border border-surface-200 bg-white shadow-soft p-2">
        <nav className="flex gap-1 min-w-max">
          {tabs.map(tab => (
            <button 
              key={tab.id} 
              onClick={() => setActiveTab(tab.id)} 
              className={cn(
                'px-4 py-2.5 text-sm font-medium rounded-xl transition-all border',
                activeTab === tab.id 
                  ? 'bg-brand-50 border-brand-100 text-brand-900 shadow-sm' 
                  : 'border-transparent text-surface-500 hover:text-surface-700 hover:border-surface-200'
              )}
            >
              {tab.label}
              {tab.count !== undefined && <span className={cn('ml-2 px-2 py-0.5 rounded-full text-xs', activeTab === tab.id ? 'bg-white text-brand-700 border border-brand-100' : 'bg-surface-100 text-surface-600')}>{tab.count}</span>}
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
                    <p className="text-3xl font-bold text-brand-900">{s.v}</p>
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
              <h3 className="font-semibold text-brand-900 mb-4">Phase Control</h3>
              <div className="space-y-2">
                {(['PRE_EVENT', 'LIVE', 'POST_EVENT'] as const).map(p => (
                  <button 
                    key={p} 
                    onClick={() => handlePhaseChange(p)} 
                    disabled={event.currentPhase === p} 
                    className={cn(
                      'w-full px-4 py-2.5 rounded-lg text-sm font-medium transition-all',
                      event.currentPhase === p 
                        ? 'bg-brand-900 text-white' 
                        : 'bg-surface-50 text-surface-700 hover:bg-surface-100'
                    )}
                  >
                    {getPhaseLabel(p)}
                  </button>
                ))}
              </div>
            </div>
            <div className="bg-white rounded-xl border border-surface-200 p-5">
              <h3 className="font-semibold text-brand-900 mb-4">Quick Links</h3>
              <div className="space-y-1 text-sm">
                {[
                  { l: 'Event Home', p: `/e/${event.slug}`, enabled: true },
                  { l: 'Invitation Page', p: `/e/${event.slug}/invitation`, enabled: event.invitationEnabled },
                  { l: 'Live Page', p: `/e/${event.slug}/live`, enabled: true },
                  { l: 'RSVP Form', p: `/e/${event.slug}/rsvp`, enabled: event.rsvpEnabled },
                  { l: 'Guestbook', p: `/e/${event.slug}/guestbook`, enabled: event.guestbookEnabled },
                  { l: 'Guest Booth', p: `/e/${event.slug}/booth`, enabled: event.guestbookEnabled },
                  { l: 'Check-In', p: `/e/${event.slug}/checkin`, enabled: event.checkInEnabled },
                  { l: 'Itinerary', p: `/e/${event.slug}/itinerary`, enabled: event.itineraryEnabled },
                  { l: 'Gift Page', p: `/gift/${event.slug}`, enabled: event.giftingEnabled },
                  { l: 'Thank You Page', p: `/e/${event.slug}/thanks`, enabled: true },
                  { l: 'Owner Token View', p: `/event-owner/${event.ownerAccessToken}`, enabled: true },
                  { l: 'Owner Dashboard Login', p: `/owner/login`, enabled: true },
                ].map(x => (
                  <div
                    key={x.p}
                    className={cn(
                      'w-full p-2.5 rounded-lg flex items-center justify-between transition-colors',
                      x.enabled ? 'hover:bg-surface-50 text-surface-700' : 'bg-surface-50/60 text-surface-400'
                    )}
                  >
                    <div className="min-w-0 flex items-center gap-2">
                      <span className="truncate">{x.l}</span>
                      {!x.enabled ? (
                        <span className="text-[10px] px-1.5 py-0.5 rounded bg-surface-200 text-surface-500 uppercase tracking-wide">
                          Disabled
                        </span>
                      ) : null}
                    </div>
                    <div className="flex items-center gap-1">
                      <a
                        href={x.p}
                        target="_blank"
                        rel="noopener noreferrer"
                        className={cn(
                          'p-1.5 rounded-md transition-colors',
                          x.enabled ? 'hover:bg-surface-100 text-surface-500 hover:text-brand-900' : 'text-surface-300'
                        )}
                        title="Open link"
                      >
                        {Icons.external}
                      </a>
                      <button
                        onClick={() => handleCopyLink(x.p)}
                        className={cn(
                          'p-1.5 rounded-md transition-colors',
                          x.enabled ? 'hover:bg-surface-100 text-surface-500 hover:text-brand-900' : 'text-surface-300'
                        )}
                        title="Copy link"
                      >
                        {Icons.copy}
                      </button>
                    </div>
                  </div>
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
                    rsvpFilter === s ? 'bg-white text-brand-900 shadow-sm' : 'text-surface-600 hover:text-surface-900'
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
            {loadingRsvps ? (
              <div className="py-12 text-center">
                <div className="inline-block animate-spin rounded-full h-8 w-8 border-b-2 border-brand-900"></div>
                <p className="mt-4 text-surface-500">Loading RSVPs...</p>
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full">
                  <thead><tr className="border-b border-surface-200 bg-surface-50">
                    <th className="text-left py-3 px-4 text-xs font-medium text-surface-500 uppercase tracking-wider">Guest</th>
                    <th className="text-left py-3 px-4 text-xs font-medium text-surface-500 uppercase tracking-wider">Contact</th>
                    <th className="text-left py-3 px-4 text-xs font-medium text-surface-500 uppercase tracking-wider">Response</th>
                    <th className="text-left py-3 px-4 text-xs font-medium text-surface-500 uppercase tracking-wider">Meal & Dietary</th>
                    <th className="text-left py-3 px-4 text-xs font-medium text-surface-500 uppercase tracking-wider">Notes</th>
                    <th className="text-left py-3 px-4 text-xs font-medium text-surface-500 uppercase tracking-wider">Status</th>
                    <th className="text-right py-3 px-4 text-xs font-medium text-surface-500 uppercase tracking-wider">Actions</th>
                  </tr></thead>
                  <tbody className="divide-y divide-surface-100">
                    {rsvps.length === 0 ? (
                      <tr><td colSpan={7} className="py-12 text-center text-surface-500">No RSVPs found</td></tr>
                    ) : rsvps.map(r => {
                      const customFields = r.customFields ? JSON.parse(r.customFields) : null;
                      return (
                        <tr key={r.id} className="hover:bg-surface-50 transition-colors">
                          <td className="py-3 px-4">
                            <p className="font-medium text-brand-900">{r.primaryName}</p>
                            {r.secondaryName && <p className="text-sm text-surface-500">& {r.secondaryName}</p>}
                          </td>
                          <td className="py-3 px-4">
                            {r.email && <p className="text-sm text-surface-600">{r.email}</p>}
                            {r.phone && <p className="text-sm text-surface-500">{r.phone}</p>}
                          </td>
                          <td className="py-3 px-4">
                            <span className={getStatusColor(r.attendance)}>{r.attendance}</span>
                            <p className="text-sm text-surface-500 mt-1">{r.guestCount} guest(s)</p>
                            {r.submittedAt && (
                              <p className="text-xs text-surface-400 mt-1">{formatDate(r.submittedAt, 'MMM d, yyyy')}</p>
                            )}
                          </td>
                          <td className="py-3 px-4 text-sm">
                            {r.mealPreference && <p className="text-surface-700">Meal: <span className="font-medium">{r.mealPreference}</span></p>}
                            {r.dietaryNotes && <p className="text-xs text-surface-600 mt-1">Dietary: {r.dietaryNotes}</p>}
                          </td>
                          <td className="py-3 px-4 text-sm">
                            {r.note && <p className="text-surface-600 max-w-[200px]">{r.note}</p>}
                            {customFields && Object.keys(customFields).length > 0 && (
                              <details className="mt-2">
                                <summary className="text-xs text-primary-600 cursor-pointer hover:text-primary-700">Custom Fields</summary>
                                <div className="mt-2 text-xs text-surface-500 space-y-1">
                                  {Object.entries(customFields).map(([key, value]) => (
                                    <p key={key}><span className="font-medium">{key}:</span> {String(value)}</p>
                                  ))}
                                </div>
                              </details>
                            )}
                          </td>
                          <td className="py-3 px-4">
                            <span className={getStatusColor(r.status)}>{r.status}</span>
                            {r.invitation?.isCheckedIn && (
                              <span className="ml-2 text-xs text-green-600 flex items-center gap-1">
                                {Icons.check} In
                              </span>
                            )}
                            {r.invitation?.accessCode && (
                              <p className="text-xs text-surface-400 mt-1 font-mono">{r.invitation.accessCode}</p>
                            )}
                          </td>
                          <td className="py-3 px-4 text-right">
                            <div className="flex items-center justify-end gap-2">
                              <button
                                onClick={() => setViewingRsvpDetails(r)}
                                className="px-3 py-1.5 text-sm bg-blue-50 text-blue-700 rounded-lg hover:bg-blue-100 transition-colors"
                                title="View Details"
                              >
                                Details
                              </button>
                              {r.status === 'PENDING' && (
                                <>
                                  <button 
                                    onClick={() => handleReviewRsvp(r.id, 'APPROVED')} 
                                    className="px-3 py-1.5 text-sm bg-green-50 text-green-700 rounded-lg hover:bg-green-100 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                                    disabled={reviewingRsvp === r.id}
                                  >
                                    {reviewingRsvp === r.id ? 'Processing...' : 'Approve'}
                                  </button>
                                  <button 
                                    onClick={() => handleReviewRsvp(r.id, 'REJECTED')} 
                                    className="px-3 py-1.5 text-sm bg-red-50 text-red-700 rounded-lg hover:bg-red-100 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                                    disabled={reviewingRsvp === r.id}
                                  >
                                    {reviewingRsvp === r.id ? 'Processing...' : 'Reject'}
                                  </button>
                                </>
                              )}
                            </div>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </div>

          {/* RSVP Details Modal */}
          {viewingRsvpDetails && (
            <div className="fixed inset-0 z-50 bg-black/50 flex items-center justify-center p-4" onClick={() => setViewingRsvpDetails(null)}>
              <div className="bg-white rounded-xl max-w-2xl w-full max-h-[90vh] overflow-y-auto" onClick={(e) => e.stopPropagation()}>
                <div className="p-6 border-b border-surface-200">
                  <div className="flex items-center justify-between">
                    <h3 className="text-lg font-semibold text-brand-900">RSVP Details</h3>
                    <button onClick={() => setViewingRsvpDetails(null)} className="p-2 rounded-lg hover:bg-surface-100">
                      <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                      </svg>
                    </button>
                  </div>
                </div>
                <div className="p-6 space-y-4">
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
                      <p className="text-brand-900">
                        <span className={getStatusColor(viewingRsvpDetails.attendance)}>{viewingRsvpDetails.attendance}</span>
                      </p>
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
                    {viewingRsvpDetails.submittedAt && (
                      <div>
                        <label className="text-sm font-medium text-surface-500">Submitted At</label>
                        <p className="text-brand-900">{formatDate(viewingRsvpDetails.submittedAt, 'MMM d, yyyy h:mm a')}</p>
                      </div>
                    )}
                    <div>
                      <label className="text-sm font-medium text-surface-500">Status</label>
                      <p className="text-brand-900">
                        <span className={getStatusColor(viewingRsvpDetails.status)}>{viewingRsvpDetails.status}</span>
                      </p>
                    </div>
                  </div>
                  
                  {viewingRsvpDetails.customFields && (() => {
                    try {
                      const customFields = JSON.parse(viewingRsvpDetails.customFields);
                      if (Object.keys(customFields).length > 0) {
                        return (
                          <div className="border-t border-surface-200 pt-4 mt-4">
                            <h4 className="text-sm font-semibold text-brand-900 mb-3">Custom Fields</h4>
                            <div className="grid sm:grid-cols-2 gap-4">
                              {Object.entries(customFields).map(([key, value]) => (
                                <div key={key}>
                                  <label className="text-sm font-medium text-surface-500">{key}</label>
                                  <p className="text-brand-900">{String(value)}</p>
                                </div>
                              ))}
                            </div>
                          </div>
                        );
                      }
                    } catch {}
                    return null;
                  })()}

                  {/* Invitation Details with QR Code */}
                  {viewingRsvpDetails.invitation && (
                    <div className="border-t border-surface-200 pt-4 mt-4">
                      <h4 className="text-sm font-semibold text-brand-900 mb-3">Invitation Details</h4>
                      <div className="grid sm:grid-cols-2 gap-4 text-sm mb-4">
                        <div>
                          <label className="text-sm font-medium text-surface-500">Access Code</label>
                          <p className="text-brand-900 font-mono">{viewingRsvpDetails.invitation.accessCode}</p>
                        </div>
                        <div>
                          <label className="text-sm font-medium text-surface-500">Checked In</label>
                          <p className="text-brand-900">
                            {viewingRsvpDetails.invitation.isCheckedIn ? (
                              <span className="text-green-600 font-medium">Yes</span>
                            ) : (
                              <span className="text-surface-400">No</span>
                            )}
                          </p>
                        </div>
                      </div>
                      {/* QR Code Display */}
                      {viewingRsvpDetails.invitation.qrCodeData && (
                        <div className="mt-4">
                          <label className="text-sm font-medium text-surface-500 mb-3 block">QR Code</label>
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
                  )}
                </div>
              </div>
            </div>
          )}
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
                      <td className="py-3 px-4"><p className="font-medium text-brand-900">{c.invitation.guestName}</p></td>
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
        <div className="space-y-6">
          {/* Header */}
          <div className="bg-gradient-to-r from-brand-900 to-brand-800 rounded-xl p-6 text-white">
            <div className="flex items-start justify-between">
              <div>
                <h3 className="text-xl font-bold mb-2">Template Assignment</h3>
                <p className="text-white/80 text-sm">Customize the appearance of each page for this event</p>
              </div>
              <Link href="/admin/templates" className="px-4 py-2 bg-white/10 hover:bg-white/20 rounded-lg text-sm font-medium transition-colors backdrop-blur-sm">
                Manage Templates →
              </Link>
            </div>
          </div>

          {/* Template Categories */}
          <div className="space-y-6">
            {/* Main Pages */}
            <div className="bg-white rounded-xl border border-surface-200 overflow-hidden">
              <div className="bg-surface-50 px-6 py-4 border-b border-surface-200">
                <h4 className="font-semibold text-brand-900 flex items-center gap-2">
                  <svg className="w-5 h-5 text-brand-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                  </svg>
                  Main Pages
                </h4>
                <p className="text-sm text-surface-500 mt-1">Core event pages</p>
              </div>
              <div className="p-6 grid sm:grid-cols-2 gap-4">
                {[
                  { t: 'INVITATION', l: 'Invitation Page', f: 'invitationTemplateId', e: event.invitationEnabled, icon: '🎫', desc: 'Digital invitation pass' },
                  { t: 'RSVP', l: 'RSVP Form', f: 'rsvpTemplateId', e: event.rsvpEnabled, icon: '✋', desc: 'Guest response form' },
                  { t: 'GUESTBOOK', l: 'Guestbook Menu', f: 'guestbookTemplateId', e: event.guestbookEnabled, icon: '📖', desc: 'Guestbook landing page' },
                  { t: 'THANK_YOU', l: 'Thank You Page', f: 'thankYouTemplateId', e: true, icon: '🙏', desc: 'Post-submission page' },
                  { t: 'LIVE_LANDING', l: 'Live Landing Page', f: 'liveLandingTemplateId', e: true, icon: '🎉', desc: 'During live phase' },
                  { t: 'EVENT_ENDED', l: 'Event Ended Page', f: 'eventEndedTemplateId', e: true, icon: '🏁', desc: 'After event ends' },
                  { t: 'ITINERARY', l: 'Itinerary Page', f: 'itineraryPageTemplateId', e: event.itineraryEnabled, icon: '🗓️', desc: 'Public itinerary tracking page' },
                  { t: 'GIFTING', l: 'Gifting Page', f: 'giftingPageTemplateId', e: event.giftingEnabled, icon: '🎁', desc: 'Guest gifting checkout page' },
                ].map(x => (
                  <div key={x.f} className={cn('relative p-4 rounded-lg border-2 transition-all', !x.e ? 'opacity-50 bg-surface-50 border-surface-200' : 'bg-white border-surface-200 hover:border-brand-300 hover:shadow-md')}>
                    <div className="flex items-start gap-3">
                      <div className="text-2xl flex-shrink-0">{x.icon}</div>
                      <div className="flex-1 min-w-0">
                        <label className="block text-sm font-semibold text-brand-900 mb-1">{x.l}</label>
                        <p className="text-xs text-surface-500 mb-3">{x.desc}</p>
                        <select 
                          className={cn('w-full px-3 py-2 text-sm border rounded-lg focus:ring-2 focus:ring-brand-500 focus:border-brand-500 transition-all', !x.e && 'cursor-not-allowed bg-surface-100')} 
                          value={(selectedTemplates as any)[x.f] || ''} 
                          onChange={e => setSelectedTemplates({ ...selectedTemplates, [x.f]: e.target.value })} 
                          disabled={!x.e}
                        >
                          <option value="">Default Template</option>
                          {getTemplatesByType(x.t).map(t => <option key={t.id} value={t.id}>{t.name}{t.isDefault && ' (Default)'}</option>)}
                        </select>
                      </div>
                    </div>
                    {!x.e && (
                      <div className="absolute top-2 right-2 px-2 py-1 bg-surface-200 text-surface-600 text-xs font-medium rounded">
                        Disabled
                      </div>
                    )}
                  </div>
                ))}
              </div>
            </div>

            {/* Guestbook Subpages */}
            {event.guestbookEnabled && (
              <div className="bg-white rounded-xl border border-surface-200 overflow-hidden">
                <div className="bg-surface-50 px-6 py-4 border-b border-surface-200">
                  <h4 className="font-semibold text-brand-900 flex items-center gap-2">
                    <svg className="w-5 h-5 text-brand-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
                    </svg>
                    Guestbook Recording Pages
                  </h4>
                  <p className="text-sm text-surface-500 mt-1">Media collection pages</p>
                </div>
                <div className="p-6 grid sm:grid-cols-3 gap-4">
                  {[
                    { t: 'GUESTBOOK_VIDEO', l: 'Video Recording', f: 'guestbookVideoTemplateId', icon: '🎥', desc: 'Video messages' },
                    { t: 'GUESTBOOK_AUDIO', l: 'Audio Recording', f: 'guestbookAudioTemplateId', icon: '🎤', desc: 'Audio messages' },
                    { t: 'GUESTBOOK_PHOTO', l: 'Photo Upload', f: 'guestbookPhotoTemplateId', icon: '📷', desc: 'Photo uploads' },
                  ].map(x => (
                    <div key={x.f} className="relative p-4 rounded-lg border-2 bg-white border-surface-200 hover:border-brand-300 hover:shadow-md transition-all">
                      <div className="flex items-start gap-3">
                        <div className="text-2xl flex-shrink-0">{x.icon}</div>
                        <div className="flex-1 min-w-0">
                          <label className="block text-sm font-semibold text-brand-900 mb-1">{x.l}</label>
                          <p className="text-xs text-surface-500 mb-3">{x.desc}</p>
                          <select 
                            className="w-full px-3 py-2 text-sm border border-surface-200 rounded-lg focus:ring-2 focus:ring-brand-500 focus:border-brand-500 transition-all" 
                            value={(selectedTemplates as any)[x.f] || ''} 
                            onChange={e => setSelectedTemplates({ ...selectedTemplates, [x.f]: e.target.value })}
                          >
                            <option value="">Default Template</option>
                            {getTemplatesByType(x.t).map(t => <option key={t.id} value={t.id}>{t.name}{t.isDefault && ' (Default)'}</option>)}
                          </select>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Booth Pages */}
            {event.guestbookEnabled && (
              <div className="bg-white rounded-xl border border-surface-200 overflow-hidden">
                <div className="bg-surface-50 px-6 py-4 border-b border-surface-200">
                  <h4 className="font-semibold text-brand-900 flex items-center gap-2">
                    <svg className="w-5 h-5 text-brand-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 3v2m6-2v2M9 19v2m6-2v2M5 9H3m2 6H3m18-6h-2m2 6h-2M7 19h10a2 2 0 002-2V7a2 2 0 00-2-2H7a2 2 0 00-2 2v10a2 2 0 002 2zM9 9h6v6H9V9z" />
                    </svg>
                    Photo Booth Pages
                  </h4>
                  <p className="text-sm text-surface-500 mt-1">Kiosk and booth interfaces</p>
                </div>
                <div className="p-6 grid sm:grid-cols-2 lg:grid-cols-4 gap-4">
                  {[
                    { t: 'BOOTH', l: 'Booth Menu', f: 'boothTemplateId', icon: '🖼️', desc: 'Main menu' },
                    { t: 'BOOTH', l: 'Booth Video', f: 'boothVideoTemplateId', icon: '📹', desc: 'Video capture' },
                    { t: 'BOOTH', l: 'Booth Audio', f: 'boothAudioTemplateId', icon: '🎙️', desc: 'Audio capture' },
                    { t: 'BOOTH', l: 'Booth Photo', f: 'boothPhotoTemplateId', icon: '📸', desc: 'Photo capture' },
                  ].map(x => (
                    <div key={x.f} className="relative p-4 rounded-lg border-2 bg-white border-surface-200 hover:border-brand-300 hover:shadow-md transition-all">
                      <div className="flex flex-col items-center text-center">
                        <div className="text-3xl mb-2">{x.icon}</div>
                        <label className="block text-sm font-semibold text-brand-900 mb-1">{x.l}</label>
                        <p className="text-xs text-surface-500 mb-3">{x.desc}</p>
                        <select 
                          className="w-full px-3 py-2 text-sm border border-surface-200 rounded-lg focus:ring-2 focus:ring-brand-500 focus:border-brand-500 transition-all" 
                          value={(selectedTemplates as any)[x.f] || ''} 
                          onChange={e => setSelectedTemplates({ ...selectedTemplates, [x.f]: e.target.value })}
                        >
                          <option value="">Default Template</option>
                          {getTemplatesByType(x.t).map(t => <option key={t.id} value={t.id}>{t.name}{t.isDefault && ' (Default)'}</option>)}
                        </select>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>

          {/* Save Button */}
          <div className="flex justify-end">
            <button 
              onClick={handleSaveTemplates} 
              disabled={savingTemplates} 
              className={cn(
                'px-6 py-3 rounded-lg font-medium transition-all flex items-center gap-2',
                savingTemplates 
                  ? 'bg-surface-200 text-surface-500 cursor-not-allowed' 
                  : 'bg-brand-900 text-white hover:bg-brand-800 shadow-lg hover:shadow-xl'
              )}
            >
              {savingTemplates ? (
                <>
                  <svg className="animate-spin h-5 w-5" fill="none" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                  </svg>
                  Saving...
                </>
              ) : (
                <>
                  <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                  </svg>
                  Save Template Assignments
                </>
              )}
            </button>
          </div>
        </div>
      )}

      {/* Tickets */}
      {activeTab === 'tickets' && (
        <TicketsTab
          eventId={eventId}
          event={event}
          tickets={tickets}
          loading={loadingTickets}
          onRefresh={fetchTickets}
        />
      )}

      {/* Itinerary */}
      {activeTab === 'itinerary' && (
        <div className="space-y-4">
          <div className="bg-white rounded-lg border border-surface-200 p-4 space-y-3">
            <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-3">
              <div>
                <h3 className="font-semibold text-brand-900">Event Itinerary</h3>
                <p className="text-sm text-surface-600">
                  Manage activities and generate MC control access.
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
                <p className="text-xs text-surface-500">Optional. Keep off for activities without fixed schedule.</p>
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

      {/* Form Fields */}
      {activeTab === 'formFields' && (
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <h3 className="text-lg font-semibold text-brand-900">RSVP Form Fields</h3>
              <p className="text-sm text-surface-500 mt-1">Customize the fields guests see when RSVPing. Email and Phone are always present but optional by default.</p>
            </div>
            <button
              onClick={() => {
                setEditingFormField(null);
                setFormFieldData({
                  fieldName: '', label: '', type: 'text', placeholder: '', helpText: '',
                  options: [], required: false, minLength: undefined, maxLength: undefined,
                  pattern: '', sortOrder: formFields.length, isActive: true, showOnConfirmation: true,
                });
                setShowFormFieldModal(true);
              }}
              className="btn-primary"
            >
              + Add Field
            </button>
          </div>

          {loadingFormFields ? (
            <div className="py-12 text-center">
              <div className="inline-block animate-spin rounded-full h-8 w-8 border-b-2 border-brand-900"></div>
              <p className="mt-4 text-surface-500">Loading form fields...</p>
            </div>
          ) : (
            <div className="bg-white rounded-xl border border-surface-200 overflow-hidden">
              {formFields.length === 0 ? (
                <div className="py-12 text-center text-surface-500">
                  <p>No custom fields yet. Add fields to collect additional information from guests.</p>
                  <p className="text-sm mt-2">Note: Email and Phone fields are always present but optional by default.</p>
                </div>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full">
                    <thead>
                      <tr className="border-b border-surface-200 bg-surface-50">
                        <th className="text-left py-3 px-4 text-xs font-medium text-surface-500 uppercase">Label</th>
                        <th className="text-left py-3 px-4 text-xs font-medium text-surface-500 uppercase">Type</th>
                        <th className="text-left py-3 px-4 text-xs font-medium text-surface-500 uppercase">Required</th>
                        <th className="text-left py-3 px-4 text-xs font-medium text-surface-500 uppercase">Active</th>
                        <th className="text-right py-3 px-4 text-xs font-medium text-surface-500 uppercase">Actions</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-surface-100">
                      {formFields.map((field) => (
                        <tr key={field.id} className="hover:bg-surface-50 transition-colors">
                          <td className="py-3 px-4">
                            <p className="font-medium text-brand-900">{field.label}</p>
                            {field.helpText && <p className="text-xs text-surface-500 mt-1">{field.helpText}</p>}
                          </td>
                          <td className="py-3 px-4">
                            <span className="px-2 py-1 text-xs rounded bg-surface-100 text-surface-700">{field.type}</span>
                          </td>
                          <td className="py-3 px-4">
                            {field.required ? (
                              <span className="text-green-600 font-medium">Yes</span>
                            ) : (
                              <span className="text-surface-400">No</span>
                            )}
                          </td>
                          <td className="py-3 px-4">
                            {field.isActive ? (
                              <span className="text-green-600 font-medium">Active</span>
                            ) : (
                              <span className="text-surface-400">Inactive</span>
                            )}
                          </td>
                          <td className="py-3 px-4 text-right">
                            <div className="flex justify-end gap-2">
                              <button
                                onClick={() => {
                                  setEditingFormField(field);
                                  setFormFieldData({
                                    fieldName: field.fieldName,
                                    label: field.label,
                                    type: field.type,
                                    placeholder: field.placeholder || '',
                                    helpText: field.helpText || '',
                                    options: field.options || [],
                                    required: field.required,
                                    minLength: field.minLength || undefined,
                                    maxLength: field.maxLength || undefined,
                                    pattern: field.pattern || '',
                                    sortOrder: field.sortOrder,
                                    isActive: field.isActive,
                                    showOnConfirmation: field.showOnConfirmation,
                                  });
                                  setShowFormFieldModal(true);
                                }}
                                className="px-3 py-1.5 text-sm bg-blue-50 text-blue-700 rounded-lg hover:bg-blue-100 transition-colors"
                              >
                                Edit
                              </button>
                              <button
                                onClick={() => handleDeleteFormField(field.id)}
                                className="px-3 py-1.5 text-sm bg-red-50 text-red-700 rounded-lg hover:bg-red-100 transition-colors"
                              >
                                Delete
                              </button>
                            </div>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          )}

          {/* Form Field Modal */}
          {showFormFieldModal && (
            <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
              <div className="bg-white rounded-xl max-w-2xl w-full max-h-[90vh] overflow-y-auto">
                <div className="p-6 border-b border-surface-200">
                  <h3 className="text-lg font-semibold text-brand-900">
                    {editingFormField ? 'Edit Form Field' : 'Add Form Field'}
                  </h3>
                </div>
                <div className="p-6 space-y-4">
                  <div className="grid sm:grid-cols-2 gap-4">
                    <div>
                      <label className="label">Field Name (Internal)</label>
                      <input
                        type="text"
                        className="input"
                        value={formFieldData.fieldName}
                        onChange={(e) => setFormFieldData({ ...formFieldData, fieldName: e.target.value })}
                        placeholder="e.g., company_name"
                      />
                    </div>
                    <div>
                      <label className="label">Display Label *</label>
                      <input
                        type="text"
                        className="input"
                        required
                        value={formFieldData.label}
                        onChange={(e) => setFormFieldData({ ...formFieldData, label: e.target.value })}
                        placeholder="e.g., Company Name"
                      />
                    </div>
                  </div>
                  <div>
                    <label className="label">Field Type *</label>
                    <select
                      className="input"
                      value={formFieldData.type}
                      onChange={(e) => setFormFieldData({ ...formFieldData, type: e.target.value as any })}
                    >
                      <option value="text">Text</option>
                      <option value="email">Email</option>
                      <option value="phone">Phone</option>
                      <option value="number">Number</option>
                      <option value="textarea">Textarea</option>
                      <option value="select">Select (Dropdown)</option>
                      <option value="radio">Radio Buttons</option>
                      <option value="checkbox">Checkbox</option>
                      <option value="date">Date</option>
                    </select>
                  </div>
                  <div className="grid sm:grid-cols-2 gap-4">
                    <div>
                      <label className="label">Placeholder</label>
                      <input
                        type="text"
                        className="input"
                        value={formFieldData.placeholder}
                        onChange={(e) => setFormFieldData({ ...formFieldData, placeholder: e.target.value })}
                      />
                    </div>
                    <div>
                      <label className="label">Help Text</label>
                      <input
                        type="text"
                        className="input"
                        value={formFieldData.helpText}
                        onChange={(e) => setFormFieldData({ ...formFieldData, helpText: e.target.value })}
                      />
                    </div>
                  </div>
                  {(formFieldData.type === 'select' || formFieldData.type === 'radio') && (
                    <div>
                      <label className="label">Options (one per line)</label>
                      <textarea
                        className="input"
                        rows={4}
                        value={formFieldData.options.join('\n')}
                        onChange={(e) => setFormFieldData({ ...formFieldData, options: e.target.value.split('\n').filter(o => o.trim()) })}
                        placeholder="Option 1&#10;Option 2&#10;Option 3"
                      />
                    </div>
                  )}
                  <div className="grid sm:grid-cols-3 gap-4">
                    <div>
                      <label className="label">Min Length</label>
                      <input
                        type="number"
                        className="input"
                        value={formFieldData.minLength || ''}
                        onChange={(e) => setFormFieldData({ ...formFieldData, minLength: e.target.value ? parseInt(e.target.value) : undefined })}
                      />
                    </div>
                    <div>
                      <label className="label">Max Length</label>
                      <input
                        type="number"
                        className="input"
                        value={formFieldData.maxLength || ''}
                        onChange={(e) => setFormFieldData({ ...formFieldData, maxLength: e.target.value ? parseInt(e.target.value) : undefined })}
                      />
                    </div>
                    <div>
                      <label className="label">Sort Order</label>
                      <input
                        type="number"
                        className="input"
                        value={formFieldData.sortOrder}
                        onChange={(e) => setFormFieldData({ ...formFieldData, sortOrder: parseInt(e.target.value) || 0 })}
                      />
                    </div>
                  </div>
                  <div className="flex gap-4">
                    <label className="flex items-center gap-2 cursor-pointer">
                      <input
                        type="checkbox"
                        className="w-4 h-4 rounded border-surface-300"
                        checked={formFieldData.required}
                        onChange={(e) => setFormFieldData({ ...formFieldData, required: e.target.checked })}
                      />
                      <span className="text-sm font-medium">Required Field</span>
                    </label>
                    <label className="flex items-center gap-2 cursor-pointer">
                      <input
                        type="checkbox"
                        className="w-4 h-4 rounded border-surface-300"
                        checked={formFieldData.isActive}
                        onChange={(e) => setFormFieldData({ ...formFieldData, isActive: e.target.checked })}
                      />
                      <span className="text-sm font-medium">Active</span>
                    </label>
                    <label className="flex items-center gap-2 cursor-pointer">
                      <input
                        type="checkbox"
                        className="w-4 h-4 rounded border-surface-300"
                        checked={formFieldData.showOnConfirmation}
                        onChange={(e) => setFormFieldData({ ...formFieldData, showOnConfirmation: e.target.checked })}
                      />
                      <span className="text-sm font-medium">Show on Confirmation</span>
                    </label>
                  </div>
                </div>
                <div className="p-6 border-t border-surface-200 flex justify-end gap-3">
                  <button
                    onClick={() => {
                      setShowFormFieldModal(false);
                      setEditingFormField(null);
                    }}
                    className="btn-outline"
                  >
                    Cancel
                  </button>
                  <button
                    onClick={handleSaveFormField}
                    className="btn-primary"
                    disabled={!formFieldData.label || !formFieldData.fieldName}
                  >
                    {editingFormField ? 'Update Field' : 'Create Field'}
                  </button>
                </div>
              </div>
            </div>
          )}
        </div>
      )}

      {/* Sales */}
      {activeTab === 'sales' && (
        <div className="space-y-4">
          {loadingSales ? (
            <div className="text-center py-12">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary-500 mx-auto" />
            </div>
          ) : (
            <>
              {/* Stats Cards */}
              {salesStats && (
                <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-4">
                  <div className="bg-white rounded-xl border border-surface-200 p-5">
                    <p className="text-sm text-surface-500 mb-1">Total Sales</p>
                    <p className="text-3xl font-bold text-brand-900">{salesStats.totalSales || 0}</p>
                  </div>
                  <div className="bg-white rounded-xl border border-surface-200 p-5">
                    <p className="text-sm text-surface-500 mb-1">Total Revenue</p>
                    <p className="text-3xl font-bold text-brand-900">
                      ${(salesStats.totalRevenue || 0).toFixed(2)}
                    </p>
                  </div>
                  <div className="bg-white rounded-xl border border-surface-200 p-5">
                    <p className="text-sm text-surface-500 mb-1">Paid</p>
                    <p className="text-3xl font-bold text-emerald-600">{salesStats.byStatus?.PAID || 0}</p>
                  </div>
                  <div className="bg-white rounded-xl border border-surface-200 p-5">
                    <p className="text-sm text-surface-500 mb-1">Pending</p>
                    <p className="text-3xl font-bold text-yellow-600">{salesStats.byStatus?.PENDING || 0}</p>
                  </div>
                </div>
              )}

              {/* Sales Table */}
              <div className="bg-white rounded-xl border border-surface-200 overflow-hidden">
                <div className="px-6 py-4 border-b border-surface-200">
                  <h3 className="text-lg font-semibold text-brand-900">Transaction History</h3>
                </div>
                {sales.length === 0 ? (
                  <div className="text-center py-12">
                    <p className="text-surface-600">No sales found for this event</p>
                    <p className="text-sm text-surface-500 mt-1">Ticket sales will appear here once guests purchase tickets</p>
                  </div>
                ) : (
                  <div className="overflow-x-auto">
                    <table className="w-full">
                      <thead>
                        <tr className="border-b border-surface-200 bg-surface-50">
                          <th className="text-left py-3 px-4 text-xs font-medium text-surface-500 uppercase tracking-wider">
                            Guest
                          </th>
                          <th className="text-left py-3 px-4 text-xs font-medium text-surface-500 uppercase tracking-wider">
                            Ticket Type
                          </th>
                          <th className="text-left py-3 px-4 text-xs font-medium text-surface-500 uppercase tracking-wider">
                            Amount
                          </th>
                          <th className="text-left py-3 px-4 text-xs font-medium text-surface-500 uppercase tracking-wider">
                            Status
                          </th>
                          <th className="text-left py-3 px-4 text-xs font-medium text-surface-500 uppercase tracking-wider">
                            Date
                          </th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-surface-100">
                        {sales.map((sale: any) => (
                          <tr key={sale.id} className="hover:bg-surface-50 transition-colors">
                            <td className="py-3 px-4">
                              <p className="font-medium text-brand-900">{sale.primaryName}</p>
                              {sale.email && (
                                <p className="text-sm text-surface-500">{sale.email}</p>
                              )}
                            </td>
                            <td className="py-3 px-4">
                              <p className="text-sm text-surface-900">{sale.ticketType || 'N/A'}</p>
                            </td>
                            <td className="py-3 px-4">
                              <p className="font-semibold text-brand-900">
                                ${(sale.amountPaid || 0).toFixed(2)}
                              </p>
                            </td>
                            <td className="py-3 px-4">
                              <span
                                className={cn(
                                  'inline-flex px-2 py-1 text-xs font-medium rounded',
                                  sale.paymentStatus === 'PAID'
                                    ? 'bg-emerald-100 text-emerald-800'
                                    : sale.paymentStatus === 'PENDING'
                                    ? 'bg-yellow-100 text-yellow-800'
                                    : 'bg-rose-100 text-rose-800'
                                )}
                              >
                                {sale.paymentStatus || 'N/A'}
                              </span>
                            </td>
                            <td className="py-3 px-4">
                              <p className="text-sm text-surface-600">
                                {formatDate(sale.submittedAt)}
                              </p>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>
            </>
          )}
        </div>
      )}

      {/* Gifts */}
      {activeTab === 'gifts' && (
        <div className="space-y-4">
          {loadingGifts ? (
            <div className="text-center py-12">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary-500 mx-auto" />
            </div>
          ) : (
            <>
              <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-4">
                <div className="bg-white rounded-xl border border-surface-200 p-5">
                  <p className="text-sm text-surface-500 mb-1">Gift Orders</p>
                  <p className="text-3xl font-bold text-brand-900">{giftSummary.orders}</p>
                </div>
                <div className="bg-white rounded-xl border border-surface-200 p-5">
                  <p className="text-sm text-surface-500 mb-1">Gross Gift Volume</p>
                  <p className="text-3xl font-bold text-brand-900">{giftCurrency} {giftSummary.gross.toFixed(2)}</p>
                </div>
                <div className="bg-white rounded-xl border border-surface-200 p-5">
                  <p className="text-sm text-surface-500 mb-1">Owner Net (Cash)</p>
                  <p className="text-3xl font-bold text-emerald-600">{giftCurrency} {giftSummary.ownerNet.toFixed(2)}</p>
                </div>
                <div className="bg-white rounded-xl border border-surface-200 p-5">
                  <p className="text-sm text-surface-500 mb-1">Admin Retained</p>
                  <p className="text-3xl font-bold text-brand-900">{giftCurrency} {giftSummary.adminRetained.toFixed(2)}</p>
                </div>
              </div>

              <div className="bg-white rounded-xl border border-surface-200 p-5">
                <PaymentGatewaySelector
                  eventId={eventId}
                  onUpdate={() => {
                    fetchEventGatewayCurrencies();
                    fetchGifts();
                  }}
                  title="Gift and Cash Collection Gateways"
                  description="Enable event gateways for public gift checkout and cash gifting. Currency options in gift package setup follow these gateway currencies."
                />
              </div>

              <div className="bg-white rounded-xl border border-surface-200 p-5 space-y-5">
                <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
                  <div>
                    <h3 className="text-lg font-semibold text-brand-900">Gift Packages for This Event</h3>
                    <p className="text-sm text-surface-500">
                      Admin controls which packages appear on the public gifting page for this event.
                    </p>
                  </div>
                  <button
                    className="btn-primary"
                    disabled={savingGiftAssignments}
                    onClick={handleSaveGiftAssignments}
                  >
                    {savingGiftAssignments ? 'Saving...' : 'Save Package Assignment'}
                  </button>
                </div>

                <div className="grid lg:grid-cols-3 gap-5">
                  <div className="lg:col-span-2">
                    <div className="rounded-xl border border-surface-200 overflow-hidden">
                      <table className="w-full">
                        <thead>
                          <tr className="border-b border-surface-200 bg-surface-50">
                            <th className="py-3 px-4 text-left text-xs font-medium text-surface-500 uppercase tracking-wider">Show</th>
                            <th className="py-3 px-4 text-left text-xs font-medium text-surface-500 uppercase tracking-wider">Package</th>
                            <th className="py-3 px-4 text-left text-xs font-medium text-surface-500 uppercase tracking-wider">Price</th>
                            <th className="py-3 px-4 text-left text-xs font-medium text-surface-500 uppercase tracking-wider">Status</th>
                            <th className="py-3 px-4 text-left text-xs font-medium text-surface-500 uppercase tracking-wider">Actions</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-surface-100">
                          {giftPackages.length === 0 ? (
                            <tr>
                              <td colSpan={5} className="px-4 py-8 text-center text-sm text-surface-500">
                                No gift packages yet. Create your first package.
                              </td>
                            </tr>
                          ) : (
                            giftPackages.map((pkg) => (
                              <tr key={pkg.id} className="hover:bg-surface-50">
                                <td className="py-3 px-4">
                                  <input
                                    type="checkbox"
                                    className="w-4 h-4 rounded border-surface-300 text-brand-900"
                                    checked={Boolean(pkg.assigned)}
                                    onChange={() => handleToggleGiftPackageAssignment(pkg.id)}
                                  />
                                </td>
                                <td className="py-3 px-4">
                                  <div className="flex items-start gap-3">
                                    <div className="w-14 h-14 rounded-lg border border-surface-200 bg-surface-100 overflow-hidden shrink-0">
                                      {pkg.thumbnailPath ? (
                                        <img
                                          src={resolveGiftThumbnailUrl(pkg.thumbnailPath) || ''}
                                          alt={pkg.name}
                                          className="w-full h-full object-cover"
                                        />
                                      ) : (
                                        <div className="w-full h-full flex items-center justify-center text-[10px] text-surface-400 font-medium">
                                          No image
                                        </div>
                                      )}
                                    </div>
                                    <div className="min-w-0">
                                      <p className="font-medium text-brand-900 truncate">{pkg.name}</p>
                                      {pkg.description ? <p className="text-xs text-surface-500 mt-1 line-clamp-2">{pkg.description}</p> : null}
                                    </div>
                                  </div>
                                </td>
                                <td className="py-3 px-4 text-sm text-surface-700">
                                  {pkg.currency} {Number(pkg.price || 0).toFixed(2)}
                                </td>
                                <td className="py-3 px-4">
                                  <span
                                    className={cn(
                                      'inline-flex px-2 py-0.5 rounded text-xs font-medium border',
                                      pkg.isActive
                                        ? 'bg-emerald-50 text-emerald-700 border-emerald-200'
                                        : 'bg-surface-100 text-surface-600 border-surface-200'
                                    )}
                                  >
                                    {pkg.isActive ? 'Active' : 'Disabled'}
                                  </span>
                                </td>
                                <td className="py-3 px-4">
                                  <button
                                    className="btn-ghost"
                                    onClick={() => handleToggleGiftPackageActive(pkg)}
                                  >
                                    {pkg.isActive ? 'Disable' : 'Enable'}
                                  </button>
                                </td>
                              </tr>
                            ))
                          )}
                        </tbody>
                      </table>
                    </div>
                  </div>

                  <div className="rounded-xl border border-surface-200 p-4 bg-surface-50 space-y-3">
                    <h4 className="font-semibold text-brand-900">Create Package</h4>
                    <input
                      className="input"
                      placeholder="Package name"
                      value={newGiftPackage.name}
                      onChange={(e) => setNewGiftPackage({ ...newGiftPackage, name: e.target.value })}
                    />
                    <textarea
                      className="input min-h-[88px]"
                      placeholder="Description (optional)"
                      value={newGiftPackage.description}
                      onChange={(e) => setNewGiftPackage({ ...newGiftPackage, description: e.target.value })}
                    />
                    <div className="space-y-2">
                      <label className="text-xs font-medium uppercase tracking-wide text-surface-500">
                        Package photo (optional)
                      </label>
                      <input
                        type="file"
                        accept="image/*"
                        className="input"
                        onChange={(e) => setNewGiftPackagePhoto(e.target.files?.[0] || null)}
                      />
                      {newGiftPackagePhoto ? (
                        <button
                          type="button"
                          className="text-xs font-medium text-rose-600 hover:text-rose-700"
                          onClick={() => setNewGiftPackagePhoto(null)}
                        >
                          Remove selected photo
                        </button>
                      ) : null}
                    </div>
                    {newGiftPackagePhotoPreview ? (
                      <div className="rounded-lg border border-surface-200 bg-white p-2">
                        <div className="text-xs text-surface-500 mb-2">Preview</div>
                        <div className="w-full h-36 rounded-md overflow-hidden bg-surface-100 border border-surface-200">
                          <img
                            src={newGiftPackagePhotoPreview}
                            alt="New package preview"
                            className="w-full h-full object-cover"
                          />
                        </div>
                      </div>
                    ) : null}
                    <div className="grid grid-cols-2 gap-3">
                      <input
                        type="number"
                        min={0}
                        step="0.01"
                        className="input"
                        placeholder="Price"
                        value={newGiftPackage.price}
                        onChange={(e) => setNewGiftPackage({ ...newGiftPackage, price: e.target.value })}
                      />
                      <select
                        className="input"
                        value={newGiftPackage.currency}
                        onChange={(e) => setNewGiftPackage({ ...newGiftPackage, currency: e.target.value.toUpperCase() })}
                      >
                        {availableEventCurrencies.map((currencyCode) => {
                          const currency = getCurrencyOption(currencyCode);
                          return (
                            <option key={currency.code} value={currency.code}>
                              {currency.code} - {currency.name}
                            </option>
                          );
                        })}
                      </select>
                    </div>
                    <p className="text-xs text-surface-500">
                      Package currency follows enabled event gateway currencies.
                    </p>
                    <button
                      className="btn-primary w-full justify-center"
                      disabled={savingGiftPackage}
                      onClick={handleCreateGiftPackage}
                    >
                      {savingGiftPackage ? 'Creating...' : 'Create Package'}
                    </button>
                  </div>
                </div>
              </div>

              <div className="bg-white rounded-xl border border-surface-200 overflow-hidden">
                <div className="px-6 py-4 border-b border-surface-200">
                  <h3 className="text-lg font-semibold text-brand-900">Gift Order Ledger</h3>
                  <p className="text-sm text-surface-500 mt-1">
                    Cash gifts route owner net after platform fee. Package purchases are retained by admin.
                  </p>
                </div>
                {giftOrders.length === 0 ? (
                  <div className="text-center py-12 text-surface-500 text-sm">No gift orders yet.</div>
                ) : (
                  <div className="overflow-x-auto">
                    <table className="w-full">
                      <thead>
                        <tr className="border-b border-surface-200 bg-surface-50">
                          <th className="text-left py-3 px-4 text-xs font-medium text-surface-500 uppercase tracking-wider">Guest</th>
                          <th className="text-left py-3 px-4 text-xs font-medium text-surface-500 uppercase tracking-wider">Gross</th>
                          <th className="text-left py-3 px-4 text-xs font-medium text-surface-500 uppercase tracking-wider">Cash</th>
                          <th className="text-left py-3 px-4 text-xs font-medium text-surface-500 uppercase tracking-wider">Packages</th>
                          <th className="text-left py-3 px-4 text-xs font-medium text-surface-500 uppercase tracking-wider">Owner Net</th>
                          <th className="text-left py-3 px-4 text-xs font-medium text-surface-500 uppercase tracking-wider">Admin Retained</th>
                          <th className="text-left py-3 px-4 text-xs font-medium text-surface-500 uppercase tracking-wider">Status</th>
                          <th className="text-left py-3 px-4 text-xs font-medium text-surface-500 uppercase tracking-wider">Date</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-surface-100">
                        {giftOrders.map((order) => (
                          <tr key={order.id} className="hover:bg-surface-50">
                            <td className="py-3 px-4">
                              <p className="font-medium text-brand-900">{order.guestName}</p>
                              <p className="text-xs text-surface-500">{order.guestEmail || order.guestPhone || 'No contact'}</p>
                            </td>
                            <td className="py-3 px-4 text-sm text-surface-700">
                              {order.currency} {Number(order.totalAmount || 0).toFixed(2)}
                            </td>
                            <td className="py-3 px-4 text-sm text-surface-700">
                              {order.currency} {Number(order.cashGiftAmount || 0).toFixed(2)}
                            </td>
                            <td className="py-3 px-4 text-sm text-surface-700">
                              {order.currency} {Number(order.packageAmount || 0).toFixed(2)}
                            </td>
                            <td className="py-3 px-4 text-sm font-semibold text-emerald-700">
                              {order.currency} {Number(order.ownerNetAmount || 0).toFixed(2)}
                            </td>
                            <td className="py-3 px-4 text-sm font-semibold text-brand-900">
                              {order.currency} {Number(order.adminRetainedAmount || 0).toFixed(2)}
                            </td>
                            <td className="py-3 px-4">
                              <span
                                className={cn(
                                  'inline-flex px-2 py-0.5 rounded text-xs font-medium border',
                                  order.status === 'PAID'
                                    ? 'bg-emerald-50 text-emerald-700 border-emerald-200'
                                    : 'bg-amber-50 text-amber-700 border-amber-200'
                                )}
                              >
                                {order.status}
                              </span>
                            </td>
                            <td className="py-3 px-4 text-sm text-surface-500">{formatDate(order.createdAt)}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>
            </>
          )}
        </div>
      )}

      {/* Settings */}
      {activeTab === 'settings' && (
        <div className="bg-white rounded-xl border border-surface-200 p-6">
          <div className="flex items-center justify-between mb-6">
            <h3 className="text-lg font-semibold text-brand-900">Event Settings</h3>
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
                <h4 className="font-medium text-brand-900 mb-4">Social Metadata & Cover</h4>
                <div className="grid sm:grid-cols-2 gap-4">
                  <div>
                    <label className="label">Social Title</label>
                    <input
                      type="text"
                      className="input"
                      placeholder="Title for social cards"
                      value={eventSettings.socialTitle}
                      onChange={(e) => setEventSettings({ ...eventSettings, socialTitle: e.target.value })}
                    />
                  </div>
                  <div>
                    <label className="label">Cover Alt Text</label>
                    <input
                      type="text"
                      className="input"
                      placeholder="Describe the cover image"
                      value={eventSettings.coverImageAlt}
                      onChange={(e) => setEventSettings({ ...eventSettings, coverImageAlt: e.target.value })}
                    />
                  </div>
                  <div className="sm:col-span-2">
                    <label className="label">Social Description</label>
                    <textarea
                      rows={2}
                      className="input"
                      placeholder="Description shown on social shares"
                      value={eventSettings.socialDescription}
                      onChange={(e) => setEventSettings({ ...eventSettings, socialDescription: e.target.value })}
                    />
                  </div>
                  <div className="sm:col-span-2">
                    <label className="label">Cover Image Upload</label>
                    <div className="flex flex-col sm:flex-row gap-3">
                      <input
                        type="file"
                        accept="image/jpeg,image/png,image/webp"
                        className="input flex-1"
                        onChange={(e) => setCoverFile(e.target.files?.[0] || null)}
                      />
                      <button
                        type="button"
                        className="btn-outline"
                        disabled={!coverFile || uploadingCover}
                        onClick={handleUploadCover}
                      >
                        {uploadingCover ? 'Uploading...' : 'Upload Cover'}
                      </button>
                      {event.coverImagePath && (
                        <button
                          type="button"
                          className="btn-ghost text-red-600 hover:text-red-700"
                          onClick={handleDeleteCover}
                        >
                          Remove Cover
                        </button>
                      )}
                    </div>
                    <p className="text-xs text-surface-500 mt-2">
                      Use JPG/PNG/WEBP, minimum 800x420 (recommended 2000px wide). Covers are auto-cropped to 1200x630 for social sharing.
                    </p>
                  </div>
                </div>

                <div className="mt-5 rounded-xl border border-surface-200 bg-white overflow-hidden">
                  <div className="aspect-[1200/630] bg-surface-100">
                    {event.coverImageUrl ? (
                      <img src={event.coverImageUrl} alt={event.coverImageAlt || event.name} className="w-full h-full object-cover" />
                    ) : (
                      <div className="w-full h-full bg-gradient-to-br from-brand-900 to-brand-700" />
                    )}
                  </div>
                  <div className="p-4">
                    <p className="text-xs uppercase tracking-wider text-surface-500 font-semibold">Live Social Preview</p>
                    <p className="font-semibold text-brand-900 mt-1">{eventSettings.socialTitle || eventSettings.name || 'Untitled Event'}</p>
                    <p className="text-sm text-surface-600 mt-1">{eventSettings.socialDescription || eventSettings.description || 'No social description set.'}</p>
                  </div>
                </div>
              </div>
              
              <div className="border-t border-surface-100 pt-6">
                <h4 className="font-medium text-brand-900 mb-4">Event Owner</h4>
                <p className="text-sm text-surface-500 mb-4">Assign an owner account or enter contact information. Notifications will be sent to this contact.</p>
                
                <div className="mb-4">
                  <label className="label">Select Owner Account</label>
                  <div className="flex gap-2">
                    <select 
                      className="input flex-1" 
                      value={eventSettings.ownerId || ''} 
                      onChange={e => {
                        const ownerId = e.target.value;
                        if (ownerId) {
                          const owner = owners.find(o => o.id === ownerId);
                          if (owner) {
                            setEventSettings({ 
                              ...eventSettings, 
                              ownerId, 
                              ownerName: owner.name, 
                              ownerEmail: owner.email, 
                              ownerPhone: owner.phone || '', 
                              organizationName: owner.company || '' 
                            });
                          }
                        } else {
                          setEventSettings({ ...eventSettings, ownerId: '' });
                        }
                      }}
                    >
                      <option value="">No owner account (use contact info below)</option>
                      {owners.map(o => (
                        <option key={o.id} value={o.id}>{o.name} {o.email && `(${o.email})`}</option>
                      ))}
                    </select>
                    <button
                      type="button"
                      onClick={() => setShowNewOwnerForm(!showNewOwnerForm)}
                      className="px-4 py-2 bg-surface-100 hover:bg-surface-200 text-surface-700 rounded-lg text-sm font-medium transition-colors"
                    >
                      {showNewOwnerForm ? 'Cancel' : '+ New Owner'}
                    </button>
                  </div>
                </div>

                {showNewOwnerForm && (
                  <div className="mb-4 p-4 bg-surface-50 rounded-lg border border-surface-200">
                    <h5 className="font-medium text-brand-900 mb-3">Create New Owner</h5>
                    <div className="grid sm:grid-cols-2 gap-3">
                      <div><label className="label text-xs">Name *</label><input type="text" className="input text-sm" placeholder="John Smith" value={newOwner.name} onChange={e => setNewOwner({ ...newOwner, name: e.target.value })} /></div>
                      <div><label className="label text-xs">Email *</label><input type="email" className="input text-sm" placeholder="owner@example.com" value={newOwner.email} onChange={e => setNewOwner({ ...newOwner, email: e.target.value })} /></div>
                      <div><label className="label text-xs">Phone</label><input type="tel" className="input text-sm" placeholder="+1234567890" value={newOwner.phone} onChange={e => setNewOwner({ ...newOwner, phone: e.target.value })} /></div>
                      <div><label className="label text-xs">Company</label><input type="text" className="input text-sm" placeholder="Company Name" value={newOwner.company} onChange={e => setNewOwner({ ...newOwner, company: e.target.value })} /></div>
                    </div>
                    <button
                      type="button"
                      onClick={handleCreateOwner}
                      className="mt-3 px-4 py-2 bg-brand-900 hover:bg-brand-800 text-white rounded-lg text-sm font-medium transition-colors"
                    >
                      Create Owner
                    </button>
                  </div>
                )}

                <div className="grid sm:grid-cols-2 gap-4">
                  <div><label className="label">Owner Name</label><input type="text" className="input" placeholder="e.g., John Smith" value={eventSettings.ownerName} onChange={e => setEventSettings({ ...eventSettings, ownerName: e.target.value })} /></div>
                  <div><label className="label">Organization</label><input type="text" className="input" placeholder="e.g., Smith Events" value={eventSettings.organizationName} onChange={e => setEventSettings({ ...eventSettings, organizationName: e.target.value })} /></div>
                  <div><label className="label">Email</label><input type="email" className="input" placeholder="owner@example.com" value={eventSettings.ownerEmail} onChange={e => setEventSettings({ ...eventSettings, ownerEmail: e.target.value })} /></div>
                  <div><label className="label">Phone</label><input type="tel" className="input" placeholder="+1234567890" value={eventSettings.ownerPhone} onChange={e => setEventSettings({ ...eventSettings, ownerPhone: e.target.value })} /></div>
                </div>
              </div>

              <div className="border-t border-surface-100 pt-6">
                <h4 className="font-medium text-brand-900 mb-4">Event Colors</h4>
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
                <h4 className="font-medium text-brand-900 mb-4">Event Features</h4>
                <p className="text-sm text-surface-500 mb-4">Enable or disable specific event features.</p>
                <div className="grid sm:grid-cols-2 gap-3">
                  <label className="flex items-center gap-3 cursor-pointer p-3 rounded-lg border border-surface-200 hover:bg-surface-50 transition-colors">
                    <input type="checkbox" className="w-5 h-5 rounded border-surface-300 text-brand-900" checked={eventSettings.invitationEnabled} onChange={e => setEventSettings({ ...eventSettings, invitationEnabled: e.target.checked })} />
                    <div><span className="font-medium text-brand-900">Invitations</span><p className="text-xs text-surface-500">Digital invitation passes</p></div>
                  </label>
                  <label className="flex items-center gap-3 cursor-pointer p-3 rounded-lg border border-surface-200 hover:bg-surface-50 transition-colors">
                    <input type="checkbox" className="w-5 h-5 rounded border-surface-300 text-brand-900" checked={eventSettings.rsvpEnabled} onChange={e => {
                      const enabled = e.target.checked;
                      setEventSettings({ 
                        ...eventSettings, 
                        rsvpEnabled: enabled,
                        // Reset RSVP mode when disabled
                        rsvpMode: enabled ? eventSettings.rsvpMode : 'free',
                        ticketingEnabled: enabled && eventSettings.rsvpMode === 'paid'
                      });
                    }} />
                    <div><span className="font-medium text-brand-900">RSVP</span><p className="text-xs text-surface-500">Guest response collection {eventSettings.invitationOnly ? '(Mandatory when invitation-only)' : '(Optional)'}</p></div>
                  </label>
                  <label className="flex items-center gap-3 cursor-pointer p-3 rounded-lg border border-surface-200 hover:bg-surface-50 transition-colors">
                    <input type="checkbox" className="w-5 h-5 rounded border-surface-300 text-brand-900" checked={eventSettings.guestbookEnabled} onChange={e => setEventSettings({ ...eventSettings, guestbookEnabled: e.target.checked })} />
                    <div><span className="font-medium text-brand-900">Guestbook</span><p className="text-xs text-surface-500">Video, audio, photo messages</p></div>
                  </label>
                  <label className={`flex items-center gap-3 cursor-pointer p-3 rounded-lg border border-surface-200 hover:bg-surface-50 transition-colors ${eventSettings.invitationOnly ? '' : 'opacity-50 cursor-not-allowed'}`}>
                    <input 
                      type="checkbox" 
                      className="w-5 h-5 rounded border-surface-300 text-brand-900" 
                      checked={eventSettings.checkInEnabled && eventSettings.invitationOnly} 
                      disabled={!eventSettings.invitationOnly}
                      onChange={e => setEventSettings({ ...eventSettings, checkInEnabled: e.target.checked })} 
                    />
                    <div>
                      <span className="font-medium text-brand-900">Check-in</span>
                      <p className="text-xs text-surface-500">
                        {eventSettings.invitationOnly 
                          ? 'Guest arrival tracking' 
                          : 'Only available for invitation-only events'}
                      </p>
                    </div>
                  </label>
                </div>
              </div>

              {/* RSVP Mode */}
              {eventSettings.rsvpEnabled && (
                <div className="border-t border-surface-100 pt-6">
                  <h4 className="font-medium text-brand-900 mb-4">RSVP Mode</h4>
                  <p className="text-sm text-surface-500 mb-4">
                    {eventSettings.invitationOnly 
                      ? 'RSVP is mandatory. Choose whether RSVPs are free or require ticket purchases.' 
                      : 'RSVP is optional. Choose whether RSVPs are free or require ticket purchases. Guests can access other features without RSVP.'}
                  </p>
                  <div className="grid sm:grid-cols-2 gap-3 mb-4">
                    <label className={`flex items-center gap-3 cursor-pointer p-4 rounded-lg border-2 transition-colors ${eventSettings.rsvpMode === 'free' ? 'border-brand-900 bg-brand-50' : 'border-surface-200 hover:bg-surface-50'}`}>
                      <input type="radio" name="rsvpMode" value="free" checked={eventSettings.rsvpMode === 'free'} onChange={() => setEventSettings({ ...eventSettings, rsvpMode: 'free' })} className="sr-only" />
                      <div className={`w-5 h-5 rounded-full border-2 flex items-center justify-center ${eventSettings.rsvpMode === 'free' ? 'border-brand-900' : 'border-surface-300'}`}>
                        {eventSettings.rsvpMode === 'free' && <div className="w-2.5 h-2.5 rounded-full bg-brand-900" />}
                      </div>
                      <div>
                        <span className="font-medium text-brand-900">Free RSVP</span>
                        <p className="text-xs text-surface-500">Guests can RSVP without payment</p>
                      </div>
                    </label>
                    <label className={`flex items-center gap-3 cursor-pointer p-4 rounded-lg border-2 transition-colors ${eventSettings.rsvpMode === 'paid' ? 'border-brand-900 bg-brand-50' : 'border-surface-200 hover:bg-surface-50'}`}>
                      <input type="radio" name="rsvpMode" value="paid" checked={eventSettings.rsvpMode === 'paid'} onChange={() => setEventSettings({ ...eventSettings, rsvpMode: 'paid', ticketingEnabled: true })} className="sr-only" />
                      <div className={`w-5 h-5 rounded-full border-2 flex items-center justify-center ${eventSettings.rsvpMode === 'paid' ? 'border-brand-900' : 'border-surface-300'}`}>
                        {eventSettings.rsvpMode === 'paid' && <div className="w-2.5 h-2.5 rounded-full bg-brand-900" />}
                      </div>
                      <div>
                        <span className="font-medium text-brand-900">Paid RSVP (Ticketing)</span>
                        <p className="text-xs text-surface-500">Guests purchase tickets to RSVP</p>
                      </div>
                    </label>
                  </div>

                </div>
              )}

              {(eventSettings.giftingEnabled || (eventSettings.rsvpEnabled && eventSettings.rsvpMode === 'paid')) && (
                <div className="border-t border-surface-100 pt-6">
                  <h4 className="font-medium text-brand-900 mb-4">Commerce Fees</h4>
                  <div className="bg-surface-50 rounded-lg p-4 space-y-4">
                    <p className="text-xs text-surface-500">
                      These fees apply to enabled paid flows:
                      {(eventSettings.rsvpEnabled && eventSettings.rsvpMode === 'paid') ? ' ticketing' : ''}
                      {(eventSettings.rsvpEnabled && eventSettings.rsvpMode === 'paid' && eventSettings.giftingEnabled) ? ' and ' : ''}
                      {eventSettings.giftingEnabled ? 'gifting' : ''}.
                    </p>
                    <label className="flex items-center gap-3 cursor-pointer p-3 rounded-lg border border-surface-200 bg-white">
                      <input
                        type="checkbox"
                        className="w-4 h-4 rounded border-surface-300 text-brand-900"
                        checked={!eventSettings.feeOverridesEnabled}
                        onChange={(e) =>
                          setEventSettings({
                            ...eventSettings,
                            feeOverridesEnabled: !e.target.checked,
                          })
                        }
                      />
                      <div>
                        <p className="text-sm font-medium text-brand-900">Use system default fees for this event</p>
                        <p className="text-xs text-surface-500">Turn off to set custom fee values only for this event.</p>
                      </div>
                    </label>

                    {!eventSettings.feeOverridesEnabled ? (
                      <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-4">
                        <div className="bg-white border border-surface-200 rounded-lg p-3">
                          <p className="text-xs text-surface-500 mb-1">Default Platform Mode</p>
                          <p className="text-sm font-semibold text-brand-900">{defaultFeeSettings.platformFeeMode}</p>
                        </div>
                        <div className="bg-white border border-surface-200 rounded-lg p-3">
                          <p className="text-xs text-surface-500 mb-1">
                            {defaultFeeSettings.platformFeeMode === 'FIXED' ? `Default Platform Fee (${primaryEventCurrency})` : 'Default Platform Fee (%)'}
                          </p>
                          <p className="text-sm font-semibold text-brand-900">
                            {defaultFeeSettings.platformFeeMode === 'FIXED'
                              ? defaultFeeSettings.platformFeeFixed
                              : defaultFeeSettings.platformFeePercent}
                          </p>
                        </div>
                        <div className="bg-white border border-surface-200 rounded-lg p-3">
                          <p className="text-xs text-surface-500 mb-1">Default Processing Fee (%)</p>
                          <p className="text-sm font-semibold text-brand-900">{defaultFeeSettings.processingFeePercent}</p>
                        </div>
                        <div className="bg-white border border-surface-200 rounded-lg p-3">
                          <p className="text-xs text-surface-500 mb-1">Default Fixed Fee ({primaryEventCurrency})</p>
                          <p className="text-sm font-semibold text-brand-900">{defaultFeeSettings.processingFeeFixed}</p>
                        </div>
                      </div>
                    ) : (
                      <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-4">
                        <div>
                          <label className="block text-xs font-medium text-surface-600 mb-1">Platform Fee Mode</label>
                          <select
                            value={eventSettings.platformFeeMode}
                            onChange={(e) =>
                              setEventSettings({
                                ...eventSettings,
                                platformFeeMode: e.target.value as 'PERCENTAGE' | 'FIXED',
                              })
                            }
                            className="w-full px-3 py-2 text-sm border border-surface-200 rounded-lg focus:ring-2 focus:ring-brand-500"
                          >
                            <option value="PERCENTAGE">Percentage</option>
                            <option value="FIXED">Fixed Amount</option>
                          </select>
                        </div>
                        <div>
                          <label className="block text-xs font-medium text-surface-600 mb-1">
                            {eventSettings.platformFeeMode === 'FIXED' ? `Platform Fee (${primaryEventCurrency})` : 'Platform Fee (%)'}
                          </label>
                          <input
                            type="number"
                            step={eventSettings.platformFeeMode === 'FIXED' ? '0.01' : '0.1'}
                            min="0"
                            max={eventSettings.platformFeeMode === 'FIXED' ? undefined : '100'}
                            value={
                              eventSettings.platformFeeMode === 'FIXED'
                                ? eventSettings.platformFeeFixed ?? 0
                                : eventSettings.platformFeePercent
                            }
                            onChange={(e) =>
                              setEventSettings({
                                ...eventSettings,
                                platformFeePercent:
                                  eventSettings.platformFeeMode === 'PERCENTAGE'
                                    ? parseFloat(e.target.value) || 0
                                    : eventSettings.platformFeePercent,
                                platformFeeFixed:
                                  eventSettings.platformFeeMode === 'FIXED'
                                    ? parseFloat(e.target.value) || 0
                                    : eventSettings.platformFeeFixed,
                              })
                            }
                            className="w-full px-3 py-2 text-sm border border-surface-200 rounded-lg focus:ring-2 focus:ring-brand-500"
                          />
                        </div>
                        <div>
                          <label className="block text-xs font-medium text-surface-600 mb-1">Processing Fee (%)</label>
                          <input
                            type="number"
                            step="0.1"
                            min="0"
                            max="100"
                            value={eventSettings.processingFeePercent}
                            onChange={(e) => setEventSettings({ ...eventSettings, processingFeePercent: parseFloat(e.target.value) || 0 })}
                            className="w-full px-3 py-2 text-sm border border-surface-200 rounded-lg focus:ring-2 focus:ring-brand-500"
                          />
                        </div>
                        <div>
                          <label className="block text-xs font-medium text-surface-600 mb-1">
                            Fixed Fee ({primaryEventCurrency})
                          </label>
                          <input
                            type="number"
                            step="0.01"
                            min="0"
                            value={eventSettings.processingFeeFixed}
                            onChange={(e) => setEventSettings({ ...eventSettings, processingFeeFixed: parseFloat(e.target.value) || 0 })}
                            className="w-full px-3 py-2 text-sm border border-surface-200 rounded-lg focus:ring-2 focus:ring-brand-500"
                          />
                        </div>
                      </div>
                    )}
                    {eventSettings.rsvpEnabled && eventSettings.rsvpMode === 'paid' ? (
                      <p className="text-xs text-surface-500">Manage ticket types in the Ticketing section after saving.</p>
                    ) : null}
                  </div>
                </div>
              )}

              <div className="border-t border-surface-100 pt-6">
                <h4 className="font-medium text-brand-900 mb-4">Access & Options</h4>
                <div className="space-y-3">
                  <label className="flex items-center gap-3 cursor-pointer p-3 rounded-lg hover:bg-surface-50 transition-colors">
                    <input 
                      type="checkbox" 
                      className="w-5 h-5 rounded border-surface-300 text-brand-900" 
                      checked={eventSettings.invitationOnly} 
                      onChange={e => {
                        const invitationOnly = e.target.checked;
                        setEventSettings({ 
                          ...eventSettings, 
                          invitationOnly,
                          // Disable check-in when invitation-only is unchecked
                          checkInEnabled: invitationOnly ? eventSettings.checkInEnabled : false
                        });
                      }} 
                    />
                    <div><span className="font-medium text-brand-900">Invitation Only</span><p className="text-sm text-surface-500">Guests must be approved before accessing event features</p></div>
                  </label>
                  <label className="flex items-center gap-3 cursor-pointer p-3 rounded-lg hover:bg-surface-50 transition-colors">
                    <input type="checkbox" className="w-5 h-5 rounded border-surface-300 text-brand-900" checked={eventSettings.reelEnabled} onChange={e => setEventSettings({ ...eventSettings, reelEnabled: e.target.checked })} />
                    <div><span className="font-medium text-brand-900">Enable Reel Generation</span><p className="text-sm text-surface-500">Allow generating video compilations from guest videos</p></div>
                  </label>
                  <label className="flex items-center gap-3 cursor-pointer p-3 rounded-lg hover:bg-surface-50 transition-colors">
                    <input type="checkbox" className="w-5 h-5 rounded border-surface-300 text-brand-900" checked={eventSettings.strictInviteOnly} onChange={e => setEventSettings({ ...eventSettings, strictInviteOnly: e.target.checked })} />
                    <div><span className="font-medium text-brand-900">Strict Invite Mode</span><p className="text-sm text-surface-500">Public RSVP requires valid invite token context.</p></div>
                  </label>
                  <label className="flex items-center gap-3 cursor-pointer p-3 rounded-lg hover:bg-surface-50 transition-colors">
                    <input type="checkbox" className="w-5 h-5 rounded border-surface-300 text-brand-900" checked={eventSettings.itineraryEnabled} onChange={e => setEventSettings({ ...eventSettings, itineraryEnabled: e.target.checked })} />
                    <div><span className="font-medium text-brand-900">Enable Itinerary</span><p className="text-sm text-surface-500">Guests can follow schedule progress; MC can control completion.</p></div>
                  </label>
                  <label className="flex items-center gap-3 cursor-pointer p-3 rounded-lg hover:bg-surface-50 transition-colors">
                    <input type="checkbox" className="w-5 h-5 rounded border-surface-300 text-brand-900" checked={eventSettings.giftingEnabled} onChange={e => setEventSettings({ ...eventSettings, giftingEnabled: e.target.checked })} />
                    <div><span className="font-medium text-brand-900">Enable Gifting</span><p className="text-sm text-surface-500">Allow MoMo cash gifts and gift package checkout for this event.</p></div>
                  </label>
                </div>
              </div>

              <div className="border-t border-surface-100 pt-6">
                <h4 className="font-medium text-brand-900 mb-4">Custom Domains</h4>
                <p className="text-sm text-surface-500 mb-4">Map client-owned domains to this event. Verification requires TXT + CNAME records.</p>

                <div className="flex flex-col sm:flex-row gap-3">
                  <input
                    type="text"
                    className="input flex-1"
                    placeholder="e.g. wedding.example.com"
                    value={domainHost}
                    onChange={(e) => setDomainHost(e.target.value)}
                  />
                  <button
                    type="button"
                    className="btn-primary"
                    disabled={savingDomain}
                    onClick={handleAddDomain}
                  >
                    {savingDomain ? 'Adding...' : 'Add Domain'}
                  </button>
                </div>

                <div className="mt-4 space-y-3">
                  {domains.length === 0 ? (
                    <div className="rounded-lg border border-dashed border-surface-300 bg-surface-50 px-4 py-5 text-sm text-surface-500">
                      No domains connected yet.
                    </div>
                  ) : (
                    domains.map((domain) => (
                      <div key={domain.id} className="rounded-xl border border-surface-200 p-4 bg-white">
                        <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-3">
                          <div>
                            <div className="flex items-center gap-2 flex-wrap">
                              <span className="font-semibold text-brand-900">{domain.host}</span>
                              {domain.isPrimary && <span className="px-2 py-0.5 rounded text-xs font-medium bg-brand-100 text-brand-700">Primary</span>}
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
                            <button type="button" className="btn-outline" onClick={() => handleVerifyDomain(domain.id)}>
                              Verify
                            </button>
                            {!domain.isPrimary && (
                              <button
                                type="button"
                                className="btn-outline"
                                onClick={() => handleSetPrimaryDomain(domain.id)}
                                disabled={!['VERIFIED', 'ACTIVE'].includes(domain.status)}
                              >
                                Make Primary
                              </button>
                            )}
                            <button type="button" className="btn-ghost text-rose-600 hover:text-rose-700" onClick={() => handleDeleteDomain(domain.id)}>
                              Remove
                            </button>
                          </div>
                        </div>
                        {domain.verificationNotes && (
                          <p className="mt-2 text-xs text-rose-600">{domain.verificationNotes}</p>
                        )}
                      </div>
                    ))
                  )}
                </div>
              </div>

              <div className="border-t border-surface-100 pt-6">
                <h4 className="font-medium text-brand-900 mb-4">Notifications</h4>
                <div className="space-y-4">
                  <div>
                    <p className="text-sm text-surface-600 mb-3">Send notifications when:</p>
                    <div className="grid sm:grid-cols-3 gap-3">
                      <label className="flex items-center gap-2 p-3 rounded-lg border border-surface-200 hover:bg-surface-50 cursor-pointer">
                        <input type="checkbox" className="w-4 h-4 rounded border-surface-300 text-brand-900" checked={eventSettings.notifyOnRsvp} onChange={e => setEventSettings({ ...eventSettings, notifyOnRsvp: e.target.checked })} />
                        <span className="text-sm font-medium">New RSVP</span>
                      </label>
                      <label className="flex items-center gap-2 p-3 rounded-lg border border-surface-200 hover:bg-surface-50 cursor-pointer">
                        <input type="checkbox" className="w-4 h-4 rounded border-surface-300 text-brand-900" checked={eventSettings.notifyOnCheckIn} onChange={e => setEventSettings({ ...eventSettings, notifyOnCheckIn: e.target.checked })} />
                        <span className="text-sm font-medium">Guest Check-in</span>
                      </label>
                      <label className="flex items-center gap-2 p-3 rounded-lg border border-surface-200 hover:bg-surface-50 cursor-pointer">
                        <input type="checkbox" className="w-4 h-4 rounded border-surface-300 text-brand-900" checked={eventSettings.notifyOnGuestbook} onChange={e => setEventSettings({ ...eventSettings, notifyOnGuestbook: e.target.checked })} />
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
                <h4 className="font-medium text-brand-900 mb-4">Guestbook Limits</h4>
                <div className="grid sm:grid-cols-3 gap-4">
                  <div><label className="label">Min Recording (sec)</label><input type="number" min="10" max="60" className="input" value={eventSettings.minRecordingDuration} onChange={e => setEventSettings({ ...eventSettings, minRecordingDuration: parseInt(e.target.value) })} /></div>
                  <div><label className="label">Max Recording (sec)</label><input type="number" min="30" max="300" className="input" value={eventSettings.maxRecordingDuration} onChange={e => setEventSettings({ ...eventSettings, maxRecordingDuration: parseInt(e.target.value) })} /></div>
                  <div><label className="label">Max Photos/Guest</label><input type="number" min="1" max="20" className="input" value={eventSettings.maxPhotosPerGuest} onChange={e => setEventSettings({ ...eventSettings, maxPhotosPerGuest: parseInt(e.target.value) })} /></div>
                </div>
              </div>

              <div className="border-t border-surface-100 pt-6">
                <h4 className="font-medium text-brand-900 mb-4">Booth/Kiosk Settings</h4>
                <p className="text-sm text-surface-500 mb-4">Configure the photo booth experience for guests.</p>
                <div className="grid sm:grid-cols-2 gap-4">
                  <div><label className="label">Max Photos Per Session</label><input type="number" min="1" max="50" className="input" value={eventSettings.maxPhotosPerBoothSession} onChange={e => setEventSettings({ ...eventSettings, maxPhotosPerBoothSession: parseInt(e.target.value) || 10 })} /></div>
                  <div><label className="label">Shutter Countdown (sec)</label><input type="number" min="1" max="10" className="input" value={eventSettings.boothShutterCountdown} onChange={e => setEventSettings({ ...eventSettings, boothShutterCountdown: parseInt(e.target.value) || 3 })} /></div>
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
                    <span className="font-medium text-brand-900">{r.v}</span>
                  </div>
                ))}
              </div>
              <div className="space-y-3">
                {[
                  { l: 'Invitation Only', v: event.invitationOnly ? 'Yes' : 'No' },
                  { l: 'Strict Invite Mode', v: event.strictInviteOnly ? 'Enabled' : 'Disabled' },
                  { l: 'Itinerary', v: event.itineraryEnabled ? 'Enabled' : 'Disabled' },
                  { l: 'Gifting', v: event.giftingEnabled ? 'Enabled' : 'Disabled' },
                  { l: 'Reel Generation', v: event.reelEnabled ? 'Enabled' : 'Disabled' },
                  { l: 'Recording Limits', v: `${event.minRecordingDuration}s – ${event.maxRecordingDuration}s` },
                  { l: 'Max Photos/Guest', v: event.maxPhotosPerGuest },
                  { l: 'Custom Domains', v: domains.length || 0 },
                ].map((r, i) => (
                  <div key={i} className="flex justify-between py-2 border-b border-surface-100 last:border-0">
                    <span className="text-surface-500">{r.l}</span>
                    <span className="font-medium text-brand-900">{r.v}</span>
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
