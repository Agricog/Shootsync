/**
 * Auth Hook - ShootSync
 * Wrapper around Clerk authentication
 */

import { useUser, useClerk } from '@clerk/clerk-react'

export type UserRole = 'captain' | 'gun' | 'beater' | 'guest'

interface UseAuthReturn {
  isLoaded: boolean
  isSignedIn: boolean
  userId: string | null
  email: string | null
  name: string | null
  imageUrl: string | null
  role: UserRole
  syndicateId: string | null
  user: {
    id: string
    email: string
    name: string
    imageUrl?: string
    role: UserRole
    syndicateId?: string
  } | null
  signOut: () => Promise<void>
}

export function useAuth(): UseAuthReturn {
  const { user, isLoaded, isSignedIn } = useUser()
  const { signOut: clerkSignOut } = useClerk()

  const role = (user?.publicMetadata?.role as UserRole) || 'gun'
  const syndicateId = (user?.publicMetadata?.syndicateId as string) || null

  const signOut = async () => {
    await clerkSignOut()
  }

  return {
    isLoaded,
    isSignedIn: isSignedIn ?? false,
    userId: user?.id || null,
    email: user?.primaryEmailAddress?.emailAddress || null,
    name: user?.fullName || user?.firstName || null,
    imageUrl: user?.imageUrl || null,
    role,
    syndicateId,
    user: user
      ? {
          id: user.id,
          email: user.primaryEmailAddress?.emailAddress || '',
          name: user.fullName || user.firstName || 'User',
          imageUrl: user.imageUrl,
          role,
          syndicateId: syndicateId || undefined,
        }
      : null,
    signOut,
  }
}

export function useAuthRole(): UserRole {
  const { role } = useAuth()
  return role
}

export function useSyndicateId(): string | null {
  const { syndicateId } = useAuth()
  return syndicateId
}

