/**
 * Server configuration - ShootSync
 *
 * Every secret is read once, at boot, and validated. A missing value stops the
 * server from starting rather than running with a blank key (Standard §03 Layer 3:
 * no fallback secrets, fail fast on boot).
 */

import { parseBankKey, type BankKeys } from './bankCrypto.js'

export interface AppConfig {
  isProduction: boolean
  frontendUrl: string
  /** Origins allowed to hold a ShootSync session (Clerk `azp` claim) and to call the API cross-origin. */
  allowedOrigins: string[]
  clerkSecretKey: string
  stripeSecretKey: string
  stripeWebhookSecret: string
  stripePriceIds: {
    STARTER: string
    STANDARD: string
  }
  /** Sentry DSN for the server. Required in production: a product nobody is told about breaking is not a product. */
  sentryDsn: string | null
  /** What Sentry calls this deployment: Railway's commit SHA, or 'local'. */
  release: string
  /**
   * The keys bank details are sealed with (server/bankCrypto.ts). Required in production. Without
   * one (a local run), bank details can't be saved, rather than being saved readable.
   */
  bankKeys: BankKeys | null
}

const REQUIRED = [
  'DATABASE_URL',
  'CLERK_SECRET_KEY',
  'STRIPE_SECRET_KEY',
  'STRIPE_WEBHOOK_SECRET',
  'STRIPE_PRICE_STARTER',
  'STRIPE_PRICE_STANDARD',
] as const

/** The public address of the site. Not a secret, so a default is safe. */
const DEFAULT_FRONTEND_URL = 'https://shootsync.co.uk'

export class ConfigError extends Error {
  constructor(public readonly missing: string[], detail?: string) {
    super(detail ?? `Missing required environment variables: ${missing.join(', ')}`)
    this.name = 'ConfigError'
  }
}

function originOf(url: string): string {
  return new URL(url).origin
}

export function loadConfig(env: Record<string, string | undefined> = process.env): AppConfig {
  const isProduction = env.NODE_ENV === 'production'
  const required = isProduction ? [...REQUIRED, 'SENTRY_DSN', 'BANK_DETAILS_KEY'] : [...REQUIRED]
  const missing = required.filter((key) => !env[key] || env[key]!.trim() === '')
  if (missing.length > 0) {
    throw new ConfigError([...missing])
  }

  const frontendUrl = originOf(env.FRONTEND_URL?.trim() || DEFAULT_FRONTEND_URL)

  let bankKeys: BankKeys | null = null
  try {
    const current = parseBankKey(env.BANK_DETAILS_KEY)
    const previous = parseBankKey(env.BANK_DETAILS_KEY_PREVIOUS)
    if (previous && !current) throw new Error('BANK_DETAILS_KEY_PREVIOUS is set but BANK_DETAILS_KEY is not.')
    bankKeys = current ? { current, previous } : null
  } catch (err) {
    throw new ConfigError(['BANK_DETAILS_KEY'], (err as Error).message)
  }

  const extraOrigins = (env.ALLOWED_ORIGINS ?? '')
    .split(',')
    .map((value) => value.trim())
    .filter(Boolean)
    .map(originOf)

  const allowedOrigins = [...new Set([frontendUrl, ...extraOrigins])]

  return {
    isProduction,
    frontendUrl,
    allowedOrigins,
    clerkSecretKey: env.CLERK_SECRET_KEY!.trim(),
    stripeSecretKey: env.STRIPE_SECRET_KEY!.trim(),
    stripeWebhookSecret: env.STRIPE_WEBHOOK_SECRET!.trim(),
    stripePriceIds: {
      STARTER: env.STRIPE_PRICE_STARTER!.trim(),
      STANDARD: env.STRIPE_PRICE_STANDARD!.trim(),
    },
    sentryDsn: env.SENTRY_DSN?.trim() || null,
    release: env.RAILWAY_GIT_COMMIT_SHA?.trim() || 'local',
    bankKeys,
  }
}
