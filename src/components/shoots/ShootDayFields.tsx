/**
 * The shoot day form fields - ShootSync
 * One set of fields for scheduling a day and for editing it, so the two can never drift (Standard §20.15).
 */

import type { InputHTMLAttributes } from 'react'
import type { ShootDraft } from '../../utils/shootForm'

const input =
  'w-full px-3 py-2 bg-slate-900 border border-slate-600 rounded-lg text-white placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-green-500 aria-[invalid=true]:border-red-500 disabled:opacity-60'

interface Props {
  draft: ShootDraft
  onChange: (draft: ShootDraft) => void
  /** Problems to show beside each field (only once the captain has tried to save). */
  problems: Partial<Record<keyof ShootDraft, string>>
  /** The date can't move once the day is over: pay, the HMRC day count and peg history hang off it. */
  dateLocked?: boolean
  autoFocusDate?: boolean
}

export default function ShootDayFields({ draft, onChange, problems, dateLocked = false, autoFocusDate = false }: Props) {
  const field = (key: keyof ShootDraft, title: string, props: InputHTMLAttributes<HTMLInputElement> = {}, hint?: string) => (
    <label className="block">
      <span className="block text-sm font-medium text-slate-300 mb-1">{title}</span>
      <input
        className={input}
        value={draft[key]}
        aria-invalid={Boolean(problems[key])}
        aria-describedby={`shoot-${key}-note`}
        onChange={(e) => onChange({ ...draft, [key]: e.target.value })}
        {...props}
      />
      <span id={`shoot-${key}-note`} className={`block mt-1 text-sm ${problems[key] ? 'text-red-400' : 'text-slate-400'}`}>
        {problems[key] ?? hint}
      </span>
    </label>
  )

  return (
    <>
      <div className="grid sm:grid-cols-2 gap-4">
        {field('date', 'Date', { type: 'date', disabled: dateLocked, autoFocus: autoFocusDate && !dateLocked }, dateLocked ? 'Fixed now the day is over.' : undefined)}
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
        <textarea
          className={input}
          rows={3}
          maxLength={5000}
          value={draft.captainNotes}
          aria-describedby="shoot-captainNotes-note"
          onChange={(e) => onChange({ ...draft, captainNotes: e.target.value })}
        />
        <span id="shoot-captainNotes-note" className="block mt-1 text-sm text-slate-400">
          Printed on the briefing sheet. Guns don’t see these in the app.
        </span>
      </label>
    </>
  )
}
