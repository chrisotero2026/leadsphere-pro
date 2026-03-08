/**
 * subscriptions.controller.ts
 * Simplified subscription management
 */

import { Response, NextFunction } from 'express';
import { z } from 'zod';
import { prisma } from '../config/prisma';
import { sendSuccess, sendError } from '../utils/response';
import { AuthRequest } from '../middleware/auth.middleware';

// ── Get all plans (public) ────────────────────────────────────────

export const getPlans = async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const plans = await prisma.plan.findMany({
      where: { isActive: true },
      orderBy: { id: 'asc' },
    });

    return sendSuccess(res, plans);
  } catch (error) {
    next(error);
  }
};

// ── Get my subscription ───────────────────────────────────────────

export const getMySubscription = async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const subscription = await prisma.subscription.findFirst({
      where: { userId: req.user!.userId },
      include: { plan: true },
      orderBy: { createdAt: 'desc' },
    });

    return sendSuccess(res, subscription || { message: 'No active subscription' });
  } catch (error) {
    next(error);
  }
};

// ── Create subscription ───────────────────────────────────────────

export const createSubscription = async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const { planId } = z.object({
      planId: z.string(),
    }).parse(req.body);

    const plan = await prisma.plan.findUnique({ where: { id: planId } });
    if (!plan) return sendError(res, 'Plan not found', 404);

    // Cancel existing subscription
    await prisma.subscription.updateMany({
      where: { userId: req.user!.userId, status: 'active' },
      data: { status: 'canceled' },
    });

    const subscription = await prisma.subscription.create({
      data: {
        userId: req.user!.userId,
        planId,
        status: 'active',
        currentPeriodStart: new Date(),
        currentPeriodEnd: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000),
      },
      include: { plan: true },
    });

    return sendSuccess(res, subscription, 'Subscription created', 201);
  } catch (error) {
    next(error);
  }
};

// ── Cancel subscription ───────────────────────────────────────────

export const cancelSubscription = async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const subscription = await prisma.subscription.findFirst({
      where: { userId: req.user!.userId, status: 'active' },
    });

    if (!subscription) return sendError(res, 'No active subscription', 404);

    const updated = await prisma.subscription.update({
      where: { id: subscription.id },
      data: { status: 'canceled', cancelAtPeriodEnd: true },
    });

    return sendSuccess(res, updated, 'Subscription canceled');
  } catch (error) {
    next(error);
  }
};

// ── Get payment history ───────────────────────────────────────────

export const getPaymentHistory = async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    // Payments not yet implemented
    const payments: any[] = [];

    return sendSuccess(res, payments);
  } catch (error) {
    next(error);
  }
};

// ── Get invoices ──────────────────────────────────────────────────

export const getInvoices = async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    // Invoices not yet implemented
    const invoices: any[] = [];

    return sendSuccess(res, invoices);
  } catch (error) {
    next(error);
  }
};

// ── Create checkout (placeholder) ─────────────────────────────────

export const createCheckout = async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const { planId } = z.object({
      planId: z.string(),
    }).parse(req.body);

    // In production, this would create a Stripe checkout session
    // For now, return a mock checkout URL
    return sendSuccess(res, {
      checkoutUrl: `https://checkout.example.com/session/${planId}`,
      message: 'Checkout session created (simulated)',
    }, 'Checkout session created', 201);
  } catch (error) {
    next(error);
  }
};

// ── Open billing portal (placeholder) ──────────────────────────────

export const openBillingPortal = async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    return sendSuccess(res, {
      portalUrl: 'https://billing.example.com/portal',
      message: 'Billing portal URL (simulated)',
    });
  } catch (error) {
    next(error);
  }
};

// ── Reactivate subscription ───────────────────────────────────────

export const reactivateSubscription = async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const subscription = await prisma.subscription.findFirst({
      where: { userId: req.user!.userId, cancelAtPeriodEnd: true },
    });

    if (!subscription) return sendError(res, 'No subscription to reactivate', 404);

    const updated = await prisma.subscription.update({
      where: { id: subscription.id },
      data: { cancelAtPeriodEnd: false, status: 'active' },
    });

    return sendSuccess(res, updated, 'Subscription reactivated');
  } catch (error) {
    next(error);
  }
};

