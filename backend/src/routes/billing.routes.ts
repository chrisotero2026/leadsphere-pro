/**
 * billing.routes.ts
 *
 * Mount in src/index.ts:
 *   import { billingRouter }     from './routes/billing.routes';
 *   import { stripeWebhookHandler } from './webhooks/stripeWebhook.handler';
 *
 *   // CRITICAL: webhook must use raw body — mount BEFORE express.json()
 *   app.post('/stripe/webhook', express.raw({ type: 'application/json' }), stripeWebhookHandler);
 *   app.use('/api/v1/billing', billingRouter);
 */

import { Router } from 'express';
import { authenticate, authorize } from '../middleware/auth.middleware';
import {
  getPlans, getMySubscription, createCheckout, openBillingPortal,
  cancelMySubscription, reactivateSubscription, getPaymentHistory, getInvoices,
  getAllSubscriptions, refreshFromStripe, updatePlanStripeIds,
} from '../controllers/subscriptions.controller';
import {
  getMarketplaceListings, getListingById, purchaseListing,
  createListing, updateListing, seedListingsFromTerritories,
  getMyPurchases, getRevenueStats,
} from '../controllers/marketplace.controller';

export const billingRouter = Router();

// ── Plans (public) ───────────────────────────────────────────────────
billingRouter.get('/plans', getPlans);

// ── Subscription (authenticated) ─────────────────────────────────────
billingRouter.use(authenticate);

billingRouter.get('/subscription',              getMySubscription);
billingRouter.post('/subscription/checkout',    createCheckout);
billingRouter.post('/subscription/portal',      openBillingPortal);
billingRouter.post('/subscription/cancel',      cancelMySubscription);
billingRouter.post('/subscription/reactivate',  reactivateSubscription);

// ── Billing history ───────────────────────────────────────────────────
billingRouter.get('/payments',   getPaymentHistory);
billingRouter.get('/invoices',   getInvoices);

// ── Marketplace ───────────────────────────────────────────────────────
billingRouter.get('/marketplace',          getMarketplaceListings);   // no auth needed
billingRouter.get('/marketplace/:id',      getListingById);
billingRouter.get('/marketplace/my',       getMyPurchases);
billingRouter.post('/marketplace/purchase', purchaseListing);

// ── Admin routes ──────────────────────────────────────────────────────
billingRouter.get( '/admin/subscriptions',           authorize('admin'), getAllSubscriptions);
billingRouter.post('/admin/subscriptions/:id/sync',  authorize('admin'), refreshFromStripe);
billingRouter.put( '/admin/plans/:planId/stripe-ids',authorize('admin'), updatePlanStripeIds);
billingRouter.get( '/admin/revenue',                 authorize('admin'), getRevenueStats);
billingRouter.post('/admin/marketplace',             authorize('admin'), createListing);
billingRouter.put( '/admin/marketplace/:id',         authorize('admin'), updateListing);
billingRouter.post('/admin/marketplace/seed',        authorize('admin'), seedListingsFromTerritories);
