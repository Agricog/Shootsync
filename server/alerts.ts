/**
 * Alerts and error reports - ShootSync
 *
 * Anything a human must act on (money that needs refunding, two subscriptions billing, a
 * dispute, a price that doesn't match the website) is an alert: it goes to the log and to
 * Sentry, which emails the owner. A route that fails unexpectedly is an error report, with a
 * reference the user sees and can quote. Routes get this through Deps, so tests record alerts
 * instead of sending them, and nothing in a test ever reaches Sentry.
 *
 * Personal data never goes in: an alert names IDs (a syndicate, a guest, a Stripe object),
 * never a name, email, bank detail or address.
 */

import * as Sentry from '@sentry/node'

export type AlertKind =
  | 'money'        // a payment to refund, collect or reconcile by hand
  | 'billing'      // a subscription in a state that needs a decision
  | 'dispute'      // a card dispute (chargeback) opened
  | 'config'       // the deployment disagrees with Stripe or the website
  | 'webhook'      // a Stripe event could not be processed

export interface Alerts {
  /** Something a human must act on. `details` holds IDs and amounts only. */
  alert(kind: AlertKind, message: string, details?: Record<string, string | number | null | undefined>): void
  /** An unexpected error. Returns the reference shown to the user. */
  report(err: unknown, context: string, details?: Record<string, string | number | null | undefined>): string
}

/**
 * What leaves for Sentry. The request is dropped whole (its URL can carry a guest's invite
 * token, which is a credential), the user too, and the event is named by the route pattern the
 * error was noted with (server/access.ts handle), never by the URL.
 */
export function scrubServerEvent<T extends { request?: unknown; user?: unknown; transaction?: string }>(
  event: T,
  hint?: { originalException?: unknown; data?: unknown },
): T {
  delete event.request
  delete event.user
  const noted = (hint?.data as { route?: unknown } | null | undefined)?.route
  const onError = (hint?.originalException as { route?: unknown } | null | undefined)?.route
  const route = typeof noted === 'string' ? noted : onError
  if (typeof route === 'string') event.transaction = route
  else delete event.transaction
  return event
}

/** Console lines are not attached: their arguments are whatever was logged, which Sentry needn't hold. */
export function keepBreadcrumb<T extends { category?: string }>(crumb: T): T | null {
  return crumb.category === 'console' ? null : crumb
}

/**
 * The error as it may be reported. A Prisma validation error's message embeds the whole
 * `data` argument (names, emails, phones), so only its name and stack are kept.
 */
export function reportable(err: unknown): unknown {
  if (err instanceof Error && err.name === 'PrismaClientValidationError') {
    const safe = new Error('PrismaClientValidationError (message withheld: it would hold the record)')
    safe.name = err.name
    safe.stack = err.stack?.split('\n').filter((line) => /^\s+at /.test(line)).join('\n')
    return safe
  }
  return err
}

const describe = (err: unknown) => {
  const e = reportable(err)
  return e instanceof Error ? `${e.name}: ${e.message}` : String(e)
}

/** "SS-7K3M9Q": short, readable, unique enough to match an email to a report. */
export function errorReference(): string {
  const alphabet = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'
  const bytes = new Uint8Array(6)
  crypto.getRandomValues(bytes)
  return 'SS-' + Array.from(bytes, (b) => alphabet[b % alphabet.length]).join('')
}

/** Alerts that go to the log and to Sentry. Sentry must already be initialised (server/index.ts). */
export function sentryAlerts(): Alerts {
  return {
    alert(kind, message, details = {}) {
      console.error(`[alert:${kind}] ${message}`, details)
      Sentry.withScope((scope) => {
        scope.setTag('alert', kind)
        scope.setLevel('error')
        scope.setContext('details', details)
        Sentry.captureMessage(`[${kind}] ${message}`)
      })
    },
    report(err, context, details = {}) {
      const reference = errorReference()
      console.error(`[error ${reference}] ${context}:`, describe(err), details)
      Sentry.withScope((scope) => {
        scope.setTag('reference', reference)
        scope.setTag('context', context)
        scope.setContext('details', details)
        Sentry.captureException(reportable(err), { data: { route: context } })
      })
      return reference
    },
  }
}

/** Alerts that only log: for tests (which also record them) and local runs with no Sentry. */
export function consoleAlerts(
  sink?: Array<{ kind: AlertKind; message: string; details: Record<string, unknown> }>,
  reports?: Array<{ reference: string; context: string; details: Record<string, unknown>; error: unknown }>,
): Alerts {
  return {
    alert(kind, message, details = {}) {
      sink?.push({ kind, message, details })
      console.error(`[alert:${kind}] ${message}`, details)
    },
    report(err, context, details = {}) {
      const reference = errorReference()
      reports?.push({ reference, context, details, error: err })
      console.error(`[error ${reference}] ${context}:`, describe(err), details)
      return reference
    },
  }
}
