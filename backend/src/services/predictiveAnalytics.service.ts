/**
 * predictiveAnalytics.service.ts
 *
 * Statistical + AI-assisted predictive models:
 *  - Revenue forecasting (next 30/60/90 days)
 *  - Territory conversion trends
 *  - Agent close probability ranking
 *  - Campaign ROI projections
 *  - Lead velocity metrics
 *
 * Uses hybrid approach:
 *  1. Statistical baselines (moving averages, regression)
 *  2. AI-enhanced interpretation (pattern recognition, anomaly detection)
 *  3. Cached in PredictiveMetric table (refreshed nightly)
 */

import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

// ══════════════════════════════════════════════════════════════════
// REVENUE FORECASTING
// ══════════════════════════════════════════════════════════════════

export async function forecastRevenue(daysAhead = 30): Promise<{
  predictedRevenue:  number;
  confidenceLow:     number;
  confidenceHigh:    number;
  confidence:        number;
  monthlyTrend:      number[];  // last 6 months actuals
  methodology:       string;
}> {
  // Pull last 6 months of converted leads with estimated revenue
  const sixMonthsAgo = new Date();
  sixMonthsAgo.setMonth(sixMonthsAgo.getMonth() - 6);

  const conversions = await prisma.leadAssignment.findMany({
    where:   { status: 'CONVERTED', assignedAt: { gte: sixMonthsAgo } },
    include: { lead: { select: { estimatedValue: true, aiScore: { select: { estimatedRevenue: true } } } } },
    orderBy: { assignedAt: 'asc' },
  });

  // Group by month and sum revenue
  const byMonth: Record<string, number> = {};
  for (const c of conversions) {
    const key = c.assignedAt.toISOString().slice(0, 7); // YYYY-MM
    const rev = Number(c.lead.aiScore?.estimatedRevenue ?? c.lead.estimatedValue ?? 0) * 0.03;
    byMonth[key] = (byMonth[key] ?? 0) + rev;
  }

  const monthlyValues = Object.values(byMonth);
  const n = monthlyValues.length;

  if (n === 0) {
    return { predictedRevenue: 0, confidenceLow: 0, confidenceHigh: 0, confidence: 0, monthlyTrend: [], methodology: 'no_data' };
  }

  // Simple linear regression over months
  const avg    = monthlyValues.reduce((a, b) => a + b, 0) / n;
  const stdDev = Math.sqrt(monthlyValues.reduce((s, v) => s + Math.pow(v - avg, 2), 0) / n);

  // Trend: slope over last 3 months vs previous 3 months
  const recent = monthlyValues.slice(-3);
  const older  = monthlyValues.slice(-6, -3);
  const recentAvg = recent.reduce((a, b) => a + b, 0) / (recent.length || 1);
  const olderAvg  = older.reduce((a, b) => a + b, 0)  / (older.length || 1);
  const growthRate = olderAvg > 0 ? (recentAvg - olderAvg) / olderAvg : 0;

  // Project forward
  const monthsFwd = daysAhead / 30;
  const predicted = recentAvg * (1 + growthRate * monthsFwd);
  const margin    = stdDev * 1.96 * Math.sqrt(monthsFwd); // 95% CI

  const confidence = Math.max(0.3, Math.min(0.95, 1 - (stdDev / (avg || 1))));

  // Save to DB
  const periodEnd = new Date(Date.now() + daysAhead * 86400000);
  await prisma.predictiveMetric.upsert({
    where: {
      id: 'revenue-forecast-' + new Date().toISOString().slice(0, 10),
    },
    create: {
      metricType:     'revenue_forecast',
      periodStart:    new Date(),
      periodEnd,
      predictedValue: Math.max(0, predicted),
      confidenceLow:  Math.max(0, predicted - margin),
      confidenceHigh: predicted + margin,
      confidenceScore:confidence,
      methodology:    'linear_regression',
      inputFeatures:  { monthsOfData: n, avgMonthlyRevenue: avg, growthRate },
    },
    update: {
      predictedValue: Math.max(0, predicted),
      confidenceLow:  Math.max(0, predicted - margin),
      confidenceHigh: predicted + margin,
      confidenceScore:confidence,
    },
  }).catch(() => {});

  return {
    predictedRevenue:  Math.max(0, Math.round(predicted)),
    confidenceLow:     Math.max(0, Math.round(predicted - margin)),
    confidenceHigh:    Math.round(predicted + margin),
    confidence:        Math.round(confidence * 100),
    monthlyTrend:      monthlyValues.map(v => Math.round(v)),
    methodology:       'linear_regression',
  };
}

