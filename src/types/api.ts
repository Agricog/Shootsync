/**
 * API & Activity Log Types - ShootSync
 * Maps to SmartSuite Table 10 and API responses
 */

export type ActivityAction =
  | 'member_invited'
  | 'member_accepted'
  | 'member_removed'
  | 'payment_received'
  | 'shoot_created'
  | 'shoot_updated'
  | 'shoot_cancelled'
  | 'bag_recorded'
  | 'peg_allocated'
  | 'beater_added'
  | 'beater_paid'
  | 'guest_invited'
  | 'guest_paid'
  | 'settings_updated'

export type TargetType = 'member' | 'shoot' | 'payment' | 'beater' | 'guest' | 'syndicate'

export interface ActivityLog {
  id: string
  syndicateId: string
  action: ActivityAction
  actorMemberId: string
  actorName: string
  targetType: TargetType
  targetId: string
  details: string
  timestamp: string
  ipAddress?: string
}

export interface CreateActivityLogInput {
  action: ActivityAction
  targetType: TargetType
  targetId: string
  details: Record<string, unknown>
}

export interface ApiResponse<T> {
  success: boolean
  data?: T
  error?: ApiError
  meta?: ApiMeta
}

export interface ApiError {
  code: string
  message: string
  field?: string
  details?: Record<string, unknown>
}

export interface ApiMeta {
  page?: number
  limit?: number
  total?: number
  hasMore?: boolean
}

export interface PaginationParams {
  page?: number
  limit?: number
  sortBy?: string
  sortOrder?: 'asc' | 'desc'
}

export interface FilterParams {
  syndicateId: string
  status?: string
  dateFrom?: string
  dateTo?: string
  search?: string
}

export interface SmartSuiteRecord {
  id: string
  application_id: string
  created_at: string
  updated_at: string
  [key: string]: unknown
}

export interface SmartSuiteQueryOptions {
  filter?: Record<string, unknown>
  sort?: Array<{ field: string; direction: 'asc' | 'desc' }>
  limit?: number
  offset?: number
}

export interface ClerkUserMetadata {
  syndicateId?: string
  role?: 'captain' | 'gun' | 'beater' | 'guest'
  memberId?: string
}

export interface WebhookPayload {
  type: string
  data: Record<string, unknown>
  timestamp: string
  signature: string
}
