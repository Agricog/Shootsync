/**
 * Guest day-fee payments - ShootSync
 *
 * Public routes: a guest has no account. The invite token from their link is
 * what authorises the payment, never a guest ID the browser chooses.
 */

import { Router } from 'express'
import { z } from 'zod'
import type { Deps } from '../deps.js'
import { HttpError, handle, isLiveSubscription, notFound } from '../access.js'
import { INVITE_TOKEN_PATTERN } from './guests.js'

const checkoutSchema = z.object({
  token: z.string().regex(INVITE_TOKEN_PATTERN),
})

const SESSION_ID_PATTERN = /^cs_[A-Za-z0-9_]{10,200}$/

export function stripeRoutes({ prisma, stripe, config }: Deps): Router {
  const router = Router()

  // POST /api/stripe/create-checkout-session { token }
  router.post('/create-checkout-session', handle(async (req, res) => {
    const parsed = checkoutSchema.safeParse(req.body)
    if (!parsed.success) throw notFound('This invitation is invalid or has expired.')

    const guest = await prisma.guestGun.findUnique({
      where: { inviteToken: parsed.data.token },
      include: {
        shootDay: { select: { date: true, locationName: true, syndicate: { select: { name: true, status: true, stripeSubscriptionStatus: true } } } },
      },
    })
    // An archived syndicate takes no more payments.
    if (!guest || guest.shootDay.syndicate.status !== 'ACTIVE') throw notFound('This invitation is invalid or has expired.')
    // Nor does one whose plan has lapsed: its captain couldn't cancel the day or the guest from the app.
    if (!isLiveSubscription(guest.shootDay.syndicate.stripeSubscriptionStatus)) {
      throw new HttpError(409, 'This syndicate can’t take payments online at the moment. Please ask the person who invited you how to pay.')
    }
    if (guest.paymentStatus === 'PAID') throw new HttpError(409, 'Already paid')
    if (guest.rsvpStatus !== 'CONFIRMED' || !guest.waiverAccepted) {
      throw new HttpError(409, 'Please accept the invitation and waiver first')
    }
    if (guest.dayFee <= 0) throw new HttpError(400, 'No payment required')

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
              description: `Shoot day on ${shootDate} with ${guest.shootDay.syndicate.name}`,
            },
            unit_amount: guest.dayFee, // pence
          },
          quantity: 1,
        },
      ],
      mode: 'payment',
      success_url: `${config.frontendUrl}/guest/payment-success?session_id={CHECKOUT_SESSION_ID}`,
      cancel_url: `${config.frontendUrl}/guest/accept/${guest.inviteToken}`,
      customer_email: guest.email,
      metadata: { guestId: guest.id, type: 'guest_day_fee' },
      // The card page closes after 30 minutes (Stripe's minimum), so a stale page can't be paid much later.
      expires_at: Math.floor(Date.now() / 1000) + 30 * 60,
    })

    res.json({ url: session.url })
  }))

  // GET /api/stripe/session/:sessionId - guest payment confirmation page
  router.get('/session/:sessionId', handle(async (req, res) => {
    if (!SESSION_ID_PATTERN.test(req.params.sessionId)) throw notFound()

    let session
    try {
      session = await stripe.checkout.sessions.retrieve(req.params.sessionId)
    } catch {
      throw notFound()
    }
    // Only ShootSync guest payments, never any other session on the Stripe account.
    if (session.metadata?.type !== 'guest_day_fee') throw notFound()

    res.set('Cache-Control', 'no-store')
    res.json({
      status: session.payment_status,
      customerEmail: session.customer_email,
      amountTotal: session.amount_total,
    })
  }))

  return router
}
