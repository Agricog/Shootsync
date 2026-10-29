/**
 * Beaters on a shoot day - captain only (on the Shoot Detail page).
 *
 * Book beaters from the syndicate's beating team, then keep each one's status up to
 * date: Asked, Confirmed, Can't make it, Didn't turn up. When the day is marked complete,
 * everyone Confirmed is owed their day rate (server/beaterPay.ts) and appears under
 * Finances. Once a beater has been marked paid for the day, their booking is locked.
 */

import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import Card from '../common/Card'
import Button from '../common/Button'
import { formatCurrency } from '../../config/stripe'
import { apiPath, apiRequest } from '../../lib/api'

export interface Booking {
  id: string
  dayRate: number
  status: 'INVITED' | 'CONFIRMED' | 'DECLINED' | 'NO_SHOW'
  beater: { id: string; name: string; phone?: string | null }
}

export interface PaymentLine {
  beaterId: string
  amount: number
  status: string
}

interface BeaterOption {
  id: string
  name: string
  dayRate: number
}

interface Props {
  shootId: string
  syndicateId: string
  shootStatus: string
  /** The plan has lapsed: show the bookings, change nothing. */
  readOnly?: boolean
  bookings: Booking[]
  payments: PaymentLine[]
  onChanged: () => Promise<void>
}

const STATUS_LABEL: Record<Booking['status'], string> = {
  INVITED: 'Asked',
  CONFIRMED: 'Confirmed',
  DECLINED: 'Can’t make it',
  NO_SHOW: 'Didn’t turn up',
}

/** null when it worked, otherwise what to tell the captain. */
async function send(path: string, method: string, body?: unknown): Promise<string | null> {
  const result = await apiRequest<unknown>(path, { method: method as 'POST' | 'PATCH' | 'DELETE', body })
  return result.ok ? null : result.error
}

const field = 'px-2 py-1.5 bg-slate-900 border border-slate-600 rounded-lg text-white text-sm focus:outline-none focus:ring-2 focus:ring-green-500 disabled:opacity-60 disabled:cursor-not-allowed'