// ── Get all subscriptions (admin only) ─────────────────────────────

export const getAllSubscriptions = async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const subscriptions = await prisma.subscription.findMany({
      include: { user: true, plan: true },
      orderBy: { createdAt: 'desc' },
      take: 100,
    });

    return sendSuccess(res, subscriptions);
  } catch (error) {
    next(error);
  }
};

// ── Refresh from Stripe (placeholder) ─────────────────────────────

export const refreshFromStripe = async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    return sendSuccess(res, { message: 'Stripe sync completed (simulated)' });
  } catch (error) {
    next(error);
  }
};

// ── Update plan Stripe IDs (placeholder) ──────────────────────────

export const updatePlanStripeIds = async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    return sendSuccess(res, { message: 'Plan Stripe IDs updated (simulated)' });
  } catch (error) {
    next(error);
  }
};

// ── Get marketplace listings ──────────────────────────────────────

export const getMarketplaceListings = async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const listings = await prisma.marketplaceListing.findMany({
      where: { status: 'ACTIVE' },
      orderBy: { createdAt: 'desc' },
      take: 50,
    });

    return sendSuccess(res, listings);
  } catch (error) {
    next(error);
  }
};

// ── Get listing by ID ─────────────────────────────────────────────

export const getListingById = async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const listing = await prisma.marketplaceListing.findUnique({
      where: { id: req.params.id },
    });

    if (!listing) return sendError(res, 'Listing not found', 404);
    return sendSuccess(res, listing);
  } catch (error) {
    next(error);
  }
};

// ── Purchase listing ──────────────────────────────────────────────

export const purchaseListing = async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const { listingId } = z.object({
      listingId: z.string().uuid(),
    }).parse(req.body);

    const listing = await prisma.marketplaceListing.findUnique({
      where: { id: listingId },
    });

    if (!listing) return sendError(res, 'Listing not found', 404);

    // Marketplace purchases not yet implemented
    const purchase: any = {
      id: 'mock-purchase',
      listingId,
      buyerId: req.user!.userId,
      amount: listing.price,
      status: 'completed',
    };

    return sendSuccess(res, purchase, 'Purchase completed', 201);
  } catch (error) {
    next(error);
  }
};

// ── Create listing ────────────────────────────────────────────────

export const createListing = async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const { title, description, price, type } = z.object({
      title: z.string().min(1),
      description: z.string().optional(),
      price: z.number().positive(),
      type: z.enum(['TERRITORY', 'LEAD_PACKAGE', 'CUSTOM']),
    }).parse(req.body);

    const listing = await prisma.marketplaceListing.create({
      data: {
        title,
        description,
        price,
        type,
        status: 'ACTIVE',
        sellerId: req.user!.userId,
      },
    });

    return sendSuccess(res, listing, 'Listing created', 201);
  } catch (error) {
    next(error);
  }
};

// ── Update listing ────────────────────────────────────────────────

export const updateListing = async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const listing = await prisma.marketplaceListing.findUnique({
      where: { id: req.params.id },
    });

    if (!listing) return sendError(res, 'Listing not found', 404);
    if (listing.sellerId !== req.user!.userId) {
      return sendError(res, 'Not authorized', 403);
    }

    const updated = await prisma.marketplaceListing.update({
      where: { id: req.params.id },
      data: req.body,
    });

    return sendSuccess(res, updated, 'Listing updated');
  } catch (error) {
    next(error);
  }
};

// ── Seed listings from territories ────────────────────────────────

export const seedListingsFromTerritories = async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    return sendSuccess(res, { message: 'Listings seeded (simulated)' });
  } catch (error) {
    next(error);
  }
};

// ── Get my purchases ──────────────────────────────────────────────

export const getMyPurchases = async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    // Marketplace purchases not yet implemented
    const purchases: any[] = [];

    return sendSuccess(res, purchases);
  } catch (error) {
    next(error);
  }
};

// ── Get revenue stats (admin only) ────────────────────────────────

export const getRevenueStats = async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    // Marketplace revenue not yet implemented
    const totalRevenue = { _sum: { amount: 0 } };

    return sendSuccess(res, {
      totalRevenue: totalRevenue._sum.amount || 0,
      message: 'Revenue stats (simulated)',
    });
  } catch (error) {
    next(error);
  }
};
