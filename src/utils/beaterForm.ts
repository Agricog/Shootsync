/**
 * Beater add/edit form: shape, and what is sent to the API. Shared by the Beaters page and tests.
 * Day rates are whole pounds. Blank bank fields on an edit keep what is saved.
 */

export interface BeaterForEdit {
  name: string
  email?: string | null
  phone?: string | null
  dayRate: number
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

export const emptyDraft = (rate: number): BeaterDraft => ({
  name: '', email: '', phone: '', dayRate: String(rate), bankName: '', bankSortCode: '', bankAccountNumber: '', notes: '',
})

export const draftFrom = (b: BeaterForEdit): BeaterDraft => ({
  name: b.name, email: b.email ?? '', phone: b.phone ?? '', dayRate: String(b.dayRate),
  bankName: b.bankName ?? '', bankSortCode: '', bankAccountNumber: '', notes: b.notes ?? '',
})

/** What to send: blank optional fields are left out, and blank bank fields keep what is saved. */
export function payloadFrom(draft: BeaterDraft, editing: boolean) {
  const rate = Number(draft.dayRate)
  if (!draft.name.trim()) return { error: 'Add the beater’s name.' as const }
  if (!/^\d+$/.test(draft.dayRate.trim()) || rate > 1000) return { error: 'Day rate must be whole pounds, from £0 to £1,000.' as const }
  if (Boolean(draft.bankSortCode.trim()) !== Boolean(draft.bankAccountNumber.trim())) {
    return { error: 'Enter both the sort code and the account number, so the right account is paid.' as const }
  }
  const text = (v: string) => (v.trim() ? v.trim() : editing ? null : undefined)
  return {
    body: {
      name: draft.name.trim(),
      dayRate: rate,
      email: draft.email.trim() || (editing ? '' : undefined),
      phone: text(draft.phone),
      bankName: text(draft.bankName),
      notes: text(draft.notes),
      ...(draft.bankSortCode.trim() ? { bankSortCode: draft.bankSortCode.trim() } : {}),
      ...(draft.bankAccountNumber.trim() ? { bankAccountNumber: draft.bankAccountNumber.trim() } : {}),
    },
  }
}

