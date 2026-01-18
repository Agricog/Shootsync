/**
 * Auth Hook - ShootSync
 * Wrapper around Clerk authentication
 */

import { useUser, useClerk, useAuth as useClerkAuth } from '@clerk/clerk-react'
import type { UserRole } from '../types/member'

interface AuthUser {
  id: string
  email: string
  name: string
  imageUrl?: string
  role: UserRole
  syndicateId?: string
}

interface UseAuthReturn {
  user: AuthUser | null
  isLoaded: boolean
  isSignedIn: boolean
  signOut: () => Promise<void>
}

export function useAuth(): UseAuthReturn {
  const { user, isLoaded, isSignedIn } = useUser()
  const { signOut: clerkSignOut } = useClerk()

  const authUser: AuthUser | null = user
    ? {
        id: user.id,
        email: user.primaryEmailAddress?.emailAddress || '',
        name: user.fullName || user.firstName || 'User',
        imageUrl: user.imageUrl,
        role: (user.publicMetadata?.role as UserRole) || 'gun',
        syndicateId: user.publicMetadata?.syndicateId as string | undefined,
      }
    : null

  const signOut = async () => {
    await clerkSignOut()
  }

  return {
    user: authUser,
    isLoaded,
    isSignedIn: isSignedIn ?? false,
    signOut,
  }
}

export function useAuthRole(): UserRole | null {
  const { user } = useAuth()
  return user?.role || null
}

export function useSyndicateId(): string | null {
  const { user } = useAuth()
  return user?.syndicateId || null
}

