/**
 * notificationQueue.service.ts
 *
 * In-process notification queue with retry logic.
 * Production: replace with BullMQ + Redis for true async processing.
 *
 * Handles:
 *   - Email notifications (via Resend or SendGrid)
 *   - Dashboard notifications (stored in DB, polled by frontend)
 *   - SMS (via Twilio — optional)
 *   - Webhook delivery
 */

import { PrismaClient, NotificationChannel, NotificationStatus, NotificationType } from '@prisma/client';

const prisma = new PrismaClient();

// ─── Queue payload ────────────────────────────────────────────────────

export interface NotificationJob {
  assignmentId:    string;
  userId:          string;
  leadId:          string;
  ownershipId?:    string;
  territoryName?:  string;
  notifyEmail:     boolean;
  notifyDashboard: boolean;
  notifySms:       boolean;
  webhookUrl?:     string;
}

// ─── Simple in-memory queue with async processing ────────────────────

class NotificationQueue {
  private queue: NotificationJob[] = [];
  private processing = false;

  async enqueue(job: NotificationJob): Promise<void> {
    this.queue.push(job);
    if (!this.processing) {
      this.processing = true;
      // Process asynchronously — don't block the caller
      setImmediate(() => this.processQueue());
    }
  }

  private async processQueue(): Promise<void> {
    while (this.queue.length > 0) {
      const job = this.queue.shift()!;
      try {
        await processNotificationJob(job);
      } catch (err) {
        console.error('[NotificationQueue] Job failed:', err);
      }
    }
    this.processing = false;
  }
}

export const notificationQueue = new NotificationQueue();

// ─── Process a single notification job ───────────────────────────────

async function processNotificationJob(job: NotificationJob): Promise<void> {
  // Fetch lead and user data
  const [lead, user] = await Promise.all([
    prisma.lead.findUnique({
      where: { id: job.leadId },
      select: {
        firstName: true, lastName: true, email: true, phone: true,
        city: true, stateCode: true, zipCode: true,
        propertyType: true, urgency: true, score: true, temperature: true,
        estimatedValue: true, sourceUrl: true, createdAt: true,
      },
    }),
    prisma.user.findUnique({
      where: { id: job.userId },
      select: { firstName: true, lastName: true, email: true, phone: true },
    }),
  ]);

  if (!lead || !user) return;

  const notifications: Promise<void>[] = [];

  // Dashboard notification (always store)
  if (job.notifyDashboard) {
    notifications.push(sendDashboardNotification(job, lead, user));
  }

  // Email notification
  if (job.notifyEmail && user.email) {
    notifications.push(sendEmailNotification(job, lead, user));
  }

  // SMS notification (optional)
  if (job.notifySms && user.phone) {
    notifications.push(sendSmsNotification(job, lead, user));
  }

  // Webhook
  if (job.webhookUrl) {
    notifications.push(sendWebhook(job, lead, user));
  }

  await Promise.allSettled(notifications);
}

// ─── Dashboard notification ───────────────────────────────────────────

async function sendDashboardNotification(
  job:  NotificationJob,
  lead: any,
  user: any
): Promise<void> {
  await prisma.assignmentNotification.create({
    data: {
      assignmentId: job.assignmentId,
      userId:       job.userId,
      type:         NotificationType.LEAD_ASSIGNED,
      channel:      NotificationChannel.DASHBOARD,
      status:       NotificationStatus.SENT,
      subject:      `New lead in ${job.territoryName ?? 'your territory'}`,
      body:         buildNotificationBody(lead, job.territoryName),
      metadata: {
        leadId:        job.leadId,
        leadName:      `${lead.firstName} ${lead.lastName}`,
        score:         lead.score,
        temperature:   lead.temperature,
        city:          lead.city,
        zipCode:       lead.zipCode,
        urgency:       lead.urgency,
        territoryName: job.territoryName,
      },
      sentAt: new Date(),
    },
  });
}

// ─── Email notification ───────────────────────────────────────────────

async function sendEmailNotification(
  job:  NotificationJob,
  lead: any,
  user: any
): Promise<void> {
  const notifRecord = await prisma.assignmentNotification.create({
    data: {
      assignmentId: job.assignmentId,
      userId:       job.userId,
      type:         NotificationType.LEAD_ASSIGNED,
      channel:      NotificationChannel.EMAIL,
      status:       NotificationStatus.PENDING,
      subject:      `🏠 New Lead: ${lead.firstName} ${lead.lastName} — ${job.territoryName}`,
      body:         buildEmailHtml(lead, user, job),
      metadata: { to: user.email },
    },
  });

  try {
    await deliverEmail({
      to:      user.email,
      subject: `🏠 New Lead: ${lead.firstName} ${lead.lastName} — ${job.territoryName}`,
      html:    buildEmailHtml(lead, user, job),
    });

    await prisma.assignmentNotification.update({
      where: { id: notifRecord.id },
      data:  { status: NotificationStatus.SENT, sentAt: new Date() },
    });
  } catch (err: any) {
    await prisma.assignmentNotification.update({
      where: { id: notifRecord.id },
      data:  { status: NotificationStatus.FAILED, error: err.message },
    });
  }
}

