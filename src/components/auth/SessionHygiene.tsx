/**
 * Session Hygiene - ShootSync
 * Clears this browser's copy of account data whenever the user signs out,
 * however they sign out (UserButton menu, idle timeout, or another tab).
 */

import { useEffect, useRef } from 'react'
import { useAuth } from '@clerk/clerk-react'
import { clearLocalAccountData } from '../../lib/session'

export default function SessionHygiene() {
  const { isLoaded, isSignedIn } = useAuth()
  const wasSignedIn = useRef<boolean | null>(null)

  useEffect(() => {
    if (!isLoaded) return
    if (wasSignedIn.current === true && !isSignedIn) {
      void clearLocalAccountData()
    }
    wasSignedIn.current = Boolean(isSignedIn)
  }, [isLoaded, isSignedIn])

  return null
}
