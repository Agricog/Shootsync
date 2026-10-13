/**
 * Rate limiting - ShootSync
 *
 * A fixed-window limit per client IP, held in memory. Correct for a single
 * Railway instance. If the service is ever scaled to several instances, move
 * this to Upstash (Standard §03 Layer 6) so the count is shared.
 */

import type { NextFunction, Request, RequestHandler, Response } from 'express'

export interface RateLimitOptions {
  windowMs: number
  max: number
  /** Only requests this returns true for are counted and limited. */
  applies?: (req: Request) => boolean
  now?: () => number
}

export function rateLimit({ windowMs, max, applies = () => true, now = Date.now }: RateLimitOptions): RequestHandler {
  const hits = new Map<string, { count: number; resetAt: number }>()
  let lastSweep = now()

  return (req: Request, res: Response, next: NextFunction) => {
    if (!applies(req)) return next()

    const time = now()
    if (time - lastSweep > windowMs) {
      for (const [key, entry] of hits) if (entry.resetAt <= time) hits.delete(key)
      lastSweep = time
    }

    const key = req.ip ?? 'unknown'
    const entry = hits.get(key)
    if (!entry || entry.resetAt <= time) {
      hits.set(key, { count: 1, resetAt: time + windowMs })
      return next()
    }

    entry.count += 1
    if (entry.count > max) {
      res.set('Retry-After', String(Math.ceil((entry.resetAt - time) / 1000)))
      return res.status(429).json({ error: 'Too many requests. Please wait a moment and try again.' })
    }
    return next()
  }
}
