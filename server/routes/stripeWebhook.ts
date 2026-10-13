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
 *
 * Subscriptions are never read from the event body. The webhook endpoint sends
 * events in whatever API version it was created with (2025-12-15.clover on the
 * live account), and from 2025-03-31 the renewal date moved from the subscription
 * onto its items. Instead the subscription is fetched from Stripe through this
 * app's pinned SDK, so a late or out-of-order event records what Stripe says
 * now, not what it said when the event was sent.
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
const LIVE: Array<StripeSubscriptionStatus> = ['ACTIVE', 'TRIALING', 'PAST_DUE']

export function stripeWebhookHandler({ prisma, stripe, config }: Deps) {
  /**
   * Fetch a subscription. Null if Stripe says it doesn't exist (deleted test data, or an
   * event from the other mode): that will never succeed, so it's logged rather than retried
   * for days. Any other failure throws, so the delivery fails and Stripe sends it again.
   */
  async function fetchSubscription(id: string): Promise<Stripe.Subscription | null> {
    try {
      return await stripe.subscriptions.retrieve(id)
    } catch (err) {
      const e = err as { type?: string; code?: string }
      if (e.type === 'StripeInvalidRequestError' && e.code === 'resource_missing') {
        console.error(`[stripe] subscription ${id} does not exist in this Stripe account; event ignored`)
        return null
      }
      throw err
    }
  }

  /** The plan is whichever of our prices the subscription is on, so a change made in Stripe is seen. */
  function tierOf(subscription: Stripe.Subscription, fallback: string | undefined): string | undefined {
    const priceId = subscription.items?.data[0]?.price.id
    const match = (Object.entries(config.stripePriceIds) as Array<[string, string]>).find(([, id]) => id === priceId)
    return match ? match[0] : fallback
  }

  /**
   * The renewal date. Older API versions put it on the subscription, newer ones on each
   * item: read either, and never turn a missing value into an invalid date.
   */
  function periodEnd(subscription: Stripe.Subscription): Date | undefined {
    const legacy = (subscription as { current_period_end?: unknown }).current_period_end
    const item = (subscription.items?.data[0] as { current_period_end?: unknown } | undefined)?.current_period_end
    const seconds = typeof legacy === 'number' ? legacy : item
    return typeof seconds === 'number' ? new Date(seconds * 1000) : undefined
  }

  /**
   * Save a subscription's current state against its syndicate.
   * `startsNew` is true only for a completed checkout, which may replace an earlier
   * subscription. Any other event only updates the subscription the syndicate is on,
   * so a late event about an old, cancelled subscription can't cancel a new one.
   */
  async function recordSubscription(syndicateId: string, subscription: Stripe.Subscription, metadataTier: string | undefined, startsNew: boolean) {
    const end = periodEnd(subscription)
    const planTier = tierOf(subscription, metadataTier)
    if (!end) console.warn(`[stripe] subscription ${subscription.id} has no renewal date; status recorded without it`)
    const result = await prisma.syndicate.updateMany({
      where: startsNew
        ? { id: syndicateId }
        : { id: syndicateId, OR: [{ stripeSubscriptionId: null }, { stripeSubscriptionId: subscription.id }] },
      data: {
        stripeSubscriptionId: subscription.id,
        stripePriceId: subscription.items?.data[0]?.price.id ?? null,
        stripeSubscriptionStatus: STATUS_MAP[subscription.status],
        subscriptionCurrentPeriodEnd: end, // undefined leaves the saved date as it is
        ...(planTier && PLAN_TIERS.has(planTier) ? { planTier: planTier as 'STARTER' | 'STANDARD' } : {}),
      },
    })
    if (result.count === 0) {
      console.warn(`[stripe] subscription ${subscription.id} not recorded: syndicate ${syndicateId} is unknown or on a different subscription`)
    }
    return result.count > 0
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
          const subscription = await fetchSubscription(subscriptionId)
          if (!subscription) return
          const syndicateId = session.metadata.syndicateId
          // A checkout replaces the syndicate's subscription, unless this is a late copy of
          // an old checkout whose subscription has since ended.
          const ended = subscription.status === 'canceled' || subscription.status === 'incomplete_expired'
          if (!ended) {
            // Checkout refuses a second plan, so this should never happen; if it does, say so loudly.
            const current = await prisma.syndicate.findUnique({ where: { id: syndicateId }, select: { stripeSubscriptionId: true, stripeSubscriptionStatus: true } })
            if (current?.stripeSubscriptionId && current.stripeSubscriptionId !== subscription.id && current.stripeSubscriptionStatus && LIVE.includes(current.stripeSubscriptionStatus)) {
              console.error(`[stripe] syndicate ${syndicateId} now has two subscriptions: ${subscription.id} replaces ${current.stripeSubscriptionId}, which is still billing. Cancel and refund ${current.stripeSubscriptionId} in Stripe.`)
            }
          }
          if (await recordSubscription(syndicateId, subscription, session.metadata.planTier, !ended)) {
            console.log(`[stripe] subscription started: syndicate ${syndicateId} (${subscription.status})`)
          }
        }
        return
      }

      case 'customer.subscription.created':
      case 'customer.subscription.updated':
      case 'customer.subscription.deleted': {
        // Only the ID is taken from the event; the state comes from Stripe now (see top of file).
        const { id } = event.data.object as { id: string }
        const subscription = await fetchSubscription(id)
        const syndicateId = subscription?.metadata?.syndicateId
        if (!subscription || !syndicateId) return
        await recordSubscription(syndicateId, subscription, subscription.metadata?.planTier, false)
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
