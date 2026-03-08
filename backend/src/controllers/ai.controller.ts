/**
 * ai.controller.ts
 * Simplified AI endpoints - core functionality only
 */

import { Response, NextFunction } from 'express';
import { z } from 'zod';
import { prisma } from '../config/prisma';
import { sendSuccess, sendError } from '../utils/response';
import { AuthRequest } from '../middleware/auth.middleware';
// Inline rule-based scoring
const ruleBasedScore = (lead: any) => {
  let totalScore = 0;
  let temperature: any = 'COLD';
  const urgencyScore = lead.urgency === 'IMMEDIATE' ? 40 : lead.urgency === 'THREE_MONTHS' ? 30 : 10;
  totalScore += urgencyScore;
  const budgetScore = lead.estimatedValue && lead.estimatedValue > 500000 ? 30 : 15;
  totalScore += budgetScore;
  const intentScore = lead.status !== 'NEW' ? 25 : 10;
  totalScore += intentScore;
  if (totalScore >= 70) temperature = 'HOT';
  else if (totalScore >= 40) temperature = 'WARM';
  else temperature = 'COLD';
  return { totalScore, temperature, urgencyScore, budgetScore, intentScore, engagementScore: 0 };
};

// ── Lead Score ────────────────────────────────────────────────────────

/** GET /ai/leads/:leadId/score — Get current score for a lead */
export const getLeadScore = async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const score = await prisma.aiLeadScore.findUnique({
      where: { leadId: req.params.leadId },
      include: { lead: { select: { firstName: true, lastName: true, temperature: true } } },
    });

    if (!score) {
      const lead = await prisma.lead.findUnique({ where: { id: req.params.leadId } });
      if (!lead) return sendError(res, 'Lead not found', 404);
      const quick = ruleBasedScore(lead as any);
      return sendSuccess(res, { ...quick, aiEnhanced: false, queued: true });
    }

    return sendSuccess(res, { ...score, aiEnhanced: true });
  } catch (error) {
    next(error);
  }
};

/** POST /ai/leads/:leadId/score — Trigger AI scoring (async) */
export const triggerLeadScore = async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const { immediate = false } = z.object({ immediate: z.boolean().optional() }).parse(req.body);
    const lead = await prisma.lead.findUnique({ where: { id: req.params.leadId } });
    if (!lead) return sendError(res, 'Lead not found', 404);

    const score = ruleBasedScore(lead as any);
    
    // Save score
    await prisma.aiLeadScore.upsert({
      where: { leadId: req.params.leadId },
      create: {
        leadId: req.params.leadId,
        totalScore: score.totalScore,
        temperature: score.temperature,
        urgencyScore: score.urgencyScore,
        budgetScore: score.budgetScore,
        intentScore: score.intentScore,
        engagementScore: 0,
      },
      update: {
        totalScore: score.totalScore,
        temperature: score.temperature,
        urgencyScore: score.urgencyScore,
        budgetScore: score.budgetScore,
        intentScore: score.intentScore,
      },
    });

    return sendSuccess(res, score, 'Lead scored', 200);
  } catch (error) {
    next(error);
  }
};

/** GET /ai/insights — Get AI insights for dashboard */
export const getInsights = async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const insights = await prisma.aiInsight.findMany({
      where: { expiresAt: { gt: new Date() } },
      orderBy: { createdAt: 'desc' },
      take: 20,
    });

    return sendSuccess(res, insights);
  } catch (error) {
    next(error);
  }
};

/** POST /ai/insights/:id/read — Mark insight as read */
export const markInsightRead = async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const insight = await prisma.aiInsight.update({
      where: { id: req.params.id },
      data: { isRead: true },
    });

    return sendSuccess(res, insight, 'Insight marked as read');
  } catch (error) {
    next(error);
  }
};

/** GET /ai/batch-score — Batch score multiple leads */
export const batchScoreLeads = async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const { leadIds } = z.object({ leadIds: z.array(z.string().uuid()) }).parse(req.body);
    
    const results: any[] = [];
    for (const leadId of leadIds) {
      const lead = await prisma.lead.findUnique({ where: { id: leadId } });
      if (lead) {
        const score = ruleBasedScore(lead as any);
        results.push({ leadId, score });
      }
    }

    return sendSuccess(res, results, `Scored ${results.length} leads`);
  } catch (error) {
    next(error);
  }
};
