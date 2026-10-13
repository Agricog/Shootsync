/**
 * ShootSync plan subscriptions - captain only.
 * Webhook events are handled in stripeWebhook.ts.
 */

import { Router } from 'express'
import { z } from 'zod'
import type { Deps } from '../deps.js'
import { HttpError, handle, notFound, requireSyndicateAccess, userIdOf } from '../access.js'

const checkoutSchema = z.object({
  syndicateId: z.string().min(1),
  planTier: z.enum(['STARTER', 'STANDARD']),
  email: z.string().trim().email().max(254),
})

const portalSchema = z.object({
  syndicateId: z.string().min(1),
})

export function subscriptionRoutes({ prisma, stripe, config }: Deps): Router {
  const router = Router()

  // POST /api/subscriptions/create-checkout
  router.post('/create-checkout', handle(async (req, res) => {
    const userId = userIdOf(req)
    const { syndicateId, planTier, email } = checkoutSchema.parse(req.body)
    await requireSyndicateAccess(prisma, syndicateId, userId, 'captain')

    const syndicate = await prisma.syndicate.findUnique({
      where: { id: syndicateId },
      select: { stripeCustomerId: true, stripeSubscriptionStatus: true },
    })
    if (!syndicate) throw notFound()
    if (syndicate.stripeSubscriptionStatus === 'ACTIVE' || syndicate.stripeSubscriptionStatus === 'TRIALING') {
      throw new HttpError(409, 'This syndicate already has an active subscription')
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
    const session = await stripe.checkout.sessions.create({
      customer: customerId,
      payment_method_types: ['card'],
      line_items: [{ price: config.stripePriceIds[planTier], quantity: 1 }],
      mode: 'subscription',
      success_url: `${config.frontendUrl}/subscription/success?session_id={CHECKOUT_SESSION_ID}`,
      cancel_url: `${config.frontendUrl}/subscribe`,
      metadata: { syndicateId, planTier },
      subscription_data: { metadata: { syndicateId, planTier } },
    }, { idempotencyKey: `shootsync-plan-checkout-${syndicateId}-${planTier}-${window10m}` })

    res.json({ url: session.url })
  }))

  // POST /api/subscriptions/portal - Stripe billing portal
  router.post('/portal', handle(async (req, res) => {
    const userId = userIdOf(req)
    const { syndicateId } = portalSchema.parse(req.body)
    await requireSyndicateAccess(prisma, syndicateId, userId, 'captain')

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
    const userId = userIdOf(req)
    await requireSyndicateAccess(prisma, req.params.syndicateId, userId, 'member')

    const syndicate = await prisma.syndicate.findUnique({
      where: { id: req.params.syndicateId },
      select: { stripeSubscriptionStatus: true, planTier: true, subscriptionCurrentPeriodEnd: true },
    })
    if (!syndicate) throw notFound()

    res.json({
      isActive: syndicate.stripeSubscriptionStatus === 'ACTIVE' || syndicate.stripeSubscriptionStatus === 'TRIALING',
      status: syndicate.stripeSubscriptionStatus,
      planTier: syndicate.planTier,
      currentPeriodEnd: syndicate.subscriptionCurrentPeriodEnd,
    })
  }))

  return router
}
