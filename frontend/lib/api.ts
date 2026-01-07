import axios from 'axios';

const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001';

const api = axios.create({
  baseURL: `${API_BASE_URL}/api`,
});

// Add auth token to requests
api.interceptors.request.use((config) => {
  if (typeof window !== 'undefined') {
    const token = localStorage.getItem('adminToken');
    if (token) {
      config.headers.Authorization = `Bearer ${token}`;
    }
  }
  return config;
});

// Auth API
export const authApi = {
  login: (apiKey: string) => api.post('/auth/login', { apiKey }),
  verify: () => api.get('/auth/verify'),
};

// Events API
export const eventsApi = {
  list: () => api.get('/events'),
  get: (id: string) => api.get(`/events/${id}`),
  create: (data: any) => api.post('/events', data),
  update: (id: string, data: any) => api.put(`/events/${id}`, data),
  delete: (id: string) => api.delete(`/events/${id}`),
  setPhase: (id: string, phase: string, override: boolean = false) =>
    api.post(`/events/${id}/phase`, { phase, override }),
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
  list: (eventId: string) => api.get(`/events/${eventId}/media`),
  get: (id: string) => api.get(`/media/${id}`),
  delete: (id: string) => api.delete(`/media/${id}`),
  downloadAll: (eventId: string) => api.get(`/events/${eventId}/media/download`, { responseType: 'blob' }),
  generateReel: (eventId: string) => api.post(`/events/${eventId}/media/reel`),
};

// Check-In API
export const checkInApi = {
  list: (eventId: string) => api.get(`/events/${eventId}/checkins`),
  verify: (eventId: string, data: { code?: string; token?: string }) =>
    api.post(`/events/${eventId}/checkin/verify`, data),
  checkIn: (eventId: string, data: { code?: string; token?: string; method: string }) =>
    api.post(`/events/${eventId}/checkin`, data),
};

// Public API (no auth required)
export const publicApi = {
  getEvent: (slug: string) => axios.get(`${API_BASE_URL}/api/public/events/${slug}`),
  getEventByToken: (token: string) => axios.get(`${API_BASE_URL}/api/public/events/token/${token}`),
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

export default api;
