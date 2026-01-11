/**
 * Session Timeout Hook - ShootSync
 * Enforces session security with idle timeout
 */

import { useEffect, useRef, useCallback } from 'react'
import { useAuth } from './useAuth'

const SESSION_TIMEOUT = 30 * 60 * 1000 // 30 minutes absolute
const IDLE_TIMEOUT = 15 * 60 * 1000 // 15 minutes idle
const WARNING_BEFORE = 2 * 60 * 1000 // Warning 2 minutes before

interface UseSessionTimeoutOptions {
  onTimeout?: () => void
  onWarning?: (secondsRemaining: number) => void
  enabled?: boolean
}

export function useSessionTimeout(options: UseSessionTimeoutOptions = {}) {
  const { signOut, isSignedIn } = useAuth()
  const { onTimeout, onWarning, enabled = true } = options

  const sessionTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const idleTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const warningTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const lastActivityRef = useRef<number>(Date.now())

  const handleTimeout = useCallback(async () => {
    if (onTimeout) {
      onTimeout()
    }
    await signOut()
  }, [onTimeout, signOut])

  const clearAllTimeouts = useCallback(() => {
    if (sessionTimeoutRef.current) {
      clearTimeout(sessionTimeoutRef.current)
      sessionTimeoutRef.current = null
    }
    if (idleTimeoutRef.current) {
      clearTimeout(idleTimeoutRef.current)
      idleTimeoutRef.current = null
    }
    if (warningTimeoutRef.current) {
      clearTimeout(warningTimeoutRef.current)
      warningTimeoutRef.current = null
    }
  }, [])

  const resetIdleTimeout = useCallback(() => {
    lastActivityRef.current = Date.now()

    if (idleTimeoutRef.current) {
      clearTimeout(idleTimeoutRef.current)
    }
    if (warningTimeoutRef.current) {
      clearTimeout(warningTimeoutRef.current)
    }

    if (onWarning) {
      warningTimeoutRef.current = setTimeout(() => {
        const secondsRemaining = Math.ceil(WARNING_BEFORE / 1000)
        onWarning(secondsRemaining)
      }, IDLE_TIMEOUT - WARNING_BEFORE)
    }

    idleTimeoutRef.current = setTimeout(() => {
      handleTimeout()
    }, IDLE_TIMEOUT)
  }, [handleTimeout, onWarning])

  useEffect(() => {
    if (!enabled || !isSignedIn) {
      clearAllTimeouts()
      return
    }

    sessionTimeoutRef.current = setTimeout(() => {
      handleTimeout()
    }, SESSION_TIMEOUT)

    resetIdleTimeout()

    const activityEvents = ['mousedown', 'keydown', 'scroll', 'touchstart', 'mousemove']
    
    const handleActivity = () => {
      resetIdleTimeout()
    }

    activityEvents.forEach((event) => {
      window.addEventListener(event, handleActivity, { passive: true })
    })

    return () => {
      clearAllTimeouts()
      activityEvents.forEach((event) => {
        window.removeEventListener(event, handleActivity)
      })
    }
  }, [enabled, isSignedIn, handleTimeout, resetIdleTimeout, clearAllTimeouts])

  return {
    resetIdleTimeout,
    lastActivity: lastActivityRef.current,
  }
}

export function useIdleWarning() {
  const warningShownRef = useRef(false)

  const showWarning = useCallback((secondsRemaining: number) => {
    if (warningShownRef.current) return
    warningShownRef.current = true
    console.warn(`[ShootSync] Session will expire in ${secondsRemaining} seconds due to inactivity`)
  }, [])

  const resetWarning = useCallback(() => {
    warningShownRef.current = false
  }, [])

  return { showWarning, resetWarning }
}
