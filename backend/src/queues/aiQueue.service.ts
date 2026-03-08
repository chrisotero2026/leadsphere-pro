/**
 * aiQueue.service.ts
 *
 * Lightweight priority job queue backed by PostgreSQL.
 * Workers poll the DB — no Redis required for MVP.
 * Production: drop-in replace with BullMQ for horizontal scaling.
 *
 * Features:
 *  - Priority levels (1=urgent, 10=background)
 *  - Automatic retries with exponential backoff
 *  - Concurrent worker slots (configurable)
 *  - Dead-letter after maxAttempts
 *  - Graceful shutdown
 */

import { PrismaClient, AiJobStatus, AiJobType } from '@prisma/client';

const prisma = new PrismaClient();

// ─── Types ────────────────────────────────────────────────────────────

export interface JobPayload {
  leadId?:       string;
  leadIds?:      string[];
  agentId?:      string;
  territoryId?:  string;
  campaignId?:   string;
  context?:      Record<string, unknown>;
}

export type JobHandler = (payload: JobPayload) => Promise<Record<string, unknown>>;

// ─── Handler registry ─────────────────────────────────────────────────

const handlers = new Map<AiJobType, JobHandler>();

export function registerHandler(type: AiJobType, handler: JobHandler) {
  handlers.set(type, handler);
}

// ─── Enqueue a job ────────────────────────────────────────────────────

export async function enqueueJob(
  type:         AiJobType,
  payload:      JobPayload,
  priority      = 5,         // 1 = high priority, 10 = background
  delayMs       = 0,
  maxAttempts   = 3
): Promise<string> {
  const scheduledFor = new Date(Date.now() + delayMs);
  const job = await prisma.aiJob.create({
    data: { type, status: AiJobStatus.QUEUED, priority, payload, scheduledFor, maxAttempts },
  });
  return job.id;
}

// ─── Enqueue high-priority lead scoring ──────────────────────────────

export async function enqueueLeadScore(leadId: string, immediate = false): Promise<string> {
  return enqueueJob(
    AiJobType.LEAD_SCORE,
    { leadId },
    immediate ? 1 : 5,
    immediate ? 0 : 2000  // 2s delay for background
  );
}

// ─── Enqueue follow-up generation ────────────────────────────────────

export async function enqueueFollowUp(leadId: string, trigger: string): Promise<string> {
  return enqueueJob(AiJobType.FOLLOWUP_SEQUENCE, { leadId, context: { trigger } }, 3);
}

// ─── Enqueue batch scoring ────────────────────────────────────────────

export async function enqueueBatchScore(leadIds: string[]): Promise<string> {
  return enqueueJob(AiJobType.BATCH_SCORE, { leadIds }, 8);
}

// ─── Worker: claim and process one job ────────────────────────────────

