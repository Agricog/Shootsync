/**
 * Record the bag - captain's game book.
 *
 * - Pick the day (today's shoot is chosen for you when there is one).
 * - Record each drive by hand or by voice ("thirty four pheasants, five duck").
 * - Correct or delete a drive. Each drive number is used once per day (the server refuses
 *   a second "drive 2"), so the day's total can't be counted twice.
 * - The season's game book: totals by species and each day's bag, with a spreadsheet export.
 *   "The season" is the syndicate's season dates from Settings; cancelled days are left out.
 */

import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { Link } from 'react-router-dom'
import { Helmet } from 'react-helmet-async'
import { useCanWrite, useCaptainSyndicate } from '../../context/SyndicateContext'
import { apiRequest } from '../../lib/api'
import { londonDate } from '../../utils/beaterPayCalculator'
import DashboardLayout from '../../components/layout/DashboardLayout'
import Card from '../../components/common/Card'
import Button from '../../components/common/Button'
import LoadingSpinner from '../../components/common/LoadingSpinner'
import { BAG_SPECIES, parseBagSpeech, type BagSpecies } from '../../utils/bagSpeech'
import { toCsv } from '../../utils/csv'
import { formatDayMonth, formatShortDate } from '../../utils/dateHelpers'

interface ShootDay {
  id: string
  date: string
  locationName: string
  status: string
}

interface Bag extends Record<BagSpecies, number> {
  id: string
  driveNumber: number
  otherDescription?: string | null
  notes?: string | null
}

interface SeasonDay extends Record<BagSpecies | 'total', number> {
  shootId: string
  date: string
  locationName: string
  status: string
  drives: number
}

interface Season extends Record<BagSpecies | 'total', number> {
  shootsCompleted: number
  outsideSeason: number
  season: { start: string; end: string }
  days: SeasonDay[]
}

interface Draft extends Record<BagSpecies, string> {
  driveNumber: string
  otherDescription: string
  notes: string
}

const LABEL: Record<BagSpecies, string> = { pheasant: 'Pheasant', partridge: 'Partridge', duck: 'Duck', woodcock: 'Woodcock', other: 'Other' }

const blankDraft = (drive: number): Draft => ({
  driveNumber: String(drive), pheasant: '', partridge: '', duck: '', woodcock: '', other: '', otherDescription: '', notes: '',
})
const draftFrom = (b: Bag): Draft => ({
  driveNumber: String(b.driveNumber),
  pheasant: String(b.pheasant), partridge: String(b.partridge), duck: String(b.duck), woodcock: String(b.woodcock), other: String(b.other),
  otherDescription: b.otherDescription ?? '', notes: b.notes ?? '',
})

/** Draft -> request body, or an error to show. Blank counts are 0. */
function bodyFrom(d: Draft): { body: Record<string, unknown> } | { error: string } {
  const drive = Number(d.driveNumber)
  if (!/^\d+$/.test(d.driveNumber) || drive < 1 || drive > 50) return { error: 'Drive number must be between 1 and 50.' }
  const counts: Partial<Record<BagSpecies, number>> = {}
  for (const species of BAG_SPECIES) {
    const raw = d[species].trim()
    if (raw && !/^\d+$/.test(raw)) return { error: `${LABEL[species]} must be a whole number.` }
    counts[species] = raw ? Number(raw) : 0
  }
  return { body: { driveNumber: drive, ...counts, otherDescription: d.otherDescription.trim() || null, notes: d.notes.trim() || null } }
}

async function send(path: string, method: 'GET' | 'POST' | 'PATCH' | 'DELETE', body?: unknown): Promise<{ ok: true; data: any } | { ok: false; error: string }> {
  const result = await apiRequest<any>(path, { method, body })
  return result.ok ? { ok: true, data: result.data } : { ok: false, error: result.error }
}

/** Today's shoot if there is one, else the most recent one that has happened, else the next one. */
function defaultShoot(shoots: ShootDay[]): string | null {
  const today = londonDate(new Date()) // the UK date, as YYYY-MM-DD
  const day = (s: ShootDay) => s.date.slice(0, 10)
  return (
    shoots.find((s) => day(s) === today)?.id ??
    [...shoots].reverse().find((s) => day(s) < today)?.id ??
    shoots.find((s) => day(s) > today)?.id ??
    null
  )
}

