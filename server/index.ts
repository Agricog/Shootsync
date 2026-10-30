/**
 * Server entry point - ShootSync
 * Validates configuration, then starts the app. Refuses to start with any secret missing.
 */

import path from 'node:path'
import { fileURLToPath } from 'node:url'
import * as Sentry from '@sentry/node'
import { PrismaClient } from '@prisma/client'
import Stripe from 'stripe'
import { ConfigError, loadConfig, type AppConfig } from './config.js'
import { consoleAlerts, keepBreadcrumb, scrubServerEvent, sentryAlerts } from './alerts.js'
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

// Error reports and alerts go to Sentry, which tells the owner. Personal data never does:
// no request bodies, headers or cookies are attached, and alerts carry IDs only (server/alerts.ts).
if (config.sentryDsn) {
  Sentry.init({
    dsn: config.sentryDsn,
    environment: config.isProduction ? 'production' : 'development',
    release: config.release,
    tracesSampleRate: 0,
    // Nothing personal is collected: no user, cookies, headers, bodies, query strings, database
    // query data or local variables. Sentry 11 collects all of these unless told not to.
    dataCollection: {
      userInfo: false,
      cookies: false,
      httpHeaders: false,
      httpBodies: [],
      urlQueryParams: false,
      databaseQueryData: false,
      stackFrameVariables: false,
      genAI: { inputs: false, outputs: false },
      mcp: { inputs: false, outputs: false },
    },
    // Whatever an integration attaches, the event leaves with the route pattern only: no URL
    // (a guest's invite link is a credential), no request, no user, no console lines.
    beforeSend: (event, hint) => scrubServerEvent(event, hint),
    beforeBreadcrumb: (crumb) => keepBreadcrumb(crumb),
  })
}
const alerts = config.sentryDsn ? sentryAlerts() : consoleAlerts()

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const prisma = new PrismaClient()
const stripe = new Stripe(config.stripeSecretKey, { apiVersion: '2023-10-16' })

const app = createApp({
  prisma,
  stripe,
  config,
  alerts,
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
  console.log(`[boot] Error reports: ${config.sentryDsn ? `Sentry (${config.release})` : 'log only (no SENTRY_DSN)'}`)
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
      if (ok) {
        console.log(`[boot] Stripe price ${tier}: ${charged} matches the website`)
      } else {
        alerts.alert('config', `Stripe price ${tier} is ${charged}; the website says £${(expected / 100).toFixed(2)}/month. Captains are being shown the wrong price.`, { tier, priceId: config.stripePriceIds[tier] })
      }
    } catch (err) {
      alerts.alert('config', `Stripe price ${tier} could not be read at boot: checkout for that plan will fail.`, { tier, priceId: config.stripePriceIds[tier], error: err instanceof Error ? err.message : 'unknown error' })
    }
  }
}

// Railway sends SIGTERM when a new deploy takes over. Requests already in flight finish first
// (a save mid-way is never cut off), within a bound so a stuck connection can't hold the old
// deploy open; then the database connections close.
const DRAIN_MS = 10_000
let stopping = false
async function shutdown(signal: string) {
  if (stopping) return
  stopping = true
  console.log(`[shutdown] ${signal} received: finishing open requests`)
  await new Promise<void>((resolve) => {
    const limit = setTimeout(() => {
      console.warn(`[shutdown] still open after ${DRAIN_MS / 1000}s; closing anyway`)
      resolve()
    }, DRAIN_MS)
    server.close(() => {
      clearTimeout(limit)
      resolve()
    })
  })
  await Sentry.flush(2000).catch(() => undefined)
  await prisma.$disconnect()
  console.log('[shutdown] done')
  process.exit(0)
}

process.on('SIGTERM', () => void shutdown('SIGTERM'))
process.on('SIGINT', () => void shutdown('SIGINT'))
