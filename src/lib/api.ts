/**
 * Talking to the ShootSync API - one way, used by every page.
 *
 * Never throws. Every call comes back as either { ok: true, data } or { ok: false, error },
 * where `error` is a sentence the captain can act on: the server's own words when it gave
 * some ("Season end must be after season start"), otherwise a plain description of what
 * went wrong. The session token is added by src/lib/session.ts.
 */

export type Result<T> = { ok: true; data: T; status: number } | { ok: false; error: string; status: number }

/**
 * Sent on window when the server refuses a change because the plan isn't paid up (402):
 * the plan changed since the app last looked, so SyndicateProvider fetches it again and
 * every screen switches to read-only, instead of each one finding out on its next save.
 */
export const PLAN_CHANGED_EVENT = 'shootsync:plan-changed'

/**
 * Sent on window when the server has ended the session (401 with code 'session_ended': 15 minutes
 * from sign-in, or 10 minutes idle). The event's detail is the server's sentence; the session
 * timer signs the user out and shows it on the sign-in page.
 */
export const SESSION_ENDED_EVENT = 'shootsync:session-ended'

export const OFFLINE_MESSAGE = 'Could not reach ShootSync. Check your signal and try again: nothing was saved.'

/** The message to show for a failed response, from whatever JSON (or nothing) the server sent. */
export function errorMessageFrom(status: number, body: unknown): string {
  const data = body as { error?: unknown; details?: Array<{ message?: unknown }> } | null
  if (data && typeof data.error === 'string' && data.error.trim()) return data.error
  const detail = data?.details?.[0]?.message
  if (typeof detail === 'string' && detail.trim()) return detail
  if (status === 401) return 'Your session has ended. Sign in again to carry on.'
  if (status === 404) return 'That could not be found. It may have been removed.'
  if (status === 429) return 'Too many requests in a short time. Wait a minute and try again.'
  if (status >= 500) return 'ShootSync had a problem saving that. Try again in a moment.'
  return `Something went wrong (${status}). Try again.`
}

export interface RequestOptions {
  method?: 'GET' | 'POST' | 'PATCH' | 'PUT' | 'DELETE'
  body?: unknown
  signal?: AbortSignal
}

export async function apiRequest<T>(path: string, options: RequestOptions = {}): Promise<Result<T>> {
  const { method = 'GET', body, signal } = options
  let response: Response
  try {
    response = await fetch(path, {
      method,
      signal,
      headers: body === undefined ? undefined : { 'Content-Type': 'application/json' },
      body: body === undefined ? undefined : JSON.stringify(body),
    })
  } catch (err) {
    if (err instanceof DOMException && err.name === 'AbortError') return { ok: false, error: 'Cancelled.', status: 0 }
    return { ok: false, error: OFFLINE_MESSAGE, status: 0 }
  }

  const text = await response.text().catch(() => '')
  let json: unknown = null
  if (text) {
    try {
      json = JSON.parse(text)
    } catch {
      json = null
    }
  }

  // Read through globalThis: this file is also loaded by the server-side tests, which have no window.
  const target = (globalThis as { window?: EventTarget }).window
  if (response.status === 402) target?.dispatchEvent(new Event(PLAN_CHANGED_EVENT))
  const ended = json as { code?: unknown; reason?: unknown } | null
  if (response.status === 401 && ended?.code === 'session_ended') {
    target?.dispatchEvent(new CustomEvent(SESSION_ENDED_EVENT, { detail: { reason: ended.reason === 'absolute' ? 'absolute' : 'idle' } }))
  }
  if (!response.ok) return { ok: false, error: errorMessageFrom(response.status, json), status: response.status }
  return { ok: true, data: json as T, status: response.status }
}

/** Builds "/api/x?a=1&b=2", leaving out empty values and encoding the rest. */
export function apiPath(path: string, query: Record<string, string | number | boolean | null | undefined> = {}): string {
  const params = new URLSearchParams()
  for (const [key, value] of Object.entries(query)) {
    if (value !== undefined && value !== null && value !== '') params.set(key, String(value))
  }
  const qs = params.toString()
  return qs ? `${path}?${qs}` : path
}
