/**
 * Session Hygiene - ShootSync
 *
 * Mounted once for the whole app. It:
 *   - clears this browser's copy of account data whenever the user signs out, however they sign
 *     out (the account menu, a session timeout, or another tab);
 *   - runs the session clock (src/hooks/useSessionTimeout.ts), and shows the warning a minute
 *     before the user is signed out.
 */

import { useEffect, useRef } from 'react'
import { useAuth } from '@clerk/clerk-react'
import { clearLocalAccountData } from '../../lib/session'
import { formatCountdown } from '../../lib/sessionClock'
import { useSessionTimeout } from '../../hooks/useSessionTimeout'

export default function SessionHygiene() {
  const { isLoaded, isSignedIn } = useAuth()
  const wasSignedIn = useRef<boolean | null>(null)
  const { warning, stayActive } = useSessionTimeout()

  useEffect(() => {
    if (!isLoaded) return
    if (wasSignedIn.current === true && !isSignedIn) {
      void clearLocalAccountData()
    }
    wasSignedIn.current = Boolean(isSignedIn)
  }, [isLoaded, isSignedIn])

  if (!warning) return null
  const left = formatCountdown(warning.msLeft)
  return (
    <div className="fixed inset-x-0 bottom-0 z-50 px-4 pb-4 pointer-events-none">
      <div
        role="alert"
        className="pointer-events-auto max-w-xl mx-auto rounded-lg border border-amber-500/40 bg-slate-800 shadow-xl p-4 flex flex-col sm:flex-row sm:items-center gap-3"
      >
        <p className="text-amber-100 text-sm flex-1">
          {warning.reason === 'idle'
            ? `You’ll be signed out in ${left} because nothing has happened for a while.`
            : `For security you’ll be signed out in ${left}, 15 minutes after signing in. Save anything you’re working on now.`}
        </p>
        {warning.reason === 'idle' && (
          <button
            type="button"
            onClick={stayActive}
            className="shrink-0 rounded-lg bg-green-600 hover:bg-green-700 text-white text-sm font-medium px-4 py-2"
          >
            Stay signed in
          </button>
        )}
      </div>
    </div>
  )
}
