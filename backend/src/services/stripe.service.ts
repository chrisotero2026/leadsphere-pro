/**
 * stripe.service.ts
 *
 * All Stripe interactions go through this service.
 * Keeps Stripe SDK isolated — easy to swap payment providers.
 *
 * Covers:
 *  - Customer management
 *  - Checkout sessions (subscriptions + one-time)
 *  - Customer Portal (self-serve billing management)
 *  - Subscription CRUD
 *  - Invoice retrieval
 *  - Webhook signature verification
 */

import Stripe from 'stripe';
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

// Lazy init so import doesn't fail if key not set yet
let _stripe: Stripe | null = null;
export function getStripe(): Stripe {
  if (!_stripe) {
    const key = process.env.STRIPE_SECRET_KEY;
    if (!key) throw new Error('STRIPE_SECRET_KEY not configured');
    _stripe = new Stripe(key, { apiVersion: '2024-11-20.acacia', typescript: true });
  }
  return _stripe;
}

const SITE_URL = process.env.SITE_URL ?? 'https://leadsphere.com';

// ─── Customer ────────────────────────────────────────────────────────

export async function getOrCreateStripeCustomer(
  userId:    string,
  email:     string,
  name?:     string,
  phone?:    string
): Promise<string> {
  const stripe = getStripe();

  // Check if subscription already has a customer ID
  const existing = await prisma.subscription.findFirst({
    where: { userId },
    select: { stripeCustomerId: true },
  });
  if (existing?.stripeCustomerId) return existing.stripeCustomerId;

  // Create new Stripe customer
  const customer = await stripe.customers.create({
    email,
    name:     name ?? email,
    phone,
    metadata: { userId, platform: 'leadsphere' },
  });

  return customer.id;
}

// ─── Checkout Session (subscription) ─────────────────────────────────

export interface CheckoutSessionParams {
  userId:          string;
  email:           string;
  name?:           string;
  stripePriceId:   string;    // Stripe Price ID for the plan
  interval:        'monthly' | 'annual';
  trialDays?:      number;    // default 0
  successPath?:    string;    // redirect after success
  cancelPath?:     string;
  metadata?:       Record<string, string>;
}

export async function createSubscriptionCheckout(
  params: CheckoutSessionParams
): Promise<{ url: string; sessionId: string }> {
  const stripe      = getStripe();
  const customerId  = await getOrCreateStripeCustomer(params.userId, params.email, params.name);

  const session = await stripe.checkout.sessions.create({
    mode:              'subscription',
    customer:          customerId,
    line_items:        [{ price: params.stripePriceId, quantity: 1 }],
    success_url:       `${SITE_URL}${params.successPath ?? '/dashboard/billing?success=1'}&session_id={CHECKOUT_SESSION_ID}`,
    cancel_url:        `${SITE_URL}${params.cancelPath ?? '/plans?canceled=1'}`,
    allow_promotion_codes: true,
    billing_address_collection: 'auto',
    tax_id_collection: { enabled: false },
    subscription_data: {
      trial_period_days: params.trialDays ?? 0,
      metadata:          { userId: params.userId, ...params.metadata },
    },
    metadata: { userId: params.userId },
  });

  return { url: session.url!, sessionId: session.id };
}

// ─── Checkout Session (one-time marketplace purchase) ─────────────────

export interface MarketplaceCheckoutParams {
  userId:       string;
  email:        string;
  name?:        string;
  listingId:    string;
  listingTitle: string;
  amount:       number;   // cents
  metadata?:    Record<string, string>;
}