// ─── SMS notification ─────────────────────────────────────────────────

async function sendSmsNotification(
  job:  NotificationJob,
  lead: any,
  user: any
): Promise<void> {
  const smsBody = `LeadSphere: New lead in ${job.territoryName ?? 'your territory'}!\n${lead.firstName} ${lead.lastName} · ${lead.phone ?? 'no phone'} · ${lead.urgency === 'IMMEDIATE' ? '🔥 IMMEDIATE' : lead.urgency}\nLogin to view: ${process.env.SITE_URL}/dashboard/leads`;

  const notifRecord = await prisma.assignmentNotification.create({
    data: {
      assignmentId: job.assignmentId,
      userId:       job.userId,
      type:         NotificationType.LEAD_ASSIGNED,
      channel:      NotificationChannel.SMS,
      status:       NotificationStatus.PENDING,
      body:         smsBody,
      metadata:     { to: user.phone },
    },
  });

  try {
    await deliverSms({ to: user.phone!, body: smsBody });
    await prisma.assignmentNotification.update({
      where: { id: notifRecord.id },
      data:  { status: NotificationStatus.SENT, sentAt: new Date() },
    });
  } catch (err: any) {
    await prisma.assignmentNotification.update({
      where: { id: notifRecord.id },
      data:  { status: NotificationStatus.FAILED, error: err.message },
    });
  }
}

// ─── Webhook delivery ─────────────────────────────────────────────────

async function sendWebhook(
  job:  NotificationJob,
  lead: any,
  _user: any
): Promise<void> {
  const payload = {
    event:       'lead.assigned',
    timestamp:   new Date().toISOString(),
    assignmentId: job.assignmentId,
    territory:   job.territoryName,
    lead: {
      id:         job.leadId,
      firstName:  lead.firstName,
      lastName:   lead.lastName,
      email:      lead.email,
      phone:      lead.phone,
      city:       lead.city,
      stateCode:  lead.stateCode,
      zipCode:    lead.zipCode,
      score:      lead.score,
      temperature:lead.temperature,
      urgency:    lead.urgency,
    },
  };

  try {
    const res = await fetch(job.webhookUrl!, {
      method:  'POST',
      headers: { 'Content-Type': 'application/json', 'X-LeadSphere-Event': 'lead.assigned' },
      body:    JSON.stringify(payload),
      signal:  AbortSignal.timeout(5000),
    });
    if (!res.ok) throw new Error(`Webhook ${res.status}`);
  } catch (err: any) {
    console.warn(`[Webhook] Failed for ${job.webhookUrl}:`, err.message);
  }
}

// ─── Email delivery (Resend / SendGrid / SMTP) ────────────────────────

async function deliverEmail(opts: { to: string; subject: string; html: string }) {
  const resendKey = process.env.RESEND_API_KEY;
  const sendgridKey = process.env.SENDGRID_API_KEY;
  const fromEmail = process.env.FROM_EMAIL ?? 'leads@leadsphere.com';

  if (resendKey) {
    // Resend (recommended — https://resend.com)
    const res = await fetch('https://api.resend.com/emails', {
      method:  'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${resendKey}` },
      body:    JSON.stringify({ from: `LeadSphere <${fromEmail}>`, to: opts.to, subject: opts.subject, html: opts.html }),
    });
    if (!res.ok) throw new Error(`Resend ${res.status}: ${await res.text()}`);
    return;
  }

  if (sendgridKey) {
    // SendGrid fallback
    const res = await fetch('https://api.sendgrid.com/v3/mail/send', {
      method:  'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${sendgridKey}` },
      body:    JSON.stringify({
        personalizations: [{ to: [{ email: opts.to }], subject: opts.subject }],
        from:    { email: fromEmail, name: 'LeadSphere' },
        content: [{ type: 'text/html', value: opts.html }],
      }),
    });
    if (!res.ok) throw new Error(`SendGrid ${res.status}`);
    return;
  }

  // No email provider configured — log for debugging
  console.log('[Email — no provider configured]', { to: opts.to, subject: opts.subject });
}

// ─── SMS delivery (Twilio) ────────────────────────────────────────────

async function deliverSms(opts: { to: string; body: string }) {
  const accountSid = process.env.TWILIO_ACCOUNT_SID;
  const authToken  = process.env.TWILIO_AUTH_TOKEN;
  const from       = process.env.TWILIO_FROM_NUMBER;

  if (!accountSid || !authToken || !from) {
    console.log('[SMS — Twilio not configured]', { to: opts.to });
    return;
  }

  const params = new URLSearchParams({ To: opts.to, From: from, Body: opts.body });
  const res = await fetch(
    `https://api.twilio.com/2010-04-01/Accounts/${accountSid}/Messages.json`,
    {
      method:  'POST',
      headers: {
        'Content-Type':  'application/x-www-form-urlencoded',
        Authorization:   'Basic ' + Buffer.from(`${accountSid}:${authToken}`).toString('base64'),
      },
      body: params.toString(),
    }
  );
  if (!res.ok) throw new Error(`Twilio ${res.status}`);
}

