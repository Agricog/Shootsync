/**
 * Auth Hook - ShootSync
 * Who is signed in, and signing out (which also clears this browser's copy of their data).
 * Roles are not here: a user's role belongs to each syndicate, and comes from GET /api/me
 * (src/context/SyndicateContext.tsx), which the server enforces on every request.
 */

import { useUser, useClerk } from '@clerk/clerk-react'
import { clearLocalAccountData } from '../lib/session'

interface UseAuthReturn {
  isLoaded: boolean
  isSignedIn: boolean
  userId: string | null
  email: string | null
  name: string | null
  imageUrl: string | null
  user: {
    id: string
    email: string
    name: string
    imageUrl?: string
  } | null
  signOut: () => Promise<void>
}

export function useAuth(): UseAuthReturn {
  const { user, isLoaded, isSignedIn } = useUser()
  const { signOut: clerkSignOut } = useClerk()

  const signOut = async () => {
    // Clear this browser's copy of the account before the session ends (Standard §03 Layer 5).
    await clearLocalAccountData()
    await clerkSignOut()
  }

  return {
    isLoaded,
    isSignedIn: isSignedIn ?? false,
    userId: user?.id || null,
    email: user?.primaryEmailAddress?.emailAddress || null,
    name: user?.fullName || user?.firstName || null,
    imageUrl: user?.imageUrl || null,
    user: user
      ? {
          id: user.id,
          email: user.primaryEmailAddress?.emailAddress || '',
          name: user.fullName || user.firstName || 'User',
          imageUrl: user.imageUrl,
        }
      : null,
    signOut,
  }
}
