/**
 * Authentication Hook - ShootSync
 * Wrapper for Clerk with ShootSync-specific logic
 */

import { useState, useEffect, useCallback } from 'react'
import type { ClerkUserPublicMetadata, UserRole } from '../config/clerk'

interface AuthState {
  isLoaded: boolean
  isSignedIn: boolean
  userId: string | null
  email: string | null
  name: string | null
  role: UserRole | null
  syndicateId: string | null
  memberId: string | null
}

interface UseAuthReturn extends AuthState {
  signOut: () => Promise<void>
  refreshUser: () => Promise<void>
}

// Placeholder until Clerk is integrated
const MOCK_AUTH: AuthState = {
  isLoaded: true,
  isSignedIn: false,
  userId: null,
  email: null,
  name: null,
  role: null,
  syndicateId: null,
  memberId: null,
}

export function useAuth(): UseAuthReturn {
  const [authState, setAuthState] = useState<AuthState>({
    isLoaded: false,
    isSignedIn: false,
    userId: null,
    email: null,
    name: null,
    role: null,
    syndicateId: null,
    memberId: null,
  })

  useEffect(() => {
    // TODO: Replace with actual Clerk integration
    // const { isLoaded, isSignedIn, user } = useUser()
    
    // Simulate auth loading
    const timer = setTimeout(() => {
      setAuthState(MOCK_AUTH)
    }, 100)

    return () => clearTimeout(timer)
  }, [])

  const signOut = useCallback(async (): Promise<void> => {
    // TODO: Replace with Clerk signOut
    setAuthState({
      ...MOCK_AUTH,
      isLoaded: true,
    })
  }, [])

  const refreshUser = useCallback(async (): Promise<void> => {
    // TODO: Replace with Clerk user refresh
    console.log('[useAuth] Refreshing user data')
  }, [])

  return {
    ...authState,
    signOut,
    refreshUser,
  }
}

export function parseUserMetadata(
  metadata: Record<string, unknown> | undefined
): ClerkUserPublicMetadata {
  if (!metadata) {
    return {}
  }

  return {
    syndicateId: typeof metadata.syndicateId === 'string' ? metadata.syndicateId : undefined,
    role: isValidRole(metadata.role) ? metadata.role : undefined,
    memberId: typeof metadata.memberId === 'string' ? metadata.memberId : undefined,
    onboardingComplete: typeof metadata.onboardingComplete === 'boolean' ? metadata.onboardingComplete : undefined,
  }
}

function isValidRole(role: unknown): role is UserRole {
  return role === 'captain' || role === 'gun' || role === 'beater' || role === 'guest'
}
