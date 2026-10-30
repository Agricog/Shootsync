/**
 * ShootSync plan subscriptions - captain only.
 * Webhook events are handled in stripeWebhook.ts.
 */

import { Router } from 'express'
import { z } from 'zod'
import type Stripe from 'stripe'
import type { Deps } from '../deps.js'
import { HttpError, handle, notFound, planSummary, requireSyndicateAccess, userIdOf } from '../access.js'

const checkoutSchema = z.object({
  syndicateId: z.string().min(1),
  planTier: z.enum(['STARTER', 'STANDARD']),
  email: z.string().trim().email().max(254),
})

const portalSchema = z.object({
  syndicateId: z.string().min(1),
})

/** Subscriptions that are over: anything else (active, trialing, past due, unpaid, incomplete, paused) still counts. */
const ENDED = new Set(['canceled', 'incomplete_expired'])

export function subscriptionRoutes({ prisma, stripe, config, now, alerts }: Deps): Router {
  const router = Router()

  // POST /api/subscriptions/create-checkout
  router.post('/create-checkout', handle(async (req, res) => {
    const userId = userIdOf(req)
    const { syndicateId, planTier, email } = checkoutSchema.parse(req.body)
    // Choosing a plan is how a lapsed syndicate becomes writable again.
    await requireSyndicateAccess(prisma, syndicateId, req, 'captain', { allowLapsed: true })

    const syndicate = await prisma.syndicate.findUnique({
      where: { id: syndicateId },
      select: { stripeCustomerId: true, stripeSubscriptionStatus: true },
    })
    if (!syndicate) throw notFound()
    if (syndicate.stripeSubscriptionStatus === 'ACTIVE' || syndicate.stripeSubscriptionStatus === 'TRIALING') {
      throw new HttpError(409, 'This syndicate already has an active subscription')
    }
    if (syndicate.stripeSubscriptionStatus === 'PAST_DUE' || syndicate.stripeSubscriptionStatus === 'UNPAID') {
      throw new HttpError(409, 'Your last payment did not go through. Update your card in Settings, Manage billing.')
    }
    // Our record can lag Stripe by a few seconds: ask Stripe too, so a plan is never bought twice.
    if (syndicate.stripeCustomerId) {
      const existing = await stripe.subscriptions.list({ customer: syndicate.stripeCustomerId, status: 'all', limit: 20 })
      if (existing.data.some((s) => !ENDED.has(s.status))) {
        throw new HttpError(409, 'This syndicate already has a subscription. Manage it in Settings, Manage billing.')
      }
    }

    let customerId = syndicate.stripeCustomerId
    if (!customerId) {
      const customer = await stripe.customers.create(
        { email, metadata: { syndicateId, clerkUserId: userId } },
        // One Stripe customer per syndicate, even if two requests race.
        { idempotencyKey: `shootsync-customer-${syndicateId}` }
      )
      customerId = customer.id
      await prisma.syndicate.update({ where: { id: syndicateId }, data: { stripeCustomerId: customerId } })
    }

    // A double-click or second tab within 10 minutes gets the same checkout, not a second subscription.
    const window10m = Math.floor(Date.now() / 600_000)
    const params: Stripe.Checkout.SessionCreateParams = {
      customer: customerId,
      payment_method_types: ['card'],
      line_items: [{ price: config.stripePriceIds[planTier], quantity: 1 }],
      mode: 'subscription',
      success_url: `${config.frontendUrl}/subscription/success?session_id={CHECKOUT_SESSION_ID}`,
      cancel_url: `${config.frontendUrl}/subscribe`,
      metadata: { syndicateId, planTier },
      subscription_data: { metadata: { syndicateId, planTier } },
    }
    let session = await stripe.checkout.sessions.create(params, { idempotencyKey: `shootsync-plan-checkout-${syndicateId}-${planTier}-${window10m}` })
    // A repeat within the window gets the earlier page back. If that page has since been
    // closed (the captain chose another plan in between), make a fresh one.
    if (session.status !== 'open') session = await stripe.checkout.sessions.create(params)

    // Only one plan checkout page open at a time: close any other (a second tab, another plan,
    // an older visit), so two plans can't both be paid for.
    const open = await stripe.checkout.sessions.list({ customer: customerId, status: 'open', limit: 20 })
    for (const other of open.data) {
      if (other.id === session.id || other.mode !== 'subscription') continue
      try {
        await stripe.checkout.sessions.expire(other.id)
      } catch (err) {
        // Most likely it was paid for this very moment. Don't offer a second page: close ours.
        alerts.report(err, 'stripe: close an open checkout', { checkout: other.id, syndicate: syndicateId })
        await stripe.checkout.sessions.expire(session.id).catch(() => undefined)
        throw new HttpError(409, 'Another checkout for this syndicate is in progress. Try again in a minute.')
      }
    }

    res.json({ url: session.url })
  }))

  // POST /api/subscriptions/portal - Stripe billing portal
  router.post('/portal', handle(async (req, res) => {
    const { syndicateId } = portalSchema.parse(req.body)
    // Updating a card is how a past-due syndicate becomes writable again.
    await requireSyndicateAccess(prisma, syndicateId, req, 'captain', { allowLapsed: true })

    const syndicate = await prisma.syndicate.findUnique({
      where: { id: syndicateId },
      select: { stripeCustomerId: true },
    })
    if (!syndicate?.stripeCustomerId) throw new HttpError(400, 'No subscription found')

    const session = await stripe.billingPortal.sessions.create({
      customer: syndicate.stripeCustomerId,
      return_url: `${config.frontendUrl}/settings`,
    })
    res.json({ url: session.url })
  }))

  // GET /api/subscriptions/status/:syndicateId - captain and active members
  router.get('/status/:syndicateId', handle(async (req, res) => {
    await requireSyndicateAccess(prisma, req.params.syndicateId, req, 'member')

    const syndicate = await prisma.syndicate.findUnique({
      where: { id: req.params.syndicateId },
      select: { stripeSubscriptionStatus: true, planTier: true, subscriptionCurrentPeriodEnd: true, disputeOpenedAt: true, pastDueSince: true, planEndedAt: true, stripeSubscriptionId: true, createdAt: true },
    })
    if (!syndicate) throw notFound()

    res.json(planSummary(syndicate, now()))
  }))

  return router
}
