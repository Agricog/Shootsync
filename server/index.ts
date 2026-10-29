/**
 * Server entry point - ShootSync
 * Validates configuration, then starts the app. Refuses to start with any secret missing.
 */

import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { PrismaClient } from '@prisma/client'
import Stripe from 'stripe'
import { ConfigError, loadConfig, type AppConfig } from './config.js'
import { createClerkVerifier } from './auth.js'
import { createApp } from './app.js'
import { PLAN_PRICES_PENCE, type PlanTierKey } from './plans.js'
import { REQUIRED_MIGRATION, requireSchema } from './schemaVersion.js'

let config: AppConfig
try {
  config = loadConfig()
} catch (err) {
  if (err instanceof ConfigError) {
    console.error(`[boot] ${err.message}. Add them in Railway → Variables, then redeploy.`)
    process.exit(1)
  }
  throw err
}

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const prisma = new PrismaClient()
const stripe = new Stripe(config.stripeSecretKey, { apiVersion: '2023-10-16' })

const app = createApp({
  prisma,
  stripe,
  config,
  verifyToken: createClerkVerifier(config.clerkSecretKey, config.allowedOrigins),
  // dist/server/index.js → dist/ holds the built frontend
  staticDir: config.isProduction ? path.join(__dirname, '..') : undefined,
})

const PORT = Number(process.env.PORT) || 3001

// Never run this code against a database that is behind it: exits if so (server/schemaVersion.ts).
await requireSchema(prisma)

const server = app.listen(PORT, () => {
  // Boot log is a verification point (Standard §19.10): it names what this process will accept.
  console.log(`[boot] ShootSync API listening on ${PORT}`)
  console.log(`[boot] Database schema: ${REQUIRED_MIGRATION} applied`)
  console.log(`[boot] Sessions accepted from: ${config.allowedOrigins.join(', ')}`)
  console.log(`[boot] Stripe mode: ${config.stripeSecretKey.startsWith('sk_live_') ? 'LIVE' : 'TEST'}`)
  void checkStripePrices()
})

/** The website's prices must be what Stripe charges. Logged at every boot; never stops the server. */
async function checkStripePrices() {
  for (const tier of Object.keys(PLAN_PRICES_PENCE) as PlanTierKey[]) {
    try {
      const price = await stripe.prices.retrieve(config.stripePriceIds[tier])
      const expected = PLAN_PRICES_PENCE[tier]
      const ok =
        price.unit_amount === expected &&
        price.currency === 'gbp' &&
        price.recurring?.interval === 'month' &&
        price.active
      const charged = `£${((price.unit_amount ?? 0) / 100).toFixed(2)}/${price.recurring?.interval ?? 'one-off'}${price.active ? '' : ' (archived)'}`
      console[ok ? 'log' : 'error'](
        `[boot] Stripe price ${tier}: ${charged} ${ok ? 'matches the website' : `DOES NOT MATCH the website's £${(expected / 100).toFixed(2)}/month`}`
      )
    } catch (err) {
      console.error(`[boot] Stripe price ${tier}: could not be read (${err instanceof Error ? err.message : 'unknown error'})`)
    }
  }
}

async function shutdown(signal: string) {
  console.log(`[shutdown] ${signal} received`)
  server.close()
  await prisma.$disconnect()
  process.exit(0)
}

process.on('SIGTERM', () => void shutdown('SIGTERM'))
process.on('SIGINT', () => void shutdown('SIGINT'))
