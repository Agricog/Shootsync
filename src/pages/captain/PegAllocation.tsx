/**
 * Peg draw - captain only.
 *
 * 1. Pick a shoot day. Its saved pegs and each gun's pegs so far this season load
 *    from the server (GET /api/shoots/:id/pegs).
 * 2. Tick who is shooting and set the number of pegs.
 * 3. Draw (POST /api/shoots/:id/pegs/draw). The fair draw runs on the server against
 *    the season's saved pegs, so it can't be fed a wrong or missing history.
 * 4. Adjust any gun's peg by hand: choosing a peg someone else holds swaps the two.
 * 5. Save the whole list at once (PUT /api/shoots/:id/pegs). It all saves or none of it does.
 */

import { useEffect, useMemo, useRef, useState } from 'react'
import { useSearchParams } from 'react-router-dom'
import { Helmet } from 'react-helmet-async'
import { useCanWrite, useCaptainSyndicate } from '../../context/SyndicateContext'
import { apiPath, apiRequest as api } from '../../lib/api'
import DashboardLayout from '../../components/layout/DashboardLayout'
import Card from '../../components/common/Card'
import Button from '../../components/common/Button'
import LoadingSpinner from '../../components/common/LoadingSpinner'

interface ShootOption {
  id: string
  date: string
  locationName: string
  status: string
}

interface Gun {
  id: string
  name: string
  role: string
  history: { pegNumber: number; shootDate: string }[]
}

interface Allocation {
  memberId: string
  pegNumber: number
}

interface PegSheet {
  shoot: ShootOption
  guns: Gun[]
  saved: Allocation[]
}

const shortDate = (iso: string) =>
  new Date(iso).toLocaleDateString('en-GB', { weekday: 'short', day: 'numeric', month: 'short', year: 'numeric' })

const text = 'text-white'
const muted = 'text-slate-400'
const field =
  'px-3 py-2 bg-slate-900 border border-slate-600 rounded-lg text-white focus:outline-none focus:ring-2 focus:ring-green-500 disabled:opacity-60 disabled:cursor-not-allowed'

