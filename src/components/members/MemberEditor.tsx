/**
 * Edit a member - captain only, on the Members page.
 *
 * Name, email, phone, the emergency contact the captain holds for them, their BASC (or other
 * insurer's) number and when their insurance runs out. Saves with PATCH /api/members/:id; only
 * the fields that changed are sent. A blank field clears what was there.
 */

import { useMemo, useState } from 'react'
import Button from '../common/Button'
import Input from '../common/Input'
import { apiRequest } from '../../lib/api'
import { useUnsavedWork } from '../../lib/unsavedWork'
import { useCanWrite } from '../../context/SyndicateContext'
import { draftFromMember, memberPayload, validateMemberDraft, type EditableMember, type MemberDraft } from '../../utils/memberForm'

export type { EditableMember } from '../../utils/memberForm'

export default function MemberEditor({ member, onSaved, onClose }: { member: EditableMember; onSaved: () => Promise<void>; onClose: () => void }) {
  const canWrite = useCanWrite()
  const [draft, setDraft] = useState<MemberDraft>(() => draftFromMember(member))
  const [showErrors, setShowErrors] = useState(false)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const problems = useMemo(() => validateMemberDraft(draft), [draft])
  const changes = useMemo(() => memberPayload(draft, member), [draft, member])
  const dirty = Object.keys(changes).length > 0
  useUnsavedWork(dirty, `member-${member.id}`)

  const err = (key: keyof MemberDraft) => (showErrors ? problems[key] : undefined)
  const set = (key: keyof MemberDraft) => (e: React.ChangeEvent<HTMLInputElement>) => setDraft({ ...draft, [key]: e.target.value })

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
    const result = await apiRequest<unknown>(`/api/members/${encodeURIComponent(member.id)}`, { method: 'PATCH', body: changes })
    setSaving(false)
    if (!result.ok) {
      setError(`Not saved: ${result.error}`)
      return
    }
    await onSaved()
  }

  return (
    <form onSubmit={(e) => void save(e)} noValidate className="mt-4 p-4 bg-slate-900 rounded-lg space-y-4">
      <h3 className="text-white font-medium">Edit {member.name}</h3>
      <div className="grid sm:grid-cols-2 gap-4">
        <Input label="Name" value={draft.name} onChange={set('name')} error={err('name')} maxLength={100} required autoFocus />
        <Input label="Email" type="email" value={draft.email} onChange={set('email')} error={err('email')} maxLength={254} required />
        <Input label="Phone" type="tel" value={draft.phone} onChange={set('phone')} maxLength={30} />
        <Input label="BASC or insurer’s number" value={draft.bascNumber} onChange={set('bascNumber')} maxLength={30} />
        <Input label="Emergency contact name" value={draft.emergencyContactName} onChange={set('emergencyContactName')} maxLength={100} />
        <Input label="Emergency contact phone" type="tel" value={draft.emergencyContactPhone} onChange={set('emergencyContactPhone')} error={err('emergencyContactPhone')} maxLength={30} />
        <Input label="Insurance runs out" type="date" value={draft.insuranceExpiry} onChange={set('insuranceExpiry')} error={err('insuranceExpiry')} hint="Leave blank if you don’t track it." />
      </div>
      {error && <p role="alert" className="rounded-lg px-3 py-2 bg-red-900/40 text-red-200 border border-red-800 text-sm">{error}</p>}
      {showErrors && Object.keys(problems).length > 0 && <p role="alert" className="text-sm text-red-300">Check the highlighted fields.</p>}
      <div className="flex flex-wrap gap-3">
        <Button type="submit" size="sm" isLoading={saving} disabled={saving || !canWrite}>Save</Button>
        <Button type="button" size="sm" variant="ghost" onClick={onClose} disabled={saving}>Cancel</Button>
      </div>
    </form>
  )
}
