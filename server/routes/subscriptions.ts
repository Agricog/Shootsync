import { Router, Request, Response } from 'express'
import { PrismaClient } from '@prisma/client'
import Stripe from 'stripe'

const router = Router()

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY || '', {
  apiVersion: '2023-10-16',
})

const PRICE_IDS = {
  STARTER: process.env.STRIPE_PRICE_STARTER || '',
  STANDARD: process.env.STRIPE_PRICE_STANDARD || '',
}

// POST /api/subscriptions/create-checkout - Create subscription checkout session
router.post('/create-checkout', async (req: Request, res: Response) => {
  const prisma: PrismaClient = req.app.locals.prisma
  const { syndicateId, planTier, clerkUserId, email } = req.body

  if (!syndicateId || !planTier || !clerkUserId || !email) {
    return res.status(400).json({ error: 'Missing required fields' })
  }

  const priceId = PRICE_IDS[planTier as keyof typeof PRICE_IDS]
  if (!priceId) {
    return res.status(400).json({ error: 'Invalid plan tier' })
  }

  try {
    const syndicate = await prisma.syndicate.findUnique({
      where: { id: syndicateId },
    })

    if (!syndicate) {
      return res.status(404).json({ error: 'Syndicate not found' })
    }

    // Create or retrieve Stripe customer
    let customerId = syndicate.stripeCustomerId

    if (!customerId) {
      const customer = await stripe.customers.create({
        email,
        metadata: {
          syndicateId,
          clerkUserId,
        },
      })
      customerId = customer.id

      await prisma.syndicate.update({
        where: { id: syndicateId },
        data: { stripeCustomerId: customerId },
      })
    }

    // Create checkout session
    const session = await stripe.checkout.sessions.create({
      customer: customerId,
      payment_method_types: ['card'],
      line_items: [
        {
          price: priceId,
          quantity: 1,
        },
      ],
      mode: 'subscription',
      success_url: `${process.env.FRONTEND_URL || 'https://shootsync.co.uk'}/subscription/success?session_id={CHECKOUT_SESSION_ID}`,
      cancel_url: `${process.env.FRONTEND_URL || 'https://shootsync.co.uk'}/pricing`,
      metadata: {
        syndicateId,
        planTier,
      },
      subscription_data: {
        metadata: {
          syndicateId,
          planTier,
        },
      },
    })

    res.json({ url: session.url })
  } catch (error) {
    console.error('Error creating checkout session:', error)
    res.status(500).json({ error: 'Failed to create checkout session' })
  }
})

// POST /api/subscriptions/webhook - Handle Stripe subscription webhooks
router.post('/webhook', async (req: Request, res: Response) => {
  const prisma: PrismaClient = req.app.locals.prisma
  const sig = req.headers['stripe-signature'] as string
  const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET

  if (!webhookSecret) {
    return res.status(500).json({ error: 'Webhook not configured' })
  }

  let event: Stripe.Event

  try {
    event = stripe.webhooks.constructEvent(req.body, sig, webhookSecret)
  } catch (err: any) {
    console.error('Webhook signature verification failed:', err.message)
    return res.status(400).json({ error: `Webhook Error: ${err.message}` })
  }

  switch (event.type) {
    case 'checkout.session.completed': {
      const session = event.data.object as Stripe.Checkout.Session
      
      if (session.mode === 'subscription' && session.metadata?.syndicateId) {
        const subscriptionId = session.subscription as string
        const subscription = await stripe.subscriptions.retrieve(subscriptionId)
        
        await prisma.syndicate.update({
          where: { id: session.metadata.syndicateId },
          data: {
            stripeSubscriptionId: subscriptionId,
            stripePriceId: subscription.items.data[0]?.price.id,
            stripeSubscriptionStatus: 'ACTIVE',
            subscriptionCurrentPeriodEnd: new Date(subscription.current_period_end * 1000),
            planTier: session.metadata.planTier as any,
          },
        })
        console.log(`Subscription activated for syndicate ${session.metadata.syndicateId}`)
      }
      break
    }

    case 'customer.subscription.updated': {
      const subscription = event.data.object as Stripe.Subscription
      const syndicateId = subscription.metadata?.syndicateId

      if (syndicateId) {
        const statusMap: Record<string, string> = {
          active: 'ACTIVE',
          past_due: 'PAST_DUE',
          canceled: 'CANCELLED',
          incomplete: 'INCOMPLETE',
          trialing: 'TRIALING',
        }

        await prisma.syndicate.update({
          where: { id: syndicateId },
          data: {
            stripeSubscriptionStatus: statusMap[subscription.status] as any,
            subscriptionCurrentPeriodEnd: new Date(subscription.current_period_end * 1000),
          },
        })
        console.log(`Subscription updated for syndicate ${syndicateId}: ${subscription.status}`)
      }
      break
    }

    case 'customer.subscription.deleted': {
      const subscription = event.data.object as Stripe.Subscription
      const syndicateId = subscription.metadata?.syndicateId

      if (syndicateId) {
        await prisma.syndicate.update({
          where: { id: syndicateId },
          data: {
            stripeSubscriptionStatus: 'CANCELLED',
          },
        })
        console.log(`Subscription cancelled for syndicate ${syndicateId}`)
      }
      break
    }

    default:
      console.log(`Unhandled event type: ${event.type}`)
  }

  res.json({ received: true })
})

// GET /api/subscriptions/portal - Create customer portal session
router.post('/portal', async (req: Request, res: Response) => {
  const prisma: PrismaClient = req.app.locals.prisma
  const { syndicateId } = req.body

  if (!syndicateId) {
    return res.status(400).json({ error: 'syndicateId required' })
  }

  try {
    const syndicate = await prisma.syndicate.findUnique({
      where: { id: syndicateId },
    })

    if (!syndicate?.stripeCustomerId) {
      return res.status(400).json({ error: 'No subscription found' })
    }

    const session = await stripe.billingPortal.sessions.create({
      customer: syndicate.stripeCustomerId,
      return_url: `${process.env.FRONTEND_URL || 'https://shootsync.co.uk'}/settings`,
    })

    res.json({ url: session.url })
  } catch (error) {
    console.error('Error creating portal session:', error)
    res.status(500).json({ error: 'Failed to create portal session' })
  }
})

// GET /api/subscriptions/status/:syndicateId - Check subscription status
router.get('/status/:syndicateId', async (req: Request, res: Response) => {
  const prisma: PrismaClient = req.app.locals.prisma
  const { syndicateId } = req.params

  try {
    const syndicate = await prisma.syndicate.findUnique({
      where: { id: syndicateId },
      select: {
        stripeSubscriptionStatus: true,
        planTier: true,
        subscriptionCurrentPeriodEnd: true,
      },
    })

    if (!syndicate) {
      return res.status(404).json({ error: 'Syndicate not found' })
    }

    const isActive = syndicate.stripeSubscriptionStatus === 'ACTIVE' || 
                     syndicate.stripeSubscriptionStatus === 'TRIALING'

    res.json({
      isActive,
      status: syndicate.stripeSubscriptionStatus,
      planTier: syndicate.planTier,
      currentPeriodEnd: syndicate.subscriptionCurrentPeriodEnd,
    })
  } catch (error) {
    console.error('Error checking subscription:', error)
    res.status(500).json({ error: 'Failed to check subscription' })
  }
})

export default router
