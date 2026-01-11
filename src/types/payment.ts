/**
 * Payment Types - ShootSync
 * Maps to SmartSuite Tables 8 and 9
 */

export type BeaterPaymentStatus = 'owed' | 'paid'
export type MemberPaymentStatus = 'pending' | 'paid' | 'overdue'
export type MemberPaymentType = 'subscription' | 'guest_fee' | 'other'
export type PaymentMethod = 'bank_transfer' | 'stripe' | 'cash'

export interface BeaterPayment {
  id: string
  syndicateId: string
  beaterId: string
  shootId: string
  amount: number
  status: BeaterPaymentStatus
  paidDate?: string
  paymentReference?: string
  stripeTransferId?: string
  notes?: string
}

export interface CreateBeaterPaymentInput {
  beaterId: string
  shootId: string
  amount: number
}

export interface UpdateBeaterPaymentInput {
  status?: BeaterPaymentStatus
  paidDate?: string
  paymentReference?: string
  stripeTransferId?: string
  notes?: string
}

export interface MemberPayment {
  id: string
  syndicateId: string
  memberId: string
  amount: number
  paymentType: MemberPaymentType
  status: MemberPaymentStatus
  dueDate: string
  paidDate?: string
  paymentMethod?: PaymentMethod
  stripePaymentId?: string
  notes?: string
}

export interface CreateMemberPaymentInput {
  memberId: string
  amount: number
  paymentType: MemberPaymentType
  dueDate: string
}

export interface UpdateMemberPaymentInput {
  amount?: number
  paymentType?: MemberPaymentType
  status?: MemberPaymentStatus
  dueDate?: string
  paidDate?: string
  paymentMethod?: PaymentMethod
  stripePaymentId?: string
  notes?: string
}

export interface PaymentSummary {
  syndicateId: string
  totalSubscriptionsOwed: number
  totalSubscriptionsPaid: number
  totalGuestFeesOwed: number
  totalGuestFeesPaid: number
  totalBeaterPaymentsOwed: number
  totalBeaterPaymentsPaid: number
  overdueCount: number
}

export interface BeaterPayoutRequest {
  beaterId: string
  beaterName: string
  stripeConnectId: string
  amount: number
  shootIds: string[]
  shootDates: string[]
}

export interface BeaterPayoutResult {
  success: boolean
  transferId?: string
  error?: string
  beaterId: string
  amount: number
}

export interface PaymentExportRow {
  date: string
  type: string
  recipient: string
  amount: number
  status: string
  reference: string
}
