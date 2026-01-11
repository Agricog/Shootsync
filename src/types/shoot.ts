/**
 * Shoot Day Types - ShootSync
 * Maps to SmartSuite Tables 4, 5, and 6
 */

export type ShootStatus = 'scheduled' | 'completed' | 'cancelled'
export type AttendanceRole = 'gun' | 'beater' | 'guest'
export type GuestPaymentStatus = 'pending' | 'paid' | 'refunded'
export type RSVPStatus = 'pending' | 'confirmed' | 'declined'

export interface ShootDay {
  id: string
  syndicateId: string
  date: string
  locationName: string
  locationAddress?: string
  locationPostcode?: string
  locationWhat3Words?: string
  meetTime: string
  drivesPlanned: number
  expectedBag: number
  status: ShootStatus
  weatherNotes?: string
  captainNotes?: string
  briefingGenerated: boolean
  createdAt: string
}

export interface CreateShootDayInput {
  date: string
  locationName: string
  locationAddress?: string
  locationPostcode?: string
  locationWhat3Words?: string
  meetTime: string
  drivesPlanned: number
  expectedBag: number
  weatherNotes?: string
  captainNotes?: string
}

export interface UpdateShootDayInput {
  date?: string
  locationName?: string
  locationAddress?: string
  locationPostcode?: string
  locationWhat3Words?: string
  meetTime?: string
  drivesPlanned?: number
  expectedBag?: number
  status?: ShootStatus
  weatherNotes?: string
  captainNotes?: string
  briefingGenerated?: boolean
}

export interface ShootAttendance {
  id: string
  shootId: string
  memberId: string
  roleOnDay: AttendanceRole
  pegNumber?: number
  confirmed: boolean
  attended: boolean
  checkedInAt?: string
  notes?: string
}

export interface CreateAttendanceInput {
  shootId: string
  memberId: string
  roleOnDay: AttendanceRole
}

export interface UpdateAttendanceInput {
  roleOnDay?: AttendanceRole
  pegNumber?: number
  confirmed?: boolean
  attended?: boolean
  checkedInAt?: string
  notes?: string
}

export interface GuestGun {
  id: string
  shootId: string
  invitedByMemberId: string
  name: string
  email: string
  phone: string
  emergencyContactName: string
  emergencyContactPhone: string
  pegNumber?: number
  dayFee: number
  paymentStatus: GuestPaymentStatus
  stripePaymentId?: string
  waiverAccepted: boolean
  waiverAcceptedAt?: string
  rsvpStatus: RSVPStatus
  notes?: string
}

export interface CreateGuestGunInput {
  shootId: string
  invitedByMemberId: string
  name: string
  email: string
  phone?: string
  dayFee: number
}

export interface UpdateGuestGunInput {
  name?: string
  email?: string
  phone?: string
  emergencyContactName?: string
  emergencyContactPhone?: string
  pegNumber?: number
  paymentStatus?: GuestPaymentStatus
  stripePaymentId?: string
  waiverAccepted?: boolean
  waiverAcceptedAt?: string
  rsvpStatus?: RSVPStatus
  notes?: string
}

export interface PegAllocation {
  memberId: string
  memberName: string
  pegNumber: number
  isGuest: boolean
  guestId?: string
}

export interface PegHistory {
  memberId: string
  pegNumber: number
  shootDate: string
  shootId: string
}
