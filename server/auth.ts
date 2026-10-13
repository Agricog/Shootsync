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
 */

import type { NextFunction, Request, RequestHandler, Response } from 'express'
import { verifyToken } from '@clerk/backend'

declare global {
  namespace Express {
    interface Request {
      auth?: { userId: string }
    }
  }
}

/** Resolves a session token to a Clerk user ID, or throws if the token is not valid. */
export type TokenVerifier = (token: string) => Promise<string>

export function createClerkVerifier(secretKey: string, authorizedParties: string[]): TokenVerifier {
  return async (token: string) => {
    const payload = await verifyToken(token, { secretKey, authorizedParties })
    if (!payload.sub) {
      throw new Error('Token has no subject')
    }
    return payload.sub
  }
}

const INVITE_TOKEN = '[a-f0-9]{64}'

/**
 * Routes reachable without signing in. Paths are relative to /api.
 * Each entry needs a reason. Adding one is a security decision.
 */
export const PUBLIC_ROUTES: ReadonlyArray<{ method: string; path: RegExp; reason: string }> = [
  { method: 'GET', path: /^\/health$/, reason: 'Uptime check' },
  { method: 'POST', path: /^\/stripe\/webhook$/, reason: 'Stripe webhook, verified by signature' },
  { method: 'POST', path: /^\/subscriptions\/webhook$/, reason: 'Stripe webhook, verified by signature' },
  { method: 'GET', path: new RegExp(`^/guests/token/${INVITE_TOKEN}$`), reason: 'Guest opens invite link' },
  { method: 'POST', path: new RegExp(`^/guests/token/${INVITE_TOKEN}/(accept|decline)$`), reason: 'Guest RSVP via invite link' },
  { method: 'POST', path: /^\/stripe\/create-checkout-session$/, reason: 'Guest day-fee payment, authorised by invite token in body' },
  { method: 'GET', path: /^\/stripe\/session\/cs_[A-Za-z0-9_]{10,200}$/, reason: 'Guest payment confirmation page' },
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
export function authGate(verify: TokenVerifier): RequestHandler {
  return async (req: Request, res: Response, next: NextFunction) => {
    if (isPublicRoute(req.method, req.path)) {
      return next()
    }

    const token = bearerToken(req)
    if (!token) {
      return res.status(401).json({ error: 'Sign in required' })
    }

    try {
      const userId = await verify(token)
      req.auth = { userId }
      return next()
    } catch {
      return res.status(401).json({ error: 'Sign in required' })
    }
  }
}
