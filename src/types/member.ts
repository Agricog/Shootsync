/**
 * Member & Beater Types - ShootSync
 * Maps to SmartSuite Tables 2, 3, and 11
 */

export type MemberRole = 'captain' | 'gun' | 'beater' | 'hybrid'
export type MemberStatus = 'active' | 'inactive' | 'pending'
export type SubscriptionStatus = 'paid' | 'unpaid' | 'overdue'
export type BeaterStatus = 'active' | 'inactive' | 'pending_stripe'
export type BookingStatus = 'invited' | 'confirmed' | 'declined' | 'no_show'
export type PaymentStatus = 'pending' | 'paid'

export interface Member {
  id: string
  syndicateId: string
  clerkUserId: string
  email: string
  name: string
  phone: string
  role: MemberRole
  bascNumber?: string
  insuranceExpiry?: string
  insuranceDocumentKey?: string
  emergencyContactName: string
  emergencyContactPhone: string
  subscriptionStatus: SubscriptionStatus
  subscriptionPaidDate?: string
  invitedAt: string
  acceptedAt?: string
  status: MemberStatus
  notes?: string
}

export interface CreateMemberInput {
  email: string
  name: string
  phone?: string
  role: MemberRole
  emergencyContactName?: string
  emergencyContactPhone?: string
}

export interface UpdateMemberInput {
  name?: string
  phone?: string
  role?: MemberRole
  bascNumber?: string
  insuranceExpiry?: string
  insuranceDocumentKey?: string
  emergencyContactName?: string
  emergencyContactPhone?: string
  subscriptionStatus?: SubscriptionStatus
  subscriptionPaidDate?: string
  status?: MemberStatus
  notes?: string
}

export interface Beater {
  id: string
  syndicateId: string
  name: string
  email: string
  phone: string
  dayRate: number
  stripeConnectId?: string
  stripeOnboardingComplete: boolean
  totalDaysWorked: number
  totalOwed: number
  totalPaid: number
  status: BeaterStatus
  notes?: string
}

export interface CreateBeaterInput {
  name: string
  email: string
  phone: string
  dayRate: number
}

export interface UpdateBeaterInput {
  name?: string
  email?: string
  phone?: string
  dayRate?: number
  stripeConnectId?: string
  stripeOnboardingComplete?: boolean
  status?: BeaterStatus
  notes?: string
}

export interface BeaterBooking {
  id: string
  syndicateId: string
  beaterId: string
  shootId: string
  dayRate: number
  status: BookingStatus
  invitedAt: string
  confirmedAt?: string
  checkedIn: boolean
  checkedInAt?: string
  paymentStatus: PaymentStatus
  paymentId?: string
  notes?: string
}

export interface CreateBeaterBookingInput {
  beaterId: string
  shootId: string
  dayRate: number
}

export interface UpdateBeaterBookingInput {
  status?: BookingStatus
  confirmedAt?: string
  checkedIn?: boolean
  checkedInAt?: string
  paymentStatus?: PaymentStatus
  paymentId?: string
  notes?: string
}
