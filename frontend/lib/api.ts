import axios from 'axios';

const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL || '';

export const api = axios.create({
  baseURL: API_BASE_URL,
  headers: {
    'Content-Type': 'application/json',
  },
});

// Request interceptor for auth token
api.interceptors.request.use((config) => {
  if (typeof window !== 'undefined') {
    const token = localStorage.getItem('admin_token');
    if (token) {
      config.headers.Authorization = `Bearer ${token}`;
    }

    const coupleToken = localStorage.getItem('couple_token');
    if (coupleToken) {
      config.headers['X-Couple-Token'] = coupleToken;
    }
  }
  return config;
});

// Response interceptor for error handling
api.interceptors.response.use(
  (response) => response,
  (error) => {
    if (error.response?.status === 401) {
      if (typeof window !== 'undefined') {
        // Clear tokens and redirect to login
        localStorage.removeItem('admin_token');
        if (window.location.pathname.startsWith('/admin')) {
          window.location.href = '/admin/login';
        }
      }
    }
    return Promise.reject(error);
  }
);

// Auth API
export const authApi = {
  login: (email: string, password: string) =>
    api.post('/api/auth/login', { email, password }),
  
  getMe: () => api.get('/api/auth/me'),
  
  changePassword: (currentPassword: string, newPassword: string) =>
    api.post('/api/auth/change-password', { currentPassword, newPassword }),
};

// Events API
export const eventsApi = {
  list: (params?: { archived?: boolean; phase?: string }) =>
    api.get('/api/events', { params }),
  
  get: (id: string) => api.get(`/api/events/${id}`),
  
  create: (data: any) => api.post('/api/events', data),
  
  update: (id: string, data: any) => api.patch(`/api/events/${id}`, data),
  
  delete: (id: string) => api.delete(`/api/events/${id}`),
  
  setPhase: (id: string, phase: string, override?: boolean) =>
    api.post(`/api/events/${id}/phase`, { phase, override }),
  
  archive: (id: string) => api.post(`/api/events/${id}/archive`),
  
  unarchive: (id: string) => api.post(`/api/events/${id}/unarchive`),
  
  getStats: (id: string) => api.get(`/api/events/${id}/stats`),
  
  regenerateCoupleToken: (id: string) =>
    api.post(`/api/events/${id}/regenerate-couple-token`),
};

// Templates API
export const templatesApi = {
  list: (type?: string) => api.get('/api/templates', { params: { type } }),
  
  get: (id: string) => api.get(`/api/templates/${id}`),
  
  create: (data: any) => api.post('/api/templates', data),
  
  update: (id: string, data: any) => api.patch(`/api/templates/${id}`, data),
  
  delete: (id: string) => api.delete(`/api/templates/${id}`),
  
  duplicate: (id: string) => api.post(`/api/templates/${id}/duplicate`),
  
  assign: (eventId: string, data: any) =>
    api.post(`/api/templates/assign/${eventId}`, data),
};

// RSVP API
export const rsvpApi = {
  submit: (eventSlug: string, data: any) =>
    api.post(`/api/rsvp/${eventSlug}`, data),
  
  list: (eventId: string, params?: any) =>
    api.get(`/api/rsvp/event/${eventId}`, { params }),
  
  get: (id: string) => api.get(`/api/rsvp/${id}`),
  
  review: (id: string, status: 'APPROVED' | 'REJECTED') =>
    api.post(`/api/rsvp/${id}/review`, { status }),
  
  bulkReview: (rsvpIds: string[], status: 'APPROVED' | 'REJECTED') =>
    api.post('/api/rsvp/bulk-review', { rsvpIds, status }),
};

// Invitations API
export const invitationsApi = {
  list: (eventId: string, params?: any) =>
    api.get(`/api/invitations/event/${eventId}`, { params }),
  
  get: (id: string) => api.get(`/api/invitations/${id}`),
  
  getByCode: (code: string) => api.get(`/api/invitations/by-code/${code}`),
  
  regenerate: (rsvpId: string) =>
    api.post(`/api/invitations/regenerate/${rsvpId}`),
};

// Check-in API
export const checkInApi = {
  checkIn: (eventId: string, data: any) =>
    api.post(`/api/checkin/${eventId}`, data),
  
  getStats: (eventId: string) => api.get(`/api/checkin/${eventId}/stats`),
  
  getList: (eventId: string, success?: boolean) =>
    api.get(`/api/checkin/${eventId}/list`, { params: { success } }),
};

// Guestbook API
export const guestbookApi = {
  getConfig: (eventId: string, accessCode?: string) =>
    api.get(`/api/guestbook/${eventId}/config`, { params: { accessCode } }),
  
  upload: (eventId: string, formData: FormData, accessCode?: string) =>
    api.post(`/api/guestbook/${eventId}/upload`, formData, {
      params: { accessCode },
      headers: { 'Content-Type': 'multipart/form-data' },
    }),
  
  getQuota: (eventId: string, deviceId?: string, accessCode?: string) =>
    api.get(`/api/guestbook/${eventId}/quota`, { params: { deviceId, accessCode } }),
};

// Media API
export const mediaApi = {
  list: (eventId: string, params?: any) =>
    api.get(`/api/media/event/${eventId}`, { params }),
  
  get: (id: string) => api.get(`/api/media/${id}`),
  
  delete: (id: string) => api.delete(`/api/media/${id}`),
  
  getTimeline: (eventId: string, limit?: number) =>
    api.get(`/api/media/event/${eventId}/timeline`, { params: { limit } }),
  
  getStats: (eventId: string) => api.get(`/api/media/event/${eventId}/stats`),
  
  downloadAll: (eventId: string) =>
    api.get(`/api/media/event/${eventId}/download-all`, { responseType: 'blob' }),
};

// Couple Portal API
export const coupleApi = {
  getEvent: () => api.get('/api/couple/event'),
  
  getRsvps: (params?: any) => api.get('/api/couple/rsvps', { params }),
  
  approveRsvp: (id: string) => api.post(`/api/couple/rsvps/${id}/approve`),
  
  rejectRsvp: (id: string) => api.post(`/api/couple/rsvps/${id}/reject`),
  
  getAttendance: () => api.get('/api/couple/attendance'),
  
  getMedia: (params?: any) => api.get('/api/couple/media', { params }),
  
  downloadAllMedia: () =>
    api.get('/api/couple/media/download-all', { responseType: 'blob' }),
};

// Public API
export const publicApi = {
  getEvent: (slug: string) => api.get(`/api/public/event/${slug}`),
  
  verifyAccess: (eventSlug: string, code: string) =>
    api.get(`/api/public/verify-access/${eventSlug}`, { params: { code } }),
};

export default api;
