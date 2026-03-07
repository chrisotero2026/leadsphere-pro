/**
 * billingApi.ts
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

export const plansApi = {
  list: () => api.get('/billing/plans'),
};

export const subscriptionApi = {
  get:          ()                                         => api.get('/billing/subscription'),
  checkout:     (planTier: string, interval = 'monthly')  => api.post('/billing/subscription/checkout', { planTier, interval }),
  portal:       ()                                         => api.post('/billing/subscription/portal'),
  cancel:       (immediately = false)                      => api.post('/billing/subscription/cancel', { immediately }),
  reactivate:   ()                                         => api.post('/billing/subscription/reactivate'),
  payments:     (p?: any)                                  => api.get('/billing/payments', { params: p }),
  invoices:     (p?: any)                                  => api.get('/billing/invoices', { params: p }),
};

export const marketplaceApi = {
  list:      (p?: any)        => api.get('/billing/marketplace', { params: p }),
  get:       (id: string)     => api.get(`/billing/marketplace/${id}`),
  myOrders:  ()               => api.get('/billing/marketplace/my'),
  purchase:  (listingId: string) => api.post('/billing/marketplace/purchase', { listingId }),
};

export const adminBillingApi = {
  subscriptions: (p?: any)   => api.get('/billing/admin/subscriptions', { params: p }),
  revenue:       ()           => api.get('/billing/admin/revenue'),
  seedListings:  (d: any)     => api.post('/billing/admin/marketplace/seed', d),
  createListing: (d: any)     => api.post('/billing/admin/marketplace', d),
};
