/**
 * Protected Route Component - ShootSync
 * Guards routes requiring authentication
 */

import { useAuth } from '@clerk/clerk-react'
import { Navigate, useLocation } from 'react-router-dom'
import { PageLoader } from '../common/LoadingSpinner'

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
    return <Navigate to="/login" state={{ from: location.pathname }} replace />
  }

  return <>{children}</>
}

interface PublicOnlyRouteProps {
  children: React.ReactNode
}

export function PublicOnlyRoute({ children }: PublicOnlyRouteProps) {
  const { isLoaded, isSignedIn } = useAuth()

  if (!isLoaded) {
    return <PageLoader />
  }

  if (isSignedIn) {
    return <Navigate to="/dashboard" replace />
  }

  return <>{children}</>
}