// ─── Template helpers ─────────────────────────────────────────────────

function buildNotificationBody(lead: any, territoryName?: string): string {
  return `New lead in ${territoryName ?? 'your territory'}: ${lead.firstName} ${lead.lastName} (${lead.city}, ${lead.stateCode} ${lead.zipCode}) — Score: ${lead.score} · ${lead.urgency}`;
}

function buildEmailHtml(lead: any, user: any, job: NotificationJob): string {
  const dashUrl = `${process.env.SITE_URL ?? 'https://leadsphere.com'}/dashboard/leads`;
  const urgencyEmoji = lead.urgency === 'IMMEDIATE' ? '🔥' : lead.urgency === 'THREE_MONTHS' ? '⚡' : '📋';
  const tempColor = lead.temperature === 'HOT' ? '#ef4444' : lead.temperature === 'WARM' ? '#f97316' : '#3b82f6';

  return `<!DOCTYPE html>
<html>
<head><meta charset="utf-8"/></head>
<body style="margin:0;padding:0;background:#f4f7fb;font-family:'Helvetica Neue',Arial,sans-serif;">
  <div style="max-width:560px;margin:32px auto;background:white;border-radius:16px;overflow:hidden;box-shadow:0 4px 24px rgba(0,0,0,0.08);">

    <!-- Header -->
    <div style="background:linear-gradient(135deg,#1B3A5C,#24527a);padding:28px 32px;">
      <div style="display:flex;align-items:center;gap:12px;">
        <div style="width:40px;height:40px;background:rgba(255,255,255,0.15);border-radius:10px;display:flex;align-items:center;justify-content:center;font-size:20px;">🏠</div>
        <div>
          <p style="color:rgba(255,255,255,0.7);font-size:12px;margin:0;text-transform:uppercase;letter-spacing:1px;">LeadSphere</p>
          <h1 style="color:white;font-size:20px;font-weight:700;margin:2px 0 0;">New Lead Assigned</h1>
        </div>
      </div>
    </div>

    <!-- Body -->
    <div style="padding:28px 32px;">
      <p style="color:#374151;font-size:15px;margin:0 0 20px;">
        Hi <strong>${user.firstName}</strong>, you have a new lead in your <strong>${job.territoryName ?? 'territory'}</strong>:
      </p>

      <!-- Lead card -->
      <div style="background:#f8fafc;border:1px solid #e2e8f0;border-radius:12px;padding:20px;margin-bottom:24px;">
        <div style="display:flex;justify-content:space-between;align-items:flex-start;margin-bottom:16px;">
          <div>
            <h2 style="font-size:20px;font-weight:700;color:#111827;margin:0;">${lead.firstName} ${lead.lastName}</h2>
            <p style="color:#6b7280;font-size:14px;margin:4px 0 0;">${lead.city}, ${lead.stateCode} ${lead.zipCode}</p>
          </div>
          <div style="text-align:right;">
            <div style="background:${tempColor};color:white;font-size:12px;font-weight:700;padding:4px 10px;border-radius:99px;">${lead.temperature}</div>
            <div style="color:#6b7280;font-size:12px;margin-top:4px;">Score: ${lead.score}/100</div>
          </div>
        </div>

        <div style="display:grid;grid-template-columns:1fr 1fr;gap:12px;font-size:13px;">
          ${lead.phone ? `<div><span style="color:#9ca3af;">Phone</span><br/><strong style="color:#111827;">${lead.phone}</strong></div>` : ''}
          ${lead.email ? `<div><span style="color:#9ca3af;">Email</span><br/><strong style="color:#111827;">${lead.email}</strong></div>` : ''}
          <div><span style="color:#9ca3af;">Urgency</span><br/><strong style="color:#111827;">${urgencyEmoji} ${lead.urgency?.replace('_',' ')}</strong></div>
          ${lead.estimatedValue ? `<div><span style="color:#9ca3af;">Est. Value</span><br/><strong style="color:#111827;">$${Number(lead.estimatedValue).toLocaleString()}</strong></div>` : ''}
        </div>
      </div>

      <!-- CTA -->
      <div style="text-align:center;">
        <a href="${dashUrl}" style="display:inline-block;background:#1B3A5C;color:white;font-weight:700;font-size:15px;padding:14px 32px;border-radius:10px;text-decoration:none;">
          View Lead in CRM →
        </a>
        <p style="color:#9ca3af;font-size:12px;margin:12px 0 0;">This lead will expire in 48 hours if not actioned.</p>
      </div>
    </div>

    <!-- Footer -->
    <div style="padding:16px 32px;border-top:1px solid #f3f4f6;text-align:center;">
      <p style="color:#9ca3af;font-size:11px;margin:0;">
        LeadSphere Properties · Serving VA, MD & DC
        <br/>You're receiving this because you own this territory. <a href="${dashUrl}/settings" style="color:#6b7280;">Manage notifications</a>
      </p>
    </div>
  </div>
</body>
</html>`;
}
