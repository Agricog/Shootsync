import { Router, Request, Response } from 'express'
import { PrismaClient } from '@prisma/client'
import Stripe from 'stripe'

const router = Router()

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY || '', {
  apiVersion: '2024-11-20.acacia',
})

// POST /api/stripe/create-checkout-session - Create checkout for guest payment
router.post('/create-checkout-session', async (req: Request, res: Response) => {
  const prisma: PrismaClient = req.app.locals.prisma
  const { guestId } = req.body

  if (!guestId) {
    return res.status(400).json({ error: 'guestId is required' })
  }

  try {
    const guest = await prisma.guestGun.findUnique({
      where: { id: guestId },
      include: {
        shootDay: {
          select: {
            date: true,
            locationName: true,
            syndicate: { select: { name: true } },
          },
        },
      },
    })

    if (!guest) {
      return res.status(404).json({ error: 'Guest not found' })
    }

    if (guest.paymentStatus === 'PAID') {
      return res.status(400).json({ error: 'Already paid' })
    }

    if (guest.dayFee <= 0) {
      return res.status(400).json({ error: 'No payment required' })
    }

    const shootDate = new Date(guest.shootDay.date).toLocaleDateString('en-GB', {
      day: 'numeric',
      month: 'long',
      year: 'numeric',
    })

    const session = await stripe.checkout.sessions.create({
      payment_method_types: ['card'],
      line_items: [
        {
          price_data: {
            currency: 'gbp',
            product_data: {
              name: `Guest Day - ${guest.shootDay.locationName}`,
              description: `Shoot day on ${shootDate} with ${guest.shootDay.syndicate?.name || 'the syndicate'}`,
            },
            unit_amount: guest.dayFee,
          },
          quantity: 1,
        },
      ],
      mode: 'payment',
      success_url: `${process.env.FRONTEND_URL || 'https://shootsync.co.uk'}/guest/payment-success?session_id={CHECKOUT_SESSION_ID}`,
      cancel_url: `${process.env.FRONTEND_URL || 'https://shootsync.co.uk'}/guest/accept/${guest.inviteToken}`,
      customer_email: guest.email,
      metadata: {
        guestId: guest.id,
        type: 'guest_day_fee',
      },
    })

    res.json({ url: session.url })
  } catch (error) {
    console.error('Error creating checkout session:', error)
    res.status(500).json({ error: 'Failed to create checkout session' })
  }
})

// POST /api/stripe/webhook - Handle Stripe webhooks
router.post('/webhook', async (req: Request, res: Response) => {
  const prisma: PrismaClient = req.app.locals.prisma
  const sig = req.headers['stripe-signature'] as string
  const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET

  if (!webhookSecret) {
    console.error('STRIPE_WEBHOOK_SECRET not configured')
    return res.status(500).json({ error: 'Webhook not configured' })
  }

  let event: Stripe.Event

  try {
    event = stripe.webhooks.constructEvent(req.body, sig, webhookSecret)
  } catch (err: any) {
    console.error('Webhook signature verification failed:', err.message)
    return res.status(400).json({ error: `Webhook Error: ${err.message}` })
  }

  // Handle the event
  switch (event.type) {
    case 'checkout.session.completed': {
      const session = event.data.object as Stripe.Checkout.Session
      
      if (session.metadata?.type === 'guest_day_fee' && session.metadata?.guestId) {
        try {
          await prisma.guestGun.update({
            where: { id: session.metadata.guestId },
            data: {
              paymentStatus: 'PAID',
              stripePaymentId: session.payment_intent as string,
            },
          })
          console.log(`Payment confirmed for guest ${session.metadata.guestId}`)
        } catch (err) {
          console.error('Error updating guest payment status:', err)
        }
      }
      break
    }

    case 'checkout.session.expired': {
      const session = event.data.object as Stripe.Checkout.Session
      console.log(`Checkout session expired: ${session.id}`)
      break
    }

    default:
      console.log(`Unhandled event type: ${event.type}`)
  }

  res.json({ received: true })
})

// GET /api/stripe/session/:sessionId - Get session status
router.get('/session/:sessionId', async (req: Request, res: Response) => {
  const { sessionId } = req.params

  try {
    const session = await stripe.checkout.sessions.retrieve(sessionId)
    
    res.json({
      status: session.payment_status,
      customerEmail: session.customer_email,
      amountTotal: session.amount_total,
    })
  } catch (error) {
    console.error('Error retrieving session:', error)
    res.status(500).json({ error: 'Failed to retrieve session' })
  }
})

export default router
