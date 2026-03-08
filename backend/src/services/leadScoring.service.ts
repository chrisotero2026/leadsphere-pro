/**
 * leadScoring.service.ts
 *
 * THE BRAIN — Scores every lead using a two-pass approach:
 *
 * Pass 1: Rule-based scoring (deterministic, instant, free)
 *   → Evaluates structured fields: urgency, estimated value, phone, email
 *   → Runs synchronously when lead is created
 *
 * Pass 2: AI-enhanced scoring (GPT-4o, async, queued)
 *   → Deep analysis: market context, sentiment, likelihood patterns
 *   → Generates call scripts, objection handlers, product recommendations
 *   → Updates score record with enriched insights
 *
 * Score dimensions (all 0–100):
 *   urgency      (30%) — How fast does this person need to act?
 *   budget       (25%) — What's the estimated deal value?
 *   intent       (20%) — How motivated/serious are they?
 *   engagement   (10%) — How complete is their profile?
 *   credit       (10%) — Financial signals
 *   timeline     ( 5%) — Speed-to-close signals
 */

import { PrismaClient } from '@prisma/client';
import { enqueueLeadScore } from '../queues/aiQueue.service';

const prisma = new PrismaClient();

// ─── Types ────────────────────────────────────────────────────────────

export interface ScoringDimensions {
  urgencyScore:    number;
  budgetScore:     number;
  intentScore:     number;
  engagementScore: number;
  creditScore:     number;
  timelineScore:   number;
}

export interface LeadScoreResult {
  totalScore:        number;
  temperature:       string;
  dimensions:        ScoringDimensions;
  summary?:          string;
  strengths:         string[];
  risks:             string[];
  recommendations:   string[];
  callScript?:       string;
  objectionHandlers: Record<string, string>;
  productMatch?:     string;
  programMatch?:     string;
  closeProbability?: number;
  estimatedDaysToClose?: number;
  estimatedRevenue?: number;
}

// ─── WEIGHTS ──────────────────────────────────────────────────────────

const WEIGHTS = {
  urgency:    0.30,
  budget:     0.25,
  intent:     0.20,
  engagement: 0.10,
  credit:     0.10,
  timeline:   0.05,
};

// ─── PASS 1: Rule-based scoring (instant, no API calls) ───────────────

export function ruleBasedScore(lead: Record<string, any>): ScoringDimensions & { total: number; temperature: string } {
  // Urgency score
  let urgencyScore = 0;
  const urgency = lead.urgency?.toUpperCase() ?? '';
  if      (urgency === 'IMMEDIATE')    urgencyScore = 100;
  else if (urgency === 'THREE_MONTHS') urgencyScore = 65;
  else if (urgency === 'SIX_MONTHS')  urgencyScore = 35;
  else if (urgency === 'EXPLORING')   urgencyScore = 15;
  // Boost for specific motivators
  if (lead.motivationReason?.includes('foreclosure') || lead.notes?.toLowerCase().includes('foreclosure')) urgencyScore = Math.min(100, urgencyScore + 20);
  if (lead.notes?.toLowerCase().includes('divorce'))  urgencyScore = Math.min(100, urgencyScore + 15);

  // Budget score
  let budgetScore = 0;
  const val = Number(lead.estimatedValue ?? 0);
  if      (val >= 800000)  budgetScore = 100;
  else if (val >= 500000)  budgetScore = 85;
  else if (val >= 300000)  budgetScore = 70;
  else if (val >= 200000)  budgetScore = 55;
  else if (val >= 100000)  budgetScore = 40;
  else if (val > 0)        budgetScore = 25;
  else                     budgetScore = 20; // unknown — slight positive assumption

  // Intent score
  let intentScore = 40; // baseline
  if (lead.phone)                 intentScore += 15; // has phone = more serious
  if (lead.address)               intentScore += 10; // has address = real seller
  if (lead.propertyType)          intentScore += 8;
  if (lead.sourceUrl?.includes('/sell-my-house-fast')) intentScore += 20; // high-intent page
  if (lead.notes?.length > 50)    intentScore += 7;  // detailed note = motivated
  intentScore = Math.min(100, intentScore);

  // Engagement score (profile completeness)
  const fields = ['firstName','lastName','email','phone','city','stateCode','zipCode',
                  'address','propertyType','estimatedValue','urgency'];
  const filled = fields.filter(f => lead[f] && String(lead[f]).trim().length > 0).length;
  const engagementScore = Math.round((filled / fields.length) * 100);

  // Credit score (estimated from value + situation)
  let creditScore = 50; // assume average
  if (urgency === 'IMMEDIATE' && val < 200000) creditScore = 35; // distress signal
  if (val >= 400000) creditScore = 65;   // higher value = better credit proxy
  if (lead.notes?.toLowerCase().includes('cash')) creditScore = 85;

  // Timeline score
  let timelineScore = 30;
  if (urgency === 'IMMEDIATE')    timelineScore = 100;
  if (urgency === 'THREE_MONTHS') timelineScore = 60;
  if (urgency === 'SIX_MONTHS')  timelineScore = 30;
  if (urgency === 'EXPLORING')   timelineScore = 10;

  // Compute weighted total
  const total = Math.round(
    urgencyScore    * WEIGHTS.urgency +
    budgetScore     * WEIGHTS.budget +
    intentScore     * WEIGHTS.intent +
    engagementScore * WEIGHTS.engagement +
    creditScore     * WEIGHTS.credit +
    timelineScore   * WEIGHTS.timeline
  );

  const temperature = total >= 70 ? 'HOT' : total >= 45 ? 'WARM' : 'COLD';

  return {
    urgencyScore, budgetScore, intentScore,
    engagementScore, creditScore, timelineScore,
    total, temperature,
  };
}

