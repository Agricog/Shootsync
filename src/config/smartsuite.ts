/**
 * SmartSuite Configuration - ShootSync
 * API configuration and table mappings
 */

export const SMARTSUITE_CONFIG = {
  apiKey: import.meta.env.VITE_SMARTSUITE_API_KEY || '',
  workspaceId: import.meta.env.VITE_SMARTSUITE_WORKSPACE_ID || '',
  baseUrl: 'https://app.smartsuite.com/api/v1',
} as const

export const SMARTSUITE_TABLES = {
  syndicates: 'syndicates',
  members: 'members',
  beaters: 'beaters',
  shootDays: 'shoot_days',
  shootAttendance: 'shoot_attendance',
  guestGuns: 'guest_guns',
  bagRecords: 'bag_records',
  beaterPayments: 'beater_payments',
  memberPayments: 'member_payments',
  activityLog: 'activity_log',
  beaterBookings: 'beater_bookings',
} as const

export type SmartSuiteTable = keyof typeof SMARTSUITE_TABLES

export const FIELD_MAPPINGS: Record<SmartSuiteTable, Record<string, string>> = {
  syndicates: {
    id: 'syndicate_id',
    name: 'name',
    captainClerkId: 'captain_clerk_id',
    seasonStart: 'season_start',
    seasonEnd: 'season_end',
    subscriptionAmount: 'subscription_amount',
    subscriptionType: 'subscription_type',
    defaultBeaterRate: 'default_beater_rate',
    pegRotationRule: 'peg_rotation_rule',
    createdAt: 'created_at',
    status: 'status',
  },
  members: {
    id: 'member_id',
    syndicateId: 'syndicate_id',
    clerkUserId: 'clerk_user_id',
    email: 'email',
    name: 'name',
    phone: 'phone',
    role: 'role',
    status: 'status',
  },
  beaters: {
    id: 'beater_id',
    syndicateId: 'syndicate_id',
    name: 'name',
    email: 'email',
    phone: 'phone',
    dayRate: 'day_rate',
    status: 'status',
  },
  shootDays: {
    id: 'shoot_id',
    syndicateId: 'syndicate_id',
    date: 'date',
    locationName: 'location_name',
    meetTime: 'meet_time',
    status: 'status',
  },
  shootAttendance: {
    id: 'attendance_id',
    shootId: 'shoot_id',
    memberId: 'member_id',
    roleOnDay: 'role_on_day',
    pegNumber: 'peg_number',
  },
  guestGuns: {
    id: 'guest_id',
    shootId: 'shoot_id',
    invitedByMemberId: 'invited_by_member_id',
    name: 'name',
    email: 'email',
  },
  bagRecords: {
    id: 'bag_id',
    shootId: 'shoot_id',
    driveNumber: 'drive_number',
    pheasant: 'pheasant',
    partridge: 'partridge',
  },
  beaterPayments: {
    id: 'payment_id',
    syndicateId: 'syndicate_id',
    beaterId: 'beater_id',
    amount: 'amount',
    status: 'status',
  },
  memberPayments: {
    id: 'payment_id',
    syndicateId: 'syndicate_id',
    memberId: 'member_id',
    amount: 'amount',
    status: 'status',
  },
  activityLog: {
    id: 'log_id',
    syndicateId: 'syndicate_id',
    action: 'action',
    timestamp: 'timestamp',
  },
  beaterBookings: {
    id: 'booking_id',
    syndicateId: 'syndicate_id',
    beaterId: 'beater_id',
    shootId: 'shoot_id',
    status: 'status',
  },
}

export const buildApiUrl = (table: SmartSuiteTable): string => {
  return `${SMARTSUITE_CONFIG.baseUrl}/applications/${SMARTSUITE_CONFIG.workspaceId}/records/${SMARTSUITE_TABLES[table]}`
}
