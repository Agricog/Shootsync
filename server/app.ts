/**
 * Express application - ShootSync
 *
 * Built by a factory so tests can run the real app against a test database
 * with their own token verifier.
 */

import express, { type Request } from 'express'
import cors from 'cors'
import helmet from 'helmet'
import path from 'node:path'
import { readFileSync } from 'node:fs'
import type { Deps } from './deps.js'
import { authGate, isPublicRoute, type TokenVerifier } from './auth.js'
import { errorHandler, handle } from './access.js'
import { checkSchema } from './schemaVersion.js'
import { rateLimit } from './rateLimit.js'
import { syndicateRoutes } from './routes/syndicates.js'
import { memberRoutes } from './routes/members.js'
import { beaterRoutes } from './routes/beaters.js'
import { shootRoutes } from './routes/shoots.js'
import { bagRoutes } from './routes/bags.js'
import { guestRoutes } from './routes/guests.js'
import { stripeRoutes } from './routes/stripe.js'
import { subscriptionRoutes } from './routes/subscriptions.js'
import { meRoutes } from './routes/me.js'
import { stripeWebhookHandler } from './routes/stripeWebhook.js'

export interface AppOptions extends Omit<Deps, 'today'> {
  verifyToken: TokenVerifier
  /** Built frontend to serve (production). Omitted in tests. */
  staticDir?: string
  /** Today's UK date, "YYYY-MM-DD". Picks which dated copy of a prerendered page to serve. Tests pass their own. */
  today?: () => string
}

const WEBHOOK_PATHS = ['/api/stripe/webhook', '/api/subscriptions/webhook']

/** Today's date in the UK, "YYYY-MM-DD". Content dates change at UK midnight, not UTC. */
export function londonToday(now: Date = new Date()): string {
  const parts = new Intl.DateTimeFormat('en-GB', { timeZone: 'Europe/London', year: 'numeric', month: '2-digit', day: '2-digit' }).formatToParts(now)
  const get = (type: string) => parts.find((part) => part.type === type)?.value ?? ''
  return `${get('year')}-${get('month')}-${get('day')}`
}

/** One prerendered copy of a page, served from `from` (inclusive) until the next copy's date. */
export interface PrerenderedCopy {
  from: string
  file: string
}

const SAFE_FILE = /^[a-z0-9-]+\.html$/
const ISO_DATE = /^\d{4}-\d{2}-\d{2}$/

/**
 * Reads dist/prerendered/manifest.json: path -> copies, oldest first (scripts/prerender.mjs).
 * A copy with no date is the one built for the build day. Anything that is not a plain file name
 * or a real date is ignored, so the manifest can never point outside the folder. The older shape
 * (path -> file name) is still read. A build without a manifest serves the app shell for every page.
 */
export function loadPrerenderManifest(staticDir: string): Record<string, PrerenderedCopy[]> {
  try {
    const raw = JSON.parse(readFileSync(path.join(staticDir, 'prerendered', 'manifest.json'), 'utf8'))
    const safe: Record<string, PrerenderedCopy[]> = {}
    for (const [route, value] of Object.entries(raw)) {
      const entries = typeof value === 'string' ? [{ file: value }] : Array.isArray(value) ? value : []
      const copies: PrerenderedCopy[] = []
      for (const entry of entries as Array<{ file?: unknown; from?: unknown }>) {
        if (typeof entry?.file !== 'string' || !SAFE_FILE.test(entry.file)) continue
        if (entry.from === undefined) copies.push({ from: '', file: entry.file })
        else if (typeof entry.from === 'string' && ISO_DATE.test(entry.from)) copies.push({ from: entry.from, file: entry.file })
      }
      copies.sort((a, b) => a.from.localeCompare(b.from))
      if (copies.length > 0 && copies[0].from === '') safe[route] = copies
    }
    return safe
  } catch {
    console.warn('[boot] No prerendered pages found; public pages will be served as the app shell')
    return {}
  }
}

/** The copy current on `today`: the latest whose date has come. */
export function currentCopy(copies: PrerenderedCopy[], today: string): PrerenderedCopy {
  return copies.filter((copy) => copy.from <= today).pop() ?? copies[0]
}

