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
import { errorHandler } from './access.js'
import { rateLimit } from './rateLimit.js'
import { syndicateRoutes } from './routes/syndicates.js'
import { memberRoutes } from './routes/members.js'
import { beaterRoutes } from './routes/beaters.js'
import { shootRoutes } from './routes/shoots.js'
import { bagRoutes } from './routes/bags.js'
import { guestRoutes } from './routes/guests.js'
import { stripeRoutes } from './routes/stripe.js'
import { subscriptionRoutes } from './routes/subscriptions.js'
import { stripeWebhookHandler } from './routes/stripeWebhook.js'

export interface AppOptions extends Deps {
  verifyToken: TokenVerifier
  /** Built frontend to serve (production). Omitted in tests. */
  staticDir?: string
}

const WEBHOOK_PATHS = ['/api/stripe/webhook', '/api/subscriptions/webhook']

/** Reads dist/prerendered/manifest.json. A build without it serves the app shell for every page. */
function loadPrerenderManifest(staticDir: string): Record<string, string> {
  try {
    const raw = JSON.parse(readFileSync(path.join(staticDir, 'prerendered', 'manifest.json'), 'utf8'))
    const safe: Record<string, string> = {}
    for (const [route, file] of Object.entries(raw)) {
      if (typeof file === 'string' && /^[a-z0-9-]+\.html$/.test(file)) safe[route] = file
    }
    return safe
  } catch {
    console.warn('[boot] No prerendered pages found; public pages will be served as the app shell')
    return {}
  }
}

export function createApp(options: AppOptions) {
  const { verifyToken, staticDir, ...deps } = options
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

  app.get('/api/health', (_req, res) => {
    res.json({ status: 'ok', timestamp: new Date().toISOString() })
  })

  app.use('/api', authGate(verifyToken))

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
    res.status(404).json({ error: 'Not found' })
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
      const page = prerendered[req.path]
      res.sendFile(page ? path.join(staticDir, 'prerendered', page) : path.join(staticDir, 'index.html'))
    })
  }

  app.use(errorHandler)
  return app
}
