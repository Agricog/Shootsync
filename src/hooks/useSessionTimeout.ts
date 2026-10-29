/**
 * Session timeout - ShootSync: 10 minutes idle, 12 hours absolute (server/sessionPolicy.ts says why)
 *
 * Mounted once for the whole app (SessionHygiene), so moving between pages never restarts the
 * clock. It measures from when the user signed in (Clerk's session), and from their last
 * keypress, tap, click or scroll in any ShootSync tab: the time is shared between tabs, so a tab
 * left in the background never signs them out while they're busy in another. A minute before
 * either limit it returns a warning to show; at the limit it signs the user out and sends them to
 * the sign-in page, which says why.
 *
 * The server enforces the same limits on every request (server/sessionPolicy.ts). While the user
 * is busy, the server is told so every couple of minutes, so a long form being filled in isn't
 * mistaken for an idle session. If the server ends the session first (a computer that slept,
 * say), its refusal signs the user out here too.
 */

import { useCallback, useEffect, useRef, useState } from 'react'
import { useAuth, useClerk, useSession } from '@clerk/clerk-react'
import { SESSION_ENDED_EVENT, apiRequest } from '../lib/api'
import { clearLocalAccountData } from '../lib/session'
import { LAST_ACTIVITY_KEY } from '../lib/storageKeys'
import { SESSION_CLOCK, SIGNED_OUT_PARAM, sessionClock, shouldPing, type SessionClockState, type SessionEndReason } from '../lib/sessionClock'

const ACTIVITY_EVENTS = ['keydown', 'pointerdown', 'touchstart', 'scroll', 'wheel'] as const
const TICK_MS = 1000
/** How often, at most, this tab shares its activity with the others. */
const SHARE_EVERY_MS = 5000

function sharedActivity(): number {
  try {
    const value = Number(localStorage.getItem(LAST_ACTIVITY_KEY))
    return Number.isFinite(value) ? value : 0
  } catch {
    return 0
  }
}

function shareActivity(at: number): void {
  try {
    localStorage.setItem(LAST_ACTIVITY_KEY, String(at))
  } catch {
    /* storage unavailable: each tab keeps its own clock */
  }
}

export interface SessionWarning {
  reason: SessionEndReason
  msLeft: number
}

export function useSessionTimeout(): { warning: SessionWarning | null; stayActive: () => void } {
  const { isSignedIn } = useAuth()
  const { session } = useSession()
  const clerk = useClerk()
  const [state, setState] = useState<SessionClockState | null>(null)
  // Clerk hands out a new session object each time it refreshes the token (about every minute):
  // the clock restarts only for a different session, never for a refresh of the same one.
  const sessionId = session?.id ?? null
  const createdAtMs = session?.createdAt instanceof Date ? session.createdAt.getTime() : null

  const lastActivity = useRef(Date.now())
  const lastShared = useRef(0)
  const lastPing = useRef(0)
  const signingOut = useRef(false)

  /** The latest activity in any tab. */
  const latestActivity = () => Math.max(lastActivity.current, sharedActivity())

  const signOut = useCallback((reason: SessionEndReason) => {
    if (signingOut.current) return
    signingOut.current = true
    const destination = `/login?${SIGNED_OUT_PARAM}=${reason}`
    clerk.signOut({ redirectUrl: destination }).catch(() => {
      // No signal, say: clear what this browser holds and leave the app anyway. The server
      // refuses the session whatever happens here.
      signingOut.current = false
      void clearLocalAccountData().finally(() => window.location.assign(destination))
    })
  }, [clerk])

  const noteActivity = useCallback(() => {
    const now = Date.now()
    // Back after the idle limit (a phone woken from the background): the first tap doesn't
    // count as having stayed; the session has already ended.
    if (now - latestActivity() >= SESSION_CLOCK.idleMs) {
      signOut('idle')
      return
    }
    lastActivity.current = now
    if (now - lastShared.current >= SHARE_EVERY_MS) {
      lastShared.current = now
      shareActivity(now)
    }
    if (shouldPing(now, lastPing.current)) {
      lastPing.current = now
      void apiRequest('/api/session/ping', { method: 'POST' })
    }
  }, [signOut])

  useEffect(() => {
    if (!isSignedIn || !sessionId) {
      setState(null)
      signingOut.current = false
      return
    }
    // Opening the app counts as activity; the absolute limit counts from when this session was
    // created, however many times the page has been reloaded.
    const signedInAt = createdAtMs ?? Date.now()
    const now = Date.now()
    lastActivity.current = now
    lastShared.current = now
    lastPing.current = now
    shareActivity(now)

    const tick = () => {
      const next = sessionClock(Date.now(), signedInAt, latestActivity())
      // Re-render only when there is something to show: the warning, its countdown, or its end.
      setState((previous) => (!next.warn && !previous?.warn ? previous ?? next : next))
      if (next.ended) signOut(next.reason)
    }
    tick()
    const timer = window.setInterval(tick, TICK_MS)

    const onActivity = () => noteActivity()
    // Capture, so scrolling inside a panel counts as well as scrolling the page.
    for (const event of ACTIVITY_EVENTS) window.addEventListener(event, onActivity, { passive: true, capture: true })

    const onServerEnded = (e: Event) => {
      const reason = (e as CustomEvent<{ reason?: SessionEndReason }>).detail?.reason
      signOut(reason === 'absolute' ? 'absolute' : 'idle')
    }
    window.addEventListener(SESSION_ENDED_EVENT, onServerEnded)

    return () => {
      window.clearInterval(timer)
      for (const event of ACTIVITY_EVENTS) window.removeEventListener(event, onActivity, { capture: true })
      window.removeEventListener(SESSION_ENDED_EVENT, onServerEnded)
    }
  }, [isSignedIn, sessionId, createdAtMs, noteActivity, signOut])

  const warning = state && state.warn && !state.ended ? { reason: state.reason, msLeft: state.msLeft } : null
  return { warning, stayActive: noteActivity }
}