const total = (b: Record<BagSpecies, number>) => BAG_SPECIES.reduce((sum, s) => sum + b[s], 0)
const field = 'w-full px-3 py-2 bg-slate-900 border border-slate-600 rounded-lg text-white focus:outline-none focus:ring-2 focus:ring-green-500'

function BagForm({ draft, onChange, onSubmit, saving, submitLabel, onCancel, voice }: {
  draft: Draft
  onChange: (d: Draft) => void
  onSubmit: () => void
  saving: boolean
  submitLabel: string
  onCancel?: () => void
  voice?: React.ReactNode
}) {
  const others = Number(draft.other) > 0
  return (
    <form className="space-y-4" onSubmit={(e) => { e.preventDefault(); onSubmit() }}>
      <div className="flex flex-wrap items-end gap-4">
        <label className="w-28">
          <span className="block text-sm font-medium text-slate-300 mb-1">Drive</span>
          <input className={field} inputMode="numeric" value={draft.driveNumber} onChange={(e) => onChange({ ...draft, driveNumber: e.target.value })} />
        </label>
        {voice}
      </div>
      <div className="grid grid-cols-2 sm:grid-cols-5 gap-3">
        {BAG_SPECIES.map((species) => (
          <label key={species}>
            <span className="block text-sm font-medium text-slate-300 mb-1">{LABEL[species]}</span>
            <input className={field} inputMode="numeric" placeholder="0" value={draft[species]}
              onChange={(e) => onChange({ ...draft, [species]: e.target.value })} />
          </label>
        ))}
      </div>
      {others && (
        <label className="block">
          <span className="block text-sm font-medium text-slate-300 mb-1">What was “other”?</span>
          <input className={field} maxLength={200} placeholder="e.g. pigeon, rabbit" value={draft.otherDescription}
            onChange={(e) => onChange({ ...draft, otherDescription: e.target.value })} />
        </label>
      )}
      <label className="block">
        <span className="block text-sm font-medium text-slate-300 mb-1">Notes</span>
        <textarea className={field} rows={2} maxLength={2000} value={draft.notes} onChange={(e) => onChange({ ...draft, notes: e.target.value })} />
      </label>
      <div className="flex gap-3">
        <Button type="submit" size="lg" isLoading={saving} disabled={saving}>{submitLabel}</Button>
        {onCancel && <Button type="button" variant="ghost" onClick={onCancel} disabled={saving}>Cancel</Button>}
      </div>
    </form>
  )
}

