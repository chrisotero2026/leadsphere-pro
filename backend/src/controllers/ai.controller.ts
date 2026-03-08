/**
 * ai.controller.ts
 * All AI-related HTTP endpoints
 */

import { Response, NextFunction } from 'express';
import { z } from 'zod';
import { PrismaClient } from '@prisma/client';
import { AuthRequest } from '../middleware/auth.middleware';
import { scoreAndSaveLead, ruleBasedScore } from '../services/leadScoring.service';
import { createFollowUpSequence, cancelSequenceForLead } from '../services/followUpAutomation.service';
import {
  getDashboardIntelligence, getPriorityCallQueue,
  getTerritoryConversionStats, getAgentPerformanceRankings,
  forecastRevenue,
} from '../services/predictiveAnalytics.service';
import {
  enqueueLeadScore, enqueueBatchScore, enqueueFollowUp,
  getQueueStats, cleanupOldJobs,
} from '../queues/aiQueue.service';

const prisma = new PrismaClient();

// ── Lead Score ────────────────────────────────────────────────────────

/** GET /ai/leads/:leadId/score — Get current score for a lead */
export const getLeadScore = async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const score = await prisma.leadAiScore.findUnique({
      where: { leadId: req.params.leadId },
      include: { lead: { select: { firstName: true, lastName: true, temperature: true } } },
    });

    if (!score) {
      // Run rule-based score instantly
      const lead = await prisma.lead.findUnique({ where: { id: req.params.leadId } });
      if (!lead) return res.status(404).json({ error: 'Lead not found' });
      const quick = ruleBasedScore(lead as any);
      return res.json({ data: { ...quick, totalScore: quick.total, aiEnhanced: false, queued: true } });
    }

    return res.json({ data: { ...score, aiEnhanced: true } });
  } catch (e) { next(e); }
};

/** POST /ai/leads/:leadId/score — Trigger AI scoring (async) */
export const triggerLeadScore = async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const { immediate = false } = z.object({ immediate: z.boolean().optional() }).parse(req.body);
    const lead = await prisma.lead.findUnique({ where: { id: req.params.leadId } });
    if (!lead) return res.status(404).json({ error: 'Lead not found' });

    if (immediate) {
      // Score synchronously (use sparingly — blocks request)
      const result = await scoreAndSaveLead(req.params.leadId);
      return res.json({ data: result, message: 'Scored immediately' });
    }

    const jobId = await enqueueLeadScore(req.params.leadId, false);
    return res.json({ data: { jobId }, message: 'Scoring queued' });
  } catch (e) { next(e); }
};

/** GET /ai/leads/:leadId/score/history — Scoring history */
export const getScoreHistory = async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const history = await prisma.leadScoreHistory.findMany({
      where:   { leadId: req.params.leadId },
      orderBy: { createdAt: 'desc' },
      take:    20,
    });
    return res.json({ data: history });
  } catch (e) { next(e); }
};

/** POST /ai/leads/batch-score — Score multiple leads */
export const batchScoreLeads = async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const { leadIds, filter } = z.object({
      leadIds: z.array(z.string().uuid()).max(500).optional(),
      filter:  z.enum(['unscored', 'stale', 'hot', 'all']).default('unscored'),
    }).parse(req.body);

    let ids = leadIds ?? [];
    if (!ids.length) {
      let where: any = {};
      if (filter === 'unscored') where = { aiScore: null };
      if (filter === 'stale')    where = { aiScore: { updatedAt: { lt: new Date(Date.now() - 7 * 86400000) } } };
      if (filter === 'hot')      where = { temperature: 'HOT' };
      const leads = await prisma.lead.findMany({ where, select: { id: true }, take: 500 });
      ids = leads.map(l => l.id);
    }

    const jobId = await enqueueBatchScore(ids);
    return res.json({ data: { jobId, count: ids.length }, message: `${ids.length} leads queued for scoring` });
  } catch (e) { next(e); }
};

// ── Call Queue ────────────────────────────────────────────────────────

/** GET /ai/call-queue — Priority-ranked call queue */
export const getCallQueue = async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const agentId = req.query.agentId as string | undefined
      ?? (req.user?.role === 'agent' ? req.user.userId : undefined);

    const queue = await getPriorityCallQueue(agentId);
    return res.json({
      data:  queue,
      meta: {
        total:   queue.length,
        hot:     queue.filter(q => q.temperature === 'HOT').length,
        warm:    queue.filter(q => q.temperature === 'WARM').length,
        cold:    queue.filter(q => q.temperature === 'COLD').length,
      },
    });
  } catch (e) { next(e); }
};

// ── Follow-up Sequences ────────────────────────────────────────────────

/** POST /ai/leads/:leadId/followup — Create follow-up sequence */
export const createFollowUp = async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const { trigger = 'manual', useAi = true } = z.object({
      trigger: z.string().optional(),
      useAi:   z.boolean().optional(),
    }).parse(req.body);

    const seqId = await createFollowUpSequence(req.params.leadId, trigger, useAi);
    return res.status(201).json({ data: { sequenceId: seqId }, message: 'Follow-up sequence created' });
  } catch (e) { next(e); }
};

