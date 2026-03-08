/**
 * aiWorkers.ts
 *
 * Registers all AI job handlers and starts the worker loop.
 * Import and call startAiWorkers() from src/index.ts.
 *
 * Usage in src/index.ts:
 *   import { startAiWorkers } from './workers/aiWorkers';
 *   startAiWorkers();
 */

import { AiJobType } from '@prisma/client';
import {
  registerHandler, startWorker, stopWorker, enqueueLeadScore,
  JobPayload,
} from '../queues/aiQueue.service';
import { scoreAndSaveLead }        from '../services/leadScoring.service';
import { createFollowUpSequence, processPendingFollowUps } from '../services/followUpAutomation.service';
import { runNightlyAnalytics }     from '../services/predictiveAnalytics.service';
import { PrismaClient }            from '@prisma/client';

const prisma = new PrismaClient();

// ─── Register handlers ─────────────────────────────────────────────

function registerAllHandlers() {

  // LEAD_SCORE: Full AI scoring for a single lead
  registerHandler(AiJobType.LEAD_SCORE, async (payload: JobPayload) => {
    if (!payload.leadId) throw new Error('leadId required');
    const result = await scoreAndSaveLead(payload.leadId);
    return { score: result.totalScore, temperature: result.temperature };
  });

  // BATCH_SCORE: Score many leads (splits into individual jobs)
  registerHandler(AiJobType.BATCH_SCORE, async (payload: JobPayload) => {
    const leadIds = payload.leadIds ?? [];
    let queued = 0;
    for (const id of leadIds) {
      await enqueueLeadScore(id, false);
      queued++;
    }
    return { queued };
  });

  // FOLLOWUP_SEQUENCE: Generate + save follow-up steps for a lead
  registerHandler(AiJobType.FOLLOWUP_SEQUENCE, async (payload: JobPayload) => {
    if (!payload.leadId) throw new Error('leadId required');
    const trigger    = (payload.context?.trigger as string) ?? 'no_response';
    const sequenceId = await createFollowUpSequence(payload.leadId, trigger);
    return { sequenceId };
  });

  // TERRITORY_PREDICTION: Snapshot territory analytics
  registerHandler(AiJobType.TERRITORY_PREDICTION, async (payload: JobPayload) => {
    const { runNightlyAnalytics } = await import('../services/predictiveAnalytics.service');
    await runNightlyAnalytics();
    return { completed: true };
  });

  // AGENT_COACHING: Generate coaching notes for an agent
  registerHandler(AiJobType.AGENT_COACHING, async (payload: JobPayload) => {
    if (!payload.agentId) throw new Error('agentId required');
    const apiKey = process.env.OPENAI_API_KEY ?? process.env.ANTHROPIC_API_KEY;
    if (!apiKey) return { skipped: 'No AI key configured' };

    const metric = await prisma.agentPerformanceMetric.findFirst({
      where:   { agentId: payload.agentId },
      orderBy: { periodStart: 'desc' },
    });
    if (!metric) return { skipped: 'No performance data' };

    const prompt = `You are a real estate sales coach. Analyze this agent's metrics and provide specific, actionable coaching.

Metrics (last 30 days):
- Leads assigned: ${metric.leadsAssigned}
- Conversion rate: ${Math.round(Number(metric.conversionRate ?? 0) * 100)}%
- Avg response time: ${metric.avgResponseHours ? `${metric.avgResponseHours} hours` : 'unknown'}
- Avg lead score: ${metric.avgLeadScore ?? 'unknown'}

Respond with JSON only:
{
  "coachingNotes": "<2-3 paragraph coaching assessment>",
  "strengthAreas": ["<strength 1>", "<strength 2>"],
  "improvementAreas": ["<area 1>", "<area 2>", "<area 3>"]
}`;

    const useAnthropic = !!process.env.ANTHROPIC_API_KEY && !process.env.OPENAI_API_KEY;
    const res = await fetch(
      useAnthropic ? 'https://api.anthropic.com/v1/messages' : 'https://api.openai.com/v1/chat/completions',
      {
        method:  'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(useAnthropic
            ? { 'x-api-key': apiKey, 'anthropic-version': '2023-06-01' }
            : { Authorization: `Bearer ${apiKey}` }),
        },
        body: JSON.stringify(
          useAnthropic
            ? { model: 'claude-haiku-4-5-20251001', max_tokens: 800, messages: [{ role:'user', content: prompt }] }
            : { model: 'gpt-4o-mini', max_tokens: 800, messages: [{ role:'user', content: prompt }] }
        ),
        signal: AbortSignal.timeout(15000),
      }
    );

    const data = await res.json();
    const raw  = useAnthropic ? data.content?.[0]?.text : data.choices?.[0]?.message?.content;
    const parsed = JSON.parse((raw ?? '{}').replace(/```json|```/g, '').trim());

    await prisma.agentPerformanceMetric.update({
      where: { id: metric.id },
      data:  {
        coachingNotes:    parsed.coachingNotes,
        strengthAreas:    parsed.strengthAreas ?? [],
        improvementAreas: parsed.improvementAreas ?? [],
      },
    });

    return { coachingGenerated: true };
  });

}

// ─── Cron jobs ─────────────────────────────────────────────────────

function startCronJobs() {
  // Follow-up delivery: every 5 minutes
  setInterval(async () => {
    const count = await processPendingFollowUps().catch(err => {
      console.error('[Cron] Follow-up error:', err);
      return 0;
    });
    if (count > 0) console.log(`[Cron] Delivered ${count} follow-up messages`);
  }, 5 * 60 * 1000);

  // Score unprocessed leads: every 15 minutes
  setInterval(async () => {
    const unscored = await prisma.lead.findMany({
      where:  { aiScore: null, createdAt: { gte: new Date(Date.now() - 7 * 86400000) } },
      select: { id: true },
      take:   20,
    });
    for (const l of unscored) {
      await enqueueLeadScore(l.id, false);
    }
  }, 15 * 60 * 1000);

  // Nightly analytics: 2:00 AM
  const scheduleNightly = () => {
    const now    = new Date();
    const target = new Date(now);
    target.setHours(2, 0, 0, 0);
    if (target <= now) target.setDate(target.getDate() + 1);
    const delayMs = target.getTime() - now.getTime();

    setTimeout(async () => {
      try {
        console.log('[Cron] Starting nightly analytics...');
        await runNightlyAnalytics();
      } catch (err) {
        console.error('[Cron] Nightly analytics failed:', err);
      }
      scheduleNightly(); // reschedule
    }, delayMs);

    console.log(`[Cron] Nightly analytics scheduled for ${target.toLocaleTimeString()}`);
  };
  scheduleNightly();
}

// ─── Main entry point ─────────────────────────────────────────────

export function startAiWorkers() {
  registerAllHandlers();
  startWorker({ pollIntervalMs: 3000, concurrency: 3 });
  startCronJobs();
  console.log('[AI] Workers and crons started');
}

export function stopAiWorkers() {
  stopWorker();
  console.log('[AI] Workers stopped');
}

// ─── Graceful shutdown ────────────────────────────────────────────

process.on('SIGTERM', stopAiWorkers);
process.on('SIGINT',  stopAiWorkers);
