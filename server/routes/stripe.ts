/**
 * Guest day-fee payment confirmations - ShootSync
 *
 * ShootSync no longer takes guest day fees by card (owner's decision, 29 Oct 2026): a guest's
 * money belongs to the syndicate, and goes straight to it once syndicates connect their own
 * Stripe accounts. Until then guests pay the syndicate directly and the captain marks them paid.
 * This confirmation page, and the webhook that records a payment, stay for card pages that were
 * already open when online payment was switched off.
 */

import { Router } from 'express'
import type { Deps } from '../deps.js'
import { handle, notFound } from '../access.js'

const SESSION_ID_PATTERN = /^cs_[A-Za-z0-9_]{10,200}$/

export function stripeRoutes({ stripe }: Deps): Router {
  const router = Router()

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