export default function BagRecord() {
  const { id: syndicateId } = useCaptainSyndicate()
  const canWrite = useCanWrite()
  const [loading, setLoading] = useState(true)
  const [shoots, setShoots] = useState<ShootDay[]>([])
  const [shootId, setShootId] = useState<string | null>(null)
  const [bags, setBags] = useState<Bag[]>([])
  const [season, setSeason] = useState<Season | null>(null)

  const [draft, setDraft] = useState<Draft>(blankDraft(1))
  const [editingId, setEditingId] = useState<string | null>(null)
  const [editDraft, setEditDraft] = useState<Draft>(blankDraft(1))
  const [confirmDelete, setConfirmDelete] = useState<string | null>(null)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [notice, setNotice] = useState<string | null>(null)

  const [listening, setListening] = useState(false)
  const [heard, setHeard] = useState<string | null>(null)
  // The day on screen now. A response for a day the captain has moved away from is ignored,
  // so one day's drives can never appear, or be edited, under another.
  const currentShoot = useRef<string | null>(null)
  currentShoot.current = shootId
  const recognitionRef = useRef<{ abort: () => void } | null>(null)
  const speechSupported = typeof window !== 'undefined' && ('webkitSpeechRecognition' in window || 'SpeechRecognition' in window)

  const nextDrive = (list: Bag[]) => list.reduce((max, b) => Math.max(max, b.driveNumber), 0) + 1

  const loadSeason = useCallback(async (id: string) => {
    const result = await send(`/api/bags/season?syndicateId=${encodeURIComponent(id)}`, 'GET')
    if (result.ok) setSeason(result.data)
  }, [])

  /** resetForm: start a fresh new-drive form (on changing day, or after recording a drive). */
  const loadBags = useCallback(async (id: string, resetForm: boolean) => {
    const result = await send(`/api/bags?shootId=${encodeURIComponent(id)}`, 'GET')
    if (currentShoot.current !== id) return
    if (!result.ok) {
      setError(result.error)
      return
    }
    const list: Bag[] = [...result.data].sort((a, b) => a.driveNumber - b.driveNumber)
    setBags(list)
    if (resetForm) setDraft(blankDraft(nextDrive(list)))
    else setDraft((d) => (list.some((b) => String(b.driveNumber) === d.driveNumber) ? { ...d, driveNumber: String(nextDrive(list)) } : d))
  }, [])

  useEffect(() => {
    ;(async () => {
      setLoading(true)
      setError(null)
      const list = await send(`/api/shoots?syndicateId=${encodeURIComponent(syndicateId)}`, 'GET')
      if (list.ok) {
        const usable: ShootDay[] = list.data.filter((s: ShootDay) => s.status !== 'CANCELLED')
        setShoots(usable)
        setShootId(defaultShoot(usable))
      } else {
        setError(list.error)
      }
      await loadSeason(syndicateId)
      setLoading(false)
    })()
  }, [syndicateId, loadSeason])

  useEffect(() => {
    setBags([])
    setEditingId(null)
    setConfirmDelete(null)
    setHeard(null)
    recognitionRef.current?.abort()
    if (shootId) loadBags(shootId, true)
  }, [shootId, loadBags])

  useEffect(() => () => recognitionRef.current?.abort(), [])

  const afterChange = async (forShoot: string, message: string, resetForm: boolean) => {
    if (currentShoot.current !== forShoot) return
    setNotice(message)
    await loadBags(forShoot, resetForm)
    await loadSeason(syndicateId)
  }

  const record = async () => {
    if (!shootId) return
    const built = bodyFrom(draft)
    if ('error' in built) return setError(built.error)
    setSaving(true)
    setError(null)
    setNotice(null)
    const forShoot = shootId
    const result = await send('/api/bags', 'POST', { shootId: forShoot, ...built.body })
    setSaving(false)
    if (!result.ok) return setError(`Not saved: ${result.error}`)
    setHeard(null)
    await afterChange(forShoot, `Drive ${built.body.driveNumber} saved: ${total(result.data)} head.`, true)
  }

  const saveEdit = async (bag: Bag) => {
    const built = bodyFrom(editDraft)
    if ('error' in built) return setError(built.error)
    setSaving(true)
    setError(null)
    const result = await send(`/api/bags/${encodeURIComponent(bag.id)}`, 'PATCH', built.body)
    setSaving(false)
    if (!result.ok) return setError(`Not saved: ${result.error}`)
    setEditingId(null)
    if (shootId) await afterChange(shootId, `Drive ${built.body.driveNumber} corrected.`, false)
  }

  const remove = async (bag: Bag) => {
    if (confirmDelete !== bag.id) return setConfirmDelete(bag.id)
    setSaving(true)
    setError(null)
    const result = await send(`/api/bags/${encodeURIComponent(bag.id)}`, 'DELETE')
    setSaving(false)
    setConfirmDelete(null)
    if (!result.ok) return setError(result.error)
    if (shootId) await afterChange(shootId, `Drive ${bag.driveNumber} deleted.`, false)
  }

  const listen = () => {
    const Recognition = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition
    if (!Recognition) return
    const forShoot = shootId
    const recognition = new Recognition()
    recognitionRef.current = recognition
    recognition.lang = 'en-GB'
    recognition.continuous = false
    recognition.interimResults = false
    recognition.onstart = () => setListening(true)
    recognition.onend = () => setListening(false)
    recognition.onerror = () => {
      setListening(false)
      setHeard('Didn’t catch that. Try again, or type the numbers.')
    }
    recognition.onresult = (event: any) => {
      if (currentShoot.current !== forShoot) return
      const text: string = event.results[0][0].transcript
      const { counts, drive, unclear } = parseBagSpeech(text)
      if (unclear) {
        setHeard(`Heard “${text}” but couldn’t be sure of every number, so nothing was filled in. Say each number before the bird, like “thirty four pheasants, five duck”.`)
        return
      }
      const parts = (Object.keys(counts) as BagSpecies[]).map((s) => `${counts[s]} ${LABEL[s].toLowerCase()}`)
      if (drive) parts.unshift(`drive ${drive}`)
      setHeard(parts.length > 0 ? `Heard “${text}”: filled in ${parts.join(', ')}. Check, then save.` : `Heard “${text}” but no numbers of birds. Try “thirty pheasants, five duck”.`)
      setDraft((d) => {
        const next = { ...d }
        if (drive) next.driveNumber = String(drive)
        for (const species of Object.keys(counts) as BagSpecies[]) next[species] = String(counts[species])
        return next
      })
    }
    recognition.start()
  }

  const dayTotals = useMemo(() => {
    const t = { pheasant: 0, partridge: 0, duck: 0, woodcock: 0, other: 0 }
    for (const b of bags) for (const s of BAG_SPECIES) t[s] += b[s]
    return t
  }, [bags])

  const exportGameBook = () => {
    if (!season) return
    const header = ['Date', 'Place', 'Drives', 'Pheasant', 'Partridge', 'Duck', 'Woodcock', 'Other', 'Total']
    const rows = season.days.map((d) => [d.date.slice(0, 10), d.locationName, String(d.drives), ...BAG_SPECIES.map((s) => String(d[s])), String(d.total)])
    const totals = ['Season', '', String(season.days.reduce((n, d) => n + d.drives, 0)), ...BAG_SPECIES.map((s) => String(season[s])), String(season.total)]
    const url = URL.createObjectURL(new Blob(['﻿' + toCsv([header, ...rows, totals])], { type: 'text/csv;charset=utf-8' }))
    const link = document.createElement('a')
    link.href = url
    link.download = `game-book-${season.season.start.slice(0, 4)}-${season.season.end.slice(2, 4)}.csv`
    link.click()
    URL.revokeObjectURL(url)
  }

  if (loading) {
    return (
      <DashboardLayout>
        <div className="flex justify-center items-center h-64"><LoadingSpinner size="lg" /></div>
      </DashboardLayout>
    )
  }

  return (
    <DashboardLayout>
      <Helmet>
        <title>Game Book | ShootSync</title>
      </Helmet>

      <div className="space-y-6 max-w-4xl">
        <div>
          <h1 className="text-2xl font-bold text-white">Game book</h1>
          <p className="text-slate-400">Record the bag drive by drive, and see the season so far.</p>
        </div>

        <div aria-live="polite" className="space-y-2">
          {error && <p className="rounded-lg px-4 py-3 bg-red-900/40 text-red-200 border border-red-800">{error}</p>}
          {notice && <p className="rounded-lg px-4 py-3 bg-green-900/40 text-green-200 border border-green-800">{notice}</p>}
        </div>

        <Card>
          <label htmlFor="shoot" className="block text-sm font-medium text-slate-300 mb-2">Shoot day</label>
          {shoots.length === 0 ? (
            <p className="text-slate-300">No shoot days yet. Add one under Shoots first.</p>
          ) : (
            <select id="shoot" value={shootId ?? ''} onChange={(e) => setShootId(e.target.value || null)} className={field}>
              <option value="">Choose a shoot day</option>
              {shoots.map((s) => (
                <option key={s.id} value={s.id}>
                  {formatShortDate(s.date)} · {s.locationName}
                </option>
              ))}
            </select>
          )}
        </Card>

        {shootId && (
          <>
            <Card>
              <h2 className="text-lg font-semibold text-white mb-4">This day: {total(dayTotals)} head</h2>
              <div className="grid grid-cols-3 sm:grid-cols-5 gap-3 text-center">
                {BAG_SPECIES.map((s) => (
                  <div key={s} className="p-2 bg-slate-900 rounded-lg">
                    <p className="text-2xl font-bold text-white">{dayTotals[s]}</p>
                    <p className="text-amber-500 text-sm">{LABEL[s]}</p>
                  </div>
                ))}
              </div>
            </Card>

            {canWrite && (
              <Card>
                <h2 className="text-lg font-semibold text-white mb-4">Record a drive</h2>
                <BagForm
                  draft={draft}
                  onChange={setDraft}
                  onSubmit={record}
                  saving={saving && !editingId}
                  submitLabel={`Save drive ${draft.driveNumber || ''}`}
                  voice={
                    speechSupported ? (
                      <Button type="button" variant={listening ? 'primary' : 'secondary'} onClick={listen} disabled={listening}>
                        {listening ? 'Listening…' : 'Say the bag'}
                      </Button>
                    ) : (
                      <p className="text-sm text-slate-400">Saying the numbers works in Chrome and Edge.</p>
                    )
                  }
                />
                {heard && <p className="mt-3 text-sm text-slate-300" aria-live="polite">{heard}</p>}
              </Card>
            )}

            {bags.length > 0 && (
              <Card>
                <h2 className="text-lg font-semibold text-white mb-4">Drives recorded</h2>
                <ul className="space-y-2">
                  {bags.map((bag) => (
                    <li key={bag.id} className="p-3 bg-slate-900 rounded-lg">
                      {editingId === bag.id ? (
                        <BagForm draft={editDraft} onChange={setEditDraft} onSubmit={() => saveEdit(bag)} saving={saving}
                          submitLabel="Save correction" onCancel={() => { setEditingId(null); setError(null) }} />
                      ) : (
                        <div className="flex flex-wrap items-center gap-3">
                          <span className="font-medium text-white w-20">Drive {bag.driveNumber}</span>
                          <span className="text-slate-300 text-sm flex-1 min-w-[12rem]">
                            {BAG_SPECIES.filter((s) => bag[s] > 0).map((s) => `${bag[s]} ${LABEL[s].toLowerCase()}`).join(', ') || 'Blank drive'}
                            {bag.otherDescription ? ` (${bag.otherDescription})` : ''}
                          </span>
                          <span className="font-semibold text-green-400">{total(bag)}</span>
                          <Button size="sm" variant="secondary" disabled={saving || editingId !== null || !canWrite}
                            onClick={() => { setEditingId(bag.id); setEditDraft(draftFrom(bag)); setConfirmDelete(null); setNotice(null) }}>
                            Edit
                          </Button>
                          <Button size="sm" variant={confirmDelete === bag.id ? 'danger' : 'ghost'} disabled={saving || editingId !== null || !canWrite} onClick={() => remove(bag)}>
                            {confirmDelete === bag.id ? `Delete drive ${bag.driveNumber}?` : 'Delete'}
                          </Button>
                        </div>
                      )}
                    </li>
                  ))}
                </ul>
              </Card>
            )}
          </>
        )}

        {season && (
          <Card>
            <div className="flex flex-wrap justify-between items-start gap-3 mb-4">
              <div>
                <h2 className="text-lg font-semibold text-white">Season so far: {season.total} head</h2>
                <p className="text-sm text-slate-400">
                  {formatShortDate(season.season.start)} to {formatShortDate(season.season.end)} · {season.days.length} {season.days.length === 1 ? 'day' : 'days'} in the book ·{' '}
                  {season.shootsCompleted} completed
                </p>
              </div>
              <Button size="sm" variant="secondary" onClick={exportGameBook} disabled={season.days.length === 0}>
                Export game book
              </Button>
            </div>
            {season.outsideSeason > 0 && (
              <p className="mb-4 text-sm text-amber-300 border-l-2 border-amber-500 pl-3">
                {season.outsideSeason} {season.outsideSeason === 1 ? 'day with a bag falls' : 'days with a bag fall'} outside your season dates, so{' '}
                {season.outsideSeason === 1 ? 'it isn’t' : 'they aren’t'} counted here. If a new season has started, update the dates in{' '}
                <Link to="/settings" className="underline">Settings</Link>.
              </p>
            )}
            <div className="grid grid-cols-3 sm:grid-cols-5 gap-3 text-center mb-4">
              {BAG_SPECIES.map((s) => (
                <div key={s} className="p-2 bg-slate-900 rounded-lg">
                  <p className="text-xl font-bold text-white">{season[s]}</p>
                  <p className="text-amber-500 text-sm">{LABEL[s]}</p>
                </div>
              ))}
            </div>
            {season.days.length > 0 && (
              <div className="overflow-x-auto">
                <table className="w-full text-sm text-left">
                  <caption className="sr-only">Bag by shoot day this season</caption>
                  <thead className="text-slate-400">
                    <tr>
                      <th scope="col" className="py-2 pr-3">Day</th>
                      {BAG_SPECIES.map((s) => <th key={s} scope="col" className="py-2 px-2 text-right">{LABEL[s]}</th>)}
                      <th scope="col" className="py-2 pl-2 text-right">Total</th>
                    </tr>
                  </thead>
                  <tbody className="text-slate-200">
                    {season.days.map((d) => (
                      <tr key={d.shootId} className="border-t border-slate-700">
                        <th scope="row" className="py-2 pr-3 font-normal whitespace-nowrap">{formatDayMonth(d.date)} · {d.locationName}</th>
                        {BAG_SPECIES.map((s) => <td key={s} className="py-2 px-2 text-right">{d[s]}</td>)}
                        <td className="py-2 pl-2 text-right font-semibold">{d.total}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </Card>
        )}
      </div>
    </DashboardLayout>
  )
}