async function processNextJob(): Promise<boolean> {
  // Atomic claim: find highest-priority queued job, mark as PROCESSING
  const job = await prisma.$transaction(async (tx) => {
    const candidate = await tx.aiJob.findFirst({
      where: {
        status:       AiJobStatus.QUEUED,
        scheduledFor: { lte: new Date() },
        attempts:     { lt: tx.aiJob.fields.maxAttempts as any },  // workaround
      },
      orderBy: [{ priority: 'asc' }, { scheduledFor: 'asc' }],
    });

    if (!candidate) return null;

    // Re-check maxAttempts manually
    if (candidate.attempts >= candidate.maxAttempts) {
      await tx.aiJob.update({
        where: { id: candidate.id },
        data:  { status: AiJobStatus.FAILED, error: 'Max attempts exceeded' },
      });
      return null;
    }

    return tx.aiJob.update({
      where: { id: candidate.id },
      data: {
        status:     AiJobStatus.PROCESSING,
        startedAt:  new Date(),
        attempts:   { increment: 1 },
      },
    });
  });

  if (!job) return false;

  const handler = handlers.get(job.type);
  if (!handler) {
    await prisma.aiJob.update({
      where: { id: job.id },
      data:  { status: AiJobStatus.FAILED, error: `No handler for ${job.type}` },
    });
    return true;
  }

  const startMs = Date.now();
  try {
    const result = await handler(job.payload as JobPayload);
    const ms = Date.now() - startMs;

    await prisma.aiJob.update({
      where: { id: job.id },
      data: {
        status:       AiJobStatus.COMPLETED,
        result,
        completedAt:  new Date(),
        processingMs: ms,
      },
    });
  } catch (err: any) {
    const ms       = Date.now() - startMs;
    const isLastAttempt = job.attempts >= job.maxAttempts;

    // Exponential backoff for retries
    const backoffMs = isLastAttempt ? 0 : Math.min(60000 * Math.pow(2, job.attempts - 1), 300000);

    await prisma.aiJob.update({
      where: { id: job.id },
      data: {
        status:       isLastAttempt ? AiJobStatus.FAILED : AiJobStatus.QUEUED,
        error:        err.message,
        scheduledFor: isLastAttempt ? undefined : new Date(Date.now() + backoffMs),
        processingMs: ms,
      },
    });

    console.error(`[AIQueue] Job ${job.id} (${job.type}) failed:`, err.message);
  }

  return true;
}

// ─── Worker loop ──────────────────────────────────────────────────────

let workerRunning = false;
let workerInterval: NodeJS.Timeout | null = null;

export function startWorker(options: {
  pollIntervalMs?: number;
  concurrency?:    number;
} = {}) {
  const { pollIntervalMs = 3000, concurrency = 3 } = options;

  if (workerRunning) return;
  workerRunning = true;

  console.log(`[AIQueue] Worker started — ${concurrency} concurrent, ${pollIntervalMs}ms poll`);

  const tick = async () => {
    if (!workerRunning) return;
    try {
      // Run up to `concurrency` jobs in parallel
      const slots = Array(concurrency).fill(null);
      await Promise.allSettled(slots.map(() => processNextJob()));
    } catch (err) {
      console.error('[AIQueue] Worker tick error:', err);
    }
  };

  workerInterval = setInterval(tick, pollIntervalMs);
  tick(); // immediate first run
}

export function stopWorker() {
  workerRunning = false;
  if (workerInterval) {
    clearInterval(workerInterval);
    workerInterval = null;
  }
  console.log('[AIQueue] Worker stopped');
}

// ─── Queue stats ──────────────────────────────────────────────────────

export async function getQueueStats() {
  const [queued, processing, completed, failed] = await Promise.all([
    prisma.aiJob.count({ where: { status: AiJobStatus.QUEUED } }),
    prisma.aiJob.count({ where: { status: AiJobStatus.PROCESSING } }),
    prisma.aiJob.count({ where: { status: AiJobStatus.COMPLETED } }),
    prisma.aiJob.count({ where: { status: AiJobStatus.FAILED } }),
  ]);

  const avgProcessingMs = await prisma.aiJob.aggregate({
    where:   { status: AiJobStatus.COMPLETED },
    _avg:    { processingMs: true },
  });

  const recentErrors = await prisma.aiJob.findMany({
    where:   { status: AiJobStatus.FAILED },
    orderBy: { completedAt: 'desc' },
    take:    5,
    select:  { type: true, error: true, completedAt: true },
  });

  return {
    queued, processing, completed, failed,
    total:          queued + processing + completed + failed,
    avgProcessingMs:Math.round(avgProcessingMs._avg.processingMs ?? 0),
    recentErrors,
    isRunning:      workerRunning,
  };
}

// ─── Cleanup old jobs ─────────────────────────────────────────────────

export async function cleanupOldJobs(daysOld = 7) {
  const cutoff = new Date(Date.now() - daysOld * 86400000);
  const { count } = await prisma.aiJob.deleteMany({
    where: {
      status:    { in: [AiJobStatus.COMPLETED, AiJobStatus.FAILED] },
      createdAt: { lt: cutoff },
    },
  });
  return count;
}