export default function ShootBeaters({ shootId, syndicateId, shootStatus, readOnly = false, bookings, payments, onChanged }: Props) {
  const [team, setTeam] = useState<BeaterOption[]>([])
  const [adding, setAdding] = useState(false)
  const [chosen, setChosen] = useState<Set<string>>(new Set())
  const [busy, setBusy] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  // Bumped after a failed change, so edited fields snap back to what is saved.
  const [revision, setRevision] = useState(0)
  const [confirmRemove, setConfirmRemove] = useState<string | null>(null)

  const cancelled = shootStatus === 'CANCELLED'
  const completed = shootStatus === 'COMPLETED'
  // Nothing can be changed on a cancelled day, or while the plan has lapsed.
  const locked = cancelled || readOnly
  const booked = new Set(bookings.map((b) => b.beater.id))
  const available = team.filter((b) => !booked.has(b.id))
  const paymentFor = (beaterId: string) => payments.find((p) => p.beaterId === beaterId)

  useEffect(() => {
    if (!adding) return
    ;(async () => {
      const result = await apiRequest<BeaterOption[]>(apiPath('/api/beaters', { syndicateId, status: 'ACTIVE' }))
      if (result.ok) setTeam(result.data)
      else setError(`Could not load your beating team. ${result.error}`)
    })()
  }, [adding, syndicateId])

  const run = async (key: string, path: string, method: string, body?: unknown) => {
    setBusy(key)
    setError(null)
    const problem = await send(path, method, body)
    // Keep controls locked until the day has reloaded, so nothing is changed from stale data.
    await onChanged()
    if (problem) {
      setError(problem)
      setRevision((r) => r + 1)
    }
    setBusy(null)
    return !problem
  }

  const book = async () => {
    if (chosen.size === 0) return
    const ok = await run('book', `/api/shoots/${encodeURIComponent(shootId)}/beaters`, 'POST', { beaterIds: [...chosen] })
    if (ok) {
      setChosen(new Set())
      setAdding(false)
    }
  }

  const bookingPath = (id: string) => `/api/shoots/${encodeURIComponent(shootId)}/beaters/${encodeURIComponent(id)}`
  const confirmedCount = bookings.filter((b) => b.status === 'CONFIRMED').length
  const askedCount = bookings.filter((b) => b.status === 'INVITED').length

  return (
    <Card>
      <div className="flex flex-wrap justify-between items-center gap-3 mb-2">
        <h2 className="text-lg font-semibold text-green-500">
          Beaters ({confirmedCount} confirmed{askedCount > 0 ? `, ${askedCount} asked` : ''})
        </h2>
        {!locked && !adding && (
          <Button size="sm" onClick={() => setAdding(true)}>
            Book beaters
          </Button>
        )}
      </div>
      <p className="text-sm text-slate-400 mb-4">
        {completed
          ? 'This day is complete: everyone Confirmed is owed their day rate, shown under Finances.'
          : 'Ring or text your beaters, then mark how each one stands. When the day is complete, everyone Confirmed is owed their day rate.'}
      </p>

      {error && (
        <p role="alert" className="mb-4 rounded-lg px-3 py-2 bg-red-900/40 text-red-200 border border-red-800 text-sm">
          {error}
        </p>
      )}

      {adding && (
        <div className="mb-6 p-4 bg-slate-900 rounded-lg">
          {team.length === 0 ? (
            <p className="text-slate-300 text-sm">
              No active beaters yet. Add your beating team under <Link to="/beaters" className="text-green-400 underline">Beaters</Link>.
            </p>
          ) : available.length === 0 ? (
            <p className="text-slate-300 text-sm">Everyone in your beating team is already booked for this day.</p>
          ) : (
            <fieldset>
              <legend className="text-white font-medium mb-3">Who are you asking?</legend>
              <div className="grid sm:grid-cols-2 gap-2">
                {available.map((beater) => (
                  <label key={beater.id} className="flex items-center gap-3 p-2 rounded hover:bg-slate-800 cursor-pointer">
                    <input
                      type="checkbox"
                      className="h-5 w-5 accent-green-600"
                      checked={chosen.has(beater.id)}
                      onChange={() => {
                        const next = new Set(chosen)
                        if (next.has(beater.id)) next.delete(beater.id)
                        else next.add(beater.id)
                        setChosen(next)
                      }}
                    />
                    <span className="text-white">{beater.name}</span>
                    <span className="text-slate-400 text-sm ml-auto">£{beater.dayRate}</span>
                  </label>
                ))}
              </div>
            </fieldset>
          )}
          <div className="flex gap-3 mt-4">
            {available.length > 0 && (
              <Button size="sm" onClick={book} isLoading={busy === 'book'} disabled={busy !== null || chosen.size === 0}>
                {chosen.size === 0 ? 'Book beaters' : `Book ${chosen.size} ${chosen.size === 1 ? 'beater' : 'beaters'}`}
              </Button>
            )}
            <Button size="sm" variant="ghost" onClick={() => setAdding(false)} disabled={busy !== null}>
              Close
            </Button>
          </div>
        </div>
      )}

      {bookings.length === 0 ? (
        <p className="text-slate-400">No beaters booked yet.</p>
      ) : (
        <ul className="space-y-2">
          {bookings.map((booking) => {
            const payment = paymentFor(booking.beater.id)
            const paid = payment?.status === 'PAID'
            return (
              <li key={booking.id} className="flex flex-wrap items-center gap-3 p-3 bg-slate-900 rounded-lg">
                <div className="min-w-0 flex-1">
                  <p className="text-white font-medium">{booking.beater.name}</p>
                  {booking.beater.phone && (
                    <a href={`tel:${booking.beater.phone}`} className="text-sm text-slate-400 hover:text-white">
                      {booking.beater.phone}
                    </a>
                  )}
                </div>

                {paid ? (
                  <span className="text-sm text-green-300">Paid {formatCurrency(payment.amount)} ✓</span>
                ) : (
                  <>
                    <label className="flex items-center gap-1 text-sm text-slate-400">
                      £
                      <input
                        key={`${booking.id}-${booking.dayRate}-${revision}`}
                        type="number"
                        inputMode="numeric"
                        min={0}
                        max={1000}
                        defaultValue={booking.dayRate}
                        aria-label={`Day rate for ${booking.beater.name}`}
                        disabled={busy !== null || locked}
                        onBlur={(e) => {
                          const value = Number(e.target.value)
                          if (!Number.isInteger(value) || value < 0 || value > 1000) {
                            setError('Day rate must be whole pounds, from £0 to £1,000.')
                            setRevision((r) => r + 1)
                          } else if (value !== booking.dayRate) {
                            run(booking.id, bookingPath(booking.id), 'PATCH', { dayRate: value })
                          }
                        }}
                        className={`w-20 ${field}`}
                      />
                    </label>
                    <select
                      value={booking.status}
                      aria-label={`Status for ${booking.beater.name}`}
                      disabled={busy !== null || locked}
                      onChange={(e) => run(booking.id, bookingPath(booking.id), 'PATCH', { status: e.target.value })}
                      className={field}
                    >
                      {(Object.keys(STATUS_LABEL) as Booking['status'][]).map((status) => (
                        <option key={status} value={status}>
                          {STATUS_LABEL[status]}
                        </option>
                      ))}
                    </select>
                    {payment && <span className="text-sm text-amber-300">Owed {formatCurrency(payment.amount)}</span>}
                    {!locked && (
                      <button
                        type="button"
                        onClick={() => {
                          // On a completed day removing someone cancels what they're owed: ask once more.
                          if (payment && confirmRemove !== booking.id) {
                            setConfirmRemove(booking.id)
                            return
                          }
                          setConfirmRemove(null)
                          run(booking.id, bookingPath(booking.id), 'DELETE')
                        }}
                        disabled={busy !== null}
                        className="text-sm text-red-400 hover:text-red-300 disabled:opacity-50"
                      >
                        {confirmRemove === booking.id ? `Remove and cancel ${formatCurrency(payment?.amount ?? 0)} owed?` : 'Remove'}
                      </button>
                    )}
                  </>
                )}
              </li>
            )
          })}
        </ul>
      )}
    </Card>
  )
}
