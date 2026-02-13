import axios from 'axios';

// API Base URL - defaults to localhost:3001 for development
export const API_BASE_URL = typeof window !== 'undefined' 
  ? (process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001')
  : 'http://localhost:3001';

const api = axios.create({
  baseURL: `${API_BASE_URL}/api`,
});

// Add auth token to requests
api.interceptors.request.use((config) => {
  if (typeof window !== 'undefined') {
    const token = localStorage.getItem('admin_token');
    if (token && token !== 'null' && token !== 'undefined') {
      config.headers.Authorization = `Bearer ${token}`;
    }
  }
  return config;
});

// Handle auth errors globally
api.interceptors.response.use(
  (response) => response,
  (error) => {
    if (error.response?.status === 401 && typeof window !== 'undefined') {
      // Token expired or invalid - clear auth and redirect
      const path = window.location.pathname;
      if (path.startsWith('/admin') && path !== '/admin/login') {
        localStorage.removeItem('admin_token');
        window.location.href = '/admin/login';
      }
    }
    return Promise.reject(error);
  }
);

// Auth API
export const authApi = {
  login: (email: string, password: string) => api.post('/auth/login', { email, password }),
  verify: () => api.get('/auth/me'),
};

// Events API
export const eventsApi = {
  list: (params?: { archived?: boolean; phase?: string }) => api.get('/events', { params }),
  get: (id: string) => api.get(`/events/${id}`),
  create: (data: any) => api.post('/events', data),
  update: (id: string, data: any) => api.patch(`/events/${id}`, data),
  uploadCover: (id: string, formData: FormData) =>
    api.post(`/events/${id}/cover`, formData, {
      headers: { 'Content-Type': 'multipart/form-data' },
    }),
  deleteCover: (id: string) => api.delete(`/events/${id}/cover`),
  getDomains: (id: string) => api.get(`/events/${id}/domains`),
  addDomain: (id: string, data: { host: string; isPrimary?: boolean }) =>
    api.post(`/events/${id}/domains`, data),
  verifyDomain: (id: string, domainId: string) =>
    api.post(`/events/${id}/domains/${domainId}/verify`),
  setPrimaryDomain: (id: string, domainId: string) =>
    api.patch(`/events/${id}/domains/${domainId}/primary`),
  deleteDomain: (id: string, domainId: string) =>
    api.delete(`/events/${id}/domains/${domainId}`),
  delete: (id: string) => api.delete(`/events/${id}`),
  setPhase: (id: string, phase: string, override: boolean = false) =>
    api.post(`/events/${id}/phase`, { phase, override }),
  archive: (id: string) => api.post(`/events/${id}/archive`),
  unarchive: (id: string) => api.post(`/events/${id}/unarchive`),
  regenerateCoupleToken: (id: string) => api.post(`/events/${id}/regenerate-couple-token`),
  stats: (id: string) => api.get(`/events/${id}/stats`),
};

// Templates API
export const templatesApi = {
  list: (type?: string, includeContent?: boolean) =>
    api.get('/templates', { params: { type, includeContent: includeContent ? 'true' : undefined } }),
  get: (id: string) => api.get(`/templates/${id}`),
  create: (data: any) => api.post('/templates', data),
update: (id: string, data: any) => api.patch(`/templates/${id}`, data),
  delete: (id: string) => api.delete(`/templates/${id}`),
  duplicate: (id: string) => api.post(`/templates/${id}/duplicate`),
  assign: (eventId: string, data: any) => api.post(`/events/${eventId}/templates`, data),
  
  // NEW METHODS FOR ZIP TEMPLATES
  /**
   * Get all files in a template
   */
  getFiles: (id: string) => 
    api.get(`/templates/${id}/files`),
  
  /**
   * Get content of a specific file in template
   */
  getFileContent: (id: string, filePath: string) => 
    api.get(`/templates/${id}/file-content`, {
      params: { filePath }
    }),
  
  /**
   * Get template preview/thumbnail URL
   */
  getPreviewUrl: (id: string) => 
    `${API_BASE_URL}/api/templates/${id}/preview`,
  
  /**
   * Get template asset URL
   */
  getAssetUrl: (id: string, assetPath: string) =>
    `${API_BASE_URL}/api/templates/${id}/assets/${assetPath}`,
  
  /**
   * Upload template ZIP file
   */
  upload: (formData: FormData) => {
    const token = typeof window !== 'undefined' ? localStorage.getItem('admin_token') : null;
    return axios.post(`${API_BASE_URL}/api/templates/upload`, formData, {
      headers: {
        'Authorization': token ? `Bearer ${token}` : '',
        'Content-Type': 'multipart/form-data',
      },
    });
  },
};

// RSVP API
export const rsvpApi = {
  list: (eventId: string, params?: any) => api.get(`/rsvp/event/${eventId}`, { params }),
  get: (id: string) => api.get(`/rsvp/${id}`),
  submit: (eventSlug: string, data: any) => axios.post(`${API_BASE_URL}/api/rsvp/${eventSlug}`, data),
  review: (id: string, status: 'APPROVED' | 'REJECTED') => api.post(`/rsvp/${id}/review`, { status }),
  inviteRespond: (token: string, data: { response: 'YES' | 'NO' }) =>
    axios.post(`${API_BASE_URL}/api/rsvp/invite/${token}/respond`, data),
  inviteDetails: (token: string, data: { partySize?: number; note?: string; email?: string }) =>
    axios.patch(`${API_BASE_URL}/api/rsvp/invite/${token}/details`, data),
};

// Media API
export const mediaApi = {
  list: (eventId: string, type?: string) => api.get(`/media/event/${eventId}`, { params: type ? { type } : undefined }),
  get: (id: string) => api.get(`/media/${id}`),
  delete: (id: string) => api.delete(`/media/${id}`),
  bulkDelete: (mediaIds: string[]) => api.post('/media/bulk-delete', { mediaIds }),
  download: (id: string) => api.get(`/media/${id}/download`, { responseType: 'blob' }),
  downloadAll: (eventId: string) => api.get(`/media/event/${eventId}/download-all`, { responseType: 'blob' }),
  stats: (eventId: string) => api.get(`/media/event/${eventId}/stats`),
  timeline: (eventId: string) => api.get(`/media/event/${eventId}/timeline`),
  generateReel: (eventId: string, maxDuration?: number) => 
    api.post(`/media/event/${eventId}/generate-reel`, { maxDuration }),
  getReelStatus: (jobId: string) => api.get(`/media/reel/${jobId}/status`),
};

// Check-In API
export const checkInApi = {
  list: (eventId: string) => api.get(`/checkin/${eventId}/list`),
  stats: (eventId: string) => api.get(`/checkin/${eventId}/stats`),
  checkIn: (eventId: string, data: { accessCode?: string; token?: string; method: string }) =>
    api.post(`/checkin/${eventId}`, data),
};

// Public API (no auth required)
export const publicApi = {
  getEvent: (slug: string) => axios.get(`${API_BASE_URL}/api/public/event/${slug}`),
  getEventByToken: (token: string) => axios.get(`${API_BASE_URL}/api/public/event/token/${token}`),
  getRsvpInvite: (token: string) => axios.get(`${API_BASE_URL}/api/public/rsvp-invite/${token}`),
  resolveDomain: (host: string) => axios.get(`${API_BASE_URL}/api/public/domain/${encodeURIComponent(host)}`),
  getItinerary: (slug: string) => axios.get(`${API_BASE_URL}/api/public/event/${slug}/itinerary`),
};

// Guestbook API
export const guestbookApi = {
  getConfig: (eventId: string, accessCode?: string) =>
    axios.get(`${API_BASE_URL}/api/guestbook/${eventId}/config`, {
      params: accessCode ? { accessCode } : undefined,
    }),
  getBoothConfig: (eventId: string) =>
    axios.get(`${API_BASE_URL}/api/guestbook/${eventId}/booth`),
  upload: (eventId: string, formData: FormData, accessCode?: string) =>
    axios.post(
      `${API_BASE_URL}/api/guestbook/${eventId}/upload${accessCode ? `?accessCode=${accessCode}` : ''}`,
      formData,
      { headers: { 'Content-Type': 'multipart/form-data' } }
    ),
  boothUpload: (eventId: string, formData: FormData) =>
    axios.post(
      `${API_BASE_URL}/api/guestbook/${eventId}/booth/upload`,
      formData,
      { headers: { 'Content-Type': 'multipart/form-data' } }
    ),
  generateSessionQR: (eventId: string, deviceId: string, sessionStart: string) =>
    axios.post(`${API_BASE_URL}/api/guestbook/${eventId}/booth/session-qr`, { deviceId, sessionStart }),
};

// Couple Portal API
export const coupleApi = {
  getEvent: (token: string) => axios.get(`${API_BASE_URL}/api/couple/${token}`),
  getRsvps: (token: string, params?: any) => axios.get(`${API_BASE_URL}/api/couple/${token}/rsvps`, { params }),
  reviewRsvp: (token: string, rsvpId: string, status: 'APPROVED' | 'REJECTED') =>
    axios.post(`${API_BASE_URL}/api/couple/${token}/rsvps/${rsvpId}/review`, { status }),
  getMedia: (token: string) => axios.get(`${API_BASE_URL}/api/couple/${token}/media`),
  getCheckIns: (token: string) => axios.get(`${API_BASE_URL}/api/couple/${token}/checkins`),
  downloadMedia: (token: string) => axios.get(`${API_BASE_URL}/api/couple/${token}/media/download`, { responseType: 'blob' }),
};

// System Settings API (admin only)
export const settingsApi = {
  get: () => api.get('/settings'),
  update: (data: any) => api.patch('/settings', data),
  testEmail: (email: string) => api.post('/settings/test-email', { email }),
  testSMS: (phone: string) => api.post('/settings/test-sms', { phone }),
  testWhatsApp: (phone: string) => api.post('/settings/test-whatsapp', { phone }),
};

// Ticketing API (admin/owner)
export const ticketingApi = {
  // Existing
  listTickets: (eventId: string) => api.get(`/tickets/event/${eventId}`),
  getTicket: (id: string) => api.get(`/tickets/${id}`),
  createTicket: (eventId: string, data: any) => api.post(`/tickets/event/${eventId}`, data),
  updateTicket: (id: string, data: any) => api.patch(`/tickets/${id}`, data),
  deleteTicket: (id: string) => api.delete(`/tickets/${id}`),
  stats: (eventId: string) => api.get(`/tickets/event/${eventId}/stats`),
  getTicketTypes: (eventId: string) => api.get(`/tickets/event/${eventId}/types`),
  // Custom Fields
  getCustomFields: (eventId: string) => api.get(`/ticketing/events/${eventId}/fields`),
  createCustomField: (eventId: string, data: any) => api.post(`/ticketing/events/${eventId}/fields`, data),
  updateCustomField: (eventId: string, fieldId: string, data: any) => api.put(`/ticketing/events/${eventId}/fields/${fieldId}`, data),
  deleteCustomField: (eventId: string, fieldId: string) => api.delete(`/ticketing/events/${eventId}/fields/${fieldId}`),
  // NEW — aliases used by TicketsTab.tsx
  createTicketType: (eventId: string, data: any) => api.post(`/tickets/event/${eventId}`, data),
  updateTicketType: (eventId: string, id: string, data: any) => api.patch(`/tickets/${id}`, data),
  deleteTicketType: (eventId: string, id: string) => api.delete(`/tickets/${id}`),
  // Payment gateway methods
  getPaymentGateway: (eventId: string) => api.get(`/payment-gateways/event/${eventId}`),
  updatePaymentGateway: (eventId: string, data: any) => api.post(`/payment-gateways/event/${eventId}`, data),
};

// Owners API (admin)
export const ownersApi = {
  list: (params?: any) => api.get('/owners', { params }),
  get: (id: string) => api.get(`/owners/${id}`),
  create: (data: any) => api.post('/owners', data),
  update: (id: string, data: any) => api.patch(`/owners/${id}`, data),
  delete: (id: string) => api.delete(`/owners/${id}`),
  // common pattern: assign/unassign owner to event
  assignToEvent: (eventId: string, ownerId: string) =>
    api.post(`/events/${eventId}/owner`, { ownerId }),
    resendWelcomeEmail: (id: string) => api.post(`/owners/${id}/resend-welcome-email`),
  changePassword: (id: string, newPassword: string) =>
    api.post(`/owners/${id}/change-password`, { newPassword }),
};

// Admin API (admin dashboards, payouts, sales, etc.)
export const adminApi = {
  dashboard: () => api.get('/admin/dashboard'),
  sales: (params?: any) => api.get('/admin/sales', { params }),
  getSales: (params?: any) => api.get('/admin/sales', { params }),
  payouts: (params?: any) => api.get('/admin/payouts', { params }),
  getPayouts: (params?: any) => api.get('/admin/payouts', { params }),
  processPayout: (id: string, data: any) => api.post(`/admin/payouts/${id}/process`, data),
  rejectPayout: (id: string, reason: string) => api.post(`/admin/payouts/${id}/reject`, { reason }),
  users: (params?: any) => api.get('/admin/users', { params }),
};

// Event Owner “token” portal API (no admin_token; uses token in URL)
export const eventOwnerApi = {
  // Existing
  getEvent: (token: string) => axios.get(`${API_BASE_URL}/api/event-owner/${token}`),
  getMedia: (token: string) => axios.get(`${API_BASE_URL}/api/event-owner/${token}/media`),
  getTickets: (token: string) => axios.get(`${API_BASE_URL}/api/event-owner/${token}/tickets`),
  getSales: (token: string, params?: any) =>
    axios.get(`${API_BASE_URL}/api/event-owner/${token}/sales`, { params }),
  // NEW — missing methods
  getRsvps: (token: string, params?: any) =>
    axios.get(`${API_BASE_URL}/api/event-owner/${token}/rsvps`, { params }),
  reviewRsvp: (token: string, rsvpId: string, status: 'APPROVED' | 'REJECTED') =>
    axios.post(`${API_BASE_URL}/api/event-owner/${token}/rsvps/${rsvpId}/review`, { status }),
  getCheckIns: (token: string) =>
    axios.get(`${API_BASE_URL}/api/event-owner/${token}/checkins`),
  getWallet: (token: string) =>
    axios.get(`${API_BASE_URL}/api/event-owner/${token}/wallet`),
  updateWallet: (token: string, data: any) =>
    axios.post(`${API_BASE_URL}/api/event-owner/${token}/wallet`, data),
  getPayouts: (token: string) =>
    axios.get(`${API_BASE_URL}/api/event-owner/${token}/payouts`),
  requestPayout: (token: string, amount: number, notes?: string) =>
    axios.post(`${API_BASE_URL}/api/event-owner/${token}/payouts/request`, { amount, notes }),
  cancelPayout: (token: string, payoutId: string) =>
    axios.delete(`${API_BASE_URL}/api/event-owner/${token}/payouts/${payoutId}`),
  getReels: (token: string) =>
    axios.get(`${API_BASE_URL}/api/event-owner/${token}/reels`),
  getReelStatus: (token: string, jobId: string) =>
    axios.get(`${API_BASE_URL}/api/event-owner/${token}/reel/${jobId}/status`),
};

export const promoCodeApi = {
  list: (eventId: string) => api.get(`/promo-codes/event/${eventId}`),
  create: (eventId: string, data: any) => api.post(`/promo-codes/event/${eventId}`, data),
  update: (id: string, data: any) => api.patch(`/promo-codes/${id}`, data),
  delete: (id: string) => api.delete(`/promo-codes/${id}`),
};

// Owner auth / dashboard APIs (owner account area)
export const ownerAuthApi = {
  login: (email: string, password: string) =>
    axios.post(`${API_BASE_URL}/api/owner-auth/login`, { email, password }),
  register: (data: any) =>
    axios.post(`${API_BASE_URL}/api/owner-auth/register`, data),
  me: (token: string) =>
    axios.get(`${API_BASE_URL}/api/owner-auth/me`, {
      headers: { Authorization: `Bearer ${token}` },
    }),
  getMe: () => {
    const token = typeof window !== 'undefined' ? localStorage.getItem('owner_token') : null;
    return axios.get(`${API_BASE_URL}/api/owner-auth/me`, {
      headers: { Authorization: token ? `Bearer ${token}` : '' },
    });
  },
  setupPassword: (email: string, password: string) =>
    axios.post(`${API_BASE_URL}/api/owner-auth/setup-password`, { email, password }),
  changePassword: (currentPassword: string, newPassword: string) => {
    const token = typeof window !== 'undefined' ? localStorage.getItem('owner_token') : null;
    return axios.post(`${API_BASE_URL}/api/owner-auth/change-password`,
      { currentPassword, newPassword },
      { headers: { Authorization: token ? `Bearer ${token}` : '' } }
    );
  },
  updateProfile: (data: any) => {
    const token = typeof window !== 'undefined' ? localStorage.getItem('owner_token') : null;
    return axios.put(`${API_BASE_URL}/api/owner-auth/profile`, data, {
      headers: { Authorization: token ? `Bearer ${token}` : '' },
    });
  },
  requestPasswordReset: (email: string, reason?: string) =>
    axios.post(`${API_BASE_URL}/api/owner-auth/request-password-reset`, { email, reason }),
};

const getOwnerToken = () =>
  typeof window !== 'undefined' ? localStorage.getItem('owner_token') : null;

const ownerHeaders = () => ({
  Authorization: `Bearer ${getOwnerToken() || ''}`,
});

export const ownerDashboardApi = {
  // Existing (keep backward compat)
  events: (token?: string, params?: any) =>
    axios.get(`${API_BASE_URL}/api/owner-dashboard/events`, {
      params, headers: { Authorization: `Bearer ${token || getOwnerToken()}` },
    }),
  payouts: (token?: string, params?: any) =>
    axios.get(`${API_BASE_URL}/api/owner-dashboard/payouts`, {
      params, headers: { Authorization: `Bearer ${token || getOwnerToken()}` },
    }),
  // NEW — methods called without explicit token (use stored token)
  getEvents: (params?: any) =>
    axios.get(`${API_BASE_URL}/api/owner-dashboard/events`, {
      params, headers: ownerHeaders(),
    }),
  getEvent: (eventId: string) =>
    axios.get(`${API_BASE_URL}/api/owner-dashboard/events/${eventId}`, {
      headers: ownerHeaders(),
    }),
  getPayouts: (params?: any) =>
    axios.get(`${API_BASE_URL}/api/owner-dashboard/payouts`, {
      params, headers: ownerHeaders(),
    }),
  requestPayout: (data: any) =>
    axios.post(`${API_BASE_URL}/api/owner-dashboard/payouts`, data, {
      headers: ownerHeaders(),
    }),
  getWallet: () =>
    axios.get(`${API_BASE_URL}/api/owner-dashboard/wallet`, {
      headers: ownerHeaders(),
    }),
  updateWallet: (data: any) =>
    axios.post(`${API_BASE_URL}/api/owner-dashboard/wallet`, data, {
      headers: ownerHeaders(),
    }),
  getStats: () =>
    axios.get(`${API_BASE_URL}/api/owner-dashboard/stats`, {
      headers: ownerHeaders(),
    }),
  getRsvps: (eventId: string, params?: any) =>
    axios.get(`${API_BASE_URL}/api/owner-dashboard/events/${eventId}/rsvps`, {
      params, headers: ownerHeaders(),
    }),
  reviewRsvp: (eventId: string, rsvpId: string, status: 'APPROVED' | 'REJECTED') =>
    axios.post(`${API_BASE_URL}/api/owner-dashboard/events/${eventId}/rsvps/${rsvpId}/review`, { status }, {
      headers: ownerHeaders(),
    }),
  getMedia: (eventId: string) =>
    axios.get(`${API_BASE_URL}/api/owner-dashboard/events/${eventId}/media`, {
      headers: ownerHeaders(),
    }),
  getDomains: (eventId: string) =>
    axios.get(`${API_BASE_URL}/api/owner-dashboard/events/${eventId}/domains`, {
      headers: ownerHeaders(),
    }),
  addDomain: (eventId: string, data: { host: string; isPrimary?: boolean }) =>
    axios.post(`${API_BASE_URL}/api/owner-dashboard/events/${eventId}/domains`, data, {
      headers: ownerHeaders(),
    }),
  verifyDomain: (eventId: string, domainId: string) =>
    axios.post(`${API_BASE_URL}/api/owner-dashboard/events/${eventId}/domains/${domainId}/verify`, {}, {
      headers: ownerHeaders(),
    }),
  setPrimaryDomain: (eventId: string, domainId: string) =>
    axios.patch(`${API_BASE_URL}/api/owner-dashboard/events/${eventId}/domains/${domainId}/primary`, {}, {
      headers: ownerHeaders(),
    }),
  deleteDomain: (eventId: string, domainId: string) =>
    axios.delete(`${API_BASE_URL}/api/owner-dashboard/events/${eventId}/domains/${domainId}`, {
      headers: ownerHeaders(),
    }),
  getRsvpInvites: (eventId: string) =>
    axios.get(`${API_BASE_URL}/api/owner-dashboard/events/${eventId}/rsvp-invites`, {
      headers: ownerHeaders(),
    }),
  sendRsvpInvites: (eventId: string, data: any) =>
    axios.post(`${API_BASE_URL}/api/owner-dashboard/events/${eventId}/rsvp-invites/batch`, data, {
      headers: ownerHeaders(),
    }),
  resendRsvpInvite: (eventId: string, inviteId: string) =>
    axios.post(`${API_BASE_URL}/api/owner-dashboard/events/${eventId}/rsvp-invites/${inviteId}/resend`, {}, {
      headers: ownerHeaders(),
    }),
  getCheckIns: (eventId: string) =>
    axios.get(`${API_BASE_URL}/api/owner-dashboard/events/${eventId}/checkins`, {
      headers: ownerHeaders(),
    }),
  getTickets: (eventId: string) =>
    axios.get(`${API_BASE_URL}/api/owner-dashboard/events/${eventId}/tickets`, {
      headers: ownerHeaders(),
    }),
  getGiftOrders: (eventId: string) =>
    axios.get(`${API_BASE_URL}/api/owner-dashboard/events/${eventId}/gift-orders`, {
      headers: ownerHeaders(),
    }),
};

export const itineraryApi = {
  listTemplates: () => api.get('/itinerary/templates'),
  createTemplate: (data: any) => api.post('/itinerary/templates', data),
  updateTemplate: (id: string, data: any) => api.patch(`/itinerary/templates/${id}`, data),
  deleteTemplate: (id: string) => api.delete(`/itinerary/templates/${id}`),
  applyTemplate: (eventId: string, templateId: string) =>
    axios.post(`${API_BASE_URL}/api/itinerary/events/${eventId}/apply-template`, { templateId }, {
      headers: ownerHeaders(),
    }),
  getItems: (eventId: string) =>
    axios.get(`${API_BASE_URL}/api/itinerary/events/${eventId}/items`, { headers: ownerHeaders() }),
  createItem: (eventId: string, data: any) =>
    axios.post(`${API_BASE_URL}/api/itinerary/events/${eventId}/items`, data, { headers: ownerHeaders() }),
  updateItem: (eventId: string, itemId: string, data: any) =>
    axios.patch(`${API_BASE_URL}/api/itinerary/events/${eventId}/items/${itemId}`, data, { headers: ownerHeaders() }),
  reorderItems: (eventId: string, itemIds: string[]) =>
    axios.post(`${API_BASE_URL}/api/itinerary/events/${eventId}/items/reorder`, { itemIds }, { headers: ownerHeaders() }),
  createMcSession: (eventId: string, data?: any) =>
    axios.post(`${API_BASE_URL}/api/itinerary/events/${eventId}/mc-session`, data || {}, { headers: ownerHeaders() }),
  getMcSession: (token: string) => axios.get(`${API_BASE_URL}/api/itinerary/mc/${token}`),
  toggleMcItem: (token: string, itemId: string) =>
    axios.post(`${API_BASE_URL}/api/itinerary/mc/${token}/items/${itemId}/toggle`),
};

export const giftingApi = {
  getPublicOptions: (slug: string) => axios.get(`${API_BASE_URL}/api/gifting/public/${slug}/options`),
  checkout: (slug: string, data: any) => axios.post(`${API_BASE_URL}/api/gifting/public/${slug}/checkout`, data),
  listPackages: () => api.get('/gifting/packages'),
  createPackage: (data: any) => api.post('/gifting/packages', data),
  updatePackage: (id: string, data: any) => api.patch(`/gifting/packages/${id}`, data),
  deletePackage: (id: string) => api.delete(`/gifting/packages/${id}`),
  listOrders: (eventId?: string) => api.get('/gifting/orders', { params: { eventId } }),
  listOwnerOrders: () => axios.get(`${API_BASE_URL}/api/gifting/owner/orders`, { headers: ownerHeaders() }),
};


export default api;