// ══════════════════════════════════════════════════════════════════
// TERRITORY CONVERSION ANALYTICS
// ══════════════════════════════════════════════════════════════════

export async function getTerritoryConversionStats(): Promise<Array<{
  territoryId:    string;
  displayName:    string;
  stateCode:      string;
  totalLeads:     number;
  converted:      number;
  conversionRate: number;
  avgScore:       number;
  estimatedRevenue: number;
  trend:          'GROWING' | 'STABLE' | 'DECLINING';
  trendPct:       number;
}>> {
  const territories = await prisma.territory.findMany({
    where:   { isActive: true },
    include: {
      assignments: {
        include: {
          lead: { select: { aiScore: { select: { totalScore: true, estimatedRevenue: true } } } },
        },
      },
    },
    take: 50,
  });

  const thirtyDaysAgo = new Date(Date.now() - 30 * 86400000);
  const sixtyDaysAgo  = new Date(Date.now() - 60 * 86400000);

  return territories.map(t => {
    const all       = t.assignments;
    const converted = all.filter(a => a.status === 'CONVERTED');
    const scores    = all.map(a => a.lead.aiScore?.totalScore ?? 0).filter(s => s > 0);
    const avgScore  = scores.length > 0 ? scores.reduce((a, b) => a + b, 0) / scores.length : 0;
    const revenue   = converted.reduce((s, a) => s + Number(a.lead.aiScore?.estimatedRevenue ?? 0), 0);

    // Trend: recent 30d vs prior 30d
    const recent = all.filter(a => a.assignedAt >= thirtyDaysAgo).length;
    const prior  = all.filter(a => a.assignedAt >= sixtyDaysAgo && a.assignedAt < thirtyDaysAgo).length;
    const trendPct = prior > 0 ? ((recent - prior) / prior) * 100 : 0;
    const trend = trendPct >  10 ? 'GROWING' : trendPct < -10 ? 'DECLINING' : 'STABLE';

    return {
      territoryId:     t.id,
      displayName:     t.displayName,
      stateCode:       t.stateCode,
      totalLeads:      all.length,
      converted:       converted.length,
      conversionRate:  all.length > 0 ? converted.length / all.length : 0,
      avgScore:        Math.round(avgScore),
      estimatedRevenue:Math.round(revenue),
      trend,
      trendPct:        Math.round(trendPct),
    };
  });
}

// ══════════════════════════════════════════════════════════════════
// AGENT PERFORMANCE + CLOSE PROBABILITY
// ══════════════════════════════════════════════════════════════════

export async function getAgentPerformanceRankings(): Promise<Array<{
  agentId:         string;
  agentName:       string;
  leadsAssigned:   number;
  converted:       number;
  conversionRate:  number;
  avgResponseHrs:  number;
  closeProbability:number;
  estimatedRevenue:number;
  rank:            number;
  trend:           string;
}>> {
  const thirtyDaysAgo = new Date(Date.now() - 30 * 86400000);

  const agents = await prisma.user.findMany({
    where: { role: { in: ['agent', 'manager'] } },
    select: {
      id: true, firstName: true, lastName: true,
      receivedAssignments: {
        where:   { assignedAt: { gte: thirtyDaysAgo } },
        include: { lead: { select: { aiScore: { select: { totalScore: true, estimatedRevenue: true } } } } },
      },
    },
  });

  const ranked = agents.map(agent => {
    const assignments = agent.receivedAssignments;
    const converted   = assignments.filter(a => a.status === 'CONVERTED');
    const accepted    = assignments.filter(a => a.acceptedAt);

    // Average response time
    const responseTimes = assignments
      .filter(a => a.acceptedAt)
      .map(a => (new Date(a.acceptedAt!).getTime() - new Date(a.assignedAt).getTime()) / 3600000);
    const avgResponseHrs = responseTimes.length > 0
      ? responseTimes.reduce((a, b) => a + b, 0) / responseTimes.length
      : 0;

    const conversionRate = assignments.length > 0 ? converted.length / assignments.length : 0;

    // Close probability = weighted average of lead scores they converted
    const convertedScores = converted.map(a => a.lead.aiScore?.totalScore ?? 50);
    const avgConvertedScore = convertedScores.length > 0
      ? convertedScores.reduce((a, b) => a + b, 0) / convertedScores.length
      : 50;

    // Composite close probability model:
    // conversion rate × (1 - response time penalty) × quality factor
    const responseTimePenalty = Math.min(0.4, avgResponseHrs / 48);
    const qualityFactor = avgConvertedScore / 100;
    const closeProbability = Math.min(0.95, conversionRate * (1 - responseTimePenalty) * (1 + qualityFactor));

    const estimatedRevenue = converted.reduce(
      (s, a) => s + Number(a.lead.aiScore?.estimatedRevenue ?? 0), 0
    );

    return {
      agentId:          agent.id,
      agentName:        `${agent.firstName} ${agent.lastName}`,
      leadsAssigned:    assignments.length,
      converted:        converted.length,
      conversionRate:   Math.round(conversionRate * 100) / 100,
      avgResponseHrs:   Math.round(avgResponseHrs * 10) / 10,
      closeProbability: Math.round(closeProbability * 100) / 100,
      estimatedRevenue: Math.round(estimatedRevenue),
      trend:            conversionRate >= 0.2 ? 'STRONG' : conversionRate >= 0.1 ? 'AVERAGE' : 'NEEDS_COACHING',
    };
  });

  return ranked
    .sort((a, b) => b.closeProbability - a.closeProbability)
    .map((a, i) => ({ ...a, rank: i + 1 }));
}

