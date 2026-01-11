/**
 * Clerk Configuration - ShootSync
 * Authentication setup
 */

export const CLERK_CONFIG = {
  publishableKey: import.meta.env.VITE_CLERK_PUBLISHABLE_KEY || '',
  
  appearance: {
    variables: {
      colorPrimary: '#16a34a',
      colorBackground: '#0f172a',
      colorText: '#f8fafc',
      colorInputBackground: '#1e293b',
      colorInputText: '#f8fafc',
      borderRadius: '0.5rem',
    },
    elements: {
      formButtonPrimary: 'bg-green-600 hover:bg-green-700',
      card: 'bg-slate-800 border-slate-700',
      headerTitle: 'text-white',
      headerSubtitle: 'text-slate-400',
      socialButtonsBlockButton: 'bg-slate-700 hover:bg-slate-600 border-slate-600',
      formFieldLabel: 'text-slate-300',
      formFieldInput: 'bg-slate-700 border-slate-600 text-white',
      footerActionLink: 'text-green-500 hover:text-green-400',
    }
  },

  signInUrl: '/login',
  signUpUrl: '/signup',
  afterSignInUrl: '/dashboard',
  afterSignUpUrl: '/onboarding',
} as const

export type UserRole = 'captain' | 'gun' | 'beater' | 'guest'

export interface ClerkUserPublicMetadata {
  syndicateId?: string
  role?: UserRole
  memberId?: string
  onboardingComplete?: boolean
}

export const ROLE_HIERARCHY: Record<UserRole, number> = {
  captain: 4,
  gun: 3,
  beater: 2,
  guest: 1,
}

export const hasPermission = (
  userRole: UserRole | undefined,
  requiredRole: UserRole
): boolean => {
  if (!userRole) return false
  return ROLE_HIERARCHY[userRole] >= ROLE_HIERARCHY[requiredRole]
}

export const canManageSyndicate = (role: UserRole | undefined): boolean => {
  return role === 'captain'
}

export const canInviteGuests = (role: UserRole | undefined): boolean => {
  return role === 'captain' || role === 'gun'
}

export const canRecordBags = (role: UserRole | undefined): boolean => {
  return role === 'captain' || role === 'gun'
}
