/**
 * Edit a guest - captain only, on the shoot day page.
 *
 * Name, email, phone, the day fee and a note, with the emergency contact they gave (a captain may
 * need to correct a digit on the morning). The fee is locked once the guest has accepted the
 * invitation at it: the server refuses the change, and the field says so before they try.
 * Saves with PATCH /api/guests/:id; only the fields that changed are sent.
 */

import { useMemo, useState } from 'react'
import Button from '../common/Button'
import Input from '../common/Input'
import { apiRequest } from '../../lib/api'
import { useUnsavedWork } from '../../lib/unsavedWork'
import { useCanWrite } from '../../context/SyndicateContext'
import { draftFromGuest, guestPayload, validateGuestDraft, type EditableGuest, type GuestDraft } from '../../utils/guestForm'

export type { EditableGuest } from '../../utils/guestForm'

export default function GuestEditor({ guest, onSaved, onClose }: { guest: EditableGuest; onSaved: () => Promise<void>; onClose: () => void }) {
  const canWrite = useCanWrite()
  const [draft, setDraft] = useState<GuestDraft>(() => draftFromGuest(guest))
  const [showErrors, setShowErrors] = useState(false)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const problems = useMemo(() => validateGuestDraft(draft), [draft])
  const changes = useMemo(() => guestPayload(draft, guest), [draft, guest])
  const dirty = Object.keys(changes).length > 0
  useUnsavedWork(dirty, `guest-${guest.id}`)

  // The fee the guest agreed to when they accepted is the fee: the server refuses a change.
  const feeLocked = guest.waiverAccepted || guest.paymentStatus !== 'PENDING'
  const feeHint = guest.paymentStatus === 'PAID'
    ? 'Fixed: they have paid at this fee. Refund them in Stripe if it must change.'
    : guest.paymentStatus === 'REFUNDED'
      ? 'Fixed: this fee was paid and refunded, so it stays on the record.'
      : feeLocked
        ? 'Fixed: they accepted the invitation at this fee. Remove them and add them again if it must change.'
        : 'Up to £1,000. 0 if they shoot free.'
  const err = (key: keyof GuestDraft) => (showErrors ? problems[key] : undefined)
  const set = (key: keyof GuestDraft) => (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => setDraft({ ...draft, [key]: e.target.value })

  const save = async (e: React.FormEvent) => {
    e.preventDefault()
    setShowErrors(true)
    if (Object.keys(problems).length > 0) return
    if (!dirty) {
      onClose()
      return
    }
    setSaving(true)
    setError(null)
    const result = await apiRequest<unknown>(`/api/guests/${encodeURIComponent(guest.id)}`, { method: 'PATCH', body: changes })
    setSaving(false)
    if (!result.ok) {
      setError(`Not saved: ${result.error}`)
      return
    }
    await onSaved()
  }

  return (
    <form onSubmit={(e) => void save(e)} noValidate className="mt-4 p-4 bg-slate-900 rounded-lg space-y-4">
      <h4 className="text-white font-medium">Edit {guest.name}</h4>
      <div className="grid sm:grid-cols-2 gap-4">
        <Input label="Name" value={draft.name} onChange={set('name')} error={err('name')} maxLength={100} required autoFocus />
        <Input label="Email" type="email" value={draft.email} onChange={set('email')} error={err('email')} maxLength={254} required />
        <Input label="Phone" type="tel" value={draft.phone} onChange={set('phone')} maxLength={30} />
        <Input
          label="Day fee (£)"
          inputMode="decimal"
          value={draft.dayFee}
          onChange={set('dayFee')}
          error={err('dayFee')}
          disabled={feeLocked}
          hint={feeHint}
        />
        <Input label="Emergency contact name" value={draft.emergencyContactName} onChange={set('emergencyContactName')} maxLength={100} />
        <Input label="Emergency contact phone" type="tel" value={draft.emergencyContactPhone} onChange={set('emergencyContactPhone')} error={err('emergencyContactPhone')} maxLength={30} />
      </div>
      <label className="block">
        <span className="block text-sm font-medium text-slate-300 mb-1">Note (only you see this)</span>
        <textarea rows={2} maxLength={2000} value={draft.notes} onChange={set('notes')}
          className="w-full px-3 py-2 bg-slate-800 border border-slate-700 rounded-lg text-white focus:outline-none focus:ring-2 focus:ring-green-500" />
      </label>
      {error && <p role="alert" className="rounded-lg px-3 py-2 bg-red-900/40 text-red-200 border border-red-800 text-sm">{error}</p>}
      {showErrors && Object.keys(problems).length > 0 && <p role="alert" className="text-sm text-red-300">Check the highlighted fields.</p>}
      <div className="flex flex-wrap gap-3">
        <Button type="submit" size="sm" isLoading={saving} disabled={saving || !canWrite}>Save</Button>
        <Button type="button" size="sm" variant="ghost" onClick={onClose} disabled={saving}>Cancel</Button>
      </div>
    </form>
  )
}