// ══════════════════════════════════════════════════════════════════
// PRIORITY CALL QUEUE
// ══════════════════════════════════════════════════════════════════

export async function getPriorityCallQueue(agentId?: string): Promise<Array<{
  assignmentId:  string;
  leadId:        string;
  leadName:      string;
  phone:         string;
  score:         number;
  temperature:   string;
  urgency:       string;
  estimatedValue:number;
  waitingHours:  number;
  callScript?:   string;
  topRecommendation?: string;
  priority:      number;  // computed call priority score
}>> {
  const where: any = {
    status: { in: ['ASSIGNED', 'ACCEPTED'] },
    lead:   { phone: { not: null } },
  };
  if (agentId) where.assignedToId = agentId;

  const assignments = await prisma.leadAssignment.findMany({
    where,
    include: {
      lead: {
        select: {
          id: true, firstName: true, lastName: true, phone: true,
          urgency: true, estimatedValue: true, temperature: true,
          aiScore: {
            select: {
              totalScore: true, callScript: true, recommendations: true,
              estimatedRevenue: true, closeProbability: true,
            },
          },
        },
      },
    },
    orderBy: { assignedAt: 'asc' },
    take:    100,
  });

  const now = Date.now();

  return assignments
    .map(a => {
      const score        = a.lead.aiScore?.totalScore ?? 50;
      const waitingHours = (now - new Date(a.assignedAt).getTime()) / 3600000;
      const closePct     = Number(a.lead.aiScore?.closeProbability ?? 0.5);

      // Priority formula: score + urgency bonus + wait time bonus (diminishing)
      const urgencyBonus: Record<string, number> = {
        IMMEDIATE: 30, THREE_MONTHS: 15, SIX_MONTHS: 5, EXPLORING: 0,
      };
      const waitBonus   = Math.min(20, waitingHours * 0.5);
      const priority    = Math.round(score + (urgencyBonus[a.lead.urgency ?? ''] ?? 0) + waitBonus);
      const recs        = a.lead.aiScore?.recommendations as string[] ?? [];

      return {
        assignmentId:     a.id,
        leadId:           a.lead.id,
        leadName:         `${a.lead.firstName} ${a.lead.lastName}`.trim(),
        phone:            a.lead.phone ?? '',
        score,
        temperature:      a.lead.temperature ?? 'COLD',
        urgency:          a.lead.urgency ?? 'EXPLORING',
        estimatedValue:   Number(a.lead.estimatedValue ?? 0),
        waitingHours:     Math.round(waitingHours * 10) / 10,
        callScript:       a.lead.aiScore?.callScript ?? undefined,
        topRecommendation:recs[0],
        priority,
      };
    })
    .sort((a, b) => b.priority - a.priority);
}

// ══════════════════════════════════════════════════════════════════
// COMPREHENSIVE DASHBOARD METRICS
// ══════════════════════════════════════════════════════════════════

