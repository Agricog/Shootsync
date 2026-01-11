/**
 * Protected Route Component - ShootSync
 * Requires authentication to access
 */

import { type ReactNode } from 'react'
import { Navigate, useLocation } from 'react-router-dom'
import { useAuth } from '../../hooks/useAuth'
import { PageLoader } from '../common/LoadingSpinner'

interface ProtectedRouteProps {
  children: ReactNode
  redirectTo?: string
}

export default function ProtectedRoute({
  children,
  redirectTo = '/login',
}: ProtectedRouteProps) {
  const { isLoaded, isSignedIn } = useAuth()
  const location = useLocation()

  if (!isLoaded) {
    return <PageLoader />
  }

  if (!isSignedIn) {
    return (
      <Navigate
        to={redirectTo}
        state={{ from: location.pathname }}
        replace
      />
    )
  }

  return <>{children}</>
}

interface RequireSyndicateProps {
  children: ReactNode
  redirectTo?: string
}

export function RequireSyndicate({
  children,
  redirectTo = '/onboarding',
}: RequireSyndicateProps) {
  const { isLoaded, isSignedIn, syndicateId } = useAuth()
  const location = useLocation()

  if (!isLoaded) {
    return <PageLoader />
  }

  if (!isSignedIn) {
    return (
      <Navigate
        to="/login"
        state={{ from: location.pathname }}
        replace
      />
    )
  }

  if (!syndicateId) {
    return (
      <Navigate
        to={redirectTo}
        state={{ from: location.pathname }}
        replace
      />
    )
  }

  return <>{children}</>
}

interface PublicOnlyRouteProps {
  children: ReactNode
  redirectTo?: string
}

export function PublicOnlyRoute({
  children,
  redirectTo = '/dashboard',
}: PublicOnlyRouteProps) {
  const { isLoaded, isSignedIn } = useAuth()

  if (!isLoaded) {
    return <PageLoader />
  }

  if (isSignedIn) {
    return <Navigate to={redirectTo} replace />
  }

  return <>{children}</>
}
