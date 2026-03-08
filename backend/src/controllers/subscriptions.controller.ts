/**
 * subscriptions.controller.ts
 * Handles plan selection, checkout, subscription management, billing portal
 */

import { Response, NextFunction } from 'express';
import { z } from 'zod';
import { PrismaClient } from '@prisma/client';
import { AuthRequest } from '../middleware/auth.middleware';
import {
  createSubscriptionCheckout,
  createBillingPortalSession,
  cancelSubscription,
  listStripeInvoices,
  syncSubscriptionFromStripe,
  retrieveStripeSubscription,
} from '../services/stripe.service';
import { getUserPlanTier, checkPlanLimit } from '../services/billing.lifecycle.service';
import { PLANS } from '../services/plans.config';

const prisma = new PrismaClient();

// ─── Get all plans (public) ────────────────────────────────────────────

export const getPlans = async (_req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const plans = await prisma.plan.findMany({
      where:   { isActive: true },
      orderBy: { sortOrder: 'asc' },
    });
    // Merge with static config (highlights, features)
    const enriched = plans.map(p => ({
      ...p,
      config: PLANS[p.tier] ?? null,
    }));
    return res.json({ data: enriched });
  } catch (e) { next(e); }
};

// ─── Get my subscription ───────────────────────────────────────────────

export const getMySubscription = async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const sub = await prisma.subscription.findFirst({
      where:   { userId: req.user!.userId, status: { notIn: ['CANCELED'] } },
      include: { plan: true },
      orderBy: { createdAt: 'desc' },
    });

    const tier  = sub?.plan?.tier ?? 'FREE';
    const plan  = PLANS[tier];
    const usage = await getCurrentUsage(req.user!.userId);

    return res.json({
      data: {
        subscription: sub,
        tier,
        plan:         plan ?? null,
        usage,
        features:     plan?.features ?? PLANS.FREE.features,
      },
    });
  } catch (e) { next(e); }
};

// ─── Create checkout session ───────────────────────────────────────────

export const createCheckout = async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const { planTier, interval = 'monthly', trialDays } = z.object({
      planTier:   z.enum(['BASIC', 'PROFESSIONAL', 'ENTERPRISE']),
      interval:   z.enum(['monthly', 'annual']).default('monthly'),
      trialDays:  z.coerce.number().int().min(0).max(30).optional(),
    }).parse(req.body);

    const plan = await prisma.plan.findFirst({ where: { tier: planTier as any } });
    if (!plan) return res.status(404).json({ error: 'Plan not found' });

    const stripePriceId = interval === 'annual'
      ? plan.stripeAnnualPriceId
      : plan.stripeMonthlyPriceId;

    if (!stripePriceId) {
      return res.status(400).json({
        error: `Stripe price not configured for ${planTier} ${interval}. Configure in Stripe dashboard and set stripeMonthlyPriceId on the plan.`,
      });
    }

    const user = await prisma.user.findUnique({
      where:  { id: req.user!.userId },
      select: { email: true, firstName: true, lastName: true },
    });

    const { url, sessionId } = await createSubscriptionCheckout({
      userId:        req.user!.userId,
      email:         user!.email,
      name:          `${user!.firstName} ${user!.lastName}`,
      stripePriceId,
      interval,
      trialDays,
    });

    return res.json({ data: { url, sessionId } });
  } catch (e) { next(e); }
};

// ─── Open Stripe billing portal ────────────────────────────────────────

export const openBillingPortal = async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const url = await createBillingPortalSession(req.user!.userId, '/dashboard/billing');
    return res.json({ data: { url } });
  } catch (e: any) {
    if (e.message.includes('No Stripe customer')) {
      return res.status(400).json({
        error:   'No active subscription found. Please subscribe to a plan first.',
        upgrade: '/plans',
      });
    }
    next(e);
  }
};

// ─── Cancel subscription ───────────────────────────────────────────────

export const cancelMySubscription = async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const { immediately = false } = z.object({
      immediately: z.boolean().optional().default(false),
    }).parse(req.body);

    const sub = await prisma.subscription.findFirst({
      where:   { userId: req.user!.userId, status: { in: ['ACTIVE', 'TRIALING'] } },
      orderBy: { createdAt: 'desc' },
    });

    if (!sub?.stripeSubId) {
      return res.status(400).json({ error: 'No active subscription found' });
    }

    const updated = await cancelSubscription(sub.stripeSubId, !immediately);

    await prisma.subscription.update({
      where: { id: sub.id },
      data: {
        cancelAtPeriodEnd: !immediately,
        canceledAt:        immediately ? new Date() : undefined,
        status:            immediately ? 'CANCELED' : sub.status,
      },
    });

    return res.json({
      data:    { cancelAtPeriodEnd: updated.cancel_at_period_end },
      message: immediately
        ? 'Subscription canceled immediately'
        : `Subscription will cancel at end of billing period (${new Date(updated.current_period_end * 1000).toLocaleDateString()})`,
    });
  } catch (e) { next(e); }
};

// ─── Reactivate canceled subscription ─────────────────────────────────