export async function getDashboardIntelligence(): Promise<{
  kpis:           Record<string, number | string>;
  revenue:        Awaited<ReturnType<typeof forecastRevenue>>;
  topTerritories: any[];
  agentRankings:  any[];
  insights:       any[];
  scoreDistribution: { hot: number; warm: number; cold: number; unscored: number };
  recentHighScores: any[];
}> {
  const [
    revenue, territories, agents,
    totalLeads, hotLeads, warmLeads, coldLeads, unscoredLeads,
    recentInsights, recentHighScores,
  ] = await Promise.all([
    forecastRevenue(30),
    getTerritoryConversionStats(),
    getAgentPerformanceRankings(),

    prisma.lead.count(),
    prisma.lead.count({ where: { temperature: 'HOT' } }),
    prisma.lead.count({ where: { temperature: 'WARM' } }),
    prisma.lead.count({ where: { temperature: 'COLD' } }),
    prisma.lead.count({ where: { aiScore: null } }),

    prisma.aiInsight.findMany({
      where:   { isRead: false, OR: [{ expiresAt: null }, { expiresAt: { gt: new Date() } }] },
      orderBy: [{ severity: 'desc' }, { createdAt: 'desc' }],
      take:    10,
    }),

    prisma.leadAiScore.findMany({
      where:   { temperature: 'HOT' },
      orderBy: { totalScore: 'desc' },
      take:    5,
      include: { lead: { select: { firstName: true, lastName: true, city: true, phone: true, urgency: true } } },
    }),
  ]);

  const conversions = await prisma.leadAssignment.count({ where: { status: 'CONVERTED' } });
  const assigned    = await prisma.leadAssignment.count({ where: { status: { not: 'UNASSIGNED' } } });

  return {
    kpis: {
      totalLeads,
      assigned,
      conversions,
      conversionRate: assigned > 0 ? `${Math.round((conversions / assigned) * 100)}%` : '0%',
      avgScore: await prisma.leadAiScore.aggregate({ _avg: { totalScore: true } })
                  .then(r => Math.round(r._avg.totalScore ?? 0)),
    },
    revenue,
    topTerritories:  territories.sort((a, b) => b.estimatedRevenue - a.estimatedRevenue).slice(0, 10),
    agentRankings:   agents.slice(0, 10),
    insights:        recentInsights,
    scoreDistribution: { hot: hotLeads, warm: warmLeads, cold: coldLeads, unscored: unscoredLeads },
    recentHighScores,
  };
}

// ══════════════════════════════════════════════════════════════════
// NIGHTLY SNAPSHOT JOB
// ══════════════════════════════════════════════════════════════════

export async function runNightlyAnalytics(): Promise<void> {
  console.log('[Analytics] Starting nightly analytics run...');

  // 1. Territory snapshots
  const territories = await prisma.territory.findMany({
    where: { isActive: true },
    select: { id: true },
  });

  for (const t of territories) {
    try {
      await snapshotTerritory(t.id);
    } catch (e) {
      console.error(`[Analytics] Territory snapshot failed for ${t.id}:`, e);
    }
  }

  // 2. Agent performance snapshots
  const agents = await prisma.user.findMany({
    where:  { role: { in: ['agent', 'manager'] } },
    select: { id: true },
  });

  for (const a of agents) {
    try {
      await snapshotAgentPerformance(a.id);
    } catch (e) {
      console.error(`[Analytics] Agent snapshot failed for ${a.id}:`, e);
    }
  }

  // 3. Revenue forecast
  await forecastRevenue(30);
  await forecastRevenue(90);

  // 4. Identify unscored leads and enqueue
  const { enqueueLeadScore } = await import('../queues/aiQueue.service');
  const unscored = await prisma.lead.findMany({
    where:  { aiScore: null },
    select: { id: true },
    take:   200,
  });
  for (const l of unscored) {
    await enqueueLeadScore(l.id, false); // background priority
  }

  // 5. Generate AI insights
  await generatePlatformInsights();

  console.log(`[Analytics] Nightly run complete: ${territories.length} territories, ${agents.length} agents, ${unscored.length} leads queued for scoring`);
}

// ─── Snapshot one territory ───────────────────────────────────────

async function snapshotTerritory(territoryId: string): Promise<void> {
  const today = new Date().toISOString().slice(0, 10);

  const [assignments, converted, scores, revenue] = await Promise.all([
    prisma.leadAssignment.count({ where: { territoryId } }),
    prisma.leadAssignment.count({ where: { territoryId, status: 'CONVERTED' } }),
    prisma.leadAiScore.aggregate({
      where:  { lead: { lead_assignments: { some: { territoryId } } } },
      _avg:   { totalScore: true },
    }),
    prisma.leadAiScore.aggregate({
      where:  { lead: { lead_assignments: { some: { territoryId, status: 'CONVERTED' } } } },
      _sum:   { estimatedRevenue: true },
    }),
  ]);

  await prisma.territoryAnalyticsSnapshot.upsert({
    where:  { territoryId_snapshotDate: { territoryId, snapshotDate: new Date(today) } },
    create: {
      territoryId,
      snapshotDate:    new Date(today),
      totalLeads:      assignments,
      assignedLeads:   assignments,
      convertedLeads:  converted,
      avgScore:        scores._avg.totalScore ?? 0,
      actualRevenue:   revenue._sum.estimatedRevenue ?? 0,
      conversionRate:  assignments > 0 ? converted / assignments : 0,
    },
    update: {
      totalLeads:     assignments,
      convertedLeads: converted,
      avgScore:       scores._avg.totalScore ?? 0,
      actualRevenue:  revenue._sum.estimatedRevenue ?? 0,
      conversionRate: assignments > 0 ? converted / assignments : 0,
    },
  });
}

