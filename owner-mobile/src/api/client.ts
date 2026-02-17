import axios from 'axios';
import { useSessionStore } from '../store/session';
import type {
  CheckIn,
  DomainRecord,
  GiftOrder,
  ItineraryItem,
  MediaAsset,
  Owner,
  OwnerEvent,
  OwnerStats,
  PaystackBank,
  PayoutResponse,
  RSVP,
  RsvpInvite,
  TicketType,
  Wallet
} from '../types/domain';

const baseURL = import.meta.env.VITE_API_BASE_URL || 'http://localhost:3001/api';

const api = axios.create({
  baseURL,
  timeout: 20000
});

api.interceptors.request.use((config) => {
  const token = useSessionStore.getState().token;
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

api.interceptors.response.use(
  (response) => response,
  (error) => {
    if (error?.response?.status === 401) {
      useSessionStore.getState().clearSession();
    }
    return Promise.reject(error);
  }
);

export const ownerAuthApi = {
  login: (email: string, password: string) =>
    api.post<{ token: string; owner: Owner }>('/owner-auth/login', { email, password }),
  register: (payload: { name: string; email: string; password: string; phone?: string; company?: string }) =>
    api.post<{ token: string; owner: Owner }>('/owner-auth/register', payload),
  setupPassword: (email: string, password: string) =>
    api.post<{ token: string; owner: Owner }>('/owner-auth/setup-password', { email, password }),
  requestPasswordReset: (email: string, reason?: string) =>
    api.post<{ message: string }>('/owner-auth/request-password-reset', { email, reason }),
  me: () => api.get<{ owner: Owner }>('/owner-auth/me'),
  updateProfile: (payload: { name?: string; email?: string; phone?: string; company?: string }) =>
    api.put<{ owner: Owner }>('/owner-auth/profile', payload),
  changePassword: (currentPassword: string, newPassword: string) =>
    api.post<{ message: string }>('/owner-auth/change-password', { currentPassword, newPassword })
};

export const ownerDashboardApi = {
  stats: () => api.get<{ stats: OwnerStats }>('/owner-dashboard/stats'),
  events: () => api.get<{ events: OwnerEvent[] }>('/owner-dashboard/events'),
  createEvent: (payload: {
    name: string;
    slug: string;
    description?: string;
    date: string;
    endDate?: string;
    timezone?: string;
    defaultCurrency?: string;
    venue?: string;
    ownerName?: string;
    ownerEmail?: string;
    ownerPhone?: string;
    organizationName?: string;
  }) => api.post<{ event: OwnerEvent }>('/owner-dashboard/events', payload),
  checkSlugAvailability: (slug: string) =>
    api.get<{ available: boolean; slug: string; reason?: string }>('/owner-dashboard/events/check-slug', {
      params: { slug }
    }),
  event: (eventId: string) => api.get<{ event: OwnerEvent }>('/owner-dashboard/events/' + eventId),
  updateEvent: (eventId: string, payload: Record<string, unknown>) =>
    api.patch<{ event: OwnerEvent }>('/owner-dashboard/events/' + eventId, payload),
  eventApproval: (eventId: string) =>
    api.get<{
      approval: {
        status: string;
        submittedAt: string | null;
        reviewedAt: string | null;
        rejectionReason: string | null;
      };
    }>('/owner-dashboard/events/' + eventId + '/approval'),
  rsvps: (eventId: string, status?: string) =>
    api.get<{ rsvps: RSVP[] }>('/owner-dashboard/events/' + eventId + '/rsvps', {
      params: status && status !== 'all' ? { status } : undefined
    }),
  reviewRsvp: (eventId: string, rsvpId: string, status: 'APPROVED' | 'REJECTED') =>
    api.post('/owner-dashboard/events/' + eventId + '/rsvps/' + rsvpId + '/review', { status }),
  updateRsvpStatus: (
    eventId: string,
    rsvpId: string,
    status: 'PENDING' | 'APPROVED' | 'REJECTED',
    reason?: string
  ) => api.patch('/owner-dashboard/events/' + eventId + '/rsvps/' + rsvpId + '/status', { status, reason }),
  media: (eventId: string) => api.get<{ media: MediaAsset[] }>('/owner-dashboard/events/' + eventId + '/media'),
  deleteMedia: (mediaId: string) => api.delete('/media/' + mediaId),
  bulkDeleteMedia: (mediaIds: string[]) => api.post('/media/bulk-delete', { mediaIds }),
  downloadMedia: (mediaId: string) => api.get('/media/' + mediaId + '/download', { responseType: 'blob' }),
  downloadAllMedia: (eventId: string, type?: 'PHOTO' | 'VIDEO' | 'AUDIO') =>
    api.get('/media/event/' + eventId + '/download-all', {
      params: type ? { type } : undefined,
      responseType: 'blob',
    }),
  checkins: (eventId: string) =>
    api.get<{ checkIns: CheckIn[] }>('/owner-dashboard/events/' + eventId + '/checkins'),
  tickets: (eventId: string) =>
    api.get<{ tickets: TicketType[] }>('/owner-dashboard/events/' + eventId + '/tickets'),
  gifts: (eventId: string) => api.get<{ orders: GiftOrder[] }>('/owner-dashboard/events/' + eventId + '/gift-orders'),
  domains: (eventId: string) =>
    api.get<{ domains: DomainRecord[]; dnsTarget: string }>('/owner-dashboard/events/' + eventId + '/domains'),
  addDomain: (eventId: string, host: string, isPrimary?: boolean) =>
    api.post('/owner-dashboard/events/' + eventId + '/domains', { host, ...(isPrimary ? { isPrimary: true } : {}) }),
  verifyDomain: (eventId: string, domainId: string) =>
    api.post('/owner-dashboard/events/' + eventId + '/domains/' + domainId + '/verify', {}),
  setPrimaryDomain: (eventId: string, domainId: string) =>
    api.patch('/owner-dashboard/events/' + eventId + '/domains/' + domainId + '/primary', {}),
  deleteDomain: (eventId: string, domainId: string) =>
    api.delete('/owner-dashboard/events/' + eventId + '/domains/' + domainId),
  invites: (eventId: string) =>
    api.get<{ invites: RsvpInvite[] }>('/owner-dashboard/events/' + eventId + '/rsvp-invites'),
  validateInvites: (
    eventId: string,
    invites: Array<{ name?: string; phone?: string; email?: string }>,
    channel: 'whatsapp' | 'email' | 'both' = 'whatsapp'
  ) =>
    api.post<{
      summary: { total: number; valid: number; invalid: number; duplicates: number };
      rows: Array<{
        index: number;
        name: string | null;
        phone: string;
        email: string | null;
        valid: boolean;
        errors: string[];
        duplicate: boolean;
      }>;
    }>('/owner-dashboard/events/' + eventId + '/rsvp-invites/validate', { invites, channel }),
  sendInvites: (
    eventId: string,
    payload: {
      invites: Array<{ name?: string; phone?: string; email?: string }>;
      expiresInHours?: number;
      channel?: 'whatsapp' | 'email' | 'both';
    }
  ) => api.post('/owner-dashboard/events/' + eventId + '/rsvp-invites/batch', payload),
  resendInvite: (eventId: string, inviteId: string) =>
    api.post('/owner-dashboard/events/' + eventId + '/rsvp-invites/' + inviteId + '/resend', {}),
  wallet: () => api.get<{ wallet: Wallet | null; paystackAutomationReady: boolean }>('/owner-dashboard/wallet'),
  updateWallet: (payload: Partial<Wallet>) => api.post<{ wallet: Wallet }>('/owner-dashboard/wallet', payload),
  paystackBanks: (country = 'ghana', currency?: string) =>
    api.get<{ banks: PaystackBank[] }>('/owner-dashboard/wallet/paystack/banks', {
      params: currency ? { country, currency } : { country }
    }),
  connectPaystack: (payload: {
    bankCode: string;
    accountNumber: string;
    businessName?: string;
    currency?: string;
    country?: string;
    setAsPreferred?: boolean;
    percentageCharge?: number;
  }) => api.post<{ wallet: Wallet }>('/owner-dashboard/wallet/paystack/connect', payload),
  payouts: () => api.get<PayoutResponse>('/owner-dashboard/payouts'),
  notificationPreferences: () =>
    api.get<{
      preferences: {
        notificationsEnabled: boolean;
        marketingEnabled: boolean;
        emailEnabled: boolean;
        smsEnabled: boolean;
        pushEnabled: boolean;
        notifyRsvp: boolean;
        notifyCheckIn: boolean;
        notifyGift: boolean;
        notifyTicketSold: boolean;
        notifyMarketing: boolean;
        soundEnabled: boolean;
        hapticsEnabled: boolean;
      };
    }>('/owner-dashboard/notification-preferences'),
  updateNotificationPreferences: (payload: {
    notificationsEnabled?: boolean;
    marketingEnabled?: boolean;
    emailEnabled?: boolean;
    smsEnabled?: boolean;
    pushEnabled?: boolean;
    notifyRsvp?: boolean;
    notifyCheckIn?: boolean;
    notifyGift?: boolean;
    notifyTicketSold?: boolean;
    notifyMarketing?: boolean;
    soundEnabled?: boolean;
    hapticsEnabled?: boolean;
  }) => api.patch('/owner-dashboard/notification-preferences', payload),
  registerDevice: (payload: {
    platform: string;
    oneSignalPlayerId?: string;
    appVersion?: string;
    deviceModel?: string;
    osVersion?: string;
  }) => api.post('/owner-dashboard/devices/register', payload),
  unregisterDevice: (oneSignalPlayerId?: string) =>
    api.post('/owner-dashboard/devices/unregister', { oneSignalPlayerId }),
  notifications: (params?: { page?: number; limit?: number }) =>
    api.get('/owner-dashboard/notifications', { params }),
  markNotificationRead: (notificationId: string) =>
    api.patch('/owner-dashboard/notifications/' + notificationId + '/read', {}),
  supportContent: () =>
    api.get<{
      supportEmail: string | null;
      supportWhatsAppNumber: string | null;
      faq: Array<{ question: string; answer: string }>;
    }>('/owner-dashboard/support-content'),
  requestPayout: (payload: {
    eventId: string;
    requestedAmount: number;
    currency?: string;
    payoutMethod?: 'bank' | 'mobile' | 'paypal' | 'stripe' | 'paystack';
    notes?: string;
  }) => api.post('/owner-dashboard/payouts', payload)
};

export const itineraryApi = {
  getItems: (eventId: string) =>
    api.get<{ items: ItineraryItem[] }>('/itinerary/events/' + eventId + '/items'),
  createItem: (
    eventId: string,
    payload: {
      title: string;
      description?: string;
      startsAt?: string;
      endsAt?: string;
      location?: string;
    }
  ) => api.post('/itinerary/events/' + eventId + '/items', payload),
  updateItem: (
    eventId: string,
    itemId: string,
    payload: {
      title?: string;
      description?: string | null;
      startsAt?: string | null;
      endsAt?: string | null;
      location?: string | null;
      isCompleted?: boolean;
    }
  ) => api.patch('/itinerary/events/' + eventId + '/items/' + itemId, payload),
  deleteItem: (eventId: string, itemId: string) =>
    api.delete('/itinerary/events/' + eventId + '/items/' + itemId),
  reorderItems: (eventId: string, itemIds: string[]) =>
    api.post('/itinerary/events/' + eventId + '/items/reorder', { itemIds }),
  createMcSession: (eventId: string) =>
    api.post<{ sessionToken: string }>('/itinerary/events/' + eventId + '/mc-session', {})
};

export const publicApi = {
  checkMobileVersion: (platform: 'android' | 'ios', version: string) =>
    api.get<{
      status: 'UP_TO_DATE' | 'UPDATE_AVAILABLE' | 'UPDATE_REQUIRED';
      latestVersion: string;
      minimumVersion: string;
      storeUrl: string | null;
    }>('/public/mobile-version-check', { params: { platform, version } }),
};

export default api;
