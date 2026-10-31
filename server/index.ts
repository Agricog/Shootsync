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
import { sealOutstandingBankDetails, wrongKey } from './bankBackfill.js'
import { runRetention } from './retention.js'
import { clerkCaptainEmail, runDeletionWarnings } from './deletionWarnings.js'
import { MAIL_FROM, resendMailer } from './mailer.js'
import { createClerkClient } from '@clerk/backend'
import { keyId } from './bankCrypto.js'

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

// Bank details still readable (from before 0006) are sealed before any request is taken.
const bankBoot = config.bankKeys
  ? await sealOutstandingBankDetails(prisma, config.bankKeys)
  : null
if (bankBoot && wrongKey(bankBoot)) {
  // Not one opens: this is the wrong key, not a damaged row. Refuse to start, so the previous
  // deploy keeps serving and nobody is asked to re-enter every beater's details.
  console.error('[boot] BANK_DETAILS_KEY does not open any beater’s bank details: it is not the key they were sealed with. Put the right key back in Railway → Variables (or set the old one as BANK_DETAILS_KEY_PREVIOUS), then redeploy.')
  await Sentry.flush(2000).catch(() => undefined)
  process.exit(1)
}
if (bankBoot?.unreadable.length) {
  alerts.alert('config', 'Some beaters’ bank details are sealed with a key this server does not have, or have been altered. Restore the previous BANK_DETAILS_KEY as BANK_DETAILS_KEY_PREVIOUS, or ask those beaters for their details again.', { beaters: bankBoot.unreadable.join(',') })
}

// Email (server/mailer.ts): required in production (server/config.ts), so a production server
// always has one. The captain's address comes from Clerk at the moment of sending.
const mailer = config.resendApiKey ? resendMailer(config.resendApiKey) : null
const clerk = createClerkClient({ secretKey: config.clerkSecretKey })
const captainEmail = clerkCaptainEmail((id) => clerk.users.getUser(id))

const server = app.listen(PORT, () => {
  // Boot log is a verification point (Standard §19.10): it names what this process will accept.
  console.log(`[boot] ShootSync API listening on ${PORT}`)
  console.log(`[boot] Error reports: ${config.sentryDsn ? `Sentry (${config.release})` : 'log only (no SENTRY_DSN)'}`)
  console.log(`[boot] Database schema: ${REQUIRED_MIGRATION} applied`)
  console.log(`[boot] Sessions accepted from: ${config.allowedOrigins.join(', ')}`)
  console.log(`[boot] Stripe mode: ${config.stripeSecretKey.startsWith('sk_live_') ? 'LIVE' : 'TEST'}`)
  console.log(
    bankBoot
      ? `[boot] Bank details: sealed (key ${keyId(config.bankKeys!.current)}); ${bankBoot.sealed} sealed now, ${bankBoot.resealed} moved to the current key, ${bankBoot.halfCleared} half-entered cleared, ${bankBoot.unreadable.length} unreadable`
      : '[boot] Bank details: no BANK_DETAILS_KEY, so none can be saved'
  )
  console.log(mailer ? `[boot] Email: Resend, from ${MAIL_FROM}` : '[boot] Email: no RESEND_API_KEY, so no email is sent (deletion warnings are off)')
  void checkStripePrices()
})

// Retention (server/retention.ts): records past their time are removed every hour, starting a
// minute after boot. One server runs it at a time; a failed run is reported and tried next hour.
const RETENTION_EVERY_MS = 60 * 60 * 1000
/** A run still going when the next is due (a slow provider, a long backlog) is left to finish. */
let retentionRunning = false
async function retentionRun() {
  if (retentionRunning) return
  retentionRunning = true
  try {
    await retentionAndWarnings()
  } finally {
    retentionRunning = false
  }
}
async function retentionAndWarnings() {
  try {
    // Anything written readable by older code during a deploy's overlap is sealed within the hour.
    if (config.bankKeys) {
      const late = await sealOutstandingBankDetails(prisma, config.bankKeys)
      if (late.sealed || late.halfCleared) console.log(`[retention] bank details sealed late: ${late.sealed}, half-entered cleared: ${late.halfCleared}`)
    }
    const result = await runRetention(prisma)
    if (result.ran) {
      const { ran: _ran, ...counts } = result
      const removed = Object.entries(counts).filter(([, n]) => n > 0)
      console.log(`[retention] ${removed.length ? removed.map(([k, n]) => `${k} ${n}`).join(', ') : 'nothing due'}`)
    }
  } catch (err) {
    alerts.report(err, 'retention run')
  }
  // Then the warnings for what is coming up (server/deletionWarnings.ts). Its own try, so a
  // retention failure never stops a warning going, nor the reverse.
  if (!mailer) return
  try {
    const warned = await runDeletionWarnings(prisma, { mailer, captainEmail, alerts, siteUrl: config.frontendUrl })
    if (warned.sent || warned.noEmail || warned.failed) {
      console.log(`[warnings] deletion warnings: ${warned.sent} sent, ${warned.noEmail} with no address, ${warned.failed} failed`)
    }
  } catch (err) {
    alerts.report(err, 'deletion warnings run')
  }
}
const retentionFirst = setTimeout(() => void retentionRun(), 60 * 1000)
const retentionTimer = setInterval(() => void retentionRun(), RETENTION_EVERY_MS)
retentionFirst.unref()
retentionTimer.unref()

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
  clearTimeout(retentionFirst)
  clearInterval(retentionTimer)
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
