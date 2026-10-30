/**
 * Where to go after signing in - ShootSync
 *
 * A captain sent to the sign-in page from somewhere (a bookmark to a shoot day, a page they
 * were on when the session ended) goes back there afterwards, not to the dashboard. The place
 * travels as a path in the sign-in page's address (`?next=/shoots/abc`) or in the router's
 * state, and is only ever a path inside this app: never another site, never a scheme, and not
 * the sign-in or sign-up pages themselves (which would loop).
 */

export const RETURN_TO_PARAM = 'next'
export const DEFAULT_AFTER_SIGN_IN = '/dashboard'

/** The path, if it is safe to go to; otherwise the dashboard. */
export function safeReturnPath(value: unknown): string {
  if (typeof value !== 'string') return DEFAULT_AFTER_SIGN_IN
  // One leading slash, then not another slash or backslash (either would make a "//host" address).
  if (!/^\/(?![/\\])/.test(value)) return DEFAULT_AFTER_SIGN_IN
  if (/[\u0000-\u001f\s]/.test(value)) return DEFAULT_AFTER_SIGN_IN
  const path = value.split(/[?#]/)[0]
  if (path === '/' || path === '/login' || path.startsWith('/login/') || path === '/signup' || path.startsWith('/signup/')) return DEFAULT_AFTER_SIGN_IN
  return value
}

/** The sign-in page's address, remembering where to return to. */
export function signInPath(returnTo: string | null, extra: Record<string, string> = {}): string {
  const params = new URLSearchParams(extra)
  const safe = returnTo ? safeReturnPath(returnTo) : DEFAULT_AFTER_SIGN_IN
  if (safe !== DEFAULT_AFTER_SIGN_IN) params.set(RETURN_TO_PARAM, safe)
  const query = params.toString()
  return query ? `/login?${query}` : '/login'
}
