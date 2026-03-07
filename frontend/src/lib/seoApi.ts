/**
 * seoApi.ts  — add these exports to your existing src/lib/api.ts
 * or import from this file alongside it.
 */

import axios from 'axios';

const API_URL = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:3001/api/v1';

export const api = axios.create({ baseURL: API_URL, headers: { 'Content-Type': 'application/json' } });

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

// ── Templates ─────────────────────────────────────────────────────
export const seoTemplatesApi = {
  list:         (p?: any)           => api.get('/seo/templates', { params: p }),
  get:          (id: string)        => api.get(`/seo/templates/${id}`),
  create:       (d: any)            => api.post('/seo/templates', d),
  update:       (id: string, d: any)=> api.put(`/seo/templates/${id}`, d),
  delete:       (id: string)        => api.delete(`/seo/templates/${id}`),
  seedDefaults: ()                  => api.post('/seo/templates/seed-defaults'),
  preview:      (templateId: string, zipCode?: string) =>
                                       api.post('/seo/templates/preview', { templateId, zipCode }),
};

// ── Pages ─────────────────────────────────────────────────────────
export const seoPagesApi = {
  list:        (p?: any)                        => api.get('/seo/pages', { params: p }),
  get:         (id: string)                     => api.get(`/seo/pages/${id}`),
  generate:    (d: any)                         => api.post('/seo/pages/generate', d),
  publish:     (id: string)                     => api.post(`/seo/pages/${id}/publish`),
  unpublish:   (id: string)                     => api.post(`/seo/pages/${id}/unpublish`),
  bulkAction:  (ids: string[], action: string)  => api.post('/seo/pages/bulk-action', { ids, action }),
  delete:      (id: string)                     => api.delete(`/seo/pages/${id}`),
  stats:       ()                               => api.get('/seo/stats'),
};

// ── Locations ─────────────────────────────────────────────────────
export const seoLocationsApi = {
  list:       (p?: any)              => api.get('/seo/locations', { params: p }),
  create:     (d: any)               => api.post('/seo/locations', d),
  update:     (id: string, d: any)   => api.put(`/seo/locations/${id}`, d),
  delete:     (id: string)           => api.delete(`/seo/locations/${id}`),
  seedVmdc:   ()                     => api.post('/seo/locations/seed-vmdc'),
  bulkImport: (locs: any[])          => api.post('/seo/locations/bulk-import', { locations: locs }),
};

// ── Jobs ──────────────────────────────────────────────────────────
export const seoJobsApi = {
  list: (p?: any) => api.get('/seo/jobs', { params: p }),
};

// ── Public lead capture (no auth) ────────────────────────────────
export const captureLeadPublic = (data: any) =>
  fetch(`${API_URL}/seo/public/lead`, {
    method:  'POST',
    headers: { 'Content-Type': 'application/json' },
    body:    JSON.stringify(data),
  }).then(r => r.json());
