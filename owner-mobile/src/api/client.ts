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
  event: (eventId: string) => api.get<{ event: OwnerEvent }>('/owner-dashboard/events/' + eventId),
  rsvps: (eventId: string, status?: string) =>
    api.get<{ rsvps: RSVP[] }>('/owner-dashboard/events/' + eventId + '/rsvps', {
      params: status && status !== 'all' ? { status } : undefined
    }),
  reviewRsvp: (eventId: string, rsvpId: string, status: 'APPROVED' | 'REJECTED') =>
    api.post('/owner-dashboard/events/' + eventId + '/rsvps/' + rsvpId + '/review', { status }),
  media: (eventId: string) => api.get<{ media: MediaAsset[] }>('/owner-dashboard/events/' + eventId + '/media'),
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
  sendInvites: (
    eventId: string,
    payload: { invites: Array<{ name?: string; phone: string; email?: string }>; expiresInHours?: number }
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

export default api;
