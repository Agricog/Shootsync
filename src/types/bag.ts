/**
 * Bag Recording Types - ShootSync
 * Maps to SmartSuite Table 7: Bag Records
 */

export interface BagRecord {
  id: string
  shootId: string
  driveNumber: number
  pheasant: number
  partridge: number
  duck: number
  woodcock: number
  other: number
  otherDescription?: string
  recordedByMemberId: string
  recordedAt: string
  notes?: string
}

export interface CreateBagRecordInput {
  shootId: string
  driveNumber: number
  pheasant?: number
  partridge?: number
  duck?: number
  woodcock?: number
  other?: number
  otherDescription?: string
  notes?: string
}

export interface UpdateBagRecordInput {
  driveNumber?: number
  pheasant?: number
  partridge?: number
  duck?: number
  woodcock?: number
  other?: number
  otherDescription?: string
  notes?: string
}

export interface BagSummary {
  shootId: string
  shootDate: string
  locationName: string
  totalPheasant: number
  totalPartridge: number
  totalDuck: number
  totalWoodcock: number
  totalOther: number
  grandTotal: number
  driveCount: number
}

export interface SeasonBagTotals {
  syndicateId: string
  seasonStart: string
  seasonEnd: string
  totalPheasant: number
  totalPartridge: number
  totalDuck: number
  totalWoodcock: number
  totalOther: number
  grandTotal: number
  shootCount: number
  averagePerShoot: number
}

export interface DriveBreakdown {
  driveNumber: number
  pheasant: number
  partridge: number
  duck: number
  woodcock: number
  other: number
  total: number
}

export interface VoiceInputResult {
  transcript: string
  parsed: {
    pheasant?: number
    partridge?: number
    duck?: number
    woodcock?: number
    other?: number
  }
  confidence: number
}
