'use client';

import { useEffect, useMemo, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import Link from 'next/link';
import { eventsApi, rsvpApi, templatesApi, mediaApi, checkInApi, ticketingApi, ownersApi, adminApi, giftingApi, itineraryApi, paymentGatewaysApi, adminVotingApi, API_BASE_URL } from '@/lib/api';
import MediaGallery from '@/components/media/MediaGallery';
import TicketsTab from '@/components/tickets/TicketsTab';
import PaymentGatewaySelector from '@/components/tickets/PaymentGatewaySelector';
import { formatDate, formatCount, getPhaseLabel, getPhaseTone, getStatusTone, getErrorMessage, humanizeEnum, cn, copyToClipboard, resolvePublicAssetUrl, getEventPublicUrl, pickLiveEventDomain, toAbsoluteAppUrl } from '@/lib/utils';
import {
  CopyButton,
  DetailRow,
  EmptyState,
  ListSkeleton,
  PageHeader,
  Panel,
  PublicPageRow,
  ShareButton,
  SegmentedControl,
  StatRow,
  StatRowSkeleton,
  StatusBadge,
  SubmitButton,
  Thumb,
  Switch,
  Tabs,
  Td,
  Th,
  Toolbar,
} from '@/components/ui/Primitives';
import { ConfirmDialog, Menu, MenuItem, Modal } from '@/components/ui/Overlay';
import { ExternalLink } from '@/components/ui/icons';
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
  defaultCurrency?: string;
  currentPhase: string;
  phaseOverride: boolean;
  invitationOnly: boolean;
  strictInviteOnly: boolean;
  itineraryEnabled: boolean;
  giftingEnabled: boolean;
  giftItemsEnabled?: boolean;
  cashGiftsEnabled?: boolean;
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
  votingPageTemplateId?: string | null;
  nominationPageTemplateId?: string | null;
  nomineesPageTemplateId?: string | null;
  leaderboardPageTemplateId?: string | null;
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
  /** Null means unlimited. */
  stockQuantity?: number | null;
  soldQuantity?: number;
  remainingStock?: number | null;
  assigned?: boolean;
}

interface GiftOrderItem {
  id: string;
  type: 'CASH' | 'PACKAGE' | string;
  quantity: number;
  unitPrice: number;
  lineTotal: number;
  giftPackage?: { id: string; name: string } | null;
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
  // Returned by the API all along; the list simply never showed them.
  items?: GiftOrderItem[];
  note?: string | null;
  deliveryDate?: string | null;
  paymentMethod?: string | null;
  paymentReference?: string | null;
  payoutRouting?: string | null;
  platformFeeAmount?: number;
  processingFeeAmount?: number;
}

type Tab = 'overview' | 'rsvps' | 'checkin' | 'media' | 'templates' | 'tickets' | 'itinerary' | 'formFields' | 'sales' | 'gifts' | 'voting' | 'settings';


const formatCurrency = (amount: number | null | undefined, currency?: string | null) => {
  const value = Number(amount || 0);
  if (!Number.isFinite(value)) return '-';
  const code = (currency || 'USD').toUpperCase();
  try {
    return new Intl.NumberFormat('en-US', { style: 'currency', currency: code }).format(value);
  } catch {
    return `${code} ${value.toFixed(2)}`;
  }
};

/** RSVP custom fields arrive as a JSON string that may be absent or invalid. */
function parseCustomFields(value: string | null | undefined): Record<string, unknown> {
  if (!value) return {};
  try {
    const parsed = JSON.parse(value);
    return parsed && typeof parsed === 'object' && !Array.isArray(parsed) ? parsed : {};
  } catch {
    return {};
  }
}

/** One template slot: the page it drives, and which design it uses. */
function TemplateAssignRow({
  label,
  enabled,
  value,
  options,
  onChange,
}: {
  label: string;
  enabled: boolean;
  value: string;
  options: Array<{ id: string; name: string; isDefault: boolean }>;
  onChange: (value: string) => void;
}) {
  const id = `template-${label.replace(/s+/g, '-').toLowerCase()}`;
  return (
    <div className="flex flex-col gap-2 px-4 py-3 sm:flex-row sm:items-center sm:gap-4 sm:px-5">
      <div className="flex min-w-0 flex-1 items-center gap-2">
        <label htmlFor={id} className="truncate text-sm font-medium text-surface-900">
          {label}
        </label>
        {enabled ? null : <StatusBadge tone="neutral">Off</StatusBadge>}
      </div>
      <select
        id={id}
        className="input input-sm sm:max-w-xs"
        value={value}
        onChange={(event) => onChange(event.target.value)}
        disabled={!enabled}
      >
        <option value="">Default design</option>
        {options.map((option) => (
          <option key={option.id} value={option.id}>
            {option.name}
            {option.isDefault ? ' (default)' : ''}
          </option>
        ))}
      </select>
    </div>
  );
}

const FIELD_TYPE_LABELS: Record<string, string> = {
  text: 'Short text',
  textarea: 'Long text',
  email: 'Email',
  phone: 'Phone',
  number: 'Number',
  date: 'Date',
  select: 'Dropdown',
  radio: 'Single choice',
  checkbox: 'Checkbox',
};

/** Derive a stable storage key from a human question. */
function toFieldName(label: string): string {
  return label
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '_')
    .replace(/^_+|_+$/g, '')
    .slice(0, 40);
}

/** Collapsible settings group. Only the essentials are open by default. */
function SettingsSection({
  title,
  defaultOpen,
  children,
}: {
  title: string;
  defaultOpen?: boolean;
  children: React.ReactNode;
}) {
  const [open, setOpen] = useState(Boolean(defaultOpen));
  return (
    <section className="panel">
      <button
        type="button"
        onClick={() => setOpen((value) => !value)}
        aria-expanded={open}
        className="flex w-full items-center justify-between gap-3 px-4 py-3 text-left transition-colors hover:bg-surface-50 sm:px-5"
      >
        <span className="panel-title">{title}</span>
        <svg
          className={cn('h-5 w-5 shrink-0 text-surface-500 transition-transform', open && 'rotate-180')}
          fill="none"
          viewBox="0 0 24 24"
          stroke="currentColor"
          aria-hidden="true"
        >
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.8} d="m6 9 6 6 6-6" />
        </svg>
      </button>
      {open ? <div className="border-t border-surface-200 p-4 sm:p-5">{children}</div> : null}
    </section>
  );
}

const siteOrigin = typeof window !== 'undefined' ? window.location.origin : '';

