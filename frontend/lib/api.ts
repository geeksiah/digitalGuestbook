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
  update: (id: string, data: any) => api.put(`/templates/${id}`, data),
  delete: (id: string) => api.delete(`/templates/${id}`),
  duplicate: (id: string) => api.post(`/templates/${id}/duplicate`),
  assign: (eventId: string, data: any) => api.post(`/events/${eventId}/templates`, data),
};

// RSVP API
export const rsvpApi = {
  list: (eventId: string, params?: any) => api.get(`/events/${eventId}/rsvps`, { params }),
  get: (id: string) => api.get(`/rsvps/${id}`),
  submit: (eventId: string, data: any) => api.post(`/events/${eventId}/rsvps`, data),
  review: (id: string, status: 'APPROVED' | 'REJECTED') => api.post(`/rsvps/${id}/review`, { status }),
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
  upload: (eventId: string, formData: FormData, accessCode?: string) =>
    axios.post(
      `${API_BASE_URL}/api/guestbook/${eventId}/upload${accessCode ? `?accessCode=${accessCode}` : ''}`,
      formData,
      { headers: { 'Content-Type': 'multipart/form-data' } }
    ),
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

export default api;
