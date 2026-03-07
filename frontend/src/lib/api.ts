import axios from 'axios';

const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001/api/v1';

export const api = axios.create({
  baseURL: API_URL,
  headers: { 'Content-Type': 'application/json' },
});

// Attach JWT token to every request
api.interceptors.request.use((config) => {
  if (typeof window !== 'undefined') {
    const token = localStorage.getItem('token');
    if (token) config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

// Handle 401 → redirect to login
api.interceptors.response.use(
  (response) => response,
  async (error) => {
    if (error.response?.status === 401 && typeof window !== 'undefined') {
      localStorage.removeItem('token');
      localStorage.removeItem('user');
      window.location.href = '/login';
    }
    return Promise.reject(error);
  }
);

// ── Auth ─────────────────────────────────────────────────────────
export const authApi = {
  login: (email: string, password: string) =>
    api.post('/auth/login', { email, password }),
  register: (data: { email: string; password: string; firstName: string; lastName: string }) =>
    api.post('/auth/register', data),
  me: () => api.get('/auth/me'),
  changePassword: (currentPassword: string, newPassword: string) =>
    api.put('/auth/change-password', { currentPassword, newPassword }),
};

// ── Leads ─────────────────────────────────────────────────────────
export const leadsApi = {
  getAll: (params?: Record<string, string | number>) =>
    api.get('/leads', { params }),
  getById: (id: string) => api.get(`/leads/${id}`),
  create: (data: unknown) => api.post('/leads', data),
  update: (id: string, data: unknown) => api.put(`/leads/${id}`, data),
  delete: (id: string) => api.delete(`/leads/${id}`),
  assign: (id: string, userId: string) => api.post(`/leads/${id}/assign`, { userId }),
  unassign: (id: string, userId: string) => api.delete(`/leads/${id}/assign/${userId}`),
  bulkUpdateStatus: (ids: string[], status: string) =>
    api.put('/leads/bulk-status', { ids, status }),
};

// ── Users ─────────────────────────────────────────────────────────
export const usersApi = {
  getAll: (params?: Record<string, string | number>) =>
    api.get('/users', { params }),
  getById: (id: string) => api.get(`/users/${id}`),
  create: (data: unknown) => api.post('/users', data),
  update: (id: string, data: unknown) => api.put(`/users/${id}`, data),
  delete: (id: string) => api.delete(`/users/${id}`),
  getRoles: () => api.get('/users/roles'),
};

// ── Activities ────────────────────────────────────────────────────
export const activitiesApi = {
  getAll: (leadId?: string) => api.get('/activities', { params: leadId ? { leadId } : {} }),
  create: (data: unknown) => api.post('/activities', data),
  delete: (id: string) => api.delete(`/activities/${id}`),
};

// ── Stats ─────────────────────────────────────────────────────────
export const statsApi = {
  dashboard: () => api.get('/stats/dashboard'),
};
