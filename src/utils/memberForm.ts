/**
 * Member edit form: shape, checks and what is sent. Shared by the Members page's editor
 * (src/components/members/MemberEditor.tsx) and its tests. The server checks everything again.
 */

export interface EditableMember {
  id: string
  name: string
  email: string
  phone?: string | null
  emergencyContactName?: string | null
  emergencyContactPhone?: string | null
  bascNumber?: string | null
  /** ISO date-time from the API, or null. */
  insuranceExpiry?: string | null
}

export interface MemberDraft {
  name: string
  email: string
  phone: string
  emergencyContactName: string
  emergencyContactPhone: string
  bascNumber: string
  /** "YYYY-MM-DD" or blank. */
  insuranceExpiry: string
}

export const draftFromMember = (m: EditableMember): MemberDraft => ({
  name: m.name,
  email: m.email,
  phone: m.phone ?? '',
  emergencyContactName: m.emergencyContactName ?? '',
  emergencyContactPhone: m.emergencyContactPhone ?? '',
  bascNumber: m.bascNumber ?? '',
  insuranceExpiry: m.insuranceExpiry ? m.insuranceExpiry.slice(0, 10) : '',
})

/** Problems by field, or none. */
export function validateMemberDraft(draft: MemberDraft): Partial<Record<keyof MemberDraft, string>> {
  const problems: Partial<Record<keyof MemberDraft, string>> = {}
  if (!draft.name.trim()) problems.name = 'Enter their name.'
  if (draft.name.trim().length > 100) problems.name = 'Keep the name to 100 characters.'
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(draft.email.trim())) problems.email = 'Enter a valid email address.'
  if (Boolean(draft.emergencyContactName.trim()) !== Boolean(draft.emergencyContactPhone.trim())) {
    problems.emergencyContactPhone = 'Give both the emergency contact’s name and their phone number, or neither.'
  }
  if (draft.insuranceExpiry && !/^\d{4}-\d{2}-\d{2}$/.test(draft.insuranceExpiry)) problems.insuranceExpiry = 'Enter the date as a day, month and four-digit year.'
  return problems
}

/**
 * What to send: only what changed. The API clears a text field with an empty string and keeps
 * one that isn't sent; an insurance date can only be set, so a cleared date is sent as null.
 */
export function memberPayload(draft: MemberDraft, member: EditableMember): Record<string, unknown> {
  const before = draftFromMember(member)
  const changed: Record<string, unknown> = {}
  for (const key of ['name', 'email', 'phone', 'emergencyContactName', 'emergencyContactPhone', 'bascNumber'] as const) {
    if (draft[key].trim() !== before[key]) changed[key] = draft[key].trim()
  }
  if (draft.insuranceExpiry !== before.insuranceExpiry) changed.insuranceExpiry = draft.insuranceExpiry || null
  return changed
}
