/**
 * Role-Based Access Hook - ShootSync
 * Enforces RBAC throughout the application
 */

import { useMemo } from 'react'
import { useAuth } from './useAuth'
import { 
  type UserRole, 
  ROLE_HIERARCHY, 
  hasPermission,
  canManageSyndicate,
  canInviteGuests,
  canRecordBags 
} from '../config/clerk'

interface UseRoleReturn {
  role: UserRole | null
  isCaptain: boolean
  isGun: boolean
  isBeater: boolean
  isGuest: boolean
  hasRole: (requiredRole: UserRole) => boolean
  canManageSyndicate: boolean
  canInviteGuests: boolean
  canRecordBags: boolean
  canViewAllMembers: boolean
  canManageBeaters: boolean
  canCreateShoots: boolean
  canAllocatePegs: boolean
  canExportData: boolean
  canViewFinances: boolean
}

export function useRole(): UseRoleReturn {
  const { role } = useAuth()

  return useMemo(() => {
    const isCaptain = role === 'captain'
    const isGun = role === 'gun'
    const isBeater = role === 'beater'
    const isGuest = role === 'guest'

    return {
      role,
      isCaptain,
      isGun,
      isBeater,
      isGuest,
      
      hasRole: (requiredRole: UserRole) => hasPermission(role ?? undefined, requiredRole),
      
      canManageSyndicate: canManageSyndicate(role ?? undefined),
      canInviteGuests: canInviteGuests(role ?? undefined),
      canRecordBags: canRecordBags(role ?? undefined),
      
      canViewAllMembers: isCaptain,
      canManageBeaters: isCaptain,
      canCreateShoots: isCaptain,
      canAllocatePegs: isCaptain,
      canExportData: isCaptain,
      canViewFinances: isCaptain,
    }
  }, [role])
}

export function getRoleDisplayName(role: UserRole): string {
  const names: Record<UserRole, string> = {
    captain: 'Captain',
    gun: 'Gun',
    beater: 'Beater',
    guest: 'Guest',
  }
  return names[role]
}

export function getRoleDescription(role: UserRole): string {
  const descriptions: Record<UserRole, string> = {
    captain: 'Full access to manage syndicate, members, shoots, and finances',
    gun: 'View shoots, record bags, invite guests, and manage own profile',
    beater: 'View bookings, confirm attendance, and track earnings',
    guest: 'View invited shoot details and complete payment/waiver',
  }
  return descriptions[role]
}

export function compareRoles(roleA: UserRole, roleB: UserRole): number {
  return ROLE_HIERARCHY[roleA] - ROLE_HIERARCHY[roleB]
}