export default function PegAllocation() {
  const syndicate = useCaptainSyndicate()
  const canWrite = useCanWrite()
  const [searchParams, setSearchParams] = useSearchParams()
  const shootIdParam = searchParams.get('shootId')

  const [loading, setLoading] = useState(true)
  const [loadError, setLoadError] = useState<string | null>(null)
  const [shoots, setShoots] = useState<ShootOption[]>([])
  const [shootId, setShootId] = useState<string | null>(shootIdParam)

  const [sheet, setSheet] = useState<PegSheet | null>(null)
  const [sheetLoading, setSheetLoading] = useState(false)
  const [shooting, setShooting] = useState<Set<string>>(new Set())
  const [numberOfPegs, setNumberOfPegs] = useState(1)
  // The syndicate's usual draw (Settings) is shown first; both are always available.
  const [preferRandom, setPreferRandom] = useState(false)
  const [allocations, setAllocations] = useState<Allocation[]>([])
  const [dirty, setDirty] = useState(false)

  const [busy, setBusy] = useState<'fair' | 'random' | 'save' | null>(null)
  // The shoot on screen now: a draw or save that finishes after the captain has moved
  // to another shoot day is ignored, so it can never land on the wrong day.
  const currentShoot = useRef<string | null>(shootId)
  currentShoot.current = shootId
  const [message, setMessage] = useState<{ kind: 'error' | 'success'; text: string } | null>(null)

  // The syndicate's shoot days.
  useEffect(() => {
    let cancelled = false
    ;(async () => {
      setLoading(true)
      setLoadError(null)
      setPreferRandom(syndicate.pegRotationRule === 'RANDOM')
      const list = await api<ShootOption[]>(apiPath('/api/shoots', { syndicateId: syndicate.id }))
      if (cancelled) return
      if (list.ok) setShoots(list.data.filter((s) => s.status !== 'CANCELLED'))
      else setLoadError(list.error)
      setLoading(false)
    })()
    return () => {
      cancelled = true
    }
  }, [syndicate.id, syndicate.pegRotationRule])

  // The chosen day's pegs and every gun's record this season.
  useEffect(() => {
    setSheet(null)
    setAllocations([])
    setDirty(false)
    setMessage(null)
    setSheetLoading(false)
    if (!shootId) return
    let cancelled = false
    ;(async () => {
      setSheetLoading(true)
      const result = await api<PegSheet>(`/api/shoots/${encodeURIComponent(shootId)}/pegs`)
      if (cancelled) return
      setSheetLoading(false)
      if (!result.ok) {
        setMessage({ kind: 'error', text: result.error })
        return
      }
      const data = result.data
      // Only active guns can hold a peg. Anyone saved here who has since left the
      // syndicate drops off the list and loses the peg when the captain next saves.
      const gunIds = new Set(data.guns.map((g) => g.id))
      const current = data.saved.filter((a) => gunIds.has(a.memberId))
      setSheet(data)
      setAllocations(current)
      if (current.length < data.saved.length) {
        setDirty(true)
        setMessage({ kind: 'error', text: 'Someone with a saved peg here is no longer an active gun. Check the list and save again.' })
      }
      const chosen = new Set(current.length > 0 ? current.map((a) => a.memberId) : data.guns.map((g) => g.id))
      setShooting(chosen)
      const highestSaved = Math.max(0, ...current.map((a) => a.pegNumber))
      setNumberOfPegs(Math.max(1, chosen.size, highestSaved))
    })()
    return () => {
      cancelled = true
    }
  }, [shootId])

  const gunsById = useMemo(() => new Map((sheet?.guns ?? []).map((g) => [g.id, g])), [sheet])

  const chooseShoot = (id: string) => {
    setShootId(id || null)
    setSearchParams(id ? { shootId: id } : {}, { replace: true })
  }

  const toggleGun = (id: string) => {
    const next = new Set(shooting)
    if (next.has(id)) next.delete(id)
    else next.add(id)
    setShooting(next)
    setNumberOfPegs((pegs) => Math.max(pegs, next.size, 1))
  }

  const draw = async (method: 'fair' | 'random') => {
    if (!shootId) return
    setMessage(null)
    if (shooting.size === 0) {
      setMessage({ kind: 'error', text: 'Tick at least one gun who is shooting.' })
      return
    }
    if (shooting.size > numberOfPegs) {
      setMessage({ kind: 'error', text: `There are ${shooting.size} guns shooting but only ${numberOfPegs} pegs.` })
      return
    }
    setBusy(method)
    const result = await api<{ allocations: Allocation[] }>(`/api/shoots/${encodeURIComponent(shootId)}/pegs/draw`, {
      method: 'POST',
      body: { method, numberOfPegs, memberIds: [...shooting] },
    })
    setBusy(null)
    if (currentShoot.current !== shootId) return
    if (!result.ok) {
      setMessage({ kind: 'error', text: result.error })
      return
    }
    setAllocations(result.data.allocations)
    setDirty(true)
  }

  /** Move a gun to a peg. If someone else holds it, the two swap. */
  const setPeg = (memberId: string, pegNumber: number) => {
    setAllocations((current) => {
      const mine = current.find((a) => a.memberId === memberId)
      if (!mine || mine.pegNumber === pegNumber) return current
      return current
        .map((a) => {
          if (a.memberId === memberId) return { ...a, pegNumber }
          if (a.pegNumber === pegNumber) return { ...a, pegNumber: mine.pegNumber }
          return a
        })
        .sort((a, b) => a.pegNumber - b.pegNumber)
    })
    setDirty(true)
  }

  const save = async () => {
    if (!shootId) return
    setBusy('save')
    setMessage(null)
    const result = await api<{ saved: Allocation[] }>(`/api/shoots/${encodeURIComponent(shootId)}/pegs`, {
      method: 'PUT',
      body: { allocations },
    })
    setBusy(null)
    if (currentShoot.current !== shootId) return
    if (!result.ok) {
      setMessage({ kind: 'error', text: `Not saved: ${result.error}` })
      return
    }
    setAllocations(result.data.saved)
    setSheet((s) => (s ? { ...s, saved: result.data.saved } : s))
    setDirty(false)
    setMessage({ kind: 'success', text: 'Pegs saved. They show on the shoot day and on the briefing sheet.' })
  }

  const pegChoices = Array.from({ length: Math.max(numberOfPegs, ...allocations.map((a) => a.pegNumber)) }, (_, i) => i + 1)

  if (loading) {
    return (
      <DashboardLayout>
        <div className="flex justify-center items-center h-64">
          <LoadingSpinner size="lg" />
        </div>
      </DashboardLayout>
    )
  }

  return (
    <DashboardLayout>
      <Helmet>
        <title>Peg Draw | ShootSync</title>
      </Helmet>

      <div className="space-y-6 max-w-3xl">
        <div>
          <h1 className="text-2xl font-bold text-white">Peg draw</h1>
          <p className="mt-1 text-slate-400">
            Draw each gun’s starting peg for a shoot day. The fair draw gives each gun the pegs they have had least
            this season.
          </p>
        </div>

        {loadError && (
          <p role="alert" className="text-red-400">
            {loadError}
          </p>
        )}

        <Card>
          <label htmlFor="shoot" className={`block text-sm font-medium mb-2 ${text}`}>
            Shoot day
          </label>
          {shoots.length === 0 ? (
            <p className={muted}>No shoot days yet. Add one under Shoots first.</p>
          ) : (
            <select id="shoot" value={shootId ?? ''} onChange={(e) => chooseShoot(e.target.value)} className={`w-full ${field}`}>
              <option value="">Choose a shoot day</option>
              {shoots.map((shoot) => (
                <option key={shoot.id} value={shoot.id}>
                  {shortDate(shoot.date)} · {shoot.locationName}
                  {shoot.status === 'COMPLETED' ? ' (completed)' : ''}
                </option>
              ))}
            </select>
          )}
        </Card>

        {message && !sheet && (
          <p
            role={message.kind === 'error' ? 'alert' : 'status'}
            className={`rounded-lg px-4 py-3 ${message.kind === 'error' ? 'bg-red-900/40 text-red-200 border border-red-800' : 'bg-green-900/40 text-green-200 border border-green-800'}`}
          >
            {message.text}
          </p>
        )}

        {sheetLoading && (
          <div className="flex justify-center py-8">
            <LoadingSpinner />
          </div>
        )}

        {sheet && (
          <>
            <Card>
              <h2 className={`text-lg font-semibold mb-1 ${text}`}>Who is shooting?</h2>
              {sheet.guns.length === 0 ? (
                <p className={muted}>No active guns yet. Add your guns under Members, and mark them active.</p>
              ) : (
                <>
                  <p className={`text-sm mb-4 ${muted}`}>
                    Untick anyone not out on this day. Pegs so far are from saved draws this season, before this day.
                  </p>
                  <ul className="divide-y divide-slate-700">
                    {sheet.guns.map((gun) => (
                      <li key={gun.id} className="py-2">
                        <label className="flex items-start gap-3 cursor-pointer">
                          <input
                            type="checkbox"
                            checked={shooting.has(gun.id)}
                            onChange={() => toggleGun(gun.id)}
                            className="mt-1 h-5 w-5 accent-green-600"
                          />
                          <span>
                            <span className={`font-medium ${text}`}>{gun.name}</span>
                            <span className={`block text-sm ${muted}`}>
                              {gun.history.length === 0
                                ? 'No pegs yet this season'
                                : `Pegs so far: ${gun.history.map((h) => h.pegNumber).join(', ')} (${gun.history.length} ${gun.history.length === 1 ? 'day' : 'days'})`}
                            </span>
                          </span>
                        </label>
                      </li>
                    ))}
                  </ul>

                  <div className="mt-6 flex flex-wrap items-end gap-4">
                    <div>
                      <label htmlFor="pegs" className={`block text-sm font-medium mb-1 ${text}`}>
                        Number of pegs
                      </label>
                      <input
                        id="pegs"
                        type="number"
                        inputMode="numeric"
                        min={Math.max(1, shooting.size)}
                        max={40}
                        value={numberOfPegs}
                        onChange={(e) => {
                          const n = Number.parseInt(e.target.value, 10)
                          if (Number.isFinite(n)) setNumberOfPegs(Math.min(40, Math.max(1, n)))
                        }}
                        className={`w-24 ${field}`}
                      />
                    </div>
                    {(preferRandom ? (['random', 'fair'] as const) : (['fair', 'random'] as const)).map((method, index) => (
                      <Button
                        key={method}
                        variant={index === 0 ? 'primary' : 'secondary'}
                        onClick={() => draw(method)}
                        isLoading={busy === method}
                        disabled={busy !== null || !canWrite}
                      >
                        {method === 'fair' ? 'Fair draw' : 'Random draw'}
                      </Button>
                    ))}
                  </div>
                  <p className={`mt-3 text-sm ${muted}`}>
                    <strong>Fair draw:</strong> across the whole line, guns are kept off pegs they have already stood on
                    this season as far as possible; ties are drawn at random. <strong>Random draw:</strong> a straight
                    draw, ignoring the season so far.
                  </p>
                </>
              )}
            </Card>


            {message && (
              <p
                role={message.kind === 'error' ? 'alert' : 'status'}
                className={`rounded-lg px-4 py-3 ${message.kind === 'error' ? 'bg-red-900/40 text-red-200 border border-red-800' : 'bg-green-900/40 text-green-200 border border-green-800'}`}
              >
                {message.text}
              </p>
            )}

            {allocations.length > 0 && (
              <Card>
                <div className="flex flex-wrap justify-between items-center gap-3 mb-4">
                  <div>
                    <h2 className={`text-lg font-semibold ${text}`}>Pegs for this day</h2>
                    <p className={`text-sm ${muted}`}>
                      {dirty ? 'Not saved yet.' : 'Saved.'} Change a peg to swap two guns.
                    </p>
                  </div>
                  <Button onClick={save} isLoading={busy === 'save'} disabled={busy !== null || !dirty || !canWrite}>
                    Save pegs
                  </Button>
                </div>
                <ol className="space-y-2">
                  {allocations.map((allocation) => {
                    const gun = gunsById.get(allocation.memberId)
                    const had = gun?.history.filter((h) => h.pegNumber === allocation.pegNumber).length ?? 0
                    return (
                      <li key={allocation.memberId} className="flex items-center justify-between gap-3 p-3 bg-slate-900 rounded-lg">
                        <div className="flex items-center gap-3 min-w-0">
                          <span className="w-11 h-11 shrink-0 flex items-center justify-center bg-green-600 text-white rounded-full font-bold text-lg" aria-hidden="true">
                            {allocation.pegNumber}
                          </span>
                          <div className="min-w-0">
                            <p className={`font-medium truncate ${text}`}>{gun?.name ?? 'Former member'}</p>
                            <p className={`text-xs ${muted}`}>
                              {had === 0 ? 'First time on this peg this season' : had === 1 ? 'Had this peg once before this season' : `Had this peg ${had} times before this season`}
                            </p>
                          </div>
                        </div>
                        <label className="flex items-center gap-2 shrink-0">
                          <span className={`text-sm ${muted}`}>Peg</span>
                          <select
                            value={allocation.pegNumber}
                            onChange={(e) => setPeg(allocation.memberId, Number(e.target.value))}
                            disabled={!canWrite}
                            className={field}
                            aria-label={`Peg for ${gun?.name ?? 'this gun'}`}
                          >
                            {pegChoices.map((peg) => (
                              <option key={peg} value={peg}>
                                {peg}
                              </option>
                            ))}
                          </select>
                        </label>
                      </li>
                    )
                  })}
                </ol>
              </Card>
            )}
          </>
        )}
      </div>
    </DashboardLayout>
  )
}