/** DELETE /ai/leads/:leadId/followup — Cancel active sequences */
export const cancelFollowUp = async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    await cancelSequenceForLead(req.params.leadId);
    return res.json({ data: null, message: 'Follow-up sequences canceled' });
  } catch (e) { next(e); }
};

/** GET /ai/leads/:leadId/followup — Get sequences for a lead */
export const getFollowUpSequences = async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const sequences = await prisma.followUpSequence.findMany({
      where:   { leadId: req.params.leadId },
      include: { steps: { orderBy: { stepNumber: 'asc' } } },
      orderBy: { createdAt: 'desc' },
    });
    return res.json({ data: sequences });
  } catch (e) { next(e); }
};

// ── Analytics / Predictions ───────────────────────────────────────────

/** GET /ai/dashboard — Full intelligence dashboard */
export const getAiDashboard = async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const data = await getDashboardIntelligence();
    return res.json({ data });
  } catch (e) { next(e); }
};

/** GET /ai/analytics/revenue — Revenue forecast */
export const getRevenueForecast = async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const days = Math.min(365, parseInt(req.query.days as string) || 30);
    const data = await forecastRevenue(days);
    return res.json({ data });
  } catch (e) { next(e); }
};

/** GET /ai/analytics/territories — Territory conversion stats */
export const getTerritoryStats = async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const data = await getTerritoryConversionStats();
    return res.json({ data });
  } catch (e) { next(e); }
};

/** GET /ai/analytics/agents — Agent performance rankings */
export const getAgentStats = async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const data = await getAgentPerformanceRankings();
    return res.json({ data });
  } catch (e) { next(e); }
};

/** GET /ai/analytics/agents/:agentId/coaching — Agent coaching notes */
export const getAgentCoaching = async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const metric = await prisma.agentPerformanceMetric.findFirst({
      where:   { agentId: req.params.agentId },
      orderBy: { periodStart: 'desc' },
    });
    if (!metric) return res.status(404).json({ error: 'No performance data found' });
    return res.json({ data: metric });
  } catch (e) { next(e); }
};

// ── Insights ──────────────────────────────────────────────────────────

/** GET /ai/insights — List AI insights */
export const getInsights = async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const unreadOnly = req.query.unread === 'true';
    const severity   = req.query.severity as string;

    const where: any = {
      OR: [
        { targetUserId: req.user!.userId },
        { targetUserId: null }, // platform-wide
      ],
      OR: [{ expiresAt: null }, { expiresAt: { gt: new Date() } }],
    };
    if (unreadOnly) where.isRead = false;
    if (severity)   where.severity = severity;

    const insights = await prisma.aiInsight.findMany({
      where,
      orderBy: [{ severity: 'desc' }, { createdAt: 'desc' }],
      take:    50,
    });

    return res.json({
      data:        insights,
      unreadCount: await prisma.aiInsight.count({ where: { ...where, isRead: false } }),
    });
  } catch (e) { next(e); }
};

/** POST /ai/insights/:id/read — Mark insight as read */
export const markInsightRead = async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    await prisma.aiInsight.update({
      where: { id: req.params.id },
      data:  { isRead: true, readAt: new Date() },
    });
    return res.json({ data: null, message: 'Marked as read' });
  } catch (e) { next(e); }
};

// ── Job Queue Admin ───────────────────────────────────────────────────

/** GET /ai/queue/stats — Queue statistics */
export const getQueueStatistics = async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const stats = await getQueueStats();
    return res.json({ data: stats });
  } catch (e) { next(e); }
};

/** DELETE /ai/queue/cleanup — Clean up old completed jobs */
export const cleanupQueue = async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const days = parseInt(req.query.days as string) || 7;
    const count = await cleanupOldJobs(days);
    return res.json({ data: { deleted: count }, message: `Deleted ${count} old jobs` });
  } catch (e) { next(e); }
};

/** GET /ai/leads/ranked — All leads ranked by AI score */
export const getRankedLeads = async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const page   = Math.max(1, parseInt(req.query.page  as string) || 1);
    const limit  = Math.min(100, parseInt(req.query.limit as string) || 25);
    const temp   = req.query.temperature as string;
    const minScore = parseInt(req.query.minScore as string) || 0;

    const where: any = { totalScore: { gte: minScore } };
    if (temp) where.temperature = temp;

    const [scores, total] = await Promise.all([
      prisma.leadAiScore.findMany({
        where,
        skip:    (page - 1) * limit,
        take:    limit,
        orderBy: { totalScore: 'desc' },
        include: {
          lead: {
            select: {
              id: true, firstName: true, lastName: true, phone: true,
              email: true, city: true, stateCode: true, urgency: true,
              estimatedValue: true, createdAt: true,
              lead_assignments: {
                where:  { status: { in: ['ASSIGNED','ACCEPTED','WORKING'] } },
                select: { assignedToId: true, status: true },
                take:   1,
              },
            },
          },
        },
      }),
      prisma.leadAiScore.count({ where }),
    ]);

    return res.json({
      data:       scores,
      pagination: { page, limit, total, pages: Math.ceil(total / limit) },
    });
  } catch (e) { next(e); }
};
