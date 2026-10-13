/**
 * Shoot day form: shape and checks, shared by the shoot day editor and its tests.
 * The server checks everything again; these checks are for the captain.
 */

export interface ShootDraft {
  date: string
  locationName: string
  locationAddress: string
  locationPostcode: string
  locationWhat3Words: string
  meetTime: string
  drivesPlanned: string
  expectedBag: string
  captainNotes: string
}

export interface ShootFields {
  date: string
  locationName: string
  locationAddress?: string | null
  locationPostcode?: string | null
  locationWhat3Words?: string | null
  meetTime: string
  drivesPlanned: number
  expectedBag?: number | null
  captainNotes?: string | null
}

export const shootDraftFrom = (s: ShootFields): ShootDraft => ({
  date: s.date.slice(0, 10),
  locationName: s.locationName,
  locationAddress: s.locationAddress ?? '',
  locationPostcode: s.locationPostcode ?? '',
  locationWhat3Words: s.locationWhat3Words ?? '',
  meetTime: s.meetTime,
  drivesPlanned: String(s.drivesPlanned),
  expectedBag: s.expectedBag == null ? '' : String(s.expectedBag),
  captainNotes: s.captainNotes ?? '',
})

export const MEET_TIME = /^([01]\d|2[0-3]):[0-5]\d$/

/** "///filled.count.soap" or "filled.count.soap" -> "filled.count.soap"; null if not three words. */
export function normaliseWhat3Words(input: string): string | null {
  const words = input.trim().replace(/^\/{3}/, '').toLowerCase()
  return /^\p{L}+\.\p{L}+\.\p{L}+$/u.test(words) ? words : null
}

export function validateShoot(d: ShootDraft): Partial<Record<keyof ShootDraft, string>> {
  const problems: Partial<Record<keyof ShootDraft, string>> = {}
  if (!/^\d{4}-\d{2}-\d{2}$/.test(d.date) || Number.isNaN(Date.parse(d.date))) problems.date = 'Choose the date.'
  if (!d.locationName.trim()) problems.locationName = 'Where is the shoot?'
  if (d.locationName.trim().length > 100) problems.locationName = 'Keep it to 100 characters.'
  if (d.locationPostcode.trim().length > 12) problems.locationPostcode = 'That postcode is too long.'
  if (d.locationWhat3Words.trim() && !normaliseWhat3Words(d.locationWhat3Words)) problems.locationWhat3Words = 'Three words with dots, like filled.count.soap.'
  if (!MEET_TIME.test(d.meetTime)) problems.meetTime = 'A time like 08:30.'
  if (!/^\d+$/.test(d.drivesPlanned) || Number(d.drivesPlanned) < 1 || Number(d.drivesPlanned) > 50) problems.drivesPlanned = 'Between 1 and 50.'
  if (d.expectedBag.trim() && (!/^\d+$/.test(d.expectedBag.trim()) || Number(d.expectedBag) > 100_000)) problems.expectedBag = 'A whole number, or leave blank.'
  return problems
}

/** What to send. Blank optional fields are cleared. */
export function shootPayload(d: ShootDraft) {
  return {
    date: d.date,
    locationName: d.locationName.trim(),
    locationAddress: d.locationAddress.trim() || null,
    locationPostcode: d.locationPostcode.trim().toUpperCase() || null,
    locationWhat3Words: d.locationWhat3Words.trim() ? normaliseWhat3Words(d.locationWhat3Words) : null,
    meetTime: d.meetTime,
    drivesPlanned: Number(d.drivesPlanned),
    expectedBag: d.expectedBag.trim() ? Number(d.expectedBag) : null,
    captainNotes: d.captainNotes.trim() || null,
  }
}
