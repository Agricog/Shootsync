/**
 * The session clock - ShootSync (Build Standard, Layer 2)
 *
 * When the signed-in user will be signed out: 12 hours after signing in, or 10 minutes after
 * they last did anything, whichever comes first. The server enforces the same limits
 * (server/sessionPolicy.ts; a test keeps the numbers equal); this is the browser's side, so the
 * user is warned a minute before and the sign-out happens on screen, not on their next save.
 * Plain functions of time, so they are tested without a browser.
 */

export const SESSION_CLOCK = {
  absoluteMs: 12 * 60 * 60_000,
  idleMs: 10 * 60_000,
  warnBeforeMs: 60_000,
  /** How often, at most, a busy user is reported to the server as still there. */
  pingEveryMs: 2 * 60_000,
} as const

export type SessionEndReason = 'absolute' | 'idle'

/** The sentence shown on the sign-in page afterwards. Same words as the server's. */
export const SESSION_ENDED_TEXT: Record<SessionEndReason, string> = {
  absolute: 'For security, ShootSync signs you out 12 hours after you sign in. Sign in again to carry on.',
  idle: 'You were signed out after 10 minutes without using ShootSync. Sign in again to carry on.',
}

export interface SessionClockState {
  reason: SessionEndReason
  /** Milliseconds until sign-out (never below 0). */
  msLeft: number
  warn: boolean
  ended: boolean
}

export function sessionClock(now: number, signedInAt: number, lastActivityAt: number): SessionClockState {
  const absoluteEnd = signedInAt + SESSION_CLOCK.absoluteMs
  const idleEnd = lastActivityAt + SESSION_CLOCK.idleMs
  const reason: SessionEndReason = absoluteEnd <= idleEnd ? 'absolute' : 'idle'
  const msLeft = Math.max(0, Math.min(absoluteEnd, idleEnd) - now)
  return { reason, msLeft, warn: msLeft <= SESSION_CLOCK.warnBeforeMs, ended: msLeft === 0 }
}

/** Whether to tell the server the user is still there: they are active now, and it's been a while. */
export function shouldPing(now: number, lastPingAt: number): boolean {
  return now - lastPingAt >= SESSION_CLOCK.pingEveryMs
}

/** "0:45", "1:00". */
export function formatCountdown(ms: number): string {
  const seconds = Math.ceil(ms / 1000)
  return `${Math.floor(seconds / 60)}:${String(seconds % 60).padStart(2, '0')}`
}

/** Where the sign-in page reads why the user was signed out. */
export const SIGNED_OUT_PARAM = 'signed_out'

export function signedOutReason(value: string | null): SessionEndReason | null {
  return value === 'absolute' || value === 'idle' ? value : null
}