// ─── PASS 2: AI-enhanced scoring (async, queued) ──────────────────────

export async function aiEnhancedScore(leadId: string): Promise<LeadScoreResult> {
  const apiKey = process.env.OPENAI_API_KEY ?? process.env.ANTHROPIC_API_KEY;
  const start  = Date.now();

  const lead = await prisma.lead.findUnique({
    where:   { id: leadId },
    include: {
      activities: { orderBy: { createdAt: 'desc' }, take: 5 },
      aiScore:    true,
    },
  });
  if (!lead) throw new Error(`Lead ${leadId} not found`);

  // Run rule-based first
  const rules = ruleBasedScore(lead as any);

  if (!apiKey) {
    // No AI key — return rule-based only with generated insights
    return buildRuleOnlyResult(lead, rules);
  }

  // Build rich context for AI
  const prompt = buildScoringPrompt(lead, rules);

  try {
    const aiResult = await callOpenAI(prompt, apiKey);
    const parsed   = parseAIResponse(aiResult);

    // Blend rule-based dimensions with AI adjustments
    const blended: ScoringDimensions = {
      urgencyScore:    blend(rules.urgencyScore,    parsed.urgencyAdjustment    ?? 0),
      budgetScore:     blend(rules.budgetScore,     parsed.budgetAdjustment     ?? 0),
      intentScore:     blend(rules.intentScore,     parsed.intentAdjustment     ?? 0),
      engagementScore: rules.engagementScore,
      creditScore:     blend(rules.creditScore,     parsed.creditAdjustment     ?? 0),
      timelineScore:   rules.timelineScore,
    };

    const totalScore = Math.min(100, Math.max(0, Math.round(
      blended.urgencyScore    * WEIGHTS.urgency    +
      blended.budgetScore     * WEIGHTS.budget     +
      blended.intentScore     * WEIGHTS.intent     +
      blended.engagementScore * WEIGHTS.engagement +
      blended.creditScore     * WEIGHTS.credit     +
      blended.timelineScore   * WEIGHTS.timeline
    )));

    const temperature = totalScore >= 70 ? 'HOT' : totalScore >= 45 ? 'WARM' : 'COLD';
    const processingMs = Date.now() - start;

    return {
      totalScore,
      temperature,
      dimensions:        blended,
      summary:           parsed.summary,
      strengths:         parsed.strengths ?? [],
      risks:             parsed.risks ?? [],
      recommendations:   parsed.recommendations ?? [],
      callScript:        parsed.callScript,
      objectionHandlers: parsed.objectionHandlers ?? {},
      productMatch:      parsed.productMatch,
      programMatch:      parsed.programMatch,
      closeProbability:  parsed.closeProbability,
      estimatedDaysToClose: parsed.estimatedDaysToClose,
      estimatedRevenue:  parsed.estimatedRevenue
                           ?? (totalScore > 0 ? computeEstimatedRevenue(lead) : undefined),
    };

  } catch (err) {
    console.error('[AIScore] OpenAI failed, falling back to rule-based:', err);
    return buildRuleOnlyResult(lead, rules);
  }
}

// ─── Save score to DB ─────────────────────────────────────────────────

export async function saveLeadScore(leadId: string, result: LeadScoreResult, tokensUsed?: number): Promise<void> {
  // Get previous score for delta calculation
  const prev = await prisma.leadAiScore.findUnique({ where: { leadId }, select: { totalScore: true, scoreVersion: true } });
  const delta = prev ? result.totalScore - prev.totalScore : null;

  // Upsert score record
  await prisma.leadAiScore.upsert({
    where:  { leadId },
    create: {
      leadId,
      totalScore:          result.totalScore,
      temperature:         result.temperature,
      ...result.dimensions,
      summary:             result.summary,
      strengths:           result.strengths,
      risks:               result.risks,
      recommendations:     result.recommendations,
      callScript:          result.callScript,
      objectionHandlers:   result.objectionHandlers,
      productMatch:        result.productMatch,
      programMatch:        result.programMatch,
      closeProbability:    result.closeProbability,
      estimatedDaysToClose:result.estimatedDaysToClose,
      estimatedRevenue:    result.estimatedRevenue,
      tokensUsed,
      scoreVersion:        1,
      lastScored:          new Date(),
    },
    update: {
      totalScore:          result.totalScore,
      temperature:         result.temperature,
      ...result.dimensions,
      summary:             result.summary,
      strengths:           result.strengths,
      risks:               result.risks,
      recommendations:     result.recommendations,
      callScript:          result.callScript,
      objectionHandlers:   result.objectionHandlers,
      productMatch:        result.productMatch,
      programMatch:        result.programMatch,
      closeProbability:    result.closeProbability,
      estimatedDaysToClose:result.estimatedDaysToClose,
      estimatedRevenue:    result.estimatedRevenue,
      tokensUsed,
      scoreVersion:        { increment: 1 },
      lastScored:          new Date(),
    },
  });

  // Update lead temperature directly
  await prisma.lead.update({
    where: { id: leadId },
    data:  { temperature: result.temperature, score: result.totalScore },
  }).catch(() => {});

  // Save to history
  await prisma.leadScoreHistory.create({
    data: {
      leadId,
      totalScore:  result.totalScore,
      temperature: result.temperature,
      trigger:     'ai_scoring',
      delta,
      snapshot:    result as any,
    },
  });
}

// ─── Full scoring pipeline: score + save + trigger follow-up ─────────

export async function scoreAndSaveLead(leadId: string): Promise<LeadScoreResult> {
  const result     = await aiEnhancedScore(leadId);
  await saveLeadScore(leadId, result);

  // Auto-trigger insights for hot leads
  if (result.temperature === 'HOT') {
    await prisma.aiInsight.create({
      data: {
        type:       'LEAD_OPPORTUNITY',
        title:      `🔥 Hot lead detected — Score ${result.totalScore}/100`,
        body:       result.summary ?? `This lead has a ${result.totalScore} score and ${Math.round((result.closeProbability ?? 0.5) * 100)}% close probability.`,
        severity:   'URGENT',
        entityType: 'lead',
        entityId:   leadId,
        actionUrl:  `/dashboard/leads/${leadId}`,
        actionLabel:'View Lead',
        expiresAt:  new Date(Date.now() + 24 * 3600000),
      },
    }).catch(() => {});
  }

  return result;
}

// ─── Helper: build AI prompt ──────────────────────────────────────────

function buildScoringPrompt(lead: any, rules: ReturnType<typeof ruleBasedScore>): string {
  const activities = lead.activities ?? [];
  const activitySummary = activities.length > 0
    ? activities.map((a: any) => `- ${a.type}: ${a.notes ?? a.subject ?? ''}`).join('\n')
    : 'No activity history';

  return `You are an expert real estate lead analyst specializing in motivated seller lead generation in the VA/MD/DC market. Analyze this lead and provide a JSON scoring adjustment.

## Lead Data
Name: ${lead.firstName} ${lead.lastName}
Location: ${lead.city}, ${lead.stateCode} ${lead.zipCode}
Phone: ${lead.phone ? 'Provided' : 'Missing'}
Email: ${lead.email ? 'Provided' : 'Missing'}
Property Type: ${lead.propertyType ?? 'Unknown'}
Estimated Value: ${lead.estimatedValue ? `$${Number(lead.estimatedValue).toLocaleString()}` : 'Not provided'}
Urgency: ${lead.urgency ?? 'Unknown'}
Situation: ${lead.motivationReason ?? 'Not specified'}
Source: ${lead.sourceUrl ?? 'Unknown'}
Notes: ${lead.notes ?? 'None'}

## Recent Activity
${activitySummary}

## Current Rule-Based Scores (0–100)
Urgency: ${rules.urgencyScore}
Budget: ${rules.budgetScore}
Intent: ${rules.intentScore}
Engagement: ${rules.engagementScore}
Credit: ${rules.creditScore}
Timeline: ${rules.timelineScore}
Total: ${rules.total} (${rules.temperature})

## Your Task
Analyze this lead holistically. Respond with ONLY valid JSON (no markdown, no preamble):

{
  "urgencyAdjustment": <integer -20 to +20>,
  "budgetAdjustment": <integer -15 to +15>,
  "intentAdjustment": <integer -15 to +15>,
  "creditAdjustment": <integer -10 to +10>,
  "summary": "<2-3 sentence analysis of this specific lead>",
  "strengths": ["<strength1>", "<strength2>", "<strength3>"],
  "risks": ["<risk1>", "<risk2>"],
  "recommendations": ["<specific action 1>", "<specific action 2>", "<specific action 3>"],
  "callScript": "<30-40 word opening script personalized to this lead's situation>",
  "objectionHandlers": {
    "I need to think about it": "<response>",
    "I want to try listing first": "<response>",
    "Your offer is too low": "<response>"
  },
  "productMatch": "<CASH_OFFER|TRADITIONAL_LISTING|INVESTOR_NETWORK|LEASE_OPTION>",
  "programMatch": "<FHA_ASSISTANCE|INVESTOR_CASH|TRADITIONAL|SHORT_SALE|NONE>",
  "closeProbability": <0.0 to 1.0>,
  "estimatedDaysToClose": <integer 7 to 180>,
  "estimatedRevenue": <number in dollars, your fee estimate>
}`;
}

// ─── Call OpenAI API ──────────────────────────────────────────────────

async function callOpenAI(prompt: string, apiKey: string): Promise<string> {
  // Support both OpenAI and Anthropic
  if (process.env.ANTHROPIC_API_KEY && !process.env.OPENAI_API_KEY) {
    return callAnthropicAPI(prompt, apiKey);
  }

  const res = await fetch('https://api.openai.com/v1/chat/completions', {
    method:  'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${apiKey}` },
    body:    JSON.stringify({
      model:       'gpt-4o-mini',  // fast + affordable for scoring
      max_tokens:  1200,
      temperature: 0.3,            // low temp = consistent scoring
      messages:    [{ role: 'user', content: prompt }],
    }),
    signal: AbortSignal.timeout(25000),
  });

  if (!res.ok) throw new Error(`OpenAI ${res.status}: ${await res.text()}`);
  const data = await res.json();
  return data.choices[0]?.message?.content ?? '';
}

async function callAnthropicAPI(prompt: string, apiKey: string): Promise<string> {
  const res = await fetch('https://api.anthropic.com/v1/messages', {
    method:  'POST',
    headers: {
      'Content-Type':      'application/json',
      'x-api-key':         apiKey,
      'anthropic-version': '2023-06-01',
    },
    body: JSON.stringify({
      model:      'claude-haiku-4-5-20251001',
      max_tokens: 1200,
      messages:   [{ role: 'user', content: prompt }],
    }),
    signal: AbortSignal.timeout(25000),
  });

  if (!res.ok) throw new Error(`Anthropic ${res.status}: ${await res.text()}`);
  const data = await res.json();
  return data.content?.[0]?.text ?? '';
}

// ─── Parse AI response ────────────────────────────────────────────────

function parseAIResponse(raw: string): Record<string, any> {
  try {
    const cleaned = raw.replace(/```json|```/g, '').trim();
    return JSON.parse(cleaned);
  } catch {
    console.warn('[AIScore] Failed to parse AI JSON:', raw.slice(0, 200));
    return {};
  }
}

// ─── Helper: blend rule score + AI adjustment ─────────────────────────

function blend(base: number, adjustment: number): number {
  return Math.max(0, Math.min(100, Math.round(base + adjustment)));
}

// ─── Helper: estimated revenue (no AI) ───────────────────────────────

function computeEstimatedRevenue(lead: any): number {
  const val = Number(lead.estimatedValue ?? 250000);
  return Math.round(val * 0.03); // 3% commission estimate
}

// ─── Helper: rule-only result with generated insights ─────────────────

function buildRuleOnlyResult(lead: any, rules: ReturnType<typeof ruleBasedScore>): LeadScoreResult {
  const strengths: string[] = [];
  const risks: string[]     = [];
  const recs: string[]      = [];

  if (rules.urgencyScore >= 70) strengths.push(`${lead.urgency} urgency — act quickly`);
  if (rules.budgetScore  >= 70) strengths.push(`High estimated value ($${Number(lead.estimatedValue ?? 0).toLocaleString()})`);
  if (lead.phone)               strengths.push('Phone number provided — call-ready');
  if (!lead.phone)              risks.push('No phone number — email outreach only');
  if (rules.engagementScore < 50) risks.push('Incomplete profile — gather more info');

  if (rules.urgencyScore >= 70) recs.push('Call within 1 hour');
  else if (rules.urgencyScore >= 50) recs.push('Call within 4 hours');
  else recs.push('Schedule a call within 24 hours');

  if (Number(lead.estimatedValue) >= 300000) recs.push('Present cash offer program');
  recs.push('Send personalized follow-up email within 2 hours');

  const closeProbability = Math.min(0.95, rules.total / 100 * 0.8);
  const estimatedRevenue = computeEstimatedRevenue(lead);

  return {
    totalScore:          rules.total,
    temperature:         rules.temperature,
    dimensions: {
      urgencyScore:    rules.urgencyScore,
      budgetScore:     rules.budgetScore,
      intentScore:     rules.intentScore,
      engagementScore: rules.engagementScore,
      creditScore:     rules.creditScore,
      timelineScore:   rules.timelineScore,
    },
    summary:           `Lead from ${lead.city ?? 'unknown'}, ${lead.stateCode ?? ''} with ${lead.urgency ?? 'unknown'} urgency. Estimated value: $${Number(lead.estimatedValue ?? 0).toLocaleString()}.`,
    strengths,
    risks,
    recommendations:   recs,
    callScript:        `Hi ${lead.firstName}, this is [Name] from LeadSphere Properties. I saw you were looking to ${lead.urgency === 'IMMEDIATE' ? 'sell quickly' : 'sell your home'} — I'd love to make you a fair cash offer today. Do you have 2 minutes?`,
    objectionHandlers: {
      'I need to think about it': 'Absolutely! To help you make the best decision, can I share a quick cash offer so you have a real number to compare?',
      'I want to try listing first':'That makes sense. Would it help to know your options? A cash offer has no repairs, no showings, and closes in 7-14 days — might be worth comparing.',
      'Your offer is too low': "I understand. Our offers are based on current market conditions and closing costs. Can I walk you through how we calculated it?",
    },
    productMatch:        Number(lead.estimatedValue ?? 0) >= 300000 ? 'CASH_OFFER' : 'INVESTOR_NETWORK',
    programMatch:        'INVESTOR_CASH',
    closeProbability,
    estimatedDaysToClose:rules.urgencyScore >= 70 ? 14 : rules.urgencyScore >= 50 ? 30 : 60,
    estimatedRevenue,
  };
}
