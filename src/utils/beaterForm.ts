/**
 * Beater add/edit form: shape, and what is sent to the API. Shared by the Beaters page and tests.
 * Day rates are typed in pounds and pence ("42.50") and sent in pence. Blank bank fields on an
 * edit keep what is saved.
 */

import { DAY_RATE_MESSAGE, dayRateField, parseDayRate } from './dayRate.js'

export interface BeaterForEdit {
  name: string
  email?: string | null
  phone?: string | null
  dayRatePence: number
  bankName?: string | null
  notes?: string | null
}

export interface BeaterDraft {
  name: string
  email: string
  phone: string
  dayRate: string
  bankName: string
  bankSortCode: string
  bankAccountNumber: string
  notes: string
}

/** A blank form, with the day rate (in pence) a new beater starts on. */
export const emptyDraft = (ratePence: number): BeaterDraft => ({
  name: '', email: '', phone: '', dayRate: dayRateField(ratePence), bankName: '', bankSortCode: '', bankAccountNumber: '', notes: '',
})

export const draftFrom = (b: BeaterForEdit): BeaterDraft => ({
  name: b.name, email: b.email ?? '', phone: b.phone ?? '', dayRate: dayRateField(b.dayRatePence),
  bankName: b.bankName ?? '', bankSortCode: '', bankAccountNumber: '', notes: b.notes ?? '',
})

/** What to send: blank optional fields are left out, and blank bank fields keep what is saved. */
export function payloadFrom(draft: BeaterDraft, editing: boolean) {
  const ratePence = parseDayRate(draft.dayRate)
  if (!draft.name.trim()) return { error: 'Add the beater’s name.' as const }
  if (ratePence === null) return { error: DAY_RATE_MESSAGE }
  if (Boolean(draft.bankSortCode.trim()) !== Boolean(draft.bankAccountNumber.trim())) {
    return { error: 'Enter both the sort code and the account number, so the right account is paid.' as const }
  }
  const text = (v: string) => (v.trim() ? v.trim() : editing ? null : undefined)
  return {
    body: {
      name: draft.name.trim(),
      dayRatePence: ratePence,
      email: draft.email.trim() || (editing ? '' : undefined),
      phone: text(draft.phone),
      bankName: text(draft.bankName),
      notes: text(draft.notes),
      ...(draft.bankSortCode.trim() ? { bankSortCode: draft.bankSortCode.trim() } : {}),
      ...(draft.bankAccountNumber.trim() ? { bankAccountNumber: draft.bankAccountNumber.trim() } : {}),
    },
  }
}