export const reactivateSubscription = async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const sub = await prisma.subscription.findFirst({
      where:   { userId: req.user!.userId, cancelAtPeriodEnd: true },
      orderBy: { createdAt: 'desc' },
    });

    if (!sub?.stripeSubId) {
      return res.status(400).json({ error: 'No canceling subscription found' });
    }

    const { getStripe } = await import('../services/stripe.service');
    await getStripe().subscriptions.update(sub.stripeSubId, { cancel_at_period_end: false });

    await prisma.subscription.update({
      where: { id: sub.id },
      data:  { cancelAtPeriodEnd: false, canceledAt: null },
    });

    return res.json({ data: null, message: 'Subscription reactivated — it will continue renewing.' });
  } catch (e) { next(e); }
};

// ─── Get payment history ───────────────────────────────────────────────

export const getPaymentHistory = async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const page  = Math.max(1, parseInt(req.query.page  as string) || 1);
    const limit = Math.min(50, parseInt(req.query.limit as string) || 20);

    const [payments, total] = await Promise.all([
      prisma.payment.findMany({
        where:   { userId: req.user!.userId },
        skip:    (page - 1) * limit,
        take:    limit,
        orderBy: { createdAt: 'desc' },
      }),
      prisma.payment.count({ where: { userId: req.user!.userId } }),
    ]);

    return res.json({
      data:       payments,
      pagination: { page, limit, total, pages: Math.ceil(total / limit) },
    });
  } catch (e) { next(e); }
};

// ─── Get invoices ──────────────────────────────────────────────────────

export const getInvoices = async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const page  = Math.max(1, parseInt(req.query.page  as string) || 1);
    const limit = Math.min(50, parseInt(req.query.limit as string) || 20);

    const [invoices, total] = await Promise.all([
      prisma.invoice.findMany({
        where:   { userId: req.user!.userId },
        skip:    (page - 1) * limit,
        take:    limit,
        orderBy: { createdAt: 'desc' },
      }),
      prisma.invoice.count({ where: { userId: req.user!.userId } }),
    ]);

    return res.json({
      data:       invoices,
      pagination: { page, limit, total, pages: Math.ceil(total / limit) },
    });
  } catch (e) { next(e); }
};

// ─── Admin: get all subscriptions ─────────────────────────────────────

export const getAllSubscriptions = async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const page   = Math.max(1, parseInt(req.query.page  as string) || 1);
    const limit  = Math.min(100, parseInt(req.query.limit as string) || 25);
    const status = req.query.status as string;
    const tier   = req.query.tier   as string;

    const where: any = {};
    if (status) where.status = status;
    if (tier)   where.plan   = { tier };

    const [rows, total] = await Promise.all([
      prisma.subscription.findMany({
        where,
        skip:    (page - 1) * limit,
        take:    limit,
        orderBy: { createdAt: 'desc' },
        include: {
          plan: true,
          user: { select: { firstName: true, lastName: true, email: true } },
        },
      }),
      prisma.subscription.count({ where }),
    ]);

    // Revenue summary
    const mrr = await prisma.subscription.aggregate({
      where:  { status: { in: ['ACTIVE', 'TRIALING'] } },
      _sum:   { customMonthlyPrice: true },
    });

    return res.json({
      data:       rows,
      pagination: { page, limit, total, pages: Math.ceil(total / limit) },
      meta:       { totalActive: total, mrrEstimate: mrr._sum.customMonthlyPrice },
    });
  } catch (e) { next(e); }
};

// ─── Admin: refresh subscription from Stripe ──────────────────────────

export const refreshFromStripe = async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const sub = await prisma.subscription.findUnique({ where: { id: req.params.id } });
    if (!sub?.stripeSubId) return res.status(404).json({ error: 'Subscription or Stripe ID not found' });

    const stripeSub = await retrieveStripeSubscription(sub.stripeSubId);
    await syncSubscriptionFromStripe(stripeSub);

    return res.json({ data: null, message: 'Subscription synced from Stripe' });
  } catch (e) { next(e); }
};

// ─── Admin: set Stripe price IDs on plan ──────────────────────────────

export const updatePlanStripeIds = async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const { stripeMonthlyPriceId, stripeAnnualPriceId } = z.object({
      stripeMonthlyPriceId: z.string().optional(),
      stripeAnnualPriceId:  z.string().optional(),
    }).parse(req.body);

    const plan = await prisma.plan.update({
      where: { id: req.params.planId },
      data:  { stripeMonthlyPriceId, stripeAnnualPriceId },
    });

    return res.json({ data: plan, message: 'Plan updated with Stripe price IDs' });
  } catch (e) { next(e); }
};

// ─── Helper: current usage for dashboard ──────────────────────────────

async function getCurrentUsage(userId: string) {
  const monthStart = new Date(new Date().getFullYear(), new Date().getMonth(), 1);

  const [territories, leadsThisMonth] = await Promise.all([
    prisma.territoryOwnership.count({ where: { userId, isActive: true } }),
    prisma.leadAssignment.count({
      where: { assignedToId: userId, assignedAt: { gte: monthStart } },
    }),
  ]);

  return { territories, leadsThisMonth, monthStart };
}
