/**
 * Edit, cancel or delete a shoot day - captain only (on the Shoot Detail page).
 *
 * Cancel keeps the day on record (and refuses once beaters have been paid for it).
 * Delete removes the day and everything on it, so it is only offered for a day that
 * hasn't happened, and the server refuses it once anyone, beater or guest, has paid.
 */

import { useState } from 'react'
import Card from '../common/Card'
import Button from '../common/Button'
import { shootDraftFrom, shootPayload, validateShoot, type ShootDraft, type ShootFields } from '../../utils/shootForm'

interface Props {
  shoot: ShootFields & { id: string; status: string }
  paidGuests: number
  onSaved: () => Promise<void>
  onClose: () => void
  onDeleted: () => void
}

async function send(path: string, method: string, body?: unknown): Promise<string | null> {
  try {
    const response = await fetch(path, {
      method,
      headers: body ? { 'Content-Type': 'application/json' } : undefined,
      body: body ? JSON.stringify(body) : undefined,
    })
    if (response.ok) return null
    const data = await response.json().catch(() => null)
    return data?.details?.[0]?.message || data?.error || `Something went wrong (${response.status})`
  } catch {
    return 'Could not reach ShootSync. Check your connection and try again.'
  }
}

const input = 'w-full px-3 py-2 bg-slate-900 border border-slate-600 rounded-lg text-white focus:outline-none focus:ring-2 focus:ring-green-500 aria-[invalid=true]:border-red-500'

export default function ShootDayEditor({ shoot, paidGuests, onSaved, onClose, onDeleted }: Props) {
  const [draft, setDraft] = useState<ShootDraft>(shootDraftFrom(shoot))
  const [showErrors, setShowErrors] = useState(false)
  const [busy, setBusy] = useState<'save' | 'cancel' | 'delete' | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [confirm, setConfirm] = useState<'cancel' | 'delete' | null>(null)

  const problems = validateShoot(draft)
  const problem = (key: keyof ShootDraft) => (showErrors ? problems[key] : undefined)
  const path = `/api/shoots/${encodeURIComponent(shoot.id)}`

  const field = (key: keyof ShootDraft, title: string, props: React.InputHTMLAttributes<HTMLInputElement> = {}, hint?: string) => (
    <label className="block">
      <span className="block text-sm font-medium text-slate-300 mb-1">{title}</span>
      <input className={input} value={draft[key]} aria-invalid={Boolean(problem(key))} aria-describedby={`shoot-${key}-note`}
        onChange={(e) => setDraft({ ...draft, [key]: e.target.value })} {...props} />
      <span id={`shoot-${key}-note`} className={`block mt-1 text-sm ${problem(key) ? 'text-red-400' : 'text-slate-500'}`}>
        {problem(key) ?? hint}
      </span>
    </label>
  )
  // Pay, the HMRC day count and the peg history hang off the date: it is fixed once the day is done.
  const dateLocked = shoot.status !== 'SCHEDULED'

  const save = async (e: React.FormEvent) => {
    e.preventDefault()
    setShowErrors(true)
    if (Object.keys(problems).length > 0) return
    setBusy('save')
    setError(null)
    const failure = await send(path, 'PATCH', shootPayload(draft))
    if (failure) {
      setError(`Not saved: ${failure}`)
      setBusy(null)
      return
    }
    await onSaved()
    setBusy(null)
    onClose()
  }

  const act = async (kind: 'cancel' | 'delete') => {
    if (confirm !== kind) {
      setConfirm(kind)
      return
    }
    setBusy(kind)
    setError(null)
    const failure = kind === 'cancel' ? await send(`${path}/cancel`, 'POST') : await send(path, 'DELETE')
    setBusy(null)
    setConfirm(null)
    if (failure) {
      setError(failure)
      return
    }
    if (kind === 'delete') onDeleted()
    else {
      await onSaved()
      onClose()
    }
  }

  return (
    <Card>
      <h2 className="text-lg font-semibold text-white mb-4">Edit shoot day</h2>
      <form onSubmit={save} noValidate className="space-y-4">
        <div className="grid sm:grid-cols-2 gap-4">
          {field('date', 'Date', { type: 'date', disabled: dateLocked, autoFocus: !dateLocked }, dateLocked ? 'Fixed now the day is over.' : undefined)}
          {field('meetTime', 'Meet time', { type: 'time' })}
          {field('locationName', 'Place', { maxLength: 100 }, 'For example the farm or estate name.')}
          {field('locationPostcode', 'Postcode', { maxLength: 12, autoComplete: 'off' })}
          {field('locationAddress', 'Address', { maxLength: 300 })}
          {field('locationWhat3Words', 'what3words for the meet', { autoComplete: 'off', placeholder: 'filled.count.soap' }, 'Optional. Printed on the briefing sheet.')}
          {field('drivesPlanned', 'Drives planned', { inputMode: 'numeric' })}
          {field('expectedBag', 'Expected bag', { inputMode: 'numeric' }, 'Optional.')}
        </div>
        <label className="block">
          <span className="block text-sm font-medium text-slate-300 mb-1">Captain’s notes</span>
          <textarea className={input} rows={3} maxLength={5000} value={draft.captainNotes}
            onChange={(e) => setDraft({ ...draft, captainNotes: e.target.value })} />
          <span className="block mt-1 text-sm text-slate-500">Printed on the briefing sheet. Guns don’t see these in the app.</span>
        </label>

        {error && (
          <p role="alert" className="rounded-lg px-3 py-2 bg-red-900/40 text-red-200 border border-red-800 text-sm">
            {error}
          </p>
        )}

        <div className="flex flex-wrap gap-3">
          <Button type="submit" isLoading={busy === 'save'} disabled={busy !== null}>
            Save changes
          </Button>
          <Button type="button" variant="ghost" onClick={onClose} disabled={busy !== null}>
            Close
          </Button>
        </div>
      </form>

      <p className="sr-only" aria-live="polite">{confirm ? 'Press the button again to confirm.' : ''}</p>

      {shoot.status === 'SCHEDULED' && (
        <div className="mt-8 pt-6 border-t border-slate-700 space-y-3">
          <h3 className="text-white font-medium">Cancel or delete</h3>
          <p className="text-sm text-slate-400">
            Cancelling keeps the day on record, marked cancelled. Deleting removes it with its pegs, guests, beaters and bag.
            {paidGuests > 0 &&
              ` ${paidGuests} ${paidGuests === 1 ? 'guest has' : 'guests have'} paid a day fee: refund ${paidGuests === 1 ? 'it' : 'them'} in your Stripe dashboard if the day doesn’t go ahead.`}
          </p>
          <div className="flex flex-wrap gap-3">
            <Button type="button" variant="secondary" onClick={() => act('cancel')} isLoading={busy === 'cancel'} disabled={busy !== null}>
              {confirm === 'cancel' ? 'Yes, cancel this day' : 'Cancel this day'}
            </Button>
            {shoot.status === 'SCHEDULED' && paidGuests === 0 && (
              <Button type="button" variant="danger" onClick={() => act('delete')} isLoading={busy === 'delete'} disabled={busy !== null}>
                {confirm === 'delete' ? 'Yes, delete it and everything on it' : 'Delete this day'}
              </Button>
            )}
          </div>
        </div>
      )}
    </Card>
  )
}
