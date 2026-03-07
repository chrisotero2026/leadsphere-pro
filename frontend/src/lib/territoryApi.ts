/**
 * territoryApi.ts — add to your existing src/lib/api.ts or import separately
 */

import axios from 'axios';

const API_URL = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:3001/api/v1';

export const api = axios.create({ baseURL: API_URL });
api.interceptors.request.use(cfg => {
  if (typeof window !== 'undefined') {
    const t = localStorage.getItem('token');
    if (t) cfg.headers.Authorization = `Bearer ${t}`;
  }
  return cfg;
});
api.interceptors.response.use(r => r, err => {
  if (err.response?.status === 401 && typeof window !== 'undefined') {
    localStorage.removeItem('token');
    window.location.href = '/login';
  }
  return Promise.reject(err);
});

export const territoriesApi = {
  list:               (p?: any)              => api.get('/territories', { params: p }),
  get:                (id: string)           => api.get(`/territories/${id}`),
  create:             (d: any)               => api.post('/territories', d),
  update:             (id: string, d: any)   => api.put(`/territories/${id}`, d),
  delete:             (id: string)           => api.delete(`/territories/${id}`),
  available:          (p?: any)              => api.get('/territories/available', { params: p }),
  myTerritories:      ()                     => api.get('/territories/my'),
  assignUser:         (id: string, d: any)   => api.post(`/territories/${id}/assign-user`, d),
  removeOwner:        (id: string, userId: string) => api.delete(`/territories/${id}/remove-owner`, { data: { userId } }),
  purchase:           (id: string, d: any)   => api.post(`/territories/${id}/purchase`, d),
  seedFromLocations:  (d: any)               => api.post('/territories/seed-from-locations', d),
};

export const assignmentsApi = {
  list:           (p?: any)    => api.get('/territories/assignments', { params: p }),
  get:            (id: string) => api.get(`/territories/assignments/${id}`),
  stats:          ()           => api.get('/territories/assignments/stats'),
  unassigned:     (p?: any)    => api.get('/territories/assignments/unassigned', { params: p }),
  accept:         (id: string) => api.post(`/territories/assignments/${id}/accept`),
  reject:         (id: string, reason?: string) => api.post(`/territories/assignments/${id}/reject`, { reason }),
  markWorking:    (id: string) => api.post(`/territories/assignments/${id}/working`),
  markConverted:  (id: string) => api.post(`/territories/assignments/${id}/convert`),
  redistribute:   (d: any)     => api.post('/territories/assignments/redistribute', d),
  distribute:     (leadId: string) => api.post(`/territories/distribute/${leadId}`),
};

export const notificationsApi = {
  list:           (p?: any)    => api.get('/territories/notifications', { params: p }),
  unreadCount:    ()           => api.get('/territories/notifications/unread-count'),
  markRead:       (id: string) => api.post(`/territories/notifications/${id}/read`),
  markAllRead:    ()           => api.post('/territories/notifications/mark-all-read'),
  updatePrefs:    (d: any)     => api.put('/territories/notifications/preferences', d),
};