/**
 * followUpAutomation.service.ts
 *
 * Generates and schedules multi-step follow-up sequences when:
 *  - Lead assigned but not responded in 24h
 *  - Lead status changes to cold
 *  - Manual trigger by agent
 *
 * Sequence (default):
 *  Step 1: Email — immediate (personalized by AI)
 *  Step 2: SMS   — +2 hours
 *  Step 3: Call reminder — +24 hours
 *  Step 4: Email — +3 days (different angle)
 *  Step 5: SMS   — +7 days (final attempt)
 */

import { PrismaClient, FollowUpChannel, FollowUpStatus } from '@prisma/client';

const prisma = new PrismaClient();

// ─── Types ────────────────────────────────────────────────────────────

interface FollowUpMessage {
  channel:     FollowUpChannel;
  subject?:    string;
  body:        string;
  delayMs:     number;  // delay from sequence start
}

// ─── Create follow-up sequence for a lead ────────────────────────────

export async function createFollowUpSequence(
  leadId:    string,
  trigger:   string = 'no_response_24h',
  useAi:     boolean = true
): Promise<string> {
  // Prevent duplicate active sequences
  const existing = await prisma.followUpSequence.findFirst({
    where: { leadId, isActive: true },
  });
  if (existing) return existing.id;

  const lead = await prisma.lead.findUnique({
    where:   { id: leadId },
    include: { aiScore: true },
  });
  if (!lead) throw new Error(`Lead ${leadId} not found`);

  // Generate AI messages or use templates
  const messages = useAi && (process.env.OPENAI_API_KEY || process.env.ANTHROPIC_API_KEY)
    ? await generateAiSequence(lead)
    : buildTemplateSequence(lead);

  // Create sequence + steps in DB
  const sequence = await prisma.followUpSequence.create({
    data: {
      leadId,
      triggeredBy: trigger,
      isActive:    true,
      steps: {
        create: messages.map((m, i) => ({
          stepNumber:  i + 1,
          channel:     m.channel,
          status:      FollowUpStatus.PENDING,
          scheduledFor:new Date(Date.now() + m.delayMs),
          subject:     m.subject,
          body:        m.body,
          aiGenerated: useAi,
        })),
      },
    },
  });

  return sequence.id;
}

// ─── Generate AI-powered sequence ────────────────────────────────────

async function generateAiSequence(lead: any): Promise<FollowUpMessage[]> {
  const apiKey = process.env.OPENAI_API_KEY ?? process.env.ANTHROPIC_API_KEY;
  const score  = lead.aiScore?.totalScore ?? 50;
  const urgency = score >= 70 ? 'urgent' : score >= 45 ? 'warm' : 'gentle';

  const prompt = `You are a real estate follow-up specialist writing personalized messages for a motivated seller lead.

Lead Info:
- Name: ${lead.firstName} ${lead.lastName}
- Location: ${lead.city}, ${lead.stateCode} ${lead.zipCode}
- Property value: ${lead.estimatedValue ? `$${Number(lead.estimatedValue).toLocaleString()}` : 'unknown'}
- Urgency: ${lead.urgency ?? 'EXPLORING'}
- Situation: ${lead.motivationReason ?? lead.notes ?? 'Wants to sell'}
- AI Score: ${score}/100 (${urgency} prospect)

Write a 5-step follow-up sequence. Tone should be ${urgency} — not pushy, genuinely helpful.
Each message should feel personal, not like a template.

Respond ONLY with JSON (no markdown):
{
  "steps": [
    {
      "channel": "EMAIL",
      "subject": "<email subject>",
      "body": "<email body, 80-120 words, friendly, 1 clear CTA>",
      "delayMs": 0
    },
    {
      "channel": "SMS",
      "body": "<SMS, max 160 chars, no links>",
      "delayMs": 7200000
    },
    {
      "channel": "CALL_REMINDER",
      "body": "<agent reminder note, what to say on call>",
      "delayMs": 86400000
    },
    {
      "channel": "EMAIL",
      "subject": "<different angle subject>",
      "body": "<different approach, address a common concern, 80-100 words>",
      "delayMs": 259200000
    },
    {
      "channel": "SMS",
      "body": "<final SMS, breakup-style — still helpful, not salesy>",
      "delayMs": 604800000
    }
  ]
}`;

  try {
    const useAnthropic = !!process.env.ANTHROPIC_API_KEY && !process.env.OPENAI_API_KEY;

    const res = await fetch(
      useAnthropic
        ? 'https://api.anthropic.com/v1/messages'
        : 'https://api.openai.com/v1/chat/completions',
      {
        method:  'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(useAnthropic
            ? { 'x-api-key': apiKey!, 'anthropic-version': '2023-06-01' }
            : { Authorization: `Bearer ${apiKey}` }),
        },
        body: JSON.stringify(
          useAnthropic
            ? { model: 'claude-haiku-4-5-20251001', max_tokens: 1500, messages: [{ role: 'user', content: prompt }] }
            : { model: 'gpt-4o-mini', max_tokens: 1500, temperature: 0.7, messages: [{ role: 'user', content: prompt }] }
        ),
        signal: AbortSignal.timeout(20000),
      }
    );

    const data = await res.json();
    const raw  = useAnthropic
      ? data.content?.[0]?.text
      : data.choices?.[0]?.message?.content;

    const parsed = JSON.parse((raw ?? '').replace(/```json|```/g, '').trim());
    return parsed.steps ?? buildTemplateSequence(lead);
  } catch (err) {
    console.warn('[FollowUp] AI generation failed, using templates:', err);
    return buildTemplateSequence(lead);
  }
}

// ─── Template-based sequence (fallback) ──────────────────────────────

function buildTemplateSequence(lead: any): FollowUpMessage[] {
  const name    = lead.firstName ?? 'there';
  const valStr  = lead.estimatedValue ? `$${Number(lead.estimatedValue).toLocaleString()}` : 'your home';
  const city    = lead.city ?? 'your area';

  return [
    {
      channel: FollowUpChannel.EMAIL,
      subject: `Your cash offer for ${city} — next steps`,
      delayMs: 0,
      body:    `Hi ${name},\n\nThank you for reaching out about ${valStr}! We work with serious cash buyers in ${city} and can move quickly.\n\nWould you have 10 minutes this week to discuss your timeline? We've helped many homeowners in similar situations close in as little as 7 days — no repairs, no fees.\n\nJust reply to this email or call us directly.\n\nBest,\nLeadSphere Properties`,
    },
    {
      channel: FollowUpChannel.SMS,
      delayMs: 7200000, // 2 hours
      body:    `Hi ${name}, it's LeadSphere. We'd love to get you a cash offer on your ${city} home. Takes 5 min — would this week work for a quick call?`,
    },
    {
      channel: FollowUpChannel.CALL_REMINDER,
      delayMs: 86400000, // 24 hours
      body:    `CALL REMINDER for ${name} in ${city}. Opening: "Hi ${name}, I'm following up about your home at ${lead.address ?? city}. Did you get a chance to review our email?" Focus: timeline, motivation, any concerns about the process.`,
    },
    {
      channel: FollowUpChannel.EMAIL,
      subject: `No pressure — just want to make sure you have all the info`,
      delayMs: 259200000, // 3 days
      body:    `Hi ${name},\n\nI know selling a home is a big decision. I just wanted to make sure you have everything you need to make the right choice — whether that's working with us or listing traditionally.\n\nOur cash offer program means: no repairs, no showings, and you choose the closing date. Happy to answer any questions, no obligation.\n\nWould a quick 5-minute call help?\n\nBest,\nLeadSphere Properties`,
    },
    {
      channel: FollowUpChannel.SMS,
      delayMs: 604800000, // 7 days
      body:    `Hi ${name}, last check-in from LeadSphere. If you've already found a solution for your ${city} home, that's great! If not, we're still here. No pressure either way.`,
    },
  ];
}

// ─── Process pending follow-up steps (cron worker) ───────────────────