export function createApp(options: AppOptions) {
  const { verifyToken, staticDir, today = londonToday, ...rest } = options
  const deps: Deps = { ...rest, today }
  const app = express()

  // Railway terminates TLS in front of the app; trust its one proxy hop so req.ip is the client.
  app.set('trust proxy', 1)
  app.disable('x-powered-by')

  // CSP is still off: it needs the Clerk and Stripe origins confirmed in a browser first (OPEN-ITEMS).
  app.use(helmet({ contentSecurityPolicy: false }))
  app.use(cors({ origin: deps.config.allowedOrigins, credentials: false }))

  // Stripe needs the raw body to verify its signature, so the webhook is mounted before JSON parsing.
  const webhook = stripeWebhookHandler(deps)
  for (const webhookPath of WEBHOOK_PATHS) {
    app.post(webhookPath, express.raw({ type: 'application/json', limit: '1mb' }), webhook)
  }

  app.use(express.json({ limit: '100kb' }))

  // Public routes are reachable without an account, so they get a tight per-IP limit.
  // Signed-in traffic gets a generous ceiling against runaway clients.
  app.use('/api', rateLimit({
    windowMs: 60_000,
    max: 30,
    applies: (req: Request) => isPublicRoute(req.method, req.path) && !req.path.endsWith('/webhook'),
  }))
  app.use('/api', rateLimit({
    windowMs: 60_000,
    max: 600,
    applies: (req: Request) => !isPublicRoute(req.method, req.path),
  }))

  // API responses hold account data: never let a browser or proxy cache them.
  app.use('/api', (_req, res, next) => {
    res.set('Cache-Control', 'no-store')
    next()
  })

  // Railway's health check (Settings, Deploy, Healthcheck Path). A new deploy only takes over
  // once this answers 200, so it asserts the database and its schema version, not just that the
  // process is up (Standard 19.6). The reason stays in the server log, never in the response.
  app.get('/api/health', handle(async (_req, res) => {
    const schema = await checkSchema(deps.prisma)
    if (!schema.ready) {
      console.error(`[health] not ready: ${schema.reason}`)
      return res.status(503).json({ status: 'unavailable' })
    }
    res.json({ status: 'ok', timestamp: new Date().toISOString() })
  }))

  app.use('/api', authGate(verifyToken, deps.prisma))

  // The browser's word that a signed-in user is still busy on a page that isn't saving anything
  // (server/sessionPolicy.ts). The auth gate above has already recorded the activity.
  app.post('/api/session/ping', (_req, res) => {
    res.status(204).end()
  })

  app.use('/api/me', meRoutes(deps))
  app.use('/api/syndicates', syndicateRoutes(deps))
  app.use('/api/members', memberRoutes(deps))
  app.use('/api/beaters', beaterRoutes(deps))
  app.use('/api/shoots', shootRoutes(deps))
  app.use('/api/bags', bagRoutes(deps))
  app.use('/api/guests', guestRoutes(deps))
  app.use('/api/stripe', stripeRoutes(deps))
  app.use('/api/subscriptions', subscriptionRoutes(deps))

  // Unknown API paths get JSON, never the SPA's index.html.
  app.use('/api', (_req, res) => {
    res.status(404).json({ error: 'That could not be found. It may have been removed.' })
  })

  if (staticDir) {
    // Public pages prerendered at build time (scripts/prerender.mjs): path -> file.
    const prerendered = loadPrerenderManifest(staticDir)

    // The compiled server lives in dist/server, inside the static folder. Never serve it,
    // and don't expose the prerendered files under a second address.
    for (const hidden of ['/server', '/prerendered']) {
      app.use(hidden, (_req, res) => {
        res.status(404).end()
      })
    }

    // One address per page: /features/ -> /features (keeps the query string).
    app.use((req, res, next) => {
      if (req.method === 'GET' && req.path.length > 1 && req.path.endsWith('/')) {
        const query = req.originalUrl.slice(req.path.length)
        // Strip leading slashes too, so '//evil.example/' can never become an off-site redirect.
        const target = '/' + req.path.replace(/^\/+|\/+$/g, '')
        return res.redirect(301, target + query)
      }
      next()
    })

    // Hashed build assets can be cached for a year; everything else revalidates.
    app.use('/assets', express.static(path.join(staticDir, 'assets'), { immutable: true, maxAge: '1y', index: false }))
    app.use(express.static(staticDir, { index: false, maxAge: 0 }))
    app.get('*', (req, res) => {
      res.set('Cache-Control', 'no-cache')
      const copies = prerendered[req.path]
      res.sendFile(copies ? path.join(staticDir, 'prerendered', currentCopy(copies, today()).file) : path.join(staticDir, 'index.html'))
    })
  }

  app.use(errorHandler)
  return app
}
