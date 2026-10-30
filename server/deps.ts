import type { PrismaClient } from '@prisma/client'
import type Stripe from 'stripe'
import type { AppConfig } from './config.js'
import type { Alerts } from './alerts.js'

/** Everything a route needs, passed in explicitly so tests can supply their own. */
export interface Deps {
  prisma: PrismaClient
  stripe: Stripe
  config: AppConfig
  /** Today's UK date, "YYYY-MM-DD" (server/app.ts londonToday). Tests fix it, so dates in fixtures never go stale. */
  today: () => string
  /** The current moment. Tests fix it; `today` is derived from it in the app. */
  now: () => Date
  /** Where alerts and error reports go (server/alerts.ts). Tests record them. */
  alerts: Alerts
}
