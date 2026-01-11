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
  async (error) => {
    if (error.response?.status === 401 && typeof window !== 'undefined') {
      const path = window.location.pathname;
      
      // Only redirect if we're on an admin page and not already on login
      if (path.startsWith('/admin') && path !== '/admin/login') {
        // Check if token exists - if not, it's just a missing token, not expiration
        const token = localStorage.getItem('admin_token');
        
        // Only clear and redirect if we had a token (meaning it expired)
        // If no token, user might be accessing a public page
        if (token && token !== 'null' && token !== 'undefined') {
          // Try to verify token one more time before clearing
          try {
            await authApi.verify();
            // If verify succeeds, it was a temporary network issue, don't clear
            return Promise.reject(error);
          } catch (verifyError) {
            // Token is actually invalid, clear it
            localStorage.removeItem('admin_token');
            // Only redirect if we're on a protected admin page
            if (path !== '/admin/login') {
              window.location.href = '/admin/login';
            }
          }
        }
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
  delete: (id: string) => api.delete(`/events/${id}`),
  setPhase: (id: string, phase: string, override: boolean = false) =>
    api.post(`/events/${id}/phase`, { phase, override }),
  archive: (id: string) => api.post(`/events/${id}/archive`),
  unarchive: (id: string) => api.post(`/events/${id}/unarchive`),
  regenerateOwnerToken: (id: string) => api.post(`/events/${id}/regenerate-owner-token`),
  stats: (id: string) => api.get(`/events/${id}/stats`),
};

// Templates API
export const templatesApi = {
  list: (type?: string, includeContent?: boolean) =>
    api.get('/templates', { params: { type, includeContent: includeContent ? 'true' : undefined } }),
  get: (id: string) => api.get(`/templates/${id}`),
  create: (data: any) => api.post('/templates', data),
  upload: (formData: FormData) => {
    const token = localStorage.getItem('admin_token');
    return axios.post(`${API_BASE_URL}/api/templates/upload`, formData, {
      headers: {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'multipart/form-data',
      },
    });
  },
  update: (id: string, data: any) => api.put(`/templates/${id}`, data),
  delete: (id: string) => api.delete(`/templates/${id}`),
  duplicate: (id: string) => api.post(`/templates/${id}/duplicate`),
  assign: (eventId: string, data: any) => api.post(`/events/${eventId}/templates`, data),
};

// RSVP API
export const rsvpApi = {
  list: (eventId: string, params?: any) => api.get(`/rsvp/event/${eventId}`, { params }),
  get: (id: string) => api.get(`/rsvp/${id}`),
  submit: (eventSlug: string, data: any) => axios.post(`${API_BASE_URL}/api/rsvp/${eventSlug}`, data),
  review: (id: string, status: 'APPROVED' | 'REJECTED') => api.post(`/rsvp/${id}/review`, { status }),
};

// Media API
export const mediaApi = {
  list: (eventId: string, type?: string) => api.get(`/media/event/${eventId}`, { params: type ? { type } : undefined }),
  get: (id: string) => api.get(`/media/${id}`),
  delete: (id: string) => api.delete(`/media/${id}`),
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
};

// Event Owner Portal API
export const eventOwnerApi = {
  getEvent: (token: string) => axios.get(`${API_BASE_URL}/api/event-owner/${token}`),
  getRsvps: (token: string, params?: any) => axios.get(`${API_BASE_URL}/api/event-owner/${token}/rsvps`, { params }),
  reviewRsvp: (token: string, rsvpId: string, status: 'APPROVED' | 'REJECTED') =>
    axios.post(`${API_BASE_URL}/api/event-owner/${token}/rsvps/${rsvpId}/review`, { status }),
  getMedia: (token: string) => axios.get(`${API_BASE_URL}/api/event-owner/${token}/media`),
  getCheckIns: (token: string) => axios.get(`${API_BASE_URL}/api/event-owner/${token}/checkins`),
  downloadMedia: (token: string) => axios.get(`${API_BASE_URL}/api/event-owner/${token}/media/download`, { responseType: 'blob' }),
  generateReel: (token: string, maxDuration?: number) => 
    axios.post(`${API_BASE_URL}/api/event-owner/${token}/generate-reel`, { maxDuration }),
  getReelStatus: (token: string, jobId: string) => 
    axios.get(`${API_BASE_URL}/api/event-owner/${token}/reel/${jobId}/status`),
  getReels: (token: string) => 
    axios.get(`${API_BASE_URL}/api/event-owner/${token}/reels`),
  
  // Sales & Transactions
  getSales: (token: string) => axios.get(`${API_BASE_URL}/api/event-owner/${token}/sales`),
  getSalesByTicket: (token: string) => axios.get(`${API_BASE_URL}/api/event-owner/${token}/sales/by-ticket`),
  
  // Payout Wallet
  getWallet: (token: string) => axios.get(`${API_BASE_URL}/api/event-owner/${token}/wallet`),
  updateWallet: (token: string, data: any) => axios.post(`${API_BASE_URL}/api/event-owner/${token}/wallet`, data),
  
  // Payout Requests
  getPayouts: (token: string) => axios.get(`${API_BASE_URL}/api/event-owner/${token}/payouts`),
  requestPayout: (token: string, amount: number, notes?: string) => 
    axios.post(`${API_BASE_URL}/api/event-owner/${token}/payouts/request`, { amount, notes }),
  getPayoutDetails: (token: string, payoutId: string) => 
    axios.get(`${API_BASE_URL}/api/event-owner/${token}/payouts/${payoutId}`),
  cancelPayout: (token: string, payoutId: string) => 
    axios.delete(`${API_BASE_URL}/api/event-owner/${token}/payouts/${payoutId}`),
};

// Ticketing API
export const ticketingApi = {
  // Ticket Types
  getTicketTypes: (eventId: string) => api.get(`/ticketing/events/${eventId}/tickets/admin`),
  createTicketType: (eventId: string, data: any) => api.post(`/ticketing/events/${eventId}/tickets`, data),
  updateTicketType: (eventId: string, ticketId: string, data: any) => api.put(`/ticketing/events/${eventId}/tickets/${ticketId}`, data),
  deleteTicketType: (eventId: string, ticketId: string) => api.delete(`/ticketing/events/${eventId}/tickets/${ticketId}`),
  
  // Payment Gateway
  getPaymentGateway: (eventId: string) => api.get(`/ticketing/events/${eventId}/payment`),
  updatePaymentGateway: (eventId: string, data: any) => api.put(`/ticketing/events/${eventId}/payment`, data),
  
  // Custom Fields
  getCustomFields: (eventId: string) => api.get(`/ticketing/events/${eventId}/fields`),
  createCustomField: (eventId: string, data: any) => api.post(`/ticketing/events/${eventId}/fields`, data),
  updateCustomField: (eventId: string, fieldId: string, data: any) => api.put(`/ticketing/events/${eventId}/fields/${fieldId}`, data),
  deleteCustomField: (eventId: string, fieldId: string) => api.delete(`/ticketing/events/${eventId}/fields/${fieldId}`),
};

// Promo Codes API
export const promoCodeApi = {
  getPromoCodes: (eventId: string) => api.get(`/promo-codes/events/${eventId}`),
  createPromoCode: (eventId: string, data: any) => api.post(`/promo-codes/events/${eventId}`, data),
  updatePromoCode: (id: string, data: any) => api.put(`/promo-codes/${id}`, data),
  deletePromoCode: (id: string) => api.delete(`/promo-codes/${id}`),
  validate: (data: { code: string; eventId: string; ticketTypeId?: string; amount: number }) =>
    api.post('/promo-codes/validate', data),
};

// Owners API
export const ownersApi = {
  list: (params?: { search?: string; isActive?: boolean }) => api.get('/owners', { params }),
  get: (id: string) => api.get(`/owners/${id}`),
  create: (data: { name: string; email: string; phone?: string; company?: string }) => api.post('/owners', data),
  update: (id: string, data: { name?: string; email?: string; phone?: string; company?: string; isActive?: boolean }) => 
    api.put(`/owners/${id}`, data),
  delete: (id: string) => api.delete(`/owners/${id}`),
};

// Owner Authentication API
export const ownerAuthApi = {
  register: (data: { name: string; email: string; password: string; phone?: string; company?: string }) => 
    axios.post(`${API_BASE_URL}/api/owner-auth/register`, data),
  login: (email: string, password: string) => 
    axios.post(`${API_BASE_URL}/api/owner-auth/login`, { email, password }),
  getMe: () => axios.get(`${API_BASE_URL}/api/owner-auth/me`, {
    headers: {
      Authorization: `Bearer ${localStorage.getItem('owner_token')}`,
    },
  }),
  changePassword: (currentPassword: string, newPassword: string) => 
    axios.post(`${API_BASE_URL}/api/owner-auth/change-password`, { currentPassword, newPassword }, {
      headers: {
        Authorization: `Bearer ${localStorage.getItem('owner_token')}`,
      },
    }),
  updateProfile: (data: { name?: string; email?: string; phone?: string; company?: string }) => 
    axios.put(`${API_BASE_URL}/api/owner-auth/profile`, data, {
      headers: {
        Authorization: `Bearer ${localStorage.getItem('owner_token')}`,
      },
    }),
};

// Owner Dashboard API
export const ownerDashboardApi = {
  getEvents: () => axios.get(`${API_BASE_URL}/api/owner-dashboard/events`, {
    headers: {
      Authorization: `Bearer ${localStorage.getItem('owner_token')}`,
    },
  }),
  getEvent: (eventId: string) => axios.get(`${API_BASE_URL}/api/owner-dashboard/events/${eventId}`, {
    headers: {
      Authorization: `Bearer ${localStorage.getItem('owner_token')}`,
    },
  }),
  getStats: () => axios.get(`${API_BASE_URL}/api/owner-dashboard/stats`, {
    headers: {
      Authorization: `Bearer ${localStorage.getItem('owner_token')}`,
    },
  }),
};


// System Settings API (admin only)
export const settingsApi = {
  get: () => api.get('/settings'),
  update: (data: any) => api.patch('/settings', data),
  testEmail: (email: string) => api.post('/settings/test-email', { email }),
  testSMS: (phone: string) => api.post('/settings/test-sms', { phone }),
  testWhatsApp: (phone: string) => api.post('/settings/test-whatsapp', { phone }),
};

// Admin API
export const adminApi = {
  getSales: (params?: any) => api.get('/admin/sales', { params }),
  // Dashboard
  getDashboard: () => api.get('/admin/dashboard'),
  
  // Audit Logs
  getAuditLogs: (params?: { page?: number; limit?: number; eventId?: string; action?: string }) =>
    api.get('/admin/audit-logs', { params }),
  
  // Payout Management
  getPayouts: (params?: { status?: string; eventId?: string; startDate?: string; endDate?: string; page?: number; limit?: number }) =>
    api.get('/admin/payouts', { params }),
  getPayoutDetails: (id: string) => api.get(`/admin/payouts/${id}`),
  processPayout: (id: string, transactionRef?: string, notes?: string, processedAt?: string) =>
    api.post(`/admin/payouts/${id}/process`, { transactionRef, notes, processedAt }),
  rejectPayout: (id: string, reason: string) =>
    api.post(`/admin/payouts/${id}/reject`, { reason }),
  getPayoutAnalytics: (params?: { startDate?: string; endDate?: string; eventId?: string }) =>
    api.get('/admin/payouts/analytics', { params }),
  
  // Wallet Management
  getWallets: () => api.get('/admin/wallets'),
  verifyWallet: (id: string) => api.put(`/admin/wallets/${id}/verify`),
  
  // Reel Jobs
  getReelJobs: (status?: string, eventId?: string) =>
    api.get('/admin/reel-jobs', { params: { status, eventId } }),
};

export default api;