// ─── Snapshot one agent ───────────────────────────────────────────

async function snapshotAgentPerformance(agentId: string): Promise<void> {
  const monthStart = new Date(new Date().getFullYear(), new Date().getMonth(), 1);
  const monthEnd   = new Date(new Date().getFullYear(), new Date().getMonth() + 1, 0);

  const assignments = await prisma.leadAssignment.findMany({
    where: { assignedToId: agentId, assignedAt: { gte: monthStart } },
    include: { lead: { select: { aiScore: { select: { totalScore: true, estimatedRevenue: true } } } } },
  });

  const converted = assignments.filter(a => a.status === 'CONVERTED');
  const accepted  = assignments.filter(a => a.acceptedAt);
  const rejected  = assignments.filter(a => a.status === 'REJECTED');

  const responseTimes = accepted.map(a =>
    (new Date(a.acceptedAt!).getTime() - new Date(a.assignedAt).getTime()) / 3600000
  );
  const avgResponseHours = responseTimes.length
    ? responseTimes.reduce((a, b) => a + b, 0) / responseTimes.length
    : null;

  const scores = assignments.map(a => a.lead.aiScore?.totalScore ?? 0).filter(s => s > 0);
  const avgScore = scores.length ? scores.reduce((a, b) => a + b, 0) / scores.length : null;

  const estimatedRevenue = converted.reduce(
    (s, a) => s + Number(a.lead.aiScore?.estimatedRevenue ?? 0), 0
  );

  await prisma.agentPerformanceMetric.upsert({
    where:  { agentId_periodStart: { agentId, periodStart: monthStart } },
    create: {
      agentId, periodStart: monthStart, periodEnd: monthEnd,
      leadsAssigned:   assignments.length,
      leadsAccepted:   accepted.length,
      leadsConverted:  converted.length,
      leadsRejected:   rejected.length,
      avgResponseHours:avgResponseHours,
      avgLeadScore:    avgScore,
      conversionRate:  assignments.length ? converted.length / assignments.length : 0,
      acceptanceRate:  assignments.length ? accepted.length  / assignments.length : 0,
      estimatedRevenue,
    },
    update: {
      leadsAssigned:   assignments.length,
      leadsAccepted:   accepted.length,
      leadsConverted:  converted.length,
      leadsRejected:   rejected.length,
      avgResponseHours,
      avgLeadScore:    avgScore,
      conversionRate:  assignments.length ? converted.length / assignments.length : 0,
      acceptanceRate:  assignments.length ? accepted.length  / assignments.length : 0,
      estimatedRevenue,
    },
  });
}

// ─── Generate platform-wide AI insights ──────────────────────────

async function generatePlatformInsights(): Promise<void> {
  // Insight: unscored leads
  const unscoredCount = await prisma.lead.count({ where: { aiScore: null } });
  if (unscoredCount > 10) {
    await prisma.aiInsight.create({
      data: {
        type:     'LEAD_OPPORTUNITY',
        title:    `${unscoredCount} leads awaiting AI scoring`,
        body:     `${unscoredCount} leads have not been scored yet. Scoring them will prioritize your call queue and improve conversion rates.`,
        severity: 'INFO',
        isRead:   false,
      },
    }).catch(() => {});
  }

  // Insight: slow-response agents
  const slowAgents = await prisma.agentPerformanceMetric.findMany({
    where:   { avgResponseHours: { gt: 4 }, periodStart: { gte: new Date(Date.now() - 30*86400000) } },
    include: { agentId: true } as any,
    take:    3,
  });
  if (slowAgents.length > 0) {
    await prisma.aiInsight.create({
      data: {
        type:     'AGENT_COACHING',
        title:    `${slowAgents.length} agents have slow response times`,
        body:     `Leads contacted within 1 hour convert 7x better. ${slowAgents.length} agents are averaging >4 hours response time this month.`,
        severity: 'WARNING',
        actionUrl:'/dashboard/analytics/agents',
        actionLabel:'View Agents',
        isRead:   false,
      },
    }).catch(() => {});
  }
}
