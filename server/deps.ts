import type { PrismaClient } from '@prisma/client'
import type Stripe from 'stripe'
import type { AppConfig } from './config.js'

/** Everything a route needs, passed in explicitly so tests can supply their own. */
export interface Deps {
  prisma: PrismaClient
  stripe: Stripe
  config: AppConfig
}
