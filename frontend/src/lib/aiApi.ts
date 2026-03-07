// src/lib/aiApi.ts
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

export const aiApi = {
  // Lead scoring
  getScore:      (leadId: string)       => api.get(`/ai/leads/${leadId}/score`),
  triggerScore:  (leadId: string, immediate = false) =>
                   api.post(`/ai/leads/${leadId}/score`, { immediate }),
  scoreHistory:  (leadId: string)       => api.get(`/ai/leads/${leadId}/score/history`),
  batchScore:    (filter = 'unscored')  => api.post('/ai/leads/batch-score', { filter }),
  rankedLeads:   (p?: any)              => api.get('/ai/leads/ranked', { params: p }),

  // Call queue
  callQueue:     (agentId?: string)     => api.get('/ai/call-queue', { params: agentId ? { agentId } : {} }),

  // Follow-ups
  getFollowUps:    (leadId: string)     => api.get(`/ai/leads/${leadId}/followup`),
  createFollowUp:  (leadId: string, trigger?: string, useAi = true) =>
                     api.post(`/ai/leads/${leadId}/followup`, { trigger, useAi }),
  cancelFollowUp:  (leadId: string)     => api.delete(`/ai/leads/${leadId}/followup`),

  // Analytics
  dashboard:       ()                   => api.get('/ai/dashboard'),
  revenueForecast: (days = 30)          => api.get('/ai/analytics/revenue', { params: { days } }),
  territoryStats:  ()                   => api.get('/ai/analytics/territories'),
  agentStats:      ()                   => api.get('/ai/analytics/agents'),
  agentCoaching:   (agentId: string)    => api.get(`/ai/analytics/agents/${agentId}/coaching`),

  // Insights
  insights:        (p?: any)            => api.get('/ai/insights', { params: p }),
  markRead:        (id: string)         => api.post(`/ai/insights/${id}/read`),

  // Queue admin
  queueStats:      ()                   => api.get('/ai/queue/stats'),
  cleanupQueue:    ()                   => api.delete('/ai/queue/cleanup'),
};