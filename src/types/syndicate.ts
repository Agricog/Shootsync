/**
 * Syndicate Types - ShootSync
 * Maps to SmartSuite Table 1: Syndicates
 */

export type SubscriptionType = 'annual' | 'per_shoot' | 'hybrid'
export type PegRotationRule = 'fair_rotation' | 'random' | 'manual'
export type SyndicateStatus = 'active' | 'archived'

export interface Syndicate {
  id: string
  name: string
  captainClerkId: string
  seasonStart: string
  seasonEnd: string
  subscriptionAmount: number
  subscriptionType: SubscriptionType
  defaultBeaterRate: number
  pegRotationRule: PegRotationRule
  createdAt: string
  status: SyndicateStatus
}

export interface CreateSyndicateInput {
  name: string
  seasonStart: string
  seasonEnd: string
  subscriptionAmount: number
  subscriptionType: SubscriptionType
  defaultBeaterRate: number
  pegRotationRule: PegRotationRule
}

export interface UpdateSyndicateInput {
  name?: string
  seasonStart?: string
  seasonEnd?: string
  subscriptionAmount?: number
  subscriptionType?: SubscriptionType
  defaultBeaterRate?: number
  pegRotationRule?: PegRotationRule
  status?: SyndicateStatus
}

export interface SyndicateSettings {
  syndicateId: string
  waiverText: string
  guestDayFee: number
  notificationsEnabled: boolean
  reminderDaysBefore: number
}
