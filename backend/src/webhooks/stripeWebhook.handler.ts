/**
 * stripeWebhook.handler.ts
 *
 * Processes ALL inbound Stripe webhook events.
 *
 * Architecture:
 *  1. Verify signature (reject if invalid)
 *  2. Idempotency check (skip already-processed events)
 *  3. Route to event-specific handler
 *  4. Mark event as processed
 *
 * Events handled:
 *  - checkout.session.completed
 *  - customer.subscription.created/updated/deleted
 *  - invoice.payment_succeeded/failed
 *  - customer.subscription.trial_will_end (7-day warning)
 *  - payment_intent.payment_failed
 */

import { Request, Response } from 'express';
import { PrismaClient, PaymentStatus } from '@prisma/client';
import Stripe from 'stripe';
import {
  verifyWebhookSignature,
  syncSubscriptionFromStripe,
  syncInvoiceFromStripe,
} from '../services/stripe.service';
import { onSubscriptionActivated, onSubscriptionCanceled, onPaymentFailed } from '../services/billing.lifecycle.service';

const prisma = new PrismaClient();

// ─── Main handler ─────────────────────────────────────────────────────

export async function stripeWebhookHandler(req: Request, res: Response) {
  // 1. Verify signature
  let event: Stripe.Event;
  try {
    event = verifyWebhookSignature(req.body as Buffer, req.headers['stripe-signature'] as string);
  } catch (err: any) {
    console.error('[Webhook] Signature verification failed:', err.message);
    return res.status(400).json({ error: 'Invalid signature' });
  }

  // 2. Idempotency — check if already processed
  const existing = await prisma.stripeWebhookEvent.findUnique({
    where: { stripeEventId: event.id },
  });
  if (existing?.processed) {
    return res.status(200).json({ received: true, skipped: true });
  }

  // 3. Log event
  const record = await prisma.stripeWebhookEvent.upsert({
    where:  { stripeEventId: event.id },
    update: {},
    create: { stripeEventId: event.id, type: event.type, payload: event as any },
  });

  // 4. Process event
  let error: string | null = null;
  try {
    await routeEvent(event);
    await prisma.stripeWebhookEvent.update({
      where: { id: record.id },
      data:  { processed: true, processedAt: new Date() },
    });
  } catch (err: any) {
    error = err.message;
    console.error(`[Webhook] Error processing ${event.type}:`, err);
    await prisma.stripeWebhookEvent.update({
      where: { id: record.id },
      data:  { error: err.message },
    });
  }

  return res.status(200).json({ received: true, error });
}

// ─── Event router ─────────────────────────────────────────────────────

async function routeEvent(event: Stripe.Event) {
  switch (event.type) {

    // ── Checkout completed (subscription or one-time) ─────────────
    case 'checkout.session.completed': {
      const session = event.data.object as Stripe.Checkout.Session;
      if (session.mode === 'subscription') {
        await handleCheckoutSubscription(session);
      } else if (session.mode === 'payment') {
        await handleCheckoutOneTime(session);
      }
      break;
    }

    // ── Subscription lifecycle ────────────────────────────────────
    case 'customer.subscription.created':
    case 'customer.subscription.updated': {
      const sub = event.data.object as Stripe.Subscription;
      await syncSubscriptionFromStripe(sub);
      if (sub.status === 'active' && !event.data.previous_attributes?.status) {
        await onSubscriptionActivated(sub.metadata?.userId, sub.id).catch(console.error);
      }
      break;
    }

    case 'customer.subscription.deleted': {
      const sub = event.data.object as Stripe.Subscription;
      await syncSubscriptionFromStripe(sub);
      await onSubscriptionCanceled(sub.metadata?.userId).catch(console.error);
      break;
    }

    case 'customer.subscription.trial_will_end': {
      const sub = event.data.object as Stripe.Subscription;
      await sendTrialEndingEmail(sub.metadata?.userId, sub).catch(console.error);
      break;
    }

    // ── Invoice / payment ─────────────────────────────────────────
    case 'invoice.payment_succeeded': {
      const invoice = event.data.object as Stripe.Invoice;
      await syncInvoiceFromStripe(invoice);
      await recordSuccessfulPayment(invoice);
      break;
    }

    case 'invoice.payment_failed': {
      const invoice = event.data.object as Stripe.Invoice;
      await syncInvoiceFromStripe(invoice);
      const sub = await prisma.subscription.findFirst({
        where: { stripeSubId: invoice.subscription as string },
      });
      if (sub) {
        await onPaymentFailed(sub.userId, invoice).catch(console.error);
      }
      break;
    }

    case 'payment_intent.payment_failed': {
      const pi = event.data.object as Stripe.PaymentIntent;
      const userId = pi.metadata?.userId;
      if (userId) {
        await prisma.payment.updateMany({
          where: { stripePaymentIntentId: pi.id },
          data:  { status: PaymentStatus.FAILED },
        }).catch(() => {});
      }
      break;
    }

    default:
      // Unhandled event — log but don't error
      console.log(`[Webhook] Unhandled event: ${event.type}`);
  }
}