export async function createMarketplaceCheckout(
  params: MarketplaceCheckoutParams
): Promise<{ url: string; sessionId: string }> {
  const stripe     = getStripe();
  const customerId = await getOrCreateStripeCustomer(params.userId, params.email, params.name);

  const session = await stripe.checkout.sessions.create({
    mode:     'payment',
    customer: customerId,
    line_items: [{
      price_data: {
        currency:     'usd',
        unit_amount:  params.amount,
        product_data: { name: params.listingTitle },
      },
      quantity: 1,
    }],
    success_url: `${SITE_URL}/marketplace/success?session_id={CHECKOUT_SESSION_ID}&listing=${params.listingId}`,
    cancel_url:  `${SITE_URL}/marketplace?canceled=1`,
    metadata: {
      userId:    params.userId,
      listingId: params.listingId,
      type:      'marketplace_purchase',
      ...params.metadata,
    },
  });

  return { url: session.url!, sessionId: session.id };
}

// ─── Customer Portal (self-serve billing) ─────────────────────────────

export async function createBillingPortalSession(
  userId:      string,
  returnPath?: string
): Promise<string> {
  const stripe = getStripe();

  const sub = await prisma.subscription.findFirst({
    where: { userId },
    select: { stripeCustomerId: true },
  });
  if (!sub?.stripeCustomerId) {
    throw new Error('No Stripe customer found for this user');
  }

  const session = await stripe.billingPortal.sessions.create({
    customer:   sub.stripeCustomerId,
    return_url: `${SITE_URL}${returnPath ?? '/dashboard/billing'}`,
  });

  return session.url;
}

// ─── Cancel subscription ──────────────────────────────────────────────

export async function cancelSubscription(
  stripeSubId:    string,
  atPeriodEnd:    boolean = true
): Promise<Stripe.Subscription> {
  const stripe = getStripe();
  if (atPeriodEnd) {
    return stripe.subscriptions.update(stripeSubId, { cancel_at_period_end: true });
  }
  return stripe.subscriptions.cancel(stripeSubId);
}

// ─── Retrieve subscription from Stripe ───────────────────────────────

export async function retrieveStripeSubscription(stripeSubId: string) {
  return getStripe().subscriptions.retrieve(stripeSubId, {
    expand: ['latest_invoice', 'default_payment_method'],
  });
}

// ─── List customer invoices ───────────────────────────────────────────

export async function listStripeInvoices(
  customerId: string,
  limit = 20
): Promise<Stripe.Invoice[]> {
  const { data } = await getStripe().invoices.list({ customer: customerId, limit });
  return data;
}

// ─── Webhook signature verification ──────────────────────────────────

export function verifyWebhookSignature(
  payload: Buffer | string,
  signature: string
): Stripe.Event {
  const secret = process.env.STRIPE_WEBHOOK_SECRET;
  if (!secret) throw new Error('STRIPE_WEBHOOK_SECRET not set');
  return getStripe().webhooks.constructEvent(payload, signature, secret);
}

// ─── Sync Stripe subscription → our DB ───────────────────────────────

