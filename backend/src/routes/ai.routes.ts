/**
 * ai.routes.ts
 *
 * Mount in src/index.ts:
 *   import { aiRouter } from './routes/ai.routes';
 *   app.use('/api/v1/ai', aiRouter);
 *
 * Also add to src/index.ts startup:
 *   import { startAiWorkers } from './workers/aiWorkers';
 *   startAiWorkers();
 */

import { Router } from 'express';
import { authenticate, authorize } from '../middleware/auth.middleware';
import {
  getLeadScore, triggerLeadScore, getScoreHistory, batchScoreLeads,
  getCallQueue,
  createFollowUp, cancelFollowUp, getFollowUpSequences,
  getAiDashboard, getRevenueForecast, getTerritoryStats, getAgentStats, getAgentCoaching,
  getInsights, markInsightRead,
  getQueueStatistics, cleanupQueue,
  getRankedLeads,
} from '../controllers/ai.controller';

export const aiRouter = Router();

// All AI routes require authentication
aiRouter.use(authenticate);

// ── Lead Intelligence ──────────────────────────────────────────────
aiRouter.get('/leads/ranked',                       getRankedLeads);
aiRouter.get('/leads/:leadId/score',                getLeadScore);
aiRouter.post('/leads/:leadId/score',               triggerLeadScore);
aiRouter.get('/leads/:leadId/score/history',        getScoreHistory);
aiRouter.post('/leads/batch-score', authorize('admin','manager'), batchScoreLeads);

// ── Call Queue ─────────────────────────────────────────────────────
aiRouter.get('/call-queue',                         getCallQueue);

// ── Follow-up Automation ───────────────────────────────────────────
aiRouter.get('/leads/:leadId/followup',             getFollowUpSequences);
aiRouter.post('/leads/:leadId/followup',            createFollowUp);
aiRouter.delete('/leads/:leadId/followup',          cancelFollowUp);

// ── Analytics & Predictions ────────────────────────────────────────
aiRouter.get('/dashboard',                          getAiDashboard);
aiRouter.get('/analytics/revenue',                  getRevenueForecast);
aiRouter.get('/analytics/territories',              getTerritoryStats);
aiRouter.get('/analytics/agents', authorize('admin','manager'), getAgentStats);
aiRouter.get('/analytics/agents/:agentId/coaching', getAgentCoaching);

// ── AI Insights ────────────────────────────────────────────────────
aiRouter.get('/insights',                           getInsights);
aiRouter.post('/insights/:id/read',                 markInsightRead);

// ── Admin: Queue Management ────────────────────────────────────────
aiRouter.get('/queue/stats',    authorize('admin'), getQueueStatistics);
aiRouter.delete('/queue/cleanup', authorize('admin'), cleanupQueue);