export default function EventDetailPage() {
  const params = useParams();
  const router = useRouter();
  const eventId = params.id as string;
  const resolveGiftThumbnailUrl = (path: string | null | undefined) => resolvePublicAssetUrl(path);

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
  const [showDisabledPages, setShowDisabledPages] = useState(false);
  const [showAddItinerary, setShowAddItinerary] = useState(false);
  const [deletingItinerary, setDeletingItinerary] = useState<ItineraryItem | null>(null);
  const [deletingFormField, setDeletingFormField] = useState<any | null>(null);
  const [showCreateGiftPackage, setShowCreateGiftPackage] = useState(false);
  const [removingDomain, setRemovingDomain] = useState<Domain | null>(null);
  const [rsvpFilter, setRsvpFilter] = useState<string>('all');
  const [savingTemplates, setSavingTemplates] = useState(false);
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
    // Blank means unlimited.
    stockQuantity: '',
  });
  const [detailOrder, setDetailOrder] = useState<GiftOrder | null>(null);
  const [stockEditPackage, setStockEditPackage] = useState<GiftPackage | null>(null);
  const [stockEditValue, setStockEditValue] = useState('');
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
    venue: '', timezone: '', defaultCurrency: 'USD', invitationOnly: false, reelEnabled: false,
    strictInviteOnly: false, itineraryEnabled: false, giftingEnabled: false,
    giftItemsEnabled: true, cashGiftsEnabled: true,
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
  const [votingEnabled, setVotingEnabled] = useState(false);

  const [selectedTemplates, setSelectedTemplates] = useState({
    invitationTemplateId: '', rsvpTemplateId: '', guestbookTemplateId: '',
    guestbookVideoTemplateId: '', guestbookAudioTemplateId: '', guestbookPhotoTemplateId: '',
    boothTemplateId: '', boothVideoTemplateId: '', boothAudioTemplateId: '', boothPhotoTemplateId: '',
    thankYouTemplateId: '',
    liveLandingTemplateId: '',
    eventEndedTemplateId: '',
    itineraryPageTemplateId: '',
    giftingPageTemplateId: '',
    votingPageTemplateId: '',
    nominationPageTemplateId: '',
    nomineesPageTemplateId: '',
    leaderboardPageTemplateId: '',
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
    // Overview shows the address guests actually visit, so domains load up front.
    fetchDomains();
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
    if (activeTab !== 'gifts' && activeTab !== 'sales') return;
    // Background refresh: silent, so the panel never drops back to a
    // skeleton, and orders-only, so unsaved edits above it survive.
    const refresh = () => {
      if (document.visibilityState !== 'visible') return;
      if (activeTab === 'gifts') void fetchGiftOrders({ silent: true });
      if (activeTab === 'sales') void fetchSales({ silent: true });
    };
    const interval = window.setInterval(refresh, 12000);
    // visibilitychange alone is enough; adding focus made every tab switch
    // fire the same refresh two or three times over.
    document.addEventListener('visibilitychange', refresh);
    return () => {
      window.clearInterval(interval);
      document.removeEventListener('visibilitychange', refresh);
    };
  }, [activeTab, eventId]);

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
        votingPageTemplateId: (event as any).votingPageTemplateId || '',
        nominationPageTemplateId: (event as any).nominationPageTemplateId || '',
        nomineesPageTemplateId: (event as any).nomineesPageTemplateId || '',
        leaderboardPageTemplateId: (event as any).leaderboardPageTemplateId || '',
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
        venue: event.venue || '', timezone: event.timezone, defaultCurrency: event.defaultCurrency || 'USD', invitationOnly: event.invitationOnly,
        reelEnabled: event.reelEnabled || false, strictInviteOnly: event.strictInviteOnly || false,
        itineraryEnabled: event.itineraryEnabled || false, giftingEnabled: event.giftingEnabled || false,
        giftItemsEnabled: event.giftItemsEnabled ?? true,
        cashGiftsEnabled: event.cashGiftsEnabled ?? true,
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
    try {
      const [eventResponse, votingResponse] = await Promise.all([
        eventsApi.get(eventId),
        adminVotingApi.getVotingConfig(eventId).catch(() => null),
      ]);
      const loadedEvent = eventResponse.data.event;
      setEvent(loadedEvent);

      // The voting switch is authoritative. Assigned voting templates only act
      // as a hint when the config could not be read at all, otherwise turning
      // voting off would leave it visible for any event that still has one.
      const config = votingResponse?.data?.config;
      if (config) {
        setVotingEnabled(Boolean(config.isEnabled));
      } else {
        setVotingEnabled(
          Boolean(loadedEvent?.votingPageTemplateId)
            || Boolean((loadedEvent as any)?.nominationPageTemplateId)
            || Boolean((loadedEvent as any)?.nomineesPageTemplateId)
            || Boolean((loadedEvent as any)?.leaderboardPageTemplateId)
        );
      }
    }
    catch {
      toast.error('Failed to load event');
      router.push('/admin/events');
    }
    finally {
      setLoading(false);
    }
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
      toast.error(getErrorMessage(e, 'Failed to load domains'));
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
      toast.error(getErrorMessage(e, 'Failed to create owner'));
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
      toast.error(getErrorMessage(e, 'Failed to load RSVPs'));
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

  const fetchSales = async ({ silent = false }: { silent?: boolean } = {}) => {
    try {
      if (!silent) setLoadingSales(true);
      const r = await adminApi.sales({ eventId });
      setSales(r.data.sales || []);
      setSalesStats(r.data.stats || null);
    } catch {
      if (!silent) toast.error('Failed to load sales');
    } finally {
      if (!silent) setLoadingSales(false);
    }
  };

  /**
   * Orders only. This is what the 12s poll refreshes: it never touches the
   * package checkboxes, which may hold assignment edits the admin has not
   * saved yet, and it stays silent so the panel does not flash a skeleton.
   */
  const fetchGiftOrders = async ({ silent = false }: { silent?: boolean } = {}) => {
    try {
      if (!silent) setLoadingGifts(true);
      const ordersResponse = await giftingApi.listOrders(eventId);
      setGiftOrders(ordersResponse.data.orders || []);
    } catch (e: any) {
      // A failed background refresh keeps the last good data and stays quiet.
      if (!silent) toast.error(getErrorMessage(e, 'Failed to load gift orders'));
    } finally {
      if (!silent) setLoadingGifts(false);
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
      toast.error(getErrorMessage(e, 'Failed to load gifting data'));
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
      toast.error(getErrorMessage(e, 'Failed to save gift package assignment'));
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

      const trimmedStock = String(newGiftPackage.stockQuantity ?? '').trim();
      await giftingApi.createPackage({
        name: newGiftPackage.name.trim(),
        description: newGiftPackage.description.trim() || null,
        price,
        currency: (newGiftPackage.currency || primaryEventCurrency).toUpperCase(),
        thumbnailPath: uploadedThumbnailPath,
        // Blank means unlimited, which the API stores as null.
        stockQuantity: trimmedStock === '' ? null : Math.max(0, Number(trimmedStock) || 0),
      });
      setNewGiftPackage({
        name: '',
        description: '',
        price: '',
        currency: (newGiftPackage.currency || primaryEventCurrency).toUpperCase(),
        stockQuantity: '',
      });
      setNewGiftPackagePhoto(null);
      setNewGiftPackagePhotoPreview(null);
      setShowCreateGiftPackage(false);
      toast.success('Gift package created');
      await fetchGifts();
    } catch (e: any) {
      toast.error(getErrorMessage(e, 'Failed to create gift package'));
    } finally {
      setSavingGiftPackage(false);
    }
  };

  // Seed the field from whichever package the dialog was opened for.
  useEffect(() => {
    if (!stockEditPackage) return;
    setStockEditValue(
      stockEditPackage.stockQuantity === null || stockEditPackage.stockQuantity === undefined
        ? ''
        : String(stockEditPackage.stockQuantity)
    );
  }, [stockEditPackage]);

  const handleUpdateGiftPackageStock = async (pkg: GiftPackage, raw: string) => {
    const trimmed = raw.trim();
    const stockQuantity = trimmed === '' ? null : Math.max(0, Number(trimmed) || 0);
    try {
      await giftingApi.updatePackage(pkg.id, { stockQuantity });
      toast.success(
        stockQuantity === null
          ? `${pkg.name} set to unlimited`
          : `${pkg.name} stock set to ${stockQuantity}`
      );
      await fetchGifts();
    } catch (e: any) {
      toast.error(getErrorMessage(e, 'Failed to update stock'));
    }
  };

  const handleToggleGiftPackageActive = async (pkg: GiftPackage) => {
    try {
      await giftingApi.updatePackage(pkg.id, { isActive: !pkg.isActive });
      toast.success(!pkg.isActive ? 'Package activated' : 'Package disabled');
      await fetchGifts();
    } catch (e: any) {
      toast.error(getErrorMessage(e, 'Failed to update package'));
    }
  };

  const fetchItinerary = async () => {
    try {
      setLoadingItinerary(true);
      const response = await itineraryApi.getItems(eventId);
      setItineraryItems(response.data.items || []);
    } catch (e: any) {
      toast.error(getErrorMessage(e, 'Failed to load itinerary'));
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
      toast.error(getErrorMessage(e, 'Failed to reorder itinerary'));
    } finally {
      setSavingItineraryOrder(false);
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
    } catch (e: any) {
      toast.error(getErrorMessage(e, 'Failed to add itinerary item'));
    } finally {
      setSavingItinerary(false);
    }
  };

  const handleCreateMcControlLink = async () => {
    setCreatingMcSession(true);
    try {
      const response = await itineraryApi.createMcSession(eventId);
      if (response.data?.mcUrl) {
        setMcControlUrl(toAbsoluteAppUrl(response.data.mcUrl));
      }
      toast.success('MC control link generated');
    } catch (e: any) {
      toast.error(getErrorMessage(e, 'Failed to generate MC link'));
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
      toast.error(getErrorMessage(e, 'Failed to update itinerary item'));
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
    } catch (e: any) {
      toast.error(getErrorMessage(e, 'Failed to delete itinerary item'));
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
      toast.error(getErrorMessage(e, 'Failed to load form fields'));
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
      toast.error(getErrorMessage(e, 'Failed to upload cover'));
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
      toast.error(getErrorMessage(e, 'Failed to remove cover'));
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
      toast.error(getErrorMessage(e, 'Failed to add domain'));
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
      toast.error(getErrorMessage(e, 'Failed to verify domain'));
    }
  };

  const handleSetPrimaryDomain = async (domainId: string) => {
    try {
      await eventsApi.setPrimaryDomain(eventId, domainId);
      toast.success('Primary domain updated');
      await fetchDomains();
    } catch (e: any) {
      toast.error(getErrorMessage(e, 'Failed to update primary domain'));
    }
  };

  const handleDeleteDomain = async (domainId: string) => {
    try {
      await eventsApi.deleteDomain(eventId, domainId);
      toast.success('Domain removed');
      await fetchDomains();
    } catch (e: any) {
      toast.error(getErrorMessage(e, 'Failed to remove domain'));
    }
  };

  const openNewFormField = () => {
    setEditingFormField(null);
    setFormFieldData({
      fieldName: '',
      label: '',
      type: 'text',
      placeholder: '',
      helpText: '',
      options: [],
      required: false,
      minLength: undefined,
      maxLength: undefined,
      pattern: '',
      sortOrder: formFields.length,
      isActive: true,
      showOnConfirmation: true,
    });
    setShowFormFieldModal(true);
  };

  const openEditFormField = (field: any) => {
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
      toast.error(getErrorMessage(e, 'Failed to save form field'));
    }
  };

  const handleDeleteFormField = async (id: string) => {
    try {
      await ticketingApi.deleteCustomField(eventId, id);
      toast.success('Form field deleted', { icon: '✅' });
      await fetchFormFields();
    } catch (e: any) {
      toast.error(getErrorMessage(e, 'Failed to delete form field'));
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
      toast.error(getErrorMessage(e, 'Failed to review RSVP'));
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
        votingPageTemplateId: selectedTemplates.votingPageTemplateId || null,
        nominationPageTemplateId: (selectedTemplates as any).nominationPageTemplateId || null,
        nomineesPageTemplateId: (selectedTemplates as any).nomineesPageTemplateId || null,
        leaderboardPageTemplateId: (selectedTemplates as any).leaderboardPageTemplateId || null,
      });
      toast.success('Templates updated'); fetchEvent();
    } catch (e: any) { toast.error(getErrorMessage(e, 'Failed')); }
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
        venue: eventSettings.venue || null, timezone: eventSettings.timezone, defaultCurrency: eventSettings.defaultCurrency,
        invitationOnly: eventSettings.invitationOnly,
        reelEnabled: eventSettings.reelEnabled,
        strictInviteOnly: eventSettings.strictInviteOnly,
        itineraryEnabled: eventSettings.itineraryEnabled,
        giftingEnabled: eventSettings.giftingEnabled,
        giftItemsEnabled: eventSettings.giftItemsEnabled,
        cashGiftsEnabled: eventSettings.cashGiftsEnabled,
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
      await adminVotingApi.updateVotingConfig(eventId, { isEnabled: votingEnabled });
      toast.success('Settings saved'); fetchEvent();
    } catch (e: any) { toast.error(getErrorMessage(e, 'Failed')); }
    finally { setSavingSettings(false); }
  };

  const handleCopyLink = async (path: string) => { if (await copyToClipboard(`${window.location.origin}${path}`)) toast.success('Link copied'); };
  /** Copy an already-resolved absolute URL (custom domain aware). */
  const handleCopyUrl = async (url: string) => {
    if (await copyToClipboard(url)) toast.success('Link copied');
    else toast.error('Could not copy. Select the link and copy it manually.');
  };

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


  const tabs: { id: Tab; label: string; count?: number }[] = useMemo(() => {
    if (!event) {
      return [{ id: 'overview', label: 'Overview' }];
    }

    const rsvpEnabled = Boolean(event.rsvpEnabled);
    const checkInEnabled = Boolean(event.checkInEnabled);
    const guestbookEnabled = Boolean(event.guestbookEnabled);
    const itineraryEnabled = Boolean(event.itineraryEnabled);
    const giftingEnabled = Boolean(event.giftingEnabled);
    const ticketingEnabled = Boolean(event.ticketingEnabled) || (rsvpEnabled && event.rsvpMode === 'paid');

    return [
      { id: 'overview', label: 'Overview' },
      ...(rsvpEnabled ? [{ id: 'rsvps' as Tab, label: 'RSVPs', count: event._count.rsvps }] : []),
      ...(checkInEnabled ? [{ id: 'checkin' as Tab, label: 'Check-In', count: event._count.checkIns }] : []),
      ...(guestbookEnabled ? [{ id: 'media' as Tab, label: 'Media', count: event._count.mediaAssets }] : []),
      { id: 'templates', label: 'Templates' },
      ...(ticketingEnabled ? [{ id: 'tickets' as Tab, label: 'Tickets' }] : []),
      ...(ticketingEnabled ? [{ id: 'sales' as Tab, label: 'Sales' }] : []),
      ...(itineraryEnabled ? [{ id: 'itinerary' as Tab, label: 'Itinerary', count: itineraryItems.length || undefined }] : []),
      ...(rsvpEnabled ? [{ id: 'formFields' as Tab, label: 'Form Fields', count: formFields.length }] : []),
      ...(giftingEnabled ? [{ id: 'gifts' as Tab, label: 'Gifts', count: event._count.giftOrders || undefined }] : []),
      ...(votingEnabled ? [{ id: 'voting' as Tab, label: 'Voting' }] : []),
      { id: 'settings', label: 'Settings' },
    ];
  }, [
    event?.rsvpEnabled,
    event?.checkInEnabled,
    event?.guestbookEnabled,
    event?.itineraryEnabled,
    event?.giftingEnabled,
    event?.ticketingEnabled,
    event?.rsvpMode,
    event?._count?.rsvps,
    event?._count?.checkIns,
    event?._count?.mediaAssets,
    event?._count?.giftOrders,
    itineraryItems.length,
    formFields.length,
    votingEnabled,
  ]);

  useEffect(() => {
    if (!tabs.some((tab) => tab.id === activeTab)) {
      setActiveTab('overview');
    }
  }, [activeTab, tabs]);

  if (loading || !event) return <div className="flex items-center justify-center h-64"><div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary-500" /></div>;

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
  // Guest links follow the event's connected domain when it has one, so what we
  // show here is exactly the address a guest lands on.
  const liveDomain = pickLiveEventDomain(domains);
  const publicUrl = (path: string) => getEventPublicUrl(event.slug, path, domains);

  const publicPages = [
    { label: 'Event home', page: '/', enabled: true },
    { label: 'Invitation', page: '/invitation', enabled: Boolean(event.invitationEnabled) },
    { label: 'Live', page: '/live', enabled: true },
    { label: 'RSVP', page: '/rsvp', enabled: Boolean(event.rsvpEnabled) },
    { label: 'Guestbook', page: '/guestbook', enabled: Boolean(event.guestbookEnabled) },
    { label: 'Guest booth', page: '/booth', enabled: Boolean(event.guestbookEnabled) },
    { label: 'Check-in', page: '/checkin', enabled: Boolean(event.checkInEnabled) },
    { label: 'Itinerary', page: '/itinerary', enabled: Boolean(event.itineraryEnabled) },
    { label: 'Gifts', page: '/gift', enabled: Boolean(event.giftingEnabled) },
    { label: 'Vote', page: '/vote', enabled: votingEnabled },
    { label: 'Nominations', page: '/nominate', enabled: votingEnabled },
    { label: 'Nominees', page: '/nominees', enabled: votingEnabled },
    { label: 'Leaderboard', page: '/leaderboard', enabled: votingEnabled },
    { label: 'Thank you', page: '/thanks', enabled: true },
  ].map((entry) => ({ ...entry, url: publicUrl(entry.page) }));

  const enabledPublicPages = publicPages.filter((page) => page.enabled);
  const disabledPublicPages = publicPages.filter((page) => !page.enabled);
  const giftCurrency = giftOrders[0]?.currency || primaryEventCurrency;
  const salesCurrency = sales[0]?.currency || event?.defaultCurrency || primaryEventCurrency;

  return (
    <div className="page">
      <PageHeader
        title={event.name}
        backHref="/admin/events"
        backLabel="Events"
        meta={
          <>
            <StatusBadge tone={getPhaseTone(event.currentPhase)} dot>
              {getPhaseLabel(event.currentPhase)}
            </StatusBadge>
            {event.phaseOverride ? <StatusBadge tone="neutral">Stage set manually</StatusBadge> : null}
            {event.invitationOnly ? <StatusBadge tone="brand">Invite only</StatusBadge> : null}
            <span className="truncate font-mono text-[12px]">/{event.slug}</span>
            <CopyButton value={`${siteOrigin}/e/${event.slug}`} label="Copy public link" className="-my-1" />
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

      <Tabs
        items={tabs}
        active={activeTab}
        onChange={(id) => setActiveTab(id as Tab)}
        label="Event workspace sections"
      />

      {/* Overview */}
      {activeTab === 'overview' && (
        <div className="grid gap-4 xl:grid-cols-[minmax(0,1.7fr)_minmax(280px,0.8fr)] xl:gap-6">
          <div className="space-y-4">
            <StatRow
              items={[
                { label: 'RSVPs', value: formatCount(event._count.rsvps) },
                { label: 'Invites', value: formatCount(event._count.invitations) },
                { label: 'Check-ins', value: formatCount(event._count.checkIns) },
                { label: 'Media', value: formatCount(event._count.mediaAssets) },
              ]}
            />

            <Panel
              title="Guest pages"
              action={
                disabledPublicPages.length > 0 ? (
                  <button
                    type="button"
                    className="btn-ghost btn-sm"
                    onClick={() => setShowDisabledPages((value) => !value)}
                    aria-expanded={showDisabledPages}
                  >
                    {showDisabledPages ? 'Hide' : `Show ${disabledPublicPages.length} off`}
                  </button>
                ) : null
              }
              flush
            >
              <div className="divide-y divide-surface-200">
                {enabledPublicPages.map((page) => (
                  <PublicPageRow
                    key={page.page}
                    label={page.label}
                    path={page.page}
                    url={page.url}
                    onCopy={() => handleCopyUrl(page.url)}
                  />
                ))}
                {showDisabledPages
                  ? disabledPublicPages.map((page) => (
                      <PublicPageRow
                        key={page.page}
                        label={page.label}
                        path={page.page}
                        url={page.url}
                        disabled
                        onCopy={() => handleCopyUrl(page.url)}
                      />
                    ))
                  : null}
              </div>
            </Panel>

            {liveDomain ? null : (
              <p className="field-hint">
                Connect a domain in Settings to serve these pages from your own address.
              </p>
            )}

            <Panel title="Owner access" flush>
              <div className="divide-y divide-surface-200">
                <PublicPageRow label="Owner view" path={`/event-owner/${event.ownerAccessToken}`} onCopy={handleCopyLink} />
                <PublicPageRow label="Owner sign-in" path="/owner/login" onCopy={handleCopyLink} />
              </div>
            </Panel>
          </div>

          <div className="space-y-4">
            <Panel title="Event stage">
              <div className="segmented w-full">
                {(['PRE_EVENT', 'LIVE', 'POST_EVENT'] as const).map((phase) => (
                  <button
                    key={phase}
                    type="button"
                    onClick={() => handlePhaseChange(phase)}
                    aria-pressed={event.currentPhase === phase}
                    className={cn(
                      'segmented-item flex-1',
                      event.currentPhase === phase && 'segmented-item-active'
                    )}
                  >
                    {getPhaseLabel(phase)}
                  </button>
                ))}
              </div>
              <p className="field-hint">Controls which guest pages are reachable right now.</p>
            </Panel>

            {votingEnabled ? (
              <Panel
                title="Voting"
                action={
                  <Link href={`/admin/events/${event.id}/voting`} className="btn-primary btn-sm">
                    Open
                  </Link>
                }
                flush
              >
                <div className="divide-y divide-surface-200">
                  <PublicPageRow label="Nominations" path="/nominate" url={publicUrl('/nominate')} onCopy={() => handleCopyUrl(publicUrl('/nominate'))} />
                  <PublicPageRow label="Nominees" path="/nominees" url={publicUrl('/nominees')} onCopy={() => handleCopyUrl(publicUrl('/nominees'))} />
                  <PublicPageRow label="Vote" path="/vote" url={publicUrl('/vote')} onCopy={() => handleCopyUrl(publicUrl('/vote'))} />
                  <PublicPageRow label="Leaderboard" path="/leaderboard" url={publicUrl('/leaderboard')} onCopy={() => handleCopyUrl(publicUrl('/leaderboard'))} />
                </div>
              </Panel>
            ) : null}
          </div>
        </div>
      )}

      {/* RSVPs */}
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

          {loadingRsvps ? (
            <ListSkeleton rows={5} />
          ) : rsvps.length === 0 ? (
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
              {/* Compact rows on phones and tablets */}
              <div className="divide-y divide-surface-200 overflow-hidden rounded-xl border border-surface-200 bg-white lg:hidden">
                {rsvps.map((r) => (
                  <div key={r.id} className="flex items-center gap-3 px-4 py-3">
                    <button
                      type="button"
                      onClick={() => setViewingRsvpDetails(r)}
                      className="min-w-0 flex-1 text-left"
                    >
                      <div className="flex min-w-0 items-center gap-2">
                        <span className="truncate text-[15px] font-semibold text-brand-900">{r.primaryName}</span>
                        <StatusBadge tone={getStatusTone(r.status)}>{humanizeEnum(r.status)}</StatusBadge>
                      </div>
                      <p className="mt-0.5 meta truncate">
                        {humanizeEnum(r.attendance)} · {r.guestCount} {r.guestCount === 1 ? 'guest' : 'guests'}
                        {r.email ? ` · ${r.email}` : ''}
                      </p>
                    </button>
                    {r.status === 'PENDING' ? (
                      <Menu label={`Review ${r.primaryName}`} sheetTitle={r.primaryName}>
                        <MenuItem onClick={() => setViewingRsvpDetails(r)}>View details</MenuItem>
                        <MenuItem
                          disabled={reviewingRsvp === r.id}
                          onClick={() => handleReviewRsvp(r.id, 'APPROVED')}
                        >
                          Approve
                        </MenuItem>
                        <MenuItem
                          danger
                          disabled={reviewingRsvp === r.id}
                          onClick={() => handleReviewRsvp(r.id, 'REJECTED')}
                        >
                          Reject
                        </MenuItem>
                      </Menu>
                    ) : (
                      <button
                        type="button"
                        className="btn-outline btn-sm shrink-0"
                        onClick={() => setViewingRsvpDetails(r)}
                      >
                        Details
                      </button>
                    )}
                  </div>
                ))}
              </div>

              {/* Full table from lg up */}
              <div className="hidden overflow-hidden rounded-xl border border-surface-200 bg-white lg:block">
                <div className="overflow-x-auto">
                  <table className="data-table" style={{ minWidth: 880 }}>
                    <thead>
                      <tr>
                        <Th>Guest</Th>
                        <Th>Contact</Th>
                        <Th>Response</Th>
                        <Th>Meal</Th>
                        <Th>Status</Th>
                        <Th align="right">Actions</Th>
                      </tr>
                    </thead>
                    <tbody>
                      {rsvps.map((r) => (
                        <tr key={r.id} className="table-row">
                          <Td>
                            <p className="font-medium text-brand-900">{r.primaryName}</p>
                            {r.secondaryName ? <p className="meta">&amp; {r.secondaryName}</p> : null}
                          </Td>
                          <Td>
                            {r.email ? <p className="truncate">{r.email}</p> : null}
                            {r.phone ? <p className="meta">{r.phone}</p> : null}
                            {!r.email && !r.phone ? <span className="text-surface-500">&mdash;</span> : null}
                          </Td>
                          <Td>
                            <StatusBadge tone={getStatusTone(r.attendance)}>{humanizeEnum(r.attendance)}</StatusBadge>
                            <p className="meta num mt-1">
                              {r.guestCount} {r.guestCount === 1 ? 'guest' : 'guests'}
                            </p>
                            {r.submittedAt ? (
                              <p className="meta mt-0.5">{formatDate(r.submittedAt, 'MMM d, yyyy')}</p>
                            ) : null}
                          </Td>
                          <Td>
                            {r.mealPreference ? <p>{r.mealPreference}</p> : <span className="text-surface-500">&mdash;</span>}
                            {r.dietaryNotes ? <p className="meta mt-0.5">{r.dietaryNotes}</p> : null}
                          </Td>
                          <Td>
                            <StatusBadge tone={getStatusTone(r.status)}>{humanizeEnum(r.status)}</StatusBadge>
                            {r.invitation?.isCheckedIn ? (
                              <p className="meta mt-1 text-emerald-700">Checked in</p>
                            ) : null}
                            {r.invitation?.accessCode ? (
                              <p className="mt-0.5 font-mono text-[12px] text-surface-600">{r.invitation.accessCode}</p>
                            ) : null}
                          </Td>
                          <Td align="right">
                            <div className="flex items-center justify-end gap-1">
                              <button
                                type="button"
                                onClick={() => setViewingRsvpDetails(r)}
                                className="btn-outline btn-sm"
                              >
                                Details
                              </button>
                              {r.status === 'PENDING' ? (
                                <Menu label={`Review ${r.primaryName}`} sheetTitle={r.primaryName}>
                                  <MenuItem
                                    disabled={reviewingRsvp === r.id}
                                    onClick={() => handleReviewRsvp(r.id, 'APPROVED')}
                                  >
                                    Approve
                                  </MenuItem>
                                  <MenuItem
                                    danger
                                    disabled={reviewingRsvp === r.id}
                                    onClick={() => handleReviewRsvp(r.id, 'REJECTED')}
                                  >
                                    Reject
                                  </MenuItem>
                                </Menu>
                              ) : null}
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

          <Modal
            open={Boolean(viewingRsvpDetails)}
            onClose={() => setViewingRsvpDetails(null)}
            title={viewingRsvpDetails?.primaryName || 'RSVP'}
            size="lg"
            footer={
              viewingRsvpDetails?.status === 'PENDING' ? (
                <>
                  <button
                    type="button"
                    className="btn-danger-outline"
                    disabled={reviewingRsvp === viewingRsvpDetails?.id}
                    onClick={() => {
                      if (viewingRsvpDetails) handleReviewRsvp(viewingRsvpDetails.id, 'REJECTED');
                      setViewingRsvpDetails(null);
                    }}
                  >
                    Reject
                  </button>
                  <button
                    type="button"
                    className="btn-primary"
                    disabled={reviewingRsvp === viewingRsvpDetails?.id}
                    onClick={() => {
                      if (viewingRsvpDetails) handleReviewRsvp(viewingRsvpDetails.id, 'APPROVED');
                      setViewingRsvpDetails(null);
                    }}
                  >
                    Approve
                  </button>
                </>
              ) : null
            }
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
                  {viewingRsvpDetails.submittedAt ? (
                    <DetailRow label="Submitted">
                      {formatDate(viewingRsvpDetails.submittedAt, 'MMM d, yyyy h:mm a')}
                    </DetailRow>
                  ) : null}
                </dl>

                {Object.entries(parseCustomFields(viewingRsvpDetails.customFields)).length > 0 ? (
                  <div>
                    <h3 className="section-title mb-1">Custom fields</h3>
                    <dl className="divide-y divide-surface-200">
                      {Object.entries(parseCustomFields(viewingRsvpDetails.customFields)).map(([key, value]) => (
                        <DetailRow key={key} label={key}>
                          {String(value)}
                        </DetailRow>
                      ))}
                    </dl>
                  </div>
                ) : null}

                {viewingRsvpDetails.invitation ? (
                  <div>
                    <h3 className="section-title mb-1">Invitation</h3>
                    <dl className="divide-y divide-surface-200">
                      <DetailRow label="Access code">
                        <span className="font-mono">{viewingRsvpDetails.invitation.accessCode}</span>
                      </DetailRow>
                      <DetailRow label="Checked in">
                        {viewingRsvpDetails.invitation.isCheckedIn ? 'Yes' : 'Not yet'}
                      </DetailRow>
                    </dl>
                    {viewingRsvpDetails.invitation.qrCodeData ? (
                      <div className="mt-4 flex justify-center">
                        <img
                          src={viewingRsvpDetails.invitation.qrCodeData}
                          alt={`Check-in QR code for ${viewingRsvpDetails.primaryName}`}
                          className="h-44 w-44 rounded-lg border border-surface-200 bg-white p-2"
                        />
                      </div>
                    ) : null}
                  </div>
                ) : null}
              </div>
            ) : null}
          </Modal>
        </div>
      )}

      {/* Check-In */}
      {activeTab === 'checkin' && (
        <div className="space-y-4">
          <Toolbar
            end={
              <>
                <button onClick={exportCheckInsToCSV} className="btn-outline btn-sm" disabled={checkIns.length === 0}>
                  Export CSV
                </button>
                <Link href={`/e/${event.slug}/checkin`} target="_blank" className="btn-primary btn-sm">
                  Open check-in station
                </Link>
              </>
            }
          >
            <span className="meta num">{formatCount(checkIns.length)} checked in</span>
          </Toolbar>

          {checkIns.length === 0 ? (
            <EmptyState title="No check-ins yet" hint="Guests appear here as they arrive." />
          ) : (
            <>
              <div className="divide-y divide-surface-200 overflow-hidden rounded-xl border border-surface-200 bg-white md:hidden">
                {checkIns.map((c) => (
                  <div key={c.id} className="px-4 py-3">
                    <div className="flex items-center justify-between gap-3">
                      <span className="truncate text-[15px] font-semibold text-brand-900">{c.invitation.guestName}</span>
                      <StatusBadge tone={c.method === 'QR_SCAN' ? 'info' : 'neutral'}>
                        {c.method === 'QR_SCAN' ? 'QR' : 'Code'}
                      </StatusBadge>
                    </div>
                    <p className="mt-0.5 meta">
                      {formatDate(c.checkedInAt, 'MMM d, h:mm a')} &middot; {c.invitation.guestCount}{' '}
                      {c.invitation.guestCount === 1 ? 'guest' : 'guests'} &middot;{' '}
                      <span className="font-mono">{c.invitation.accessCode}</span>
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
                      {checkIns.map((c) => (
                        <tr key={c.id} className="table-row">
                          <Td className="font-medium text-brand-900">{c.invitation.guestName}</Td>
                          <Td align="right" className="num">
                            {c.invitation.guestCount}
                          </Td>
                          <Td className="font-mono">{c.invitation.accessCode}</Td>
                          <Td>{formatDate(c.checkedInAt, 'MMM d, h:mm a')}</Td>
                          <Td>
                            <StatusBadge tone={c.method === 'QR_SCAN' ? 'info' : 'neutral'}>
                              {c.method === 'QR_SCAN' ? 'QR' : 'Code'}
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
        <div className="space-y-4">
          <Toolbar
            end={
              <>
                <Link href="/admin/templates" className="btn-outline btn-sm">
                  Template library
                </Link>
                <SubmitButton
                  loading={savingTemplates}
                  onClick={handleSaveTemplates}
                  className="btn-primary btn-sm"
                >
                  Save
                </SubmitButton>
              </>
            }
          >
            <span className="meta">Choose the design used for each guest page.</span>
          </Toolbar>

          <Panel title="Guest pages" flush>
            <div className="divide-y divide-surface-200">
              {[
                { t: 'INVITATION', l: 'Invitation', f: 'invitationTemplateId', e: event.invitationEnabled },
                { t: 'RSVP', l: 'RSVP and tickets', f: 'rsvpTemplateId', e: event.rsvpEnabled },
                { t: 'GUESTBOOK', l: 'Guestbook', f: 'guestbookTemplateId', e: event.guestbookEnabled },
                { t: 'THANK_YOU', l: 'Thank you', f: 'thankYouTemplateId', e: true },
                { t: 'LIVE_LANDING', l: 'Live landing', f: 'liveLandingTemplateId', e: true },
                { t: 'EVENT_ENDED', l: 'Event ended', f: 'eventEndedTemplateId', e: true },
                { t: 'ITINERARY', l: 'Itinerary', f: 'itineraryPageTemplateId', e: event.itineraryEnabled },
                { t: 'GIFTING', l: 'Gifting', f: 'giftingPageTemplateId', e: event.giftingEnabled },
                { t: 'VOTING', l: 'Voting', f: 'votingPageTemplateId', e: true },
                { t: 'VOTING_NOMINATION', l: 'Nominations', f: 'nominationPageTemplateId', e: true },
                { t: 'VOTING_NOMINEES', l: 'Nominees', f: 'nomineesPageTemplateId', e: true },
                { t: 'VOTING_LEADERBOARD', l: 'Leaderboard', f: 'leaderboardPageTemplateId', e: true },
              ].map((x) => (
                <TemplateAssignRow
                  key={x.f}
                  label={x.l}
                  enabled={Boolean(x.e)}
                  value={(selectedTemplates as any)[x.f] || ''}
                  options={getTemplatesByType(x.t)}
                  onChange={(value) => setSelectedTemplates({ ...selectedTemplates, [x.f]: value })}
                />
              ))}
            </div>
          </Panel>

          {event.guestbookEnabled ? (
            <Panel title="Guestbook recording" flush>
              <div className="divide-y divide-surface-200">
                {[
                  { t: 'GUESTBOOK_VIDEO', l: 'Video', f: 'guestbookVideoTemplateId' },
                  { t: 'GUESTBOOK_AUDIO', l: 'Audio', f: 'guestbookAudioTemplateId' },
                  { t: 'GUESTBOOK_PHOTO', l: 'Photo', f: 'guestbookPhotoTemplateId' },
                ].map((x) => (
                  <TemplateAssignRow
                    key={x.f}
                    label={x.l}
                    enabled
                    value={(selectedTemplates as any)[x.f] || ''}
                    options={getTemplatesByType(x.t)}
                    onChange={(value) => setSelectedTemplates({ ...selectedTemplates, [x.f]: value })}
                  />
                ))}
              </div>
            </Panel>
          ) : null}

          {event.guestbookEnabled ? (
            <Panel title="Photo booth" flush>
              <div className="divide-y divide-surface-200">
                {[
                  { t: 'BOOTH', l: 'Booth menu', f: 'boothTemplateId' },
                  { t: 'BOOTH', l: 'Booth video', f: 'boothVideoTemplateId' },
                  { t: 'BOOTH', l: 'Booth audio', f: 'boothAudioTemplateId' },
                  { t: 'BOOTH', l: 'Booth photo', f: 'boothPhotoTemplateId' },
                ].map((x) => (
                  <TemplateAssignRow
                    key={x.f}
                    label={x.l}
                    enabled
                    value={(selectedTemplates as any)[x.f] || ''}
                    options={getTemplatesByType(x.t)}
                    onChange={(value) => setSelectedTemplates({ ...selectedTemplates, [x.f]: value })}
                  />
                ))}
              </div>
            </Panel>
          ) : null}
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

      {/* Form Fields */}
      {activeTab === 'formFields' && (
        <div className="space-y-4">
          <Toolbar
            end={
              <button onClick={openNewFormField} className="btn-primary btn-sm">
                Add field
              </button>
            }
          >
            <span className="meta">Extra questions on the RSVP form. Email and phone are always collected.</span>
          </Toolbar>

          {loadingFormFields ? (
            <ListSkeleton rows={4} />
          ) : formFields.length === 0 ? (
            <EmptyState
              title="No custom fields"
              hint="Add a field to collect anything else you need from guests."
              action={
                <button onClick={openNewFormField} className="btn-primary btn-sm">
                  Add field
                </button>
              }
            />
          ) : (
            <div className="divide-y divide-surface-200 overflow-hidden rounded-xl border border-surface-200 bg-white">
              {formFields.map((field) => (
                <div key={field.id} className="flex items-center gap-3 px-4 py-3">
                  <div className="min-w-0 flex-1">
                    <div className="flex min-w-0 flex-wrap items-center gap-2">
                      <span className="truncate text-[15px] font-semibold text-brand-900">{field.label}</span>
                      {field.required ? <StatusBadge tone="brand">Required</StatusBadge> : null}
                      {field.isActive ? null : <StatusBadge tone="neutral">Hidden</StatusBadge>}
                    </div>
                    <p className="mt-0.5 meta truncate">
                      {FIELD_TYPE_LABELS[field.type] || field.type}
                      {field.helpText ? ` · ${field.helpText}` : ''}
                    </p>
                  </div>
                  <button type="button" className="btn-outline btn-sm hidden sm:inline-flex" onClick={() => openEditFormField(field)}>
                    Edit
                  </button>
                  <Menu label={`Actions for ${field.label}`} sheetTitle={field.label}>
                    <MenuItem onClick={() => openEditFormField(field)}>Edit field</MenuItem>
                    <MenuItem danger onClick={() => setDeletingFormField(field)}>
                      Delete field
                    </MenuItem>
                  </Menu>
                </div>
              ))}
            </div>
          )}

          <Modal
            open={showFormFieldModal}
            onClose={() => {
              setShowFormFieldModal(false);
              setEditingFormField(null);
            }}
            title={editingFormField ? 'Edit field' : 'Add field'}
            size="lg"
            footer={
              <>
                <button
                  className="btn-outline"
                  onClick={() => {
                    setShowFormFieldModal(false);
                    setEditingFormField(null);
                  }}
                >
                  Cancel
                </button>
                <button
                  onClick={handleSaveFormField}
                  className="btn-primary"
                  disabled={!formFieldData.label.trim() || !formFieldData.fieldName.trim()}
                >
                  {editingFormField ? 'Save changes' : 'Add field'}
                </button>
              </>
            }
          >
            <div className="space-y-4">
              <div>
                <label className="label" htmlFor="field-label">
                  Question
                </label>
                <input
                  id="field-label"
                  data-autofocus
                  type="text"
                  className="input"
                  value={formFieldData.label}
                  onChange={(e) => {
                    const label = e.target.value;
                    setFormFieldData((prev) => ({
                      ...prev,
                      label,
                      // Keep the stored key in step with the question until it is edited by hand.
                      fieldName: editingFormField ? prev.fieldName : toFieldName(label),
                    }));
                  }}
                  placeholder="Company name"
                />
              </div>

              <div>
                <label className="label" htmlFor="field-type">
                  Answer type
                </label>
                <select
                  id="field-type"
                  className="input"
                  value={formFieldData.type}
                  onChange={(e) => setFormFieldData({ ...formFieldData, type: e.target.value as any })}
                >
                  {Object.entries(FIELD_TYPE_LABELS).map(([value, label]) => (
                    <option key={value} value={value}>
                      {label}
                    </option>
                  ))}
                </select>
              </div>

              {formFieldData.type === 'select' || formFieldData.type === 'radio' ? (
                <div>
                  <label className="label" htmlFor="field-options">
                    Choices
                  </label>
                  <textarea
                    id="field-options"
                    className="input"
                    rows={4}
                    value={formFieldData.options.join('\n')}
                    onChange={(e) =>
                      setFormFieldData({
                        ...formFieldData,
                        options: e.target.value.split('\n').filter((option) => option.trim()),
                      })
                    }
                    placeholder={'Option 1\nOption 2'}
                  />
                  <p className="field-hint">One per line.</p>
                </div>
              ) : null}

              <div className="grid gap-4 sm:grid-cols-2">
                <div>
                  <label className="label" htmlFor="field-placeholder">
                    Placeholder <span className="font-normal text-surface-600">(optional)</span>
                  </label>
                  <input
                    id="field-placeholder"
                    type="text"
                    className="input"
                    value={formFieldData.placeholder}
                    onChange={(e) => setFormFieldData({ ...formFieldData, placeholder: e.target.value })}
                  />
                </div>
                <div>
                  <label className="label" htmlFor="field-help">
                    Help text <span className="font-normal text-surface-600">(optional)</span>
                  </label>
                  <input
                    id="field-help"
                    type="text"
                    className="input"
                    value={formFieldData.helpText}
                    onChange={(e) => setFormFieldData({ ...formFieldData, helpText: e.target.value })}
                  />
                </div>
              </div>

              <div className="space-y-1 border-t border-surface-200 pt-3">
                <Switch
                  label="Required"
                  checked={formFieldData.required}
                  onChange={(checked) => setFormFieldData({ ...formFieldData, required: checked })}
                />
                <Switch
                  label="Show on the RSVP form"
                  checked={formFieldData.isActive}
                  onChange={(checked) => setFormFieldData({ ...formFieldData, isActive: checked })}
                />
                <Switch
                  label="Show on the confirmation page"
                  checked={formFieldData.showOnConfirmation}
                  onChange={(checked) => setFormFieldData({ ...formFieldData, showOnConfirmation: checked })}
                />
              </div>

              <details className="border-t border-surface-200 pt-3">
                <summary className="cursor-pointer text-sm font-medium text-surface-700 hover:text-brand-900">
                  Advanced
                </summary>
                <div className="mt-3 space-y-4">
                  <div className="grid gap-4 sm:grid-cols-3">
                    <div>
                      <label className="label" htmlFor="field-min">
                        Min length
                      </label>
                      <input
                        id="field-min"
                        type="number"
                        min={0}
                        className="input"
                        value={formFieldData.minLength ?? ''}
                        onChange={(e) =>
                          setFormFieldData({
                            ...formFieldData,
                            minLength: e.target.value ? parseInt(e.target.value, 10) : undefined,
                          })
                        }
                      />
                    </div>
                    <div>
                      <label className="label" htmlFor="field-max">
                        Max length
                      </label>
                      <input
                        id="field-max"
                        type="number"
                        min={0}
                        className="input"
                        value={formFieldData.maxLength ?? ''}
                        onChange={(e) =>
                          setFormFieldData({
                            ...formFieldData,
                            maxLength: e.target.value ? parseInt(e.target.value, 10) : undefined,
                          })
                        }
                      />
                    </div>
                    <div>
                      <label className="label" htmlFor="field-order">
                        Position
                      </label>
                      <input
                        id="field-order"
                        type="number"
                        min={0}
                        className="input"
                        value={formFieldData.sortOrder}
                        onChange={(e) =>
                          setFormFieldData({ ...formFieldData, sortOrder: parseInt(e.target.value, 10) || 0 })
                        }
                      />
                    </div>
                  </div>
                  <div>
                    <label className="label" htmlFor="field-key">
                      Stored key
                    </label>
                    <input
                      id="field-key"
                      type="text"
                      className="input font-mono"
                      value={formFieldData.fieldName}
                      onChange={(e) => setFormFieldData({ ...formFieldData, fieldName: toFieldName(e.target.value) })}
                    />
                    <p className="field-hint">Used in exports and the API. Changing it on an existing field starts a new column.</p>
                  </div>
                </div>
              </details>
            </div>
          </Modal>

          <ConfirmDialog
            open={Boolean(deletingFormField)}
            onClose={() => setDeletingFormField(null)}
            onConfirm={() => {
              if (deletingFormField) void handleDeleteFormField(deletingFormField.id);
              setDeletingFormField(null);
            }}
            title={`Delete "${deletingFormField?.label || ''}"?`}
            body="Guests will stop seeing this question. Answers already submitted stay in your exports."
            confirmLabel="Delete field"
          />
        </div>
      )}

      {/* Sales */}
      {activeTab === 'sales' && (
        <div className="space-y-4">
          {loadingSales ? (
            <>
              <StatRowSkeleton />
              <ListSkeleton rows={5} />
            </>
          ) : (
            <>
              {salesStats ? (
                <StatRow
                  items={[
                    { label: 'Sales', value: formatCount(salesStats.totalSales || 0) },
                    { label: 'Revenue', value: formatCurrency(salesStats.totalRevenue || 0, salesCurrency) },
                    {
                      label: 'Paid',
                      value: formatCount(salesStats.byStatus?.PAID || 0),
                      tone: (salesStats.byStatus?.PAID || 0) > 0 ? 'positive' : 'default',
                    },
                    { label: 'Pending', value: formatCount(salesStats.byStatus?.PENDING || 0) },
                  ]}
                />
              ) : null}

              {sales.length === 0 ? (
                <EmptyState title="No sales yet" hint="Ticket purchases appear here as guests check out." />
              ) : (
                <>
                  <div className="divide-y divide-surface-200 overflow-hidden rounded-xl border border-surface-200 bg-white md:hidden">
                    {sales.map((sale: any) => (
                      <div key={sale.id} className="px-4 py-3">
                        <div className="flex items-start justify-between gap-3">
                          <div className="min-w-0">
                            <p className="truncate text-[15px] font-semibold text-brand-900">{sale.primaryName}</p>
                            <p className="mt-0.5 meta truncate">
                              {sale.ticketType || 'Ticket'} &middot; {formatDate(sale.submittedAt, 'MMM d, yyyy')}
                            </p>
                          </div>
                          <div className="shrink-0 text-right">
                            <p className="num text-[15px] font-semibold text-brand-900">
                              {formatCurrency(sale.amountPaid || 0, sale.currency || salesCurrency)}
                            </p>
                            <StatusBadge tone={getStatusTone(sale.paymentStatus)} className="mt-1">
                              {humanizeEnum(sale.paymentStatus) || 'Unknown'}
                            </StatusBadge>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>

                  <div className="hidden overflow-hidden rounded-xl border border-surface-200 bg-white md:block">
                    <div className="overflow-x-auto">
                      <table className="data-table" style={{ minWidth: 720 }}>
                        <thead>
                          <tr>
                            <Th>Guest</Th>
                            <Th>Ticket</Th>
                            <Th align="right">Amount</Th>
                            <Th>Status</Th>
                            <Th>Date</Th>
                          </tr>
                        </thead>
                        <tbody>
                          {sales.map((sale: any) => (
                            <tr key={sale.id} className="table-row">
                              <Td>
                                <p className="font-medium text-brand-900">{sale.primaryName}</p>
                                {sale.email ? <p className="meta truncate">{sale.email}</p> : null}
                              </Td>
                              <Td>{sale.ticketType || <span className="text-surface-500">&mdash;</span>}</Td>
                              <Td align="right" className="num font-semibold text-brand-900">
                                {formatCurrency(sale.amountPaid || 0, sale.currency || salesCurrency)}
                              </Td>
                              <Td>
                                <StatusBadge tone={getStatusTone(sale.paymentStatus)}>
                                  {humanizeEnum(sale.paymentStatus) || 'Unknown'}
                                </StatusBadge>
                              </Td>
                              <Td>{formatDate(sale.submittedAt, 'MMM d, yyyy')}</Td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </div>
                </>
              )}
            </>
          )}
        </div>
      )}

      {/* Gifts */}
      {activeTab === 'gifts' && (
        <div className="space-y-4">
          {loadingGifts ? (
            <>
              <StatRowSkeleton />
              <ListSkeleton rows={4} />
            </>
          ) : (
            <>
              <StatRow
                items={[
                  { label: 'Gift orders', value: formatCount(giftSummary.orders) },
                  { label: 'Gross', value: formatCurrency(giftSummary.gross, giftCurrency) },
                  { label: 'Owner net', value: formatCurrency(giftSummary.ownerNet, giftCurrency), tone: 'positive' },
                  { label: 'Platform', value: formatCurrency(giftSummary.adminRetained, giftCurrency) },
                ]}
              />

              <Panel title="Payment gateways">
                <PaymentGatewaySelector
                  eventId={eventId}
                  onUpdate={() => {
                    fetchEventGatewayCurrencies();
                    fetchGifts();
                  }}
                  title=""
                  description="Gateways enabled here set which currencies gift packages can use."
                />
              </Panel>

              <Panel
                title="Gift packages"
                action={
                  <>
                    <button className="btn-outline btn-sm" onClick={() => setShowCreateGiftPackage(true)}>
                      New package
                    </button>
                    <SubmitButton
                      loading={savingGiftAssignments}
                      className="btn-primary btn-sm"
                      onClick={handleSaveGiftAssignments}
                    >
                      Save
                    </SubmitButton>
                  </>
                }
                flush
              >
                {giftPackages.length === 0 ? (
                  <div className="p-4 sm:p-5">
                    <EmptyState
                      title="No gift packages"
                      action={
                        <button className="btn-primary btn-sm" onClick={() => setShowCreateGiftPackage(true)}>
                          Create package
                        </button>
                      }
                    />
                  </div>
                ) : (
                  <div className="divide-y divide-surface-200">
                    {giftPackages.map((pkg) => (
                      <div key={pkg.id} className="flex items-center gap-3 px-4 py-3">
                        <input
                          type="checkbox"
                          id={`gift-pkg-${pkg.id}`}
                          className="shrink-0"
                          checked={Boolean(pkg.assigned)}
                          onChange={() => handleToggleGiftPackageAssignment(pkg.id)}
                          aria-label={`Show ${pkg.name} on the gifting page`}
                        />
                        <Thumb
                          src={resolveGiftThumbnailUrl(pkg.thumbnailPath)}
                          alt=""
                          className="h-11 w-11 shrink-0"
                        />
                        <label htmlFor={`gift-pkg-${pkg.id}`} className="min-w-0 flex-1 cursor-pointer">
                          <div className="flex min-w-0 items-center gap-2">
                            <span className="truncate text-[15px] font-semibold text-brand-900">{pkg.name}</span>
                            {pkg.isActive ? null : <StatusBadge tone="neutral">Disabled</StatusBadge>}
                            {pkg.remainingStock === 0 ? (
                              <StatusBadge tone="danger">Out of stock</StatusBadge>
                            ) : typeof pkg.remainingStock === 'number' && pkg.remainingStock <= 5 ? (
                              <StatusBadge tone="warning">{pkg.remainingStock} left</StatusBadge>
                            ) : null}
                          </div>
                          <p className="mt-0.5 meta num">
                            {formatCurrency(Number(pkg.price || 0), pkg.currency)}
                            {typeof pkg.remainingStock === 'number'
                              ? ` · ${pkg.remainingStock} of ${pkg.stockQuantity} left`
                              : ' · Unlimited'}
                          </p>
                        </label>
                        <Menu label={`Actions for ${pkg.name}`} sheetTitle={pkg.name}>
                          <MenuItem onClick={() => setStockEditPackage(pkg)}>Set stock</MenuItem>
                          <MenuItem onClick={() => handleToggleGiftPackageActive(pkg)}>
                            {pkg.isActive ? 'Disable package' : 'Enable package'}
                          </MenuItem>
                        </Menu>
                      </div>
                    ))}
                  </div>
                )}
              </Panel>

              <Panel title="Gift orders" flush>
                {giftOrders.length === 0 ? (
                  <div className="p-4 sm:p-5">
                    <EmptyState title="No gift orders yet" />
                  </div>
                ) : (
                  <>
                    <div className="divide-y divide-surface-200 lg:hidden">
                      {giftOrders.map((order) => (
                        <button
                          key={order.id}
                          type="button"
                          className="w-full px-4 py-3 text-left transition-colors hover:bg-surface-50"
                          onClick={() => setDetailOrder(order)}
                          aria-label={`View gift from ${order.guestName}`}
                        >
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
                                {formatCurrency(Number(order.totalAmount || 0), order.currency)}
                              </p>
                              <StatusBadge tone={getStatusTone(order.status)} className="mt-1">
                                {humanizeEnum(order.status)}
                              </StatusBadge>
                            </div>
                          </div>
                          <dl className="mt-2 grid grid-cols-2 gap-x-4">
                            <DetailRow label="Cash">
                              {formatCurrency(Number(order.cashGiftAmount || 0), order.currency)}
                            </DetailRow>
                            <DetailRow label="Packages">
                              {formatCurrency(Number(order.packageAmount || 0), order.currency)}
                            </DetailRow>
                            <DetailRow label="Owner net">
                              {formatCurrency(Number(order.ownerNetAmount || 0), order.currency)}
                            </DetailRow>
                            <DetailRow label="Platform">
                              {formatCurrency(Number(order.adminRetainedAmount || 0), order.currency)}
                            </DetailRow>
                          </dl>
                        </button>
                      ))}
                    </div>

                    <div className="hidden overflow-x-auto lg:block">
                      <table className="data-table" style={{ minWidth: 900 }}>
                        <thead>
                          <tr>
                            <Th>Guest</Th>
                            <Th align="right">Gross</Th>
                            <Th align="right">Cash</Th>
                            <Th align="right">Packages</Th>
                            <Th align="right">Owner net</Th>
                            <Th align="right">Platform</Th>
                            <Th>Status</Th>
                            <Th>Date</Th>
                          </tr>
                        </thead>
                        <tbody>
                          {giftOrders.map((order) => (
                            <tr
                              key={order.id}
                              className="table-row cursor-pointer focus:outline-none focus-visible:bg-surface-100"
                              tabIndex={0}
                              role="button"
                              aria-label={`View gift from ${order.guestName}`}
                              onClick={() => setDetailOrder(order)}
                              onKeyDown={(e) => {
                                if (e.key === 'Enter' || e.key === ' ') {
                                  e.preventDefault();
                                  setDetailOrder(order);
                                }
                              }}
                            >
                              <Td>
                                <p className="font-medium text-brand-900">{order.guestName}</p>
                                <p className="meta truncate">{order.guestEmail || order.guestPhone || 'No contact'}</p>
                              </Td>
                              <Td align="right" className="num">
                                {formatCurrency(Number(order.totalAmount || 0), order.currency)}
                              </Td>
                              <Td align="right" className="num">
                                {formatCurrency(Number(order.cashGiftAmount || 0), order.currency)}
                              </Td>
                              <Td align="right" className="num">
                                {formatCurrency(Number(order.packageAmount || 0), order.currency)}
                              </Td>
                              <Td align="right" className="num font-semibold text-emerald-700">
                                {formatCurrency(Number(order.ownerNetAmount || 0), order.currency)}
                              </Td>
                              <Td align="right" className="num font-semibold text-brand-900">
                                {formatCurrency(Number(order.adminRetainedAmount || 0), order.currency)}
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
                  </>
                )}
              </Panel>

              <Modal
                open={Boolean(detailOrder)}
                onClose={() => setDetailOrder(null)}
                title={detailOrder ? `Gift from ${detailOrder.guestName}` : 'Gift'}
                description={
                  detailOrder
                    ? `${formatDate(detailOrder.createdAt, 'PPp')} · ${humanizeEnum(detailOrder.status)}`
                    : undefined
                }
                size="lg"
              >
                {detailOrder ? (
                  <div className="space-y-5">
                    <dl className="grid gap-x-4 gap-y-3 sm:grid-cols-2">
                      <DetailRow label="Sender">{detailOrder.guestName}</DetailRow>
                      <DetailRow label="Phone">
                        {detailOrder.guestPhone || <span className="text-surface-500">Not provided</span>}
                      </DetailRow>
                      <DetailRow label="Email">
                        {detailOrder.guestEmail || <span className="text-surface-500">Not provided</span>}
                      </DetailRow>
                      <DetailRow label="Paid with">
                        {detailOrder.paymentMethod ? humanizeEnum(detailOrder.paymentMethod) : 'Unknown'}
                      </DetailRow>
                      {detailOrder.deliveryDate ? (
                        <DetailRow label="Deliver on">
                          {formatDate(detailOrder.deliveryDate, 'PPP')}
                        </DetailRow>
                      ) : null}
                      {detailOrder.paymentReference ? (
                        <DetailRow label="Reference">
                          <span className="font-mono text-[12px] break-all">
                            {detailOrder.paymentReference}
                          </span>
                        </DetailRow>
                      ) : null}
                    </dl>

                    <div>
                      <h3 className="text-[13px] font-semibold text-brand-900">What was sent</h3>
                      {detailOrder.items && detailOrder.items.length ? (
                        <ul className="mt-2 divide-y divide-surface-200 rounded-xl border border-surface-200">
                          {detailOrder.items.map((item) => (
                            <li key={item.id} className="flex items-center justify-between gap-3 px-3 py-2.5">
                              <div className="min-w-0">
                                <p className="truncate text-sm font-medium text-brand-900">
                                  {item.type === 'CASH' ? 'Cash gift' : item.giftPackage?.name || 'Gift item'}
                                </p>
                                {item.type === 'PACKAGE' ? (
                                  <p className="meta mt-0.5">
                                    {item.quantity} x{' '}
                                    {formatCurrency(Number(item.unitPrice || 0), detailOrder.currency)}
                                  </p>
                                ) : null}
                              </div>
                              <p className="num shrink-0 text-sm font-semibold text-brand-900">
                                {formatCurrency(Number(item.lineTotal || 0), detailOrder.currency)}
                              </p>
                            </li>
                          ))}
                        </ul>
                      ) : (
                        <p className="mt-2 rounded-xl border border-dashed border-surface-300 bg-surface-50 px-3 py-4 text-center text-[13px] text-surface-600">
                          No itemised breakdown was recorded for this order.
                        </p>
                      )}
                    </div>

                    {detailOrder.note ? (
                      <div>
                        <h3 className="text-[13px] font-semibold text-brand-900">Message from the guest</h3>
                        <p className="mt-2 whitespace-pre-wrap rounded-xl bg-surface-50 px-3 py-3 text-sm leading-6 text-surface-800">
                          {detailOrder.note}
                        </p>
                      </div>
                    ) : null}

                    <div>
                      <h3 className="text-[13px] font-semibold text-brand-900">Settlement</h3>
                      <dl className="mt-2 space-y-1.5 rounded-xl border border-surface-200 px-3 py-3 text-sm">
                        <div className="flex items-center justify-between gap-3">
                          <dt className="text-surface-600">Guest paid</dt>
                          <dd className="num font-medium text-brand-900">
                            {formatCurrency(Number(detailOrder.totalAmount || 0), detailOrder.currency)}
                          </dd>
                        </div>
                        <div className="flex items-center justify-between gap-3">
                          <dt className="text-surface-600">Owner receives</dt>
                          <dd className="num font-medium text-emerald-700">
                            {formatCurrency(Number(detailOrder.ownerNetAmount || 0), detailOrder.currency)}
                          </dd>
                        </div>
                        <div className="flex items-center justify-between gap-3">
                          <dt className="text-surface-600">Platform keeps</dt>
                          <dd className="num font-medium text-brand-900">
                            {formatCurrency(Number(detailOrder.adminRetainedAmount || 0), detailOrder.currency)}
                          </dd>
                        </div>
                        {detailOrder.payoutRouting ? (
                          <div className="flex items-center justify-between gap-3 border-t border-surface-200 pt-2">
                            <dt className="text-surface-600">Routing</dt>
                            <dd className="text-[13px] font-medium text-surface-700">
                              {detailOrder.payoutRouting === 'OWNER_AUTOMATED'
                                ? 'Split to owner at the gateway'
                                : 'Settled to platform, paid out on request'}
                            </dd>
                          </div>
                        ) : null}
                      </dl>
                    </div>
                  </div>
                ) : null}
              </Modal>

              <Modal
                open={Boolean(stockEditPackage)}
                onClose={() => setStockEditPackage(null)}
                title={stockEditPackage ? `Stock for ${stockEditPackage.name}` : 'Set stock'}
                description="Leave blank for unlimited."
                size="sm"
                footer={
                  <>
                    <button className="btn-outline" onClick={() => setStockEditPackage(null)}>
                      Cancel
                    </button>
                    <button
                      className="btn-primary"
                      onClick={async () => {
                        if (!stockEditPackage) return;
                        await handleUpdateGiftPackageStock(stockEditPackage, stockEditValue);
                        setStockEditPackage(null);
                      }}
                    >
                      Save stock
                    </button>
                  </>
                }
              >
                <label className="label" htmlFor="gift-stock-edit">
                  Units available
                </label>
                <input
                  id="gift-stock-edit"
                  type="number"
                  min={0}
                  step="1"
                  className="input"
                  placeholder="Unlimited"
                  value={stockEditValue}
                  onChange={(e) => setStockEditValue(e.target.value)}
                />
                {stockEditPackage && typeof stockEditPackage.soldQuantity === 'number' ? (
                  <p className="field-hint">
                    {stockEditPackage.soldQuantity} already sold. Set a number at or above that to
                    keep the package available.
                  </p>
                ) : null}
              </Modal>

              <Modal
                open={showCreateGiftPackage}
                onClose={() => setShowCreateGiftPackage(false)}
                title="New gift package"
                size="md"
                footer={
                  <>
                    <button
                      className="btn-outline"
                      onClick={() => setShowCreateGiftPackage(false)}
                      disabled={savingGiftPackage}
                    >
                      Cancel
                    </button>
                    <SubmitButton loading={savingGiftPackage} onClick={handleCreateGiftPackage}>
                      Create package
                    </SubmitButton>
                  </>
                }
              >
                <div className="space-y-4">
                  <div>
                    <label className="label" htmlFor="gift-name">
                      Name
                    </label>
                    <input
                      id="gift-name"
                      data-autofocus
                      className="input"
                      value={newGiftPackage.name}
                      onChange={(e) => setNewGiftPackage({ ...newGiftPackage, name: e.target.value })}
                    />
                  </div>

                  <div>
                    <label className="label" htmlFor="gift-description">
                      Description <span className="font-normal text-surface-600">(optional)</span>
                    </label>
                    <textarea
                      id="gift-description"
                      className="input"
                      rows={3}
                      value={newGiftPackage.description}
                      onChange={(e) => setNewGiftPackage({ ...newGiftPackage, description: e.target.value })}
                    />
                  </div>

                  <div className="grid gap-4 sm:grid-cols-2">
                    <div>
                      <label className="label" htmlFor="gift-price">
                        Price
                      </label>
                      <input
                        id="gift-price"
                        type="number"
                        min={0}
                        step="0.01"
                        className="input"
                        value={newGiftPackage.price}
                        onChange={(e) => setNewGiftPackage({ ...newGiftPackage, price: e.target.value })}
                      />
                    </div>
                    <div>
                      <label className="label" htmlFor="gift-currency">
                        Currency
                      </label>
                      <select
                        id="gift-currency"
                        className="input"
                        value={newGiftPackage.currency}
                        onChange={(e) =>
                          setNewGiftPackage({ ...newGiftPackage, currency: e.target.value.toUpperCase() })
                        }
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
                      <p className="field-hint">Follows the gateways enabled for this event.</p>
                    </div>
                  </div>

                  <div>
                    <label className="label" htmlFor="gift-stock">
                      Stock <span className="font-normal text-surface-600">(optional)</span>
                    </label>
                    <input
                      id="gift-stock"
                      type="number"
                      min={0}
                      step="1"
                      className="input"
                      placeholder="Unlimited"
                      value={newGiftPackage.stockQuantity}
                      onChange={(e) =>
                        setNewGiftPackage({ ...newGiftPackage, stockQuantity: e.target.value })
                      }
                    />
                    <p className="field-hint">
                      Leave blank for unlimited. At zero the package shows as out of stock and
                      cannot be added to a gift.
                    </p>
                  </div>

                  <div>
                    <label className="label" htmlFor="gift-photo">
                      Photo <span className="font-normal text-surface-600">(optional)</span>
                    </label>
                    <input
                      id="gift-photo"
                      type="file"
                      accept="image/*"
                      className="input"
                      onChange={(e) => setNewGiftPackagePhoto(e.target.files?.[0] || null)}
                    />
                    {newGiftPackagePhotoPreview ? (
                      <div className="mt-2 flex items-center gap-3">
                        <img
                          src={newGiftPackagePhotoPreview}
                          alt="Package preview"
                          className="h-20 w-28 rounded-lg border border-surface-200 object-cover"
                        />
                        <button
                          type="button"
                          className="btn-outline btn-sm"
                          onClick={() => setNewGiftPackagePhoto(null)}
                        >
                          Remove
                        </button>
                      </div>
                    ) : null}
                  </div>
                </div>
              </Modal>
            </>
          )}
        </div>
      )}

      {/* Voting */}
      {activeTab === 'voting' && (
        <div className="space-y-4">
          <Toolbar
            end={
              <>
                <Link href={`/e/${event.slug}/vote`} target="_blank" className="btn-outline btn-sm">
                  Public vote page
                </Link>
                <Link href={`/admin/events/${event.id}/voting`} className="btn-primary btn-sm">
                  Open voting workspace
                </Link>
              </>
            }
          >
            <span className="meta">Categories, nominees, results and live rankings live in the voting workspace.</span>
          </Toolbar>

          {!event.ownerId ? (
            <div className="banner-warning" role="status">
              Assign an owner in Settings to give them access to the owner voting console.
            </div>
          ) : null}

          <Panel title="Paid voting gateways">
            <PaymentGatewaySelector
              eventId={eventId}
              onUpdate={() => {
                fetchEventGatewayCurrencies();
              }}
              title=""
              description="Paid voting appears publicly only while at least one gateway here stays available."
            />
          </Panel>

          <Panel title="Voting links" flush>
            <div className="divide-y divide-surface-200">
              <PublicPageRow label="Vote" path="/vote" url={publicUrl('/vote')} onCopy={() => handleCopyUrl(publicUrl('/vote'))} />
              <PublicPageRow label="Nominations" path="/nominate" url={publicUrl('/nominate')} onCopy={() => handleCopyUrl(publicUrl('/nominate'))} />
              <PublicPageRow label="Nominees" path="/nominees" url={publicUrl('/nominees')} onCopy={() => handleCopyUrl(publicUrl('/nominees'))} />
              <PublicPageRow label="Leaderboard" path="/leaderboard" url={publicUrl('/leaderboard')} onCopy={() => handleCopyUrl(publicUrl('/leaderboard'))} />
              <PublicPageRow label="Embed script" path="/embed/vote.js" onCopy={handleCopyLink} />
            </div>
          </Panel>

          <Panel title="Related" flush>
            <div className="divide-y divide-surface-200">
              <div className="flex items-center gap-3 px-4 py-2.5">
                <span className="min-w-0 flex-1 truncate text-sm font-medium text-surface-900">USSD channels and credits</span>
                <Link href="/admin/ussd" className="btn-outline btn-sm shrink-0">
                  Open
                </Link>
              </div>
              {event.ownerId ? (
                <div className="flex items-center gap-3 px-4 py-2.5">
                  <span className="min-w-0 flex-1 truncate text-sm font-medium text-surface-900">Owner voting console</span>
                  <Link
                    href={`/owner/events/${event.id}/voting`}
                    target="_blank"
                    className="btn-outline btn-sm shrink-0"
                  >
                    Open
                  </Link>
                </div>
              ) : null}
            </div>
          </Panel>
        </div>
      )}

      {/* Settings */}
      {activeTab === 'settings' && (
        <div className="space-y-4">
          <Toolbar
            end={
              <>
                <button type="button" className="btn-outline btn-sm" onClick={fetchEvent} disabled={savingSettings}>
                  Discard changes
                </button>
                <SubmitButton loading={savingSettings} className="btn-primary btn-sm" onClick={handleSaveSettings}>
                  Save
                </SubmitButton>
              </>
            }
          >
            <span className="meta">Changes apply once you save.</span>
          </Toolbar>

          <SettingsSection title="Basics" defaultOpen>
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="sm:col-span-2">
                <label className="label" htmlFor="set-name">
                  Event name
                </label>
                <input
                  id="set-name"
                  type="text"
                  className="input"
                  value={eventSettings.name}
                  onChange={(e) => setEventSettings({ ...eventSettings, name: e.target.value })}
                />
              </div>
              <div className="sm:col-span-2">
                <label className="label" htmlFor="set-description">
                  Description
                </label>
                <textarea
                  id="set-description"
                  rows={3}
                  className="input"
                  value={eventSettings.description}
                  onChange={(e) => setEventSettings({ ...eventSettings, description: e.target.value })}
                />
              </div>
              <div>
                <label className="label" htmlFor="set-date">
                  Starts
                </label>
                <div className="flex gap-2">
                  <input
                    id="set-date"
                    type="date"
                    className="input"
                    value={eventSettings.date}
                    onChange={(e) => setEventSettings({ ...eventSettings, date: e.target.value })}
                  />
                  <input
                    type="time"
                    className="input"
                    aria-label="Start time"
                    value={eventSettings.time}
                    onChange={(e) => setEventSettings({ ...eventSettings, time: e.target.value })}
                  />
                </div>
              </div>
              <div>
                <label className="label" htmlFor="set-end-date">
                  Ends <span className="font-normal text-surface-600">(optional)</span>
                </label>
                <div className="flex gap-2">
                  <input
                    id="set-end-date"
                    type="date"
                    className="input"
                    value={eventSettings.endDate}
                    onChange={(e) => setEventSettings({ ...eventSettings, endDate: e.target.value })}
                  />
                  <input
                    type="time"
                    className="input"
                    aria-label="End time"
                    value={eventSettings.endTime}
                    onChange={(e) => setEventSettings({ ...eventSettings, endTime: e.target.value })}
                  />
                </div>
              </div>
              <div className="sm:col-span-2">
                <label className="label" htmlFor="set-venue">
                  Venue
                </label>
                <input
                  id="set-venue"
                  type="text"
                  className="input"
                  value={eventSettings.venue}
                  onChange={(e) => setEventSettings({ ...eventSettings, venue: e.target.value })}
                />
              </div>
              <div>
                <label className="label" htmlFor="set-timezone">
                  Time zone
                </label>
                <select
                  id="set-timezone"
                  className="input"
                  value={eventSettings.timezone}
                  onChange={(e) => setEventSettings({ ...eventSettings, timezone: e.target.value })}
                >
                  <option value="UTC">UTC</option>
                  <option value="America/New_York">Eastern Time</option>
                  <option value="America/Chicago">Central Time</option>
                  <option value="America/Denver">Mountain Time</option>
                  <option value="America/Los_Angeles">Pacific Time</option>
                  <option value="Europe/London">London</option>
                  <option value="Africa/Accra">Ghana (GMT)</option>
                </select>
              </div>
              <div>
                <label className="label" htmlFor="set-currency">
                  Currency
                </label>
                <select
                  id="set-currency"
                  className="input"
                  value={eventSettings.defaultCurrency}
                  onChange={(e) => setEventSettings({ ...eventSettings, defaultCurrency: e.target.value })}
                >
                  {['USD', 'EUR', 'GBP', 'GHS', 'KES', 'NGN'].map((code) => (
                    <option key={code} value={code}>
                      {code}
                    </option>
                  ))}
                </select>
              </div>
              <div className="sm:col-span-2">
                <dl className="divide-y divide-surface-200 border-t border-surface-200 pt-1">
                  <DetailRow label="Web address">
                    <span className="font-mono">/e/{event.slug}</span>
                  </DetailRow>
                </dl>
              </div>
            </div>
          </SettingsSection>

          <SettingsSection title="What guests can do">
            <div className="space-y-1">
              <Switch
                label="Invitations"
                description="Digital invitation passes."
                checked={eventSettings.invitationEnabled}
                onChange={(checked) => setEventSettings({ ...eventSettings, invitationEnabled: checked })}
              />
              <Switch
                label="RSVP"
                description="Collect guest responses."
                checked={eventSettings.rsvpEnabled}
                onChange={(checked) =>
                  setEventSettings({
                    ...eventSettings,
                    rsvpEnabled: checked,
                    rsvpMode: checked ? eventSettings.rsvpMode : 'free',
                    ticketingEnabled: checked && eventSettings.rsvpMode === 'paid',
                  })
                }
              />
              <Switch
                label="Guestbook"
                description="Video, audio and photo messages."
                checked={eventSettings.guestbookEnabled}
                onChange={(checked) => setEventSettings({ ...eventSettings, guestbookEnabled: checked })}
              />
              <Switch
                label="Check-in"
                description={
                  eventSettings.invitationOnly
                    ? 'Track arrivals at the door.'
                    : 'Available on invitation-only events.'
                }
                disabled={!eventSettings.invitationOnly}
                checked={eventSettings.checkInEnabled && eventSettings.invitationOnly}
                onChange={(checked) => setEventSettings({ ...eventSettings, checkInEnabled: checked })}
              />
              <Switch
                label="Itinerary"
                description="Guests follow the running order; the MC marks items done."
                checked={eventSettings.itineraryEnabled}
                onChange={(checked) => setEventSettings({ ...eventSettings, itineraryEnabled: checked })}
              />
              <Switch
                label="Gifting"
                description="Cash gifts and gift packages."
                checked={eventSettings.giftingEnabled}
                onChange={(checked) => setEventSettings({ ...eventSettings, giftingEnabled: checked })}
              />
              {eventSettings.giftingEnabled ? (
                <div className="ml-0 space-y-3 border-l-2 border-surface-200 pl-4 sm:ml-2">
                  <Switch
                    label="Gift items"
                    description="Guests can buy packages from the catalogue."
                    checked={eventSettings.giftItemsEnabled}
                    onChange={(checked) =>
                      setEventSettings({
                        ...eventSettings,
                        giftItemsEnabled: checked,
                        // Gifting with neither kind on would leave guests a dead page.
                        cashGiftsEnabled: checked ? eventSettings.cashGiftsEnabled : true,
                      })
                    }
                  />
                  <Switch
                    label="Cash gifts"
                    description="Guests can send money straight to the host."
                    checked={eventSettings.cashGiftsEnabled}
                    onChange={(checked) =>
                      setEventSettings({
                        ...eventSettings,
                        cashGiftsEnabled: checked,
                        giftItemsEnabled: checked ? eventSettings.giftItemsEnabled : true,
                      })
                    }
                  />
                </div>
              ) : null}
              <Switch
                label="Voting"
                description="Nominations, voting and the leaderboard."
                checked={votingEnabled}
                onChange={setVotingEnabled}
              />
              <Switch
                label="Reels"
                description="Generate a video compilation from guest videos."
                checked={eventSettings.reelEnabled}
                onChange={(checked) => setEventSettings({ ...eventSettings, reelEnabled: checked })}
              />
            </div>

            {eventSettings.rsvpEnabled ? (
              <div className="mt-4 border-t border-surface-200 pt-4">
                <p className="label">RSVP type</p>
                <div className="grid gap-2 sm:grid-cols-2">
                  {[
                    { value: 'free', label: 'Free', hint: 'Guests RSVP without paying.' },
                    { value: 'paid', label: 'Ticketed', hint: 'Guests buy a ticket to RSVP.' },
                  ].map((option) => (
                    <label
                      key={option.value}
                      className={cn(
                        'flex cursor-pointer items-start gap-3 rounded-lg border p-3 transition-colors',
                        eventSettings.rsvpMode === option.value
                          ? 'border-brand-900 bg-brand-50'
                          : 'border-surface-300 hover:bg-surface-50'
                      )}
                    >
                      <input
                        type="radio"
                        name="rsvpMode"
                        className="mt-0.5"
                        value={option.value}
                        checked={eventSettings.rsvpMode === option.value}
                        onChange={() =>
                          setEventSettings({
                            ...eventSettings,
                            rsvpMode: option.value as 'free' | 'paid',
                            ticketingEnabled: option.value === 'paid',
                          })
                        }
                      />
                      <span className="min-w-0">
                        <span className="block text-sm font-medium text-brand-900">{option.label}</span>
                        <span className="block text-[13px] leading-5 text-surface-600">{option.hint}</span>
                      </span>
                    </label>
                  ))}
                </div>
              </div>
            ) : null}
          </SettingsSection>

          <SettingsSection title="Access">
            <div className="space-y-1">
              <Switch
                label="Invitation only"
                description="Guests must be approved before they can use event features."
                checked={eventSettings.invitationOnly}
                onChange={(checked) =>
                  setEventSettings({
                    ...eventSettings,
                    invitationOnly: checked,
                    checkInEnabled: checked ? eventSettings.checkInEnabled : false,
                  })
                }
              />
              <Switch
                label="Require an invite link"
                description="Public RSVP only works from a valid invite link."
                checked={eventSettings.strictInviteOnly}
                onChange={(checked) => setEventSettings({ ...eventSettings, strictInviteOnly: checked })}
              />
            </div>
          </SettingsSection>

          <SettingsSection title="Owner">
            <div className="space-y-4">
              <div>
                <label className="label" htmlFor="set-owner">
                  Owner account
                </label>
                <div className="flex gap-2">
                  <select
                    id="set-owner"
                    className="input flex-1"
                    value={eventSettings.ownerId || ''}
                    onChange={(e) => {
                      const ownerId = e.target.value;
                      if (!ownerId) {
                        setEventSettings({ ...eventSettings, ownerId: '' });
                        return;
                      }
                      const owner = owners.find((o) => o.id === ownerId);
                      if (owner) {
                        setEventSettings({
                          ...eventSettings,
                          ownerId,
                          ownerName: owner.name,
                          ownerEmail: owner.email,
                          ownerPhone: owner.phone || '',
                          organizationName: owner.company || '',
                        });
                      }
                    }}
                  >
                    <option value="">No account — use the contact details below</option>
                    {owners.map((o) => (
                      <option key={o.id} value={o.id}>
                        {o.name}
                        {o.email ? ` (${o.email})` : ''}
                      </option>
                    ))}
                  </select>
                  <button type="button" onClick={() => setShowNewOwnerForm(true)} className="btn-outline shrink-0">
                    New
                  </button>
                </div>
              </div>

              <div className="grid gap-4 sm:grid-cols-2">
                <div>
                  <label className="label" htmlFor="set-owner-name">
                    Contact name
                  </label>
                  <input
                    id="set-owner-name"
                    type="text"
                    className="input"
                    value={eventSettings.ownerName}
                    onChange={(e) => setEventSettings({ ...eventSettings, ownerName: e.target.value })}
                  />
                </div>
                <div>
                  <label className="label" htmlFor="set-org">
                    Organisation
                  </label>
                  <input
                    id="set-org"
                    type="text"
                    className="input"
                    value={eventSettings.organizationName}
                    onChange={(e) => setEventSettings({ ...eventSettings, organizationName: e.target.value })}
                  />
                </div>
                <div>
                  <label className="label" htmlFor="set-owner-email">
                    Email
                  </label>
                  <input
                    id="set-owner-email"
                    type="email"
                    className="input"
                    value={eventSettings.ownerEmail}
                    onChange={(e) => setEventSettings({ ...eventSettings, ownerEmail: e.target.value })}
                  />
                </div>
                <div>
                  <label className="label" htmlFor="set-owner-phone">
                    Phone
                  </label>
                  <input
                    id="set-owner-phone"
                    type="tel"
                    className="input"
                    value={eventSettings.ownerPhone}
                    onChange={(e) => setEventSettings({ ...eventSettings, ownerPhone: e.target.value })}
                  />
                </div>
              </div>
              <p className="field-hint">Event notifications go to this contact.</p>
            </div>
          </SettingsSection>

          <SettingsSection title="Branding and sharing">
            <div className="grid gap-4 sm:grid-cols-2">
              <div>
                <label className="label" htmlFor="set-social-title">
                  Share title
                </label>
                <input
                  id="set-social-title"
                  type="text"
                  className="input"
                  value={eventSettings.socialTitle}
                  onChange={(e) => setEventSettings({ ...eventSettings, socialTitle: e.target.value })}
                />
              </div>
              <div>
                <label className="label" htmlFor="set-cover-alt">
                  Cover description
                </label>
                <input
                  id="set-cover-alt"
                  type="text"
                  className="input"
                  value={eventSettings.coverImageAlt}
                  onChange={(e) => setEventSettings({ ...eventSettings, coverImageAlt: e.target.value })}
                />
              </div>
              <div className="sm:col-span-2">
                <label className="label" htmlFor="set-social-desc">
                  Share description
                </label>
                <textarea
                  id="set-social-desc"
                  rows={2}
                  className="input"
                  value={eventSettings.socialDescription}
                  onChange={(e) => setEventSettings({ ...eventSettings, socialDescription: e.target.value })}
                />
              </div>

              <div className="sm:col-span-2">
                <label className="label" htmlFor="set-cover">
                  Cover image
                </label>
                <div className="flex flex-col gap-2 sm:flex-row">
                  <input
                    id="set-cover"
                    type="file"
                    accept="image/jpeg,image/png,image/webp"
                    className="input flex-1"
                    onChange={(e) => setCoverFile(e.target.files?.[0] || null)}
                  />
                  <button
                    type="button"
                    className="btn-outline shrink-0"
                    disabled={!coverFile || uploadingCover}
                    onClick={handleUploadCover}
                  >
                    {uploadingCover ? 'Uploading…' : 'Upload'}
                  </button>
                  {event.coverImagePath ? (
                    <button type="button" className="btn-danger-outline shrink-0" onClick={handleDeleteCover}>
                      Remove
                    </button>
                  ) : null}
                </div>
                <p className="field-hint">JPG, PNG or WEBP, at least 800&times;420. Cropped to 1200&times;630 for sharing.</p>
              </div>

              <div className="sm:col-span-2 overflow-hidden rounded-xl border border-surface-200">
                <div className="aspect-[1200/630] bg-surface-200">
                  {event.coverImageUrl ? (
                    <img
                      src={event.coverImageUrl}
                      alt={event.coverImageAlt || event.name}
                      className="h-full w-full object-cover"
                    />
                  ) : (
                    <div className="h-full w-full bg-gradient-to-br from-brand-900 to-brand-700" />
                  )}
                </div>
                <div className="p-4">
                  <p className="text-[15px] font-semibold text-brand-900">
                    {eventSettings.socialTitle || eventSettings.name || 'Untitled event'}
                  </p>
                  <p className="mt-0.5 meta">
                    {eventSettings.socialDescription || eventSettings.description || 'No share description set.'}
                  </p>
                </div>
              </div>

              <div className="sm:col-span-2 border-t border-surface-200 pt-4">
                <p className="label">Event colours</p>
                <div className="grid gap-3 sm:grid-cols-3">
                  {[
                    { key: 'primaryColor' as const, label: 'Primary' },
                    { key: 'secondaryColor' as const, label: 'Secondary' },
                    { key: 'accentColor' as const, label: 'Accent' },
                  ].map((color) => (
                    <div key={color.key}>
                      <label className="label text-[13px]" htmlFor={`color-${color.key}`}>
                        {color.label}
                      </label>
                      <div className="flex items-center gap-2">
                        <input
                          id={`color-${color.key}`}
                          type="color"
                          className="h-10 w-10 shrink-0 cursor-pointer rounded-lg border border-surface-300"
                          value={eventSettings[color.key]}
                          onChange={(e) => setEventSettings({ ...eventSettings, [color.key]: e.target.value })}
                        />
                        <input
                          type="text"
                          className="input font-mono"
                          aria-label={`${color.label} colour hex`}
                          value={eventSettings[color.key]}
                          onChange={(e) => setEventSettings({ ...eventSettings, [color.key]: e.target.value })}
                        />
                      </div>
                    </div>
                  ))}
                </div>
                <div
                  className="mt-3 flex flex-wrap items-center gap-3 rounded-lg p-4"
                  style={{ backgroundColor: eventSettings.primaryColor, color: eventSettings.secondaryColor }}
                >
                  <span className="text-[15px] font-semibold">{eventSettings.name || 'Event name'}</span>
                  <span
                    className="rounded-full px-3 py-1 text-[13px] font-semibold"
                    style={{ backgroundColor: eventSettings.secondaryColor, color: eventSettings.accentColor }}
                  >
                    Sample button
                  </span>
                </div>
              </div>
            </div>
          </SettingsSection>

          {eventSettings.giftingEnabled || (eventSettings.rsvpEnabled && eventSettings.rsvpMode === 'paid') ? (
            <SettingsSection title="Fees">
              <Switch
                label="Use the platform default fees"
                description="Turn off to set fees just for this event."
                checked={!eventSettings.feeOverridesEnabled}
                onChange={(checked) => setEventSettings({ ...eventSettings, feeOverridesEnabled: !checked })}
              />

              <div className="mt-4">
                {!eventSettings.feeOverridesEnabled ? (
                  <dl className="divide-y divide-surface-200">
                    <DetailRow label="Platform fee">
                      {defaultFeeSettings.platformFeeMode === 'FIXED'
                        ? formatCurrency(defaultFeeSettings.platformFeeFixed, primaryEventCurrency)
                        : `${defaultFeeSettings.platformFeePercent}%`}
                    </DetailRow>
                    <DetailRow label="Processing fee">{defaultFeeSettings.processingFeePercent}%</DetailRow>
                    <DetailRow label="Fixed fee">
                      {formatCurrency(defaultFeeSettings.processingFeeFixed, primaryEventCurrency)}
                    </DetailRow>
                  </dl>
                ) : (
                  <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
                    <div>
                      <label className="label" htmlFor="fee-mode">
                        Platform fee type
                      </label>
                      <select
                        id="fee-mode"
                        className="input"
                        value={eventSettings.platformFeeMode}
                        onChange={(e) =>
                          setEventSettings({
                            ...eventSettings,
                            platformFeeMode: e.target.value as 'PERCENTAGE' | 'FIXED',
                          })
                        }
                      >
                        <option value="PERCENTAGE">Percentage</option>
                        <option value="FIXED">Fixed amount</option>
                      </select>
                    </div>
                    <div>
                      <label className="label" htmlFor="fee-platform">
                        {eventSettings.platformFeeMode === 'FIXED'
                          ? `Platform fee (${primaryEventCurrency})`
                          : 'Platform fee (%)'}
                      </label>
                      <input
                        id="fee-platform"
                        type="number"
                        className="input"
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
                      />
                    </div>
                    <div>
                      <label className="label" htmlFor="fee-processing">
                        Processing fee (%)
                      </label>
                      <input
                        id="fee-processing"
                        type="number"
                        className="input"
                        step="0.1"
                        min="0"
                        max="100"
                        value={eventSettings.processingFeePercent}
                        onChange={(e) =>
                          setEventSettings({ ...eventSettings, processingFeePercent: parseFloat(e.target.value) || 0 })
                        }
                      />
                    </div>
                    <div>
                      <label className="label" htmlFor="fee-fixed">
                        Fixed fee ({primaryEventCurrency})
                      </label>
                      <input
                        id="fee-fixed"
                        type="number"
                        className="input"
                        step="0.01"
                        min="0"
                        value={eventSettings.processingFeeFixed}
                        onChange={(e) =>
                          setEventSettings({ ...eventSettings, processingFeeFixed: parseFloat(e.target.value) || 0 })
                        }
                      />
                    </div>
                  </div>
                )}
              </div>
            </SettingsSection>
          ) : null}

          <SettingsSection title="Custom domains">
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

            <div className="mt-4">
              {domains.length === 0 ? (
                <EmptyState title="No domains connected" hint="Guests reach this event at its EventPeepo address." />
              ) : (
                <div className="divide-y divide-surface-200 overflow-hidden rounded-xl border border-surface-200">
                  {domains.map((domain) => (
                    <div key={domain.id} className="px-4 py-3">
                      <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
                        <div className="flex min-w-0 flex-wrap items-center gap-2">
                          <span className="truncate text-[15px] font-semibold text-brand-900">{domain.host}</span>
                          {domain.isPrimary ? <StatusBadge tone="brand">Primary</StatusBadge> : null}
                          <StatusBadge
                            tone={
                              domain.status === 'ACTIVE'
                                ? 'success'
                                : domain.status === 'FAILED'
                                ? 'danger'
                                : 'warning'
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
            </div>
          </SettingsSection>

          <SettingsSection title="Notifications">
            <p className="label">Notify the owner when</p>
            <div className="space-y-1">
              <Switch
                label="A guest RSVPs"
                checked={eventSettings.notifyOnRsvp}
                onChange={(checked) => setEventSettings({ ...eventSettings, notifyOnRsvp: checked })}
              />
              <Switch
                label="A guest checks in"
                checked={eventSettings.notifyOnCheckIn}
                onChange={(checked) => setEventSettings({ ...eventSettings, notifyOnCheckIn: checked })}
              />
              <Switch
                label="A guestbook entry arrives"
                checked={eventSettings.notifyOnGuestbook}
                onChange={(checked) => setEventSettings({ ...eventSettings, notifyOnGuestbook: checked })}
              />
            </div>

            <p className="label mt-4 border-t border-surface-200 pt-4">Send via</p>
            <div className="space-y-1">
              <Switch
                label="Email"
                checked={eventSettings.emailNotifications}
                onChange={(checked) => setEventSettings({ ...eventSettings, emailNotifications: checked })}
              />
              <Switch
                label="SMS"
                checked={eventSettings.smsNotifications}
                onChange={(checked) => setEventSettings({ ...eventSettings, smsNotifications: checked })}
              />
              <Switch
                label="WhatsApp"
                checked={eventSettings.whatsappNotifications}
                onChange={(checked) => setEventSettings({ ...eventSettings, whatsappNotifications: checked })}
              />
            </div>
            <p className="field-hint">
              Providers are configured in <Link href="/admin/settings" className="font-medium underline">Settings</Link>.
            </p>
          </SettingsSection>

          <SettingsSection title="Capture limits">
            <div className="grid gap-4 sm:grid-cols-3">
              <div>
                <label className="label" htmlFor="lim-min">
                  Shortest recording (s)
                </label>
                <input
                  id="lim-min"
                  type="number"
                  min="10"
                  max="60"
                  className="input"
                  value={eventSettings.minRecordingDuration}
                  onChange={(e) =>
                    setEventSettings({ ...eventSettings, minRecordingDuration: parseInt(e.target.value, 10) || 10 })
                  }
                />
              </div>
              <div>
                <label className="label" htmlFor="lim-max">
                  Longest recording (s)
                </label>
                <input
                  id="lim-max"
                  type="number"
                  min="30"
                  max="300"
                  className="input"
                  value={eventSettings.maxRecordingDuration}
                  onChange={(e) =>
                    setEventSettings({ ...eventSettings, maxRecordingDuration: parseInt(e.target.value, 10) || 30 })
                  }
                />
              </div>
              <div>
                <label className="label" htmlFor="lim-photos">
                  Photos per guest
                </label>
                <input
                  id="lim-photos"
                  type="number"
                  min="1"
                  max="20"
                  className="input"
                  value={eventSettings.maxPhotosPerGuest}
                  onChange={(e) =>
                    setEventSettings({ ...eventSettings, maxPhotosPerGuest: parseInt(e.target.value, 10) || 1 })
                  }
                />
              </div>
              <div>
                <label className="label" htmlFor="lim-booth-photos">
                  Booth photos per session
                </label>
                <input
                  id="lim-booth-photos"
                  type="number"
                  min="1"
                  max="50"
                  className="input"
                  value={eventSettings.maxPhotosPerBoothSession}
                  onChange={(e) =>
                    setEventSettings({
                      ...eventSettings,
                      maxPhotosPerBoothSession: parseInt(e.target.value, 10) || 10,
                    })
                  }
                />
              </div>
              <div>
                <label className="label" htmlFor="lim-countdown">
                  Booth countdown (s)
                </label>
                <input
                  id="lim-countdown"
                  type="number"
                  min="1"
                  max="10"
                  className="input"
                  value={eventSettings.boothShutterCountdown}
                  onChange={(e) =>
                    setEventSettings({
                      ...eventSettings,
                      boothShutterCountdown: parseInt(e.target.value, 10) || 3,
                    })
                  }
                />
              </div>
            </div>
          </SettingsSection>

          <Modal
            open={showNewOwnerForm}
            onClose={() => setShowNewOwnerForm(false)}
            title="New owner"
            size="md"
            footer={
              <>
                <button type="button" className="btn-outline" onClick={() => setShowNewOwnerForm(false)}>
                  Cancel
                </button>
                <button
                  type="button"
                  className="btn-primary"
                  onClick={handleCreateOwner}
                  disabled={!newOwner.name.trim() || !newOwner.email.trim()}
                >
                  Create owner
                </button>
              </>
            }
          >
            <div className="grid gap-4 sm:grid-cols-2">
              <div>
                <label className="label" htmlFor="new-owner-name">
                  Name
                </label>
                <input
                  id="new-owner-name"
                  data-autofocus
                  type="text"
                  className="input"
                  value={newOwner.name}
                  onChange={(e) => setNewOwner({ ...newOwner, name: e.target.value })}
                />
              </div>
              <div>
                <label className="label" htmlFor="new-owner-email">
                  Email
                </label>
                <input
                  id="new-owner-email"
                  type="email"
                  className="input"
                  value={newOwner.email}
                  onChange={(e) => setNewOwner({ ...newOwner, email: e.target.value })}
                />
              </div>
              <div>
                <label className="label" htmlFor="new-owner-phone">
                  Phone <span className="font-normal text-surface-600">(optional)</span>
                </label>
                <input
                  id="new-owner-phone"
                  type="tel"
                  className="input"
                  value={newOwner.phone}
                  onChange={(e) => setNewOwner({ ...newOwner, phone: e.target.value })}
                />
              </div>
              <div>
                <label className="label" htmlFor="new-owner-company">
                  Company <span className="font-normal text-surface-600">(optional)</span>
                </label>
                <input
                  id="new-owner-company"
                  type="text"
                  className="input"
                  value={newOwner.company}
                  onChange={(e) => setNewOwner({ ...newOwner, company: e.target.value })}
                />
              </div>
            </div>
          </Modal>

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

    </div>
  );
}

