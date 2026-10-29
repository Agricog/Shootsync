/**
 * Guest payments - ShootSync
 *
 * ShootSync no longer takes guest day fees by card (owner's decision, 29 Oct 2026): a guest's
 * money belongs to the syndicate, and goes straight to it once syndicates connect their own
 * Stripe accounts. Until then guests pay the syndicate directly and the captain marks them paid.
 * Nothing is mounted here now; the webhook (stripeWebhook.ts) still records a card payment if
 * one ever arrives, so money is never lost sight of.
 */

import { Router } from 'express'
import type { Deps } from '../deps.js'

export function stripeRoutes(_deps: Deps): Router {
  return Router()
}