// ─── Handle subscription checkout completion ──────────────────────────

async function handleCheckoutSubscription(session: Stripe.Checkout.Session) {
  if (!session.subscription || !session.metadata?.userId) return;

  const { Stripe: StripeSDK } = await import('stripe');
  const stripe = new StripeSDK(process.env.STRIPE_SECRET_KEY!, { apiVersion: '2024-11-20.acacia' });

  const stripeSub = await stripe.subscriptions.retrieve(session.subscription as string, {
    expand: ['latest_invoice'],
  });

  await syncSubscriptionFromStripe(stripeSub);
}

// ─── Handle one-time marketplace purchase ────────────────────────────

async function handleCheckoutOneTime(session: Stripe.Checkout.Session) {
  const { listingId, userId } = session.metadata ?? {};
  if (!listingId || !userId) return;

  await prisma.marketplacePurchase.updateMany({
    where: { stripeSessionId: session.id },
    data:  {
      status:       PaymentStatus.SUCCEEDED,
      completedAt:  new Date(),
      stripePaymentIntentId: session.payment_intent as string ?? undefined,
    },
  });

  // Mark listing as sold
  await prisma.marketplaceListing.update({
    where: { id: listingId },
    data: {
      status:  'SOLD',
      buyerId: userId,
      soldAt:  new Date(),
      stripeSessionId: session.id,
    },
  });

  // If the listing is a territory — transfer ownership
  const listing = await prisma.marketplaceListing.findUnique({
    where: { id: listingId },
    select: { type: true, territoryId: true },
  });

  if (listing?.type === 'TERRITORY' && listing.territoryId) {
    await prisma.territoryOwnership.create({
      data: {
        territoryId: listing.territoryId,
        userId,
        startDate:  new Date(),
        endDate:    new Date(Date.now() + 30 * 24 * 60 * 60 * 1000),
        isActive:   true,
        autoRenew:  false, // separate Stripe subscription handles renewal
        leadNotifyEmail:     true,
        leadNotifyDashboard: true,
      },
    }).catch(() => {}); // may already exist
  }
}

// ─── Record successful payment ────────────────────────────────────────

async function recordSuccessfulPayment(invoice: Stripe.Invoice) {
  if (!invoice.id) return;

  const sub = await prisma.subscription.findFirst({
    where: { stripeSubId: invoice.subscription as string },
    select: { id: true, userId: true },
  });

  if (!sub) return;

  await prisma.payment.upsert({
    where:  { stripeInvoiceId: invoice.id } as any,
    update: { status: PaymentStatus.SUCCEEDED },
    create: {
      subscriptionId:       sub.id,
      userId:               sub.userId,
      stripeInvoiceId:      invoice.id,
      stripePaymentIntentId:invoice.payment_intent as string ?? undefined,
      amount:               invoice.amount_paid / 100,
      currency:             invoice.currency,
      status:               PaymentStatus.SUCCEEDED,
      description:          `Invoice ${invoice.number}`,
    },
  });
}

// ─── Trial ending email placeholder ──────────────────────────────────

async function sendTrialEndingEmail(userId: string | undefined, sub: Stripe.Subscription) {
  if (!userId) return;
  const user = await prisma.user.findUnique({ where: { id: userId }, select: { email: true, firstName: true } });
  if (!user) return;
  console.log(`[Billing] Trial ending for ${user.email} — send email here`);
  // Implement via your email provider (Resend/SendGrid)
}
