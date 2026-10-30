/**
 * Guest edit form: shape, checks and what is sent. Shared by the shoot day page's guest editor
 * (src/components/guests/GuestEditor.tsx) and its tests. The server checks everything again.
 */

import { parsePounds } from './beaterPayCalculator.js'

export interface EditableGuest {
  id: string
  name: string
  email: string
  phone?: string | null
  dayFee: number
  paymentStatus: string
  waiverAccepted: boolean
  emergencyContactName?: string | null
  emergencyContactPhone?: string | null
  notes?: string | null
}

export interface GuestDraft {
  name: string
  email: string
  phone: string
  dayFee: string
  emergencyContactName: string
  emergencyContactPhone: string
  notes: string
}

/** The most a day fee can be, in pence: £1,000 (server/routes/guests.ts). */
const MAX_DAY_FEE_PENCE = 100_000

export const draftFromGuest = (g: EditableGuest): GuestDraft => ({
  name: g.name,
  email: g.email,
  phone: g.phone ?? '',
  dayFee: g.dayFee % 100 === 0 ? String(g.dayFee / 100) : (g.dayFee / 100).toFixed(2),
  emergencyContactName: g.emergencyContactName ?? '',
  emergencyContactPhone: g.emergencyContactPhone ?? '',
  notes: g.notes ?? '',
})

/** Problems by field, or none. */
export function validateGuestDraft(draft: GuestDraft): Partial<Record<keyof GuestDraft, string>> {
  const problems: Partial<Record<keyof GuestDraft, string>> = {}
  if (!draft.name.trim()) problems.name = 'Enter the guest’s name.'
  if (draft.name.trim().length > 100) problems.name = 'Keep the name to 100 characters.'
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(draft.email.trim())) problems.email = 'Enter a valid email address.'
  const fee = parsePounds(draft.dayFee)
  if (fee === null || fee > MAX_DAY_FEE_PENCE) problems.dayFee = 'Enter the day fee in pounds, from £0 to £1,000. 0 if they shoot free.'
  if (Boolean(draft.emergencyContactName.trim()) !== Boolean(draft.emergencyContactPhone.trim())) {
    problems.emergencyContactPhone = 'Give both the emergency contact’s name and their phone number, or neither.'
  }
  if (draft.notes.length > 2000) problems.notes = 'Keep the note to 2,000 characters.'
  return problems
}

/** What to send: only what changed. */
export function guestPayload(draft: GuestDraft, guest: EditableGuest): Record<string, unknown> {
  const before = draftFromGuest(guest)
  const changed: Record<string, unknown> = {}
  if (draft.name.trim() !== before.name) changed.name = draft.name.trim()
  if (draft.email.trim() !== before.email) changed.email = draft.email.trim()
  if (draft.phone.trim() !== before.phone) changed.phone = draft.phone.trim()
  if (parsePounds(draft.dayFee) !== guest.dayFee) changed.dayFee = parsePounds(draft.dayFee)
  if (draft.emergencyContactName.trim() !== before.emergencyContactName) changed.emergencyContactName = draft.emergencyContactName.trim()
  if (draft.emergencyContactPhone.trim() !== before.emergencyContactPhone) changed.emergencyContactPhone = draft.emergencyContactPhone.trim()
  if (draft.notes.trim() !== before.notes) changed.notes = draft.notes.trim()
  return changed
}
