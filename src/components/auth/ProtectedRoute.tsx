/**
 * Protected Route Component - ShootSync
 * Guards routes requiring authentication
 */

import { useAuth } from '@clerk/clerk-react'
import { Navigate, useLocation } from 'react-router-dom'
import { PageLoader } from '../common/LoadingSpinner'
import { safeReturnPath, signInPath } from '../../lib/returnTo'

interface ProtectedRouteProps {
  children: React.ReactNode
}

export default function ProtectedRoute({ children }: ProtectedRouteProps) {
  const { isLoaded, isSignedIn } = useAuth()
  const location = useLocation()

  if (!isLoaded) {
    return <PageLoader />
  }

  if (!isSignedIn) {
    // Remember where they were going, so signing in takes them there and not to the dashboard.
    return <Navigate to={signInPath(`${location.pathname}${location.search}`)} replace />
  }

  return <>{children}</>
}

interface PublicOnlyRouteProps {
  children: React.ReactNode
}

export function PublicOnlyRoute({ children }: PublicOnlyRouteProps) {
  const { isLoaded, isSignedIn } = useAuth()
  const location = useLocation()

  if (!isLoaded) {
    return <PageLoader />
  }

  if (isSignedIn) {
    // Already signed in (or just signed in): on to the page they came for.
    return <Navigate to={safeReturnPath(new URLSearchParams(location.search).get('next'))} replace />
  }

  return <>{children}</>
}
