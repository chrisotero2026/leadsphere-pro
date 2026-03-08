/**
 * billing.lifecycle.service.ts
 *
 * Handles all side effects when billing events occur:
 *  - Subscription activated → grant access, send welcome email
 *  - Subscription canceled  → revoke excess access, send offboarding email
 *  - Payment failed         → notify user, mark past_due
 *  - Access checks          → enforce plan limits in real time
 */

import { PrismaClient } from '@prisma/client';
import { PLANS, getLimit } from './plans.config';

const prisma = new PrismaClient();

// ─── Subscription activated ───────────────────────────────────────────

export async function onSubscriptionActivated(
  userId:    string | undefined,
  stripeSubId: string
): Promise<void> {
  if (!userId) return;

  const user = await prisma.user.findUnique({
    where:  { id: userId },
    select: { email: true, firstName: true },
  });
  if (!user) return;

  console.log(`[Billing] Subscription activated for ${user.email} (${stripeSubId})`);
  // Send welcome email here (Resend/SendGrid)
  // await sendEmail({ to: user.email, template: 'subscription_welcome', ... });
}

// ─── Subscription canceled ────────────────────────────────────────────

export async function onSubscriptionCanceled(userId: string | undefined): Promise<void> {
  if (!userId) return;

  // Find the user's current plan via their subscription
  const sub = await prisma.subscription.findFirst({
    where:   { userId, status: { in: ['ACTIVE','PAST_DUE','TRIALING'] } },
    include: { plan: true },
    orderBy: { createdAt: 'desc' },
  });

  if (!sub) return;

  const freePlan = await prisma.plan.findFirst({ where: { tier: 'FREE' } });
  if (!freePlan) return;

  // Downgrade to free — enforce territory limits
  const freeMaxTerritories = getLimit('maxTerritories', 'FREE') ?? 0;

  // Deactivate territories beyond free limit
  const ownerships = await prisma.territoryOwnership.findMany({
    where:   { userId, isActive: true },
    orderBy: { leadsReceived: 'asc' }, // keep best-performing ones
  });

  for (let i = freeMaxTerritories; i < ownerships.length; i++) {
    await prisma.territoryOwnership.update({
      where: { id: ownerships[i].id },
      data:  { isActive: false, endDate: new Date() },
    });
  }

  console.log(`[Billing] Canceled — downgraded user ${userId} to Free tier`);
  // Send cancellation email here
}

// ─── Payment failed ───────────────────────────────────────────────────

export async function onPaymentFailed(userId: string, invoice: any): Promise<void> {
  const user = await prisma.user.findUnique({
    where:  { id: userId },
    select: { email: true, firstName: true },
  });
  if (!user) return;

  // Mark subscription as past_due (Stripe does this too, but we mirror it)
  await prisma.subscription.updateMany({
    where: { userId, status: { not: 'CANCELED' } },
    data:  { status: 'PAST_DUE' },
  });

  console.log(`[Billing] Payment failed for ${user.email} — invoice ${invoice.id}`);
  // Send "payment failed" email with link to billing portal
}

// ─── Get user's active plan tier ─────────────────────────────────────

export async function getUserPlanTier(userId: string): Promise<string> {
  const sub = await prisma.subscription.findFirst({
    where:   { userId, status: { in: ['ACTIVE', 'TRIALING'] } },
    include: { plan: true },
    orderBy: { createdAt: 'desc' },
  });
  return sub?.plan?.tier ?? 'FREE';
}

// ─── Check if user can perform an action ─────────────────────────────

export async function checkPlanLimit(
  userId:  string,
  metric:  'maxTerritories' | 'maxLeadsPerMonth' | 'maxUsers' | 'maxSeoPages'
): Promise<{ allowed: boolean; current: number; limit: number | null; tier: string }> {
  const tier = await getUserPlanTier(userId);
  const limit = getLimit(metric, tier);

  // Count current usage
  let current = 0;
  switch (metric) {
    case 'maxTerritories':
      current = await prisma.territoryOwnership.count({ where: { userId, isActive: true } });
      break;
    case 'maxLeadsPerMonth': {
      const start = new Date(new Date().setDate(1)); // first of month
      current = await prisma.leadAssignment.count({
        where: { assignedToId: userId, assignedAt: { gte: start } },
      });
      break;
    }
    case 'maxSeoPages':
      // Count SEO pages owned by this user's territories
      current = await prisma.seoPage.count({ where: { status: 'PUBLISHED' } });
      break;
    default:
      current = 0;
  }

  const allowed = limit === null || current < limit;
  return { allowed, current, limit, tier };
}

// ─── Enforce feature access ───────────────────────────────────────────

export async function checkFeatureAccess(
  userId:  string,
  feature: string
): Promise<{ allowed: boolean; tier: string; requiredTier?: string }> {
  const tier = await getUserPlanTier(userId);
  const plan = PLANS[tier];
  if (!plan) return { allowed: false, tier };

  const featureMap: Record<string, string[]> = {
    aiContent:         ['PROFESSIONAL', 'ENTERPRISE'],
    callCenterAccess:  ['PROFESSIONAL', 'ENTERPRISE'],
    advancedAnalytics: ['PROFESSIONAL', 'ENTERPRISE'],
    apiAccess:         ['ENTERPRISE'],
    whiteLabel:        ['ENTERPRISE'],
    webhooks:          ['BASIC', 'PROFESSIONAL', 'ENTERPRISE'],
    teamManagement:    ['PROFESSIONAL', 'ENTERPRISE'],
  };

  const allowed_tiers = featureMap[feature] ?? [];
  const allowed = allowed_tiers.includes(tier);

  return {
    allowed,
    tier,
    requiredTier: !allowed ? allowed_tiers[0] : undefined,
  };
}

// ─── Monthly usage reset (cron: 1st of each month) ───────────────────

export async function resetMonthlyUsage(): Promise<void> {
  const periodStart = new Date(new Date().setDate(1));
  const periodEnd   = new Date(new Date().setMonth(new Date().getMonth() + 1, 0));

  // Snapshot all current usage
  const subs = await prisma.subscription.findMany({
    where: { status: { in: ['ACTIVE', 'TRIALING'] } },
    select: { id: true, userId: true },
  });

  for (const sub of subs) {
    const [leads, territories, pages] = await Promise.all([
      prisma.leadAssignment.count({
        where: { assignedToId: sub.userId, assignedAt: { gte: periodStart } },
      }),
      prisma.territoryOwnership.count({
        where: { userId: sub.userId, isActive: true },
      }),
      prisma.seoPage.count({ where: { status: 'PUBLISHED' } }),
    ]);

    await prisma.usageRecord.createMany({
      data: [
        { subscriptionId: sub.id, userId: sub.userId, metric: 'leads_assigned', quantity: leads, periodStart, periodEnd },
        { subscriptionId: sub.id, userId: sub.userId, metric: 'territories',    quantity: territories, periodStart, periodEnd },
        { subscriptionId: sub.id, userId: sub.userId, metric: 'seo_pages',      quantity: pages, periodStart, periodEnd },
      ],
    });
  }

  console.log(`[Billing] Usage snapshot saved for ${subs.length} subscriptions`);
}
