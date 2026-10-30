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
import { recordActivity } from '../audit.js'

const STATUS_MAP: Record<Stripe.Subscription.Status, StripeSubscriptionStatus> = {
  active: 'ACTIVE',
  trialing: 'TRIALING',
  past_due: 'PAST_DUE',
  unpaid: 'UNPAID',
  canceled: 'CANCELLED',
  incomplete: 'INCOMPLETE',
  incomplete_expired: 'CANCELLED',
  paused: 'INCOMPLETE',
}

const PLAN_TIERS = new Set(['STARTER', 'STANDARD'])
/** A subscription that still exists in Stripe (not ended), so a second one would be a double charge. */
const LIVE: Array<StripeSubscriptionStatus> = ['ACTIVE', 'TRIALING', 'PAST_DUE', 'UNPAID']
/** Dispute states in which the card issuer is still holding the money. */
const OPEN_DISPUTE = new Set(['warning_needs_response', 'warning_under_review', 'needs_response', 'under_review'])

export function stripeWebhookHandler({ prisma, stripe, config, alerts, now }: Deps) {
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
        alerts.alert('webhook', 'A subscription in a Stripe event does not exist in this Stripe account (deleted test data, or an event from the other mode); the event was ignored.', { subscription: id })
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
    if (!end) alerts.alert('webhook', 'A subscription has no renewal date; its status was recorded without one.', { subscription: subscription.id })
    const before = await prisma.syndicate.findUnique({ where: { id: syndicateId }, select: { stripeSubscriptionStatus: true } })
    const status = STATUS_MAP[subscription.status]
    const result = await prisma.syndicate.updateMany({
      where: startsNew
        ? { id: syndicateId }
        : { id: syndicateId, OR: [{ stripeSubscriptionId: null }, { stripeSubscriptionId: subscription.id }] },
      data: {
        stripeSubscriptionId: subscription.id,
        stripePriceId: subscription.items?.data[0]?.price.id ?? null,
        stripeSubscriptionStatus: status,
        subscriptionCurrentPeriodEnd: end, // undefined leaves the saved date as it is
        ...(planTier && PLAN_TIERS.has(planTier) ? { planTier: planTier as 'STARTER' | 'STANDARD' } : {}),
      },
    })
    if (result.count === 0) {
      alerts.alert('billing', 'A subscription was not recorded: its syndicate is unknown or on a different subscription.', { subscription: subscription.id, syndicate: syndicateId })
      return false
    }
    // When the card first fails, note the moment: full use runs 14 days from here (planAccess).
    // Any other status ends the episode, so the next failure starts its own two weeks.
    // The plan ending starts the 90-day clock to deletion (claude/retention-policy-2026-10-30.md);
    // a plan that starts again stops it.
    if (status === 'CANCELLED' || status === 'UNPAID') {
      await prisma.syndicate.updateMany({ where: { id: syndicateId, planEndedAt: null }, data: { planEndedAt: now() } })
    } else if (status === 'ACTIVE' || status === 'TRIALING' || status === 'PAST_DUE') {
      await prisma.syndicate.updateMany({ where: { id: syndicateId, planEndedAt: { not: null } }, data: { planEndedAt: null } })
    }
    if (before?.stripeSubscriptionStatus !== status) {
      await recordActivity(prisma, { syndicateId, action: 'Plan status changed', actorRole: 'stripe', targetType: 'syndicate', targetId: syndicateId, details: { from: before?.stripeSubscriptionStatus ?? null, to: status, subscription: subscription.id } })
    }
    if (subscription.status === 'past_due') {
      await prisma.syndicate.updateMany({ where: { id: syndicateId, pastDueSince: null }, data: { pastDueSince: now() } })
    } else {
      await prisma.syndicate.updateMany({ where: { id: syndicateId, pastDueSince: { not: null } }, data: { pastDueSince: null } })
    }
    return true
  }

  async function handleEvent(event: Stripe.Event) {
    switch (event.type) {
      case 'checkout.session.completed': {
        const session = event.data.object as Stripe.Checkout.Session

        if (session.metadata?.type === 'guest_day_fee' && session.metadata.guestId) {
          if (session.payment_status !== 'paid') return
          // The money has been taken, so it is always recorded (a guest marked unpaid could pay
          // twice). But the amount must be the guest's fee, in pounds: anything else is said loudly.
          const owed = await prisma.guestGun.findUnique({ where: { id: session.metadata.guestId }, select: { dayFee: true } })
          if (owed && (session.amount_total !== owed.dayFee || session.currency !== 'gbp')) {
            alerts.alert('money', 'A guest paid a different amount from their day fee. Check it in Stripe and refund or collect the difference.', { guest: session.metadata.guestId, paid: session.amount_total, currency: session.currency, dayFeePence: owed.dayFee, session: session.id })
          }
          const recorded = await prisma.guestGun.updateMany({
            where: { id: session.metadata.guestId },
            data: {
              paymentStatus: 'PAID',
              stripePaymentId: typeof session.payment_intent === 'string' ? session.payment_intent : null,
            },
          })
          if (recorded.count === 0) {
            // The guest was removed: the money arrived but there is no record to attach it to.
            alerts.alert('money', 'A guest day fee was paid for a guest who no longer exists. Refund it in Stripe.', { guest: session.metadata.guestId, session: session.id, paid: session.amount_total })
          } else {
            const where = await prisma.guestGun.findUnique({ where: { id: session.metadata.guestId }, select: { shootDay: { select: { syndicateId: true } } } })
            if (where) await recordActivity(prisma, { syndicateId: where.shootDay.syndicateId, action: 'Guest paid by card', actorRole: 'stripe', targetType: 'guest', targetId: session.metadata.guestId, details: { amount: session.amount_total, session: session.id } })
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
              alerts.alert('billing', 'A syndicate now has two subscriptions: the new one replaces the old, which is still billing. Cancel and refund the old one in Stripe.', { syndicate: syndicateId, newSubscription: subscription.id, oldSubscription: current.stripeSubscriptionId })
            }
          }
          if (await recordSubscription(syndicateId, subscription, session.metadata.planTier, !ended)) {
            // A new plan paid for is a payment arrived: a dispute hold ends.
            if (!ended) await prisma.syndicate.updateMany({ where: { id: syndicateId }, data: { disputeOpenedAt: null } })
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

      case 'invoice.paid': {
        // Money has arrived for a subscription: whatever dispute was open, the account is paid.
        // Only real money, and only a payment made after the dispute was opened: a late
        // redelivery of the very invoice that was charged back, or a £0 invoice, lifts nothing.
        const invoice = event.data.object as Stripe.Invoice
        if (!(invoice.amount_paid > 0)) return
        const syndicate = await syndicateOfCustomer(invoice.customer)
        if (!syndicate) return
        const cleared = await prisma.syndicate.updateMany({ where: { id: syndicate.id, disputeOpenedAt: { lt: eventTime(event) } }, data: { disputeOpenedAt: null } })
        if (cleared.count > 0) {
          await recordActivity(prisma, { syndicateId: syndicate.id, action: 'Payment received after a dispute: in full use again', actorRole: 'stripe', targetType: 'syndicate', targetId: syndicate.id, details: { invoice: invoice.id } })
          alerts.alert('billing', 'A syndicate that had a disputed payment has paid again; it is in full use again.', { syndicate: syndicate.id, invoice: invoice.id })
        }
        return
      }

      case 'charge.dispute.created': {
        // A chargeback. The card issuer has taken the money back for now; someone must answer it
        // in Stripe within the deadline. A guest's fee is the syndicate's money, so the captain is
        // told through the owner; a subscription payment makes the syndicate read-only at once.
        const dispute = event.data.object as Stripe.Dispute
        const paymentIntent = idOf(dispute.payment_intent)
        const guest = paymentIntent ? await prisma.guestGun.findFirst({ where: { stripePaymentId: paymentIntent }, select: { id: true, shootId: true } }) : null
        if (guest) {
          alerts.alert('dispute', 'A guest has disputed their day fee with their card issuer. Answer it in Stripe before the deadline and tell the captain.', { guest: guest.id, shoot: guest.shootId, dispute: dispute.id, amount: dispute.amount, reason: dispute.reason })
          return
        }
        const syndicate = await syndicateOfCharge(dispute.charge)
        if (syndicate) {
          // What Stripe says now, not what the event said: a delivery retried after the dispute
          // closed must not lock the syndicate again.
          const status = (await fetchDispute(dispute.id))?.status ?? dispute.status
          if (!OPEN_DISPUTE.has(status)) return
          const opened = await prisma.syndicate.updateMany({ where: { id: syndicate.id, disputeOpenedAt: null }, data: { disputeOpenedAt: eventTime(event) } })
          if (opened.count > 0) await recordActivity(prisma, { syndicateId: syndicate.id, action: 'Card payment disputed: read-only', actorRole: 'stripe', targetType: 'syndicate', targetId: syndicate.id, details: { dispute: dispute.id, amount: dispute.amount } })
          alerts.alert('dispute', 'A syndicate has disputed a subscription payment with its card issuer. It is read-only until a payment arrives. Answer the dispute in Stripe before the deadline.', { syndicate: syndicate.id, dispute: dispute.id, amount: dispute.amount, reason: dispute.reason })
          return
        }
        alerts.alert('dispute', 'A card dispute was opened on a payment ShootSync cannot match to a syndicate or a guest. Look it up in Stripe.', { dispute: dispute.id, charge: idOf(dispute.charge), amount: dispute.amount, reason: dispute.reason })
        return
      }

      case 'charge.dispute.closed': {
        const dispute = event.data.object as Stripe.Dispute
        const syndicate = await syndicateOfCharge(dispute.charge)
        if (dispute.status === 'won' || dispute.status === 'warning_closed') {
          // The money stayed with ShootSync: nothing is owed, so the hold ends (unless a later
          // dispute has since opened its own).
          const cleared = syndicate ? await prisma.syndicate.updateMany({ where: { id: syndicate.id, disputeOpenedAt: { lte: eventTime(event) } }, data: { disputeOpenedAt: null } }) : { count: 0 }
          if (syndicate && cleared.count > 0) await recordActivity(prisma, { syndicateId: syndicate.id, action: 'Dispute closed with the payment kept: in full use again', actorRole: 'stripe', targetType: 'syndicate', targetId: syndicate.id, details: { dispute: dispute.id } })
          alerts.alert('dispute', 'A card dispute was closed in ShootSync’s favour.', { dispute: dispute.id, syndicate: syndicate?.id ?? null, status: dispute.status })
          return
        }
        // Lost: the money is gone. The syndicate stays read-only until it pays again; decide in
        // Stripe whether to cancel its subscription.
        alerts.alert('dispute', 'A card dispute was lost: the money has gone. The syndicate stays read-only until a payment arrives. Decide in Stripe whether to cancel its subscription.', { dispute: dispute.id, syndicate: syndicate?.id ?? null, amount: dispute.amount, status: dispute.status })
        return
      }

      case 'charge.refunded': {
        // Money sent back from Stripe, by hand or by a dispute: the record must say so.
        const charge = event.data.object as Stripe.Charge
        const paymentIntent = idOf(charge.payment_intent)
        const guest = paymentIntent ? await prisma.guestGun.findFirst({ where: { stripePaymentId: paymentIntent }, select: { id: true, paymentStatus: true } }) : null
        if (guest) {
          if (charge.refunded) {
            const changed = await prisma.guestGun.updateMany({ where: { id: guest.id, paymentStatus: 'PAID' }, data: { paymentStatus: 'REFUNDED' } })
            // A redelivery after the guest is already recorded as refunded says nothing new.
            if (changed.count === 0) return
            const where = await prisma.guestGun.findUnique({ where: { id: guest.id }, select: { shootDay: { select: { syndicateId: true } } } })
            if (where) await recordActivity(prisma, { syndicateId: where.shootDay.syndicateId, action: 'Guest refunded by card', actorRole: 'stripe', targetType: 'guest', targetId: guest.id, details: { refunded: charge.amount_refunded } })
            alerts.alert('money', 'A guest’s day fee paid by card has been refunded in full; the guest is now recorded as refunded.', { guest: guest.id, paymentIntent, charge: charge.id, refunded: charge.amount_refunded })
          } else {
            alerts.alert('money', 'A guest’s day fee paid by card has been partly refunded; the guest is still recorded as paid.', { guest: guest.id, paymentIntent, charge: charge.id, refunded: charge.amount_refunded, of: charge.amount })
          }
          return
        }
        const syndicate = await syndicateOfCharge(charge.id, charge)
        alerts.alert('money', charge.refunded ? 'A payment has been refunded in full.' : 'A payment has been partly refunded.', { charge: charge.id, syndicate: syndicate?.id ?? null, refunded: charge.amount_refunded, of: charge.amount })
        return
      }

      default:
        return
    }
  }

  /** When Stripe says the event happened: the same whenever it is delivered. */
  function eventTime(event: Stripe.Event): Date {
    return new Date(event.created * 1000)
  }

  async function fetchDispute(id: string): Promise<Stripe.Dispute | null> {
    try {
      return await stripe.disputes.retrieve(id)
    } catch (err) {
      const e = err as { type?: string; code?: string }
      if (e.type === 'StripeInvalidRequestError' && e.code === 'resource_missing') return null
      throw err
    }
  }

  function idOf(ref: string | { id: string } | null | undefined): string | null {
    return typeof ref === 'string' ? ref : ref?.id ?? null
  }

  async function syndicateOfCustomer(customer: Stripe.Invoice['customer'] | Stripe.Charge['customer']): Promise<{ id: string } | null> {
    const customerId = idOf(customer as string | { id: string } | null)
    return customerId ? prisma.syndicate.findFirst({ where: { stripeCustomerId: customerId }, select: { id: true } }) : null
  }

  /** The syndicate a charge belongs to, by the Stripe customer it was made for. */
  async function syndicateOfCharge(ref: string | Stripe.Charge | null | undefined, loaded?: Stripe.Charge): Promise<{ id: string } | null> {
    const charge = loaded ?? (typeof ref === 'string' ? await fetchCharge(ref) : ref)
    return charge ? syndicateOfCustomer(charge.customer) : null
  }

  /** As fetchSubscription: a charge Stripe doesn't have is null (alerted by the caller), anything else throws so Stripe retries. */
  async function fetchCharge(id: string): Promise<Stripe.Charge | null> {
    try {
      return await stripe.charges.retrieve(id)
    } catch (err) {
      const e = err as { type?: string; code?: string }
      if (e.type === 'StripeInvalidRequestError' && e.code === 'resource_missing') return null
      throw err
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
      alerts.report(err, `stripe webhook: ${event.type}`, { event: event.id })
      return res.status(500).json({ error: 'Webhook processing failed' })
    }
  }
}
