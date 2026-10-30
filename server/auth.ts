/**
 * Authentication gate - ShootSync
 *
 * Every /api request needs a valid Clerk session token in the Authorization
 * header, except the short list of public routes below. The list is the only
 * way to make a route public, so a new route is protected by default
 * (fail closed). The signed-in user's ID comes from the verified token and
 * never from the request body or query string (Standard §07.4).
 *
 * Header-only (no cookie auth) keeps state-changing routes immune to CSRF.
 *
 * Every signed-in request also passes the session limits (server/sessionPolicy.ts): 12 hours
 * from sign-in, 10 minutes idle. A refusal is 401 with `code: 'session_ended'` and a sentence,
 * and the browser signs the user out with that sentence.
 */

import type { NextFunction, Request, RequestHandler, Response } from 'express'
import { verifyToken } from '@clerk/backend'
import type { PrismaClient } from '@prisma/client'
import type { Alerts } from './alerts.js'
import { SESSION_ENDED_MESSAGES, absoluteLimitReached, touchSession, type SessionEndReason, type VerifiedSession } from './sessionPolicy.js'

declare global {
  namespace Express {
    interface Request {
      auth?: { userId: string }
    }
  }
}

/** Resolves a session token to the user, their session and its age, or throws if the token is not valid. */
export type TokenVerifier = (token: string) => Promise<VerifiedSession>

/**
 * The parts of a verified Clerk token the app relies on. The user and session are required: a
 * token without a session (a server-to-server token, say) is refused, never waved through. How
 * long ago the user signed in is read when the token says (fva[0] whole minutes before it was
 * issued, plus the token's own age); when it doesn't, the server's own record of the session's
 * start still enforces the absolute limit (server/sessionPolicy.ts).
 */
/** A token this server refuses: carries a reason like Clerk's own refusals, so it is never mistaken for an outage. */
export function refusal(message: string): Error {
  return Object.assign(new Error(message), { reason: 'token-invalid' })
}

export function sessionFromClaims(
  payload: { sub?: unknown; sid?: unknown; fva?: unknown; iat?: unknown },
  nowSeconds: number = Math.floor(Date.now() / 1000),
): VerifiedSession {
  if (typeof payload.sub !== 'string' || !payload.sub) throw refusal('Token has no subject')
  if (typeof payload.sid !== 'string' || !payload.sid) throw refusal('Token has no session')
  const fva = Array.isArray(payload.fva) ? payload.fva[0] : undefined
  const issued = typeof payload.iat === 'number' && Number.isFinite(payload.iat) ? payload.iat : null
  const secondsSinceSignIn =
    typeof fva === 'number' && Number.isFinite(fva) && fva >= 0 && issued !== null
      ? fva * 60 + Math.max(0, nowSeconds - issued)
      : null
  return { userId: payload.sub, sessionId: payload.sid, secondsSinceSignIn }
}

export function createClerkVerifier(secretKey: string, authorizedParties: string[]): TokenVerifier {
  return async (token: string) => sessionFromClaims(await verifyToken(token, { secretKey, authorizedParties }))
}

const INVITE_TOKEN = '[a-f0-9]{64}'

/**
 * Routes reachable without signing in. Paths are relative to /api.
 * Each entry needs a reason. Adding one is a security decision.
 */
export const PUBLIC_ROUTES: ReadonlyArray<{ method: string; path: RegExp; reason: string }> = [
  { method: 'GET', path: /^\/health$/, reason: 'Uptime check' },
  { method: 'POST', path: /^\/csp-report$/, reason: 'Browsers report what the content security policy would block; nothing is read back' },
  { method: 'POST', path: /^\/stripe\/webhook$/, reason: 'Stripe webhook, verified by signature' },
  { method: 'POST', path: /^\/subscriptions\/webhook$/, reason: 'Stripe webhook, verified by signature' },
  { method: 'GET', path: new RegExp(`^/guests/token/${INVITE_TOKEN}$`), reason: 'Guest opens invite link' },
  { method: 'POST', path: new RegExp(`^/guests/token/${INVITE_TOKEN}/(accept|decline)$`), reason: 'Guest RSVP via invite link' },
]

export function isPublicRoute(method: string, path: string): boolean {
  return PUBLIC_ROUTES.some((route) => route.method === method && route.path.test(path))
}

function bearerToken(req: Request): string | null {
  const header = req.headers.authorization
  if (!header) return null
  const match = /^Bearer\s+([A-Za-z0-9._-]+)$/.exec(header.trim())
  return match ? match[1] : null
}

/**
 * Mount at /api. Public routes pass straight through; everything else must
 * carry a valid token, and the verified user ID is attached as req.auth.
 */
function sessionEnded(res: Response, reason: SessionEndReason) {
  return res.status(401).json({ error: SESSION_ENDED_MESSAGES[reason], code: 'session_ended', reason })
}

/**
 * Clerk could not be asked: its signing keys failed to load (a Clerk outage or a network fault),
 * as opposed to a token Clerk would refuse. The user hasn't done anything wrong, so they are told
 * to try again in a moment rather than being signed out.
 */
/**
 * Every refusal of a token is a Clerk TokenVerificationError with a string `reason` (and
 * sessionFromClaims gives its own refusals one). Anything else is the road to Clerk failing:
 * fetch failed, DNS, a timeout, an outage page where its keys should be. A key-loading reason
 * is the same thing said by Clerk.
 */
const CLERK_UNREACHABLE = new Set(['jwk-remote-failed-to-load', 'jwk-failed-to-resolve'])
export function clerkUnreachable(err: unknown): boolean {
  const reason = (err as { reason?: unknown } | null)?.reason
  if (typeof reason === 'string') return CLERK_UNREACHABLE.has(reason)
  return true
}

/** One report a minute while Clerk is down, not one per request. */
const REPORT_EVERY_MS = 60_000

export function authGate(verify: TokenVerifier, prisma: PrismaClient, alerts?: Alerts): RequestHandler {
  let lastOutageReport = 0
  return async (req: Request, res: Response, next: NextFunction) => {
    if (isPublicRoute(req.method, req.path)) {
      return next()
    }

    const token = bearerToken(req)
    if (!token) {
      return res.status(401).json({ error: 'Sign in required' })
    }

    let session: VerifiedSession
    try {
      session = await verify(token)
    } catch (err) {
      if (clerkUnreachable(err)) {
        if (Date.now() - lastOutageReport >= REPORT_EVERY_MS) {
          lastOutageReport = Date.now()
          alerts?.report(err, 'auth: sign-in service unreachable')
        }
        return res.status(503).json({ error: 'ShootSync couldn’t check your sign-in just now. Try again in a moment.' })
      }
      return res.status(401).json({ error: 'Sign in required' })
    }
    if (absoluteLimitReached(session)) return sessionEnded(res, 'absolute')
    try {
      const ended = await touchSession(prisma, session.sessionId)
      if (ended) return sessionEnded(res, ended)
    } catch (err) {
      // The database is down: nothing past this point could work either, and nothing is let through unchecked.
      alerts?.report(err, 'auth: session activity check')
      return res.status(503).json({ error: 'ShootSync had a problem checking your session. Try again in a moment.' })
    }
    req.auth = { userId: session.userId }
    return next()
  }
}
