/**
 * Role Guard Component - ShootSync
 * Enforces role-based access control
 */

import { type ReactNode } from 'react'
import { Navigate } from 'react-router-dom'
import { useRole } from '../../hooks/useRole'
import { useAuth } from '../../hooks/useAuth'
import { type UserRole } from '../../config/clerk'
import { PageLoader } from '../common/LoadingSpinner'

interface RoleGuardProps {
  children: ReactNode
  allowedRoles: UserRole[]
  redirectTo?: string
  fallback?: ReactNode
}

export default function RoleGuard({
  children,
  allowedRoles,
  redirectTo = '/dashboard',
  fallback,
}: RoleGuardProps) {
  const { isLoaded } = useAuth()
  const { role } = useRole()

  if (!isLoaded) {
    return <PageLoader />
  }

  if (!role || !allowedRoles.includes(role)) {
    if (fallback) {
      return <>{fallback}</>
    }
    return <Navigate to={redirectTo} replace />
  }

  return <>{children}</>
}

interface CaptainOnlyProps {
  children: ReactNode
  fallback?: ReactNode
}

export function CaptainOnly({ children, fallback }: CaptainOnlyProps) {
  return (
    <RoleGuard allowedRoles={['captain']} fallback={fallback}>
      {children}
    </RoleGuard>
  )
}

interface GunOrAboveProps {
  children: ReactNode
  fallback?: ReactNode
}

export function GunOrAbove({ children, fallback }: GunOrAboveProps) {
  return (
    <RoleGuard allowedRoles={['captain', 'gun']} fallback={fallback}>
      {children}
    </RoleGuard>
  )
}

interface HideFromGuestsProps {
  children: ReactNode
}

export function HideFromGuests({ children }: HideFromGuestsProps) {
  const { role } = useRole()

  if (role === 'guest') {
    return null
  }

  return <>{children}</>
}

interface ShowForRolesProps {
  children: ReactNode
  roles: UserRole[]
}

export function ShowForRoles({ children, roles }: ShowForRolesProps) {
  const { role } = useRole()

  if (!role || !roles.includes(role)) {
    return null
  }

  return <>{children}</>
}

interface AccessDeniedProps {
  title?: string
  message?: string
}

export function AccessDenied({
  title = 'Access Denied',
  message = "You don't have permission to view this page.",
}: AccessDeniedProps) {
  return (
    <div className="min-h-[400px] flex items-center justify-center p-8">
      <div className="max-w-md w-full text-center">
        <div className="w-16 h-16 mx-auto mb-4 bg-amber-500/10 rounded-full flex items-center justify-center">
          <svg
            className="w-8 h-8 text-amber-500"
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
            aria-hidden="true"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M12 15v2m0 0v2m0-2h2m-2 0H9m3-10V5a3 3 0 00-3-3H6a3 3 0 00-3 3v4a3 3 0 003 3h2m8-4v4a3 3 0 01-3 3h-2m0 0V9a3 3 0 00-3-3H6"
            />
          </svg>
        </div>

        <h2 className="text-xl font-semibold text-white mb-2">{title}</h2>
        <p className="text-slate-400">{message}</p>
      </div>
    </div>
  )
}
