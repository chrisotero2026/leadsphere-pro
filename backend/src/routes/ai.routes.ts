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
  getLeadScore, triggerLeadScore, batchScoreLeads,
  getInsights, markInsightRead,
} from '../controllers/ai.controller';

export const aiRouter = Router();

// All AI routes require authentication
aiRouter.use(authenticate);

// ── Lead Intelligence ──────────────────────────────────────────────
aiRouter.get('/leads/:leadId/score',                getLeadScore);
aiRouter.post('/leads/:leadId/score',               triggerLeadScore);
aiRouter.post('/leads/batch-score', authorize('admin','manager'), batchScoreLeads);

// ── AI Insights ────────────────────────────────────────────────────
aiRouter.get('/insights',                           getInsights);
aiRouter.post('/insights/:id/read',                 markInsightRead);