export async function syncSubscriptionFromStripe(
  stripeSub: Stripe.Subscription
): Promise<void> {
  const userId = stripeSub.metadata?.userId;
  if (!userId) return;

  const priceId = stripeSub.items.data[0]?.price?.id;

  // Find matching plan
  const plan = await prisma.plan.findFirst({
    where: {
      OR: [
        { stripeMonthlyPriceId: priceId },
        { stripeAnnualPriceId:  priceId },
      ],
    },
  });

  const interval = stripeSub.items.data[0]?.price?.recurring?.interval === 'year'
    ? 'ANNUAL'
    : 'MONTHLY';

  const statusMap: Record<string, string> = {
    trialing:   'TRIALING',
    active:     'ACTIVE',
    past_due:   'PAST_DUE',
    canceled:   'CANCELED',
    unpaid:     'UNPAID',
    incomplete: 'INCOMPLETE',
    paused:     'PAUSED',
  };

  await prisma.subscription.upsert({
    where:  { stripeSubId: stripeSub.id },
    update: {
      status:              statusMap[stripeSub.status] as any ?? 'ACTIVE',
      stripePriceId:       priceId,
      planId:              plan?.id ?? undefined,
      currentPeriodStart:  new Date(stripeSub.current_period_start * 1000),
      currentPeriodEnd:    new Date(stripeSub.current_period_end   * 1000),
      canceledAt:          stripeSub.canceled_at ? new Date(stripeSub.canceled_at * 1000) : null,
      cancelAtPeriodEnd:   stripeSub.cancel_at_period_end,
      trialEnd:            stripeSub.trial_end ? new Date(stripeSub.trial_end * 1000) : null,
      interval:            interval as any,
    },
    create: {
      userId,
      planId:              plan?.id!,
      stripeCustomerId:    (stripeSub.customer as string),
      stripeSubId:         stripeSub.id,
      stripePriceId:       priceId,
      status:              statusMap[stripeSub.status] as any ?? 'ACTIVE',
      interval:            interval as any,
      currentPeriodStart:  new Date(stripeSub.current_period_start * 1000),
      currentPeriodEnd:    new Date(stripeSub.current_period_end   * 1000),
      cancelAtPeriodEnd:   stripeSub.cancel_at_period_end,
      trialEnd:            stripeSub.trial_end ? new Date(stripeSub.trial_end * 1000) : null,
    },
  });
}

// ─── Sync invoice from Stripe ─────────────────────────────────────────

export async function syncInvoiceFromStripe(
  stripeInvoice: Stripe.Invoice
): Promise<void> {
  if (!stripeInvoice.id) return;

  const sub = stripeInvoice.subscription
    ? await prisma.subscription.findFirst({
        where: { stripeSubId: stripeInvoice.subscription as string },
      })
    : null;

  // Generate invoice number
  const count = await prisma.invoice.count();
  const invoiceNumber = `INV-${new Date().getFullYear()}-${String(count + 1).padStart(4, '0')}`;

  const statusMap: Record<string, string> = {
    draft: 'DRAFT', open: 'OPEN', paid: 'PAID', void: 'VOID', uncollectible: 'UNCOLLECTIBLE',
  };

  await prisma.invoice.upsert({
    where:  { stripeInvoiceId: stripeInvoice.id },
    update: {
      status:          statusMap[stripeInvoice.status ?? 'open'] as any,
      paidAt:          stripeInvoice.status_transitions?.paid_at
                         ? new Date(stripeInvoice.status_transitions.paid_at * 1000) : null,
      invoicePdfUrl:   stripeInvoice.invoice_pdf,
      hostedInvoiceUrl:stripeInvoice.hosted_invoice_url,
    },
    create: {
      stripeInvoiceId: stripeInvoice.id,
      subscriptionId:  sub?.id,
      userId:          sub?.userId ?? stripeInvoice.metadata?.userId ?? '',
      invoiceNumber,
      subtotal:        stripeInvoice.subtotal / 100,
      tax:             (stripeInvoice.tax ?? 0) / 100,
      total:           stripeInvoice.total / 100,
      currency:        stripeInvoice.currency,
      status:          statusMap[stripeInvoice.status ?? 'open'] as any,
      dueDate:         stripeInvoice.due_date ? new Date(stripeInvoice.due_date * 1000) : null,
      paidAt:          stripeInvoice.status_transitions?.paid_at
                         ? new Date(stripeInvoice.status_transitions.paid_at * 1000) : null,
      invoicePdfUrl:   stripeInvoice.invoice_pdf,
      hostedInvoiceUrl:stripeInvoice.hosted_invoice_url,
      lineItems:       stripeInvoice.lines.data.map(l => ({
        description:   l.description,
        amount:        l.amount / 100,
        quantity:      l.quantity,
        period:        l.period,
      })),
      periodStart:     stripeInvoice.period_start ? new Date(stripeInvoice.period_start * 1000) : null,
      periodEnd:       stripeInvoice.period_end   ? new Date(stripeInvoice.period_end   * 1000) : null,
    },
  });
}
