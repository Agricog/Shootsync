/**
 * Error reporting in the browser - ShootSync
 *
 * Every unexpected error gets a short reference the captain can quote. The report goes to the
 * browser console and, when VITE_SENTRY_DSN is set, to Sentry with the same reference, so a
 * quoted reference finds the report. Nothing personal goes with it: no user, cookies, headers,
 * request bodies or query strings, and the page URL is cut to its path (server/index.ts does the
 * same for the server).
 *
 * Sentry's code is loaded after the app, so it never slows the first paint; anything captured
 * before it arrives is kept and sent then.
 */

type SentryModule = typeof import('@sentry/react')

let sentry: SentryModule | null = null
const pending: Array<{ error: unknown; context: string; reference: string }> = []

/** A short, readable reference: "SS-7K3M9Q". Unique enough to match an email to a report. */
export function errorReference(): string {
  const alphabet = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'
  let out = 'SS-'
  const bytes = new Uint8Array(6)
  try {
    crypto.getRandomValues(bytes)
  } catch {
    for (let i = 0; i < bytes.length; i++) bytes[i] = Math.floor(Math.random() * 256)
  }
  for (const b of bytes) out += alphabet[b % alphabet.length]
  return out
}

/** Strips anything personal an event might carry, whatever attached it. */
export function scrubEvent<T extends { request?: { url?: string; headers?: unknown; cookies?: unknown; data?: unknown; query_string?: unknown }; user?: unknown; transaction?: string }>(event: T): T {
  if (event.request) {
    delete event.request.headers
    delete event.request.cookies
    delete event.request.data
    delete event.request.query_string
    if (event.request.url) event.request.url = pathOnly(event.request.url)
  }
  delete event.user
  if (typeof event.transaction === 'string') event.transaction = pathOnly(event.transaction)
  return event
}

/**
 * "/shoots/abc?x=1#y" → "/shoots/abc": a path can name a record, never a person. A guest's
 * invite token (64 hex characters) is a credential, so it is masked wherever a path carries it.
 */
export function pathOnly(url: string): string {
  try {
    return new URL(url, 'https://shootsync.co.uk').pathname.replace(/[a-f0-9]{64}/g, ':token')
  } catch {
    return '/'
  }
}

function send(S: SentryModule, error: unknown, context: string, reference: string): void {
  S.withScope((scope) => {
    scope.setTag('reference', reference)
    scope.setTag('context', context)
    S.captureException(error instanceof Error ? error : new Error(String(error)))
  })
}

/** Starts reporting to Sentry when a DSN is configured. Safe to call once, before render. */
export function installErrorReporting(dsn: string | undefined, release: string | undefined, production: boolean): void {
  if (!dsn) return
  void import('@sentry/react')
    .then((S) => {
      S.init({
        dsn,
        release: release || undefined,
        environment: production ? 'production' : 'development',
        tracesSampleRate: 0,
        dataCollection: { userInfo: false, cookies: false, httpHeaders: false, httpBodies: [], urlQueryParams: false, stackFrameVariables: false },
        // No click trail (a clicked field's label can name a person) and no console lines;
        // page moves and requests stay, with their paths cut as above.
        integrations: [S.breadcrumbsIntegration({ dom: false })],
        beforeSend: (event) => scrubEvent(event),
        // A breadcrumb's URL could carry a query string; keep the path only.
        beforeBreadcrumb: (crumb) => {
          if (crumb.category === 'console') return null
          if (crumb.data && typeof crumb.data.url === 'string') crumb.data.url = pathOnly(crumb.data.url)
          if (crumb.data && typeof crumb.data.to === 'string') crumb.data.to = pathOnly(crumb.data.to)
          if (crumb.data && typeof crumb.data.from === 'string') crumb.data.from = pathOnly(crumb.data.from)
          return crumb
        },
      })
      sentry = S
      for (const item of pending.splice(0)) send(S, item.error, item.context, item.reference)
    })
    .catch(() => {
      /* no signal, or blocked: the console still has every report */
    })
}

/** Records an unexpected error and returns its reference. Never throws. */
export function captureError(error: unknown, context: string): string {
  const reference = errorReference()
  try {
    const message = error instanceof Error ? error.message : String(error)
    const stack = error instanceof Error ? error.stack : undefined
    console.error(`[ShootSync ${reference}] ${context}: ${message}`, stack ?? '')
    if (sentry) send(sentry, error, context, reference)
    else if (pending.length < 20) pending.push({ error, context, reference })
  } catch {
    /* the console itself failed: nothing more to do */
  }
  return reference
}
