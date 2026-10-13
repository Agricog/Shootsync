/**
 * Stripe webhook - ShootSync
 *
 * One handler for every Stripe event, mounted at both /api/stripe/webhook and
 * /api/subscriptions/webhook. Previously each path handled only half the events
 * while sharing one signing secret, so whichever single URL Stripe was pointed
 * at, either guest payments or subscriptions were silently never recorded.
 *
 * Signature is verified on the raw body before anything is read (Standard §12.1).
 * Every update sets a final state, so a redelivered event is harmless (§12.4).
 */

import type { Request, Response } from 'express'
import type Stripe from 'stripe'
import type { StripeSubscriptionStatus } from '@prisma/client'
import type { Deps } from '../deps.js'

const STATUS_MAP: Record<Stripe.Subscription.Status, StripeSubscriptionStatus> = {
  active: 'ACTIVE',
  trialing: 'TRIALING',
  past_due: 'PAST_DUE',
  unpaid: 'PAST_DUE',
  canceled: 'CANCELLED',
  incomplete: 'INCOMPLETE',
  incomplete_expired: 'CANCELLED',
  paused: 'INCOMPLETE',
}

const PLAN_TIERS = new Set(['STARTER', 'STANDARD'])

export function stripeWebhookHandler({ prisma, stripe, config }: Deps) {
  async function recordSubscription(syndicateId: string, subscription: Stripe.Subscription, planTier?: string) {
    const result = await prisma.syndicate.updateMany({
      where: { id: syndicateId },
      data: {
        stripeSubscriptionId: subscription.id,
        stripePriceId: subscription.items.data[0]?.price.id ?? null,
        stripeSubscriptionStatus: STATUS_MAP[subscription.status],
        subscriptionCurrentPeriodEnd: new Date(subscription.current_period_end * 1000),
        ...(planTier && PLAN_TIERS.has(planTier) ? { planTier: planTier as 'STARTER' | 'STANDARD' } : {}),
      },
    })
    if (result.count === 0) {
      console.warn(`[stripe] subscription ${subscription.id} names unknown syndicate ${syndicateId}`)
    }
  }

  async function handleEvent(event: Stripe.Event) {
    switch (event.type) {
      case 'checkout.session.completed': {
        const session = event.data.object as Stripe.Checkout.Session

        if (session.metadata?.type === 'guest_day_fee' && session.metadata.guestId) {
          if (session.payment_status !== 'paid') return
          const recorded = await prisma.guestGun.updateMany({
            where: { id: session.metadata.guestId },
            data: {
              paymentStatus: 'PAID',
              stripePaymentId: typeof session.payment_intent === 'string' ? session.payment_intent : null,
            },
          })
          if (recorded.count === 0) {
            // The guest was removed: the money arrived but there is no record to attach it to.
            console.error(`[stripe] guest day fee paid for a guest who no longer exists (guest ${session.metadata.guestId}, session ${session.id}): refund it in Stripe`)
          }
          console.log(`[stripe] guest day fee paid: guest ${session.metadata.guestId}`)
          return
        }

        if (session.mode === 'subscription' && session.metadata?.syndicateId && session.subscription) {
          const subscriptionId =
            typeof session.subscription === 'string' ? session.subscription : session.subscription.id
          const subscription = await stripe.subscriptions.retrieve(subscriptionId)
          await recordSubscription(session.metadata.syndicateId, subscription, session.metadata.planTier)
          console.log(`[stripe] subscription started: syndicate ${session.metadata.syndicateId} (${subscription.status})`)
        }
        return
      }

      case 'customer.subscription.created':
      case 'customer.subscription.updated':
      case 'customer.subscription.deleted': {
        const subscription = event.data.object as Stripe.Subscription
        const syndicateId = subscription.metadata?.syndicateId
        if (!syndicateId) return
        await recordSubscription(syndicateId, subscription, subscription.metadata?.planTier)
        console.log(`[stripe] ${event.type}: syndicate ${syndicateId} (${subscription.status})`)
        return
      }

      default:
        return
    }
  }

  return async (req: Request, res: Response) => {
    const signature = req.headers['stripe-signature']
    if (typeof signature !== 'string' || !Buffer.isBuffer(req.body)) {
      return res.status(400).json({ error: 'Missing signature' })
    }

    let event: Stripe.Event
    try {
      event = stripe.webhooks.constructEvent(req.body, signature, config.stripeWebhookSecret)
    } catch {
      return res.status(400).json({ error: 'Invalid signature' })
    }

    try {
      await handleEvent(event)
      return res.json({ received: true })
    } catch (err) {
      // 500 makes Stripe retry the delivery.
      console.error(`[stripe] failed to process ${event.type} ${event.id}:`, err)
      return res.status(500).json({ error: 'Webhook processing failed' })
    }
  }
}