export async function processPendingFollowUps(): Promise<number> {
  const steps = await prisma.followUpStep.findMany({
    where: {
      status:      FollowUpStatus.PENDING,
      scheduledFor:{ lte: new Date() },
      sequence:    { isActive: true },
    },
    include: {
      sequence: {
        include: {
          lead: {
            select: {
              id: true, firstName: true, lastName: true,
              email: true, phone: true, city: true, stateCode: true,
            },
          },
        },
      },
    },
    take: 50, // process up to 50 per tick
  });

  let processed = 0;

  for (const step of steps) {
    const lead = step.sequence.lead;
    try {
      await deliverFollowUpStep(step, lead);
      await prisma.followUpStep.update({
        where: { id: step.id },
        data:  { status: FollowUpStatus.SENT, sentAt: new Date() },
      });
      processed++;
    } catch (err: any) {
      await prisma.followUpStep.update({
        where: { id: step.id },
        data:  { status: FollowUpStatus.FAILED, error: err.message },
      });
      console.error(`[FollowUp] Step ${step.id} failed:`, err.message);
    }
  }

  return processed;
}

// ─── Deliver a single step ────────────────────────────────────────────

async function deliverFollowUpStep(step: any, lead: any): Promise<void> {
  switch (step.channel) {
    case FollowUpChannel.EMAIL:
      await sendFollowUpEmail(lead, step);
      break;

    case FollowUpChannel.SMS:
      await sendFollowUpSms(lead, step);
      break;

    case FollowUpChannel.CALL_REMINDER:
      // Create a dashboard notification / activity for the agent
      await prisma.activity.create({
        data: {
          leadId:    lead.id,
          type:      'CALL_SCHEDULED',
          subject:   `📞 Call reminder: ${lead.firstName} ${lead.lastName}`,
          notes:     step.body,
          createdById: lead.assignedToId ?? '',
        },
      }).catch(() => {});
      break;
  }
}

// ─── Email delivery ───────────────────────────────────────────────────

async function sendFollowUpEmail(lead: any, step: any): Promise<void> {
  if (!lead.email) throw new Error('No email address');
  const fromEmail = process.env.FROM_EMAIL ?? 'leads@leadsphere.com';
  const resendKey = process.env.RESEND_API_KEY;
  const sgKey     = process.env.SENDGRID_API_KEY;

  if (!resendKey && !sgKey) {
    console.log(`[FollowUp Email] Would send to ${lead.email}: ${step.subject}`);
    return;
  }

  if (resendKey) {
    const res = await fetch('https://api.resend.com/emails', {
      method:  'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${resendKey}` },
      body:    JSON.stringify({
        from:    `LeadSphere Properties <${fromEmail}>`,
        to:      lead.email,
        subject: step.subject,
        text:    step.body,
      }),
    });
    if (!res.ok) throw new Error(`Resend ${res.status}`);
  }
}

// ─── SMS delivery ─────────────────────────────────────────────────────

async function sendFollowUpSms(lead: any, step: any): Promise<void> {
  if (!lead.phone) throw new Error('No phone number');
  const accountSid = process.env.TWILIO_ACCOUNT_SID;
  const authToken  = process.env.TWILIO_AUTH_TOKEN;
  const from       = process.env.TWILIO_FROM_NUMBER;

  if (!accountSid || !authToken || !from) {
    console.log(`[FollowUp SMS] Would send to ${lead.phone}: ${step.body}`);
    return;
  }

  const params = new URLSearchParams({ To: lead.phone, From: from, Body: step.body });
  const res = await fetch(
    `https://api.twilio.com/2010-04-01/Accounts/${accountSid}/Messages.json`,
    {
      method:  'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
        Authorization:  'Basic ' + Buffer.from(`${accountSid}:${authToken}`).toString('base64'),
      },
      body: params.toString(),
    }
  );
  if (!res.ok) throw new Error(`Twilio ${res.status}`);
}

// ─── Cancel sequence when lead responds ──────────────────────────────

export async function cancelSequenceForLead(leadId: string): Promise<void> {
  await prisma.followUpSequence.updateMany({
    where: { leadId, isActive: true },
    data:  { isActive: false, canceledAt: new Date() },
  });

  await prisma.followUpStep.updateMany({
    where: {
      status:   FollowUpStatus.PENDING,
      sequence: { leadId },
    },
    data: { status: FollowUpStatus.SKIPPED },
  });
}
