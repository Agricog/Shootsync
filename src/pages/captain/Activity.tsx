/**
 * Activity log - captain only.
 *
 * Every change to the syndicate's records, newest first: what happened, to what, by whom and
 * which details changed (names of fields, never their values). Entries can't be edited by anyone;
 * they are removed only when the retention policy says their time is up (server/audit.ts).
 */

import { useCallback, useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { Helmet } from 'react-helmet-async'
import { useCaptainSyndicate } from '../../context/SyndicateContext'
import { apiPath, apiRequest } from '../../lib/api'
import DashboardLayout from '../../components/layout/DashboardLayout'
import Card from '../../components/common/Card'
import Button from '../../components/common/Button'
import LoadingSpinner from '../../components/common/LoadingSpinner'

interface Entry {
  id: string
  at: string
  action: string
  who: string
  target: string | null
  fields: string[]
}

/** Field names as a captain would say them. */
const FIELD_NAMES: Record<string, string> = {
  name: 'name', email: 'email', phone: 'phone', dayRate: 'day rate', bankName: 'bank', bankSortCode: 'bank details',
  bankAccountNumber: 'bank details', clearBankDetails: 'bank details removed', notes: 'notes', status: 'status', role: 'role',
  seasonStart: 'season start', seasonEnd: 'season end', defaultBeaterRate: 'default beater rate', pegRotationRule: 'peg rule',
  waiverExtra: 'guest clauses', subscriptionAmount: 'subscription', subscriptionType: 'subscription type', locationName: 'location',
  locationAddress: 'address', locationPostcode: 'postcode', locationWhat3words: 'what3words', meetTime: 'meet time',
  drivesPlanned: 'drives', expectedBag: 'expected bag', captainNotes: 'captain’s notes', weatherNotes: 'weather notes', date: 'date',
  pegNumber: 'peg', dayFee: 'day fee', paid: 'paid', allocations: 'pegs', payments: 'payments', paymentReference: 'reference',
  emergencyContactName: 'emergency contact', emergencyContactPhone: 'emergency contact', waiverAccepted: 'acknowledgement',
  pheasant: 'pheasant', partridge: 'partridge', duck: 'duck', woodcock: 'woodcock', other: 'other', otherDescription: 'other',
  driveNumber: 'drive', beaterIds: 'beaters', memberId: 'gun', shootId: 'day', planTier: 'plan', bascNumber: 'BASC number',
  insuranceExpiry: 'insurance expiry',
}

const when = (iso: string) =>
  new Date(iso).toLocaleString('en-GB', { day: 'numeric', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit', timeZone: 'Europe/London' })

export default function Activity() {
  const { id: syndicateId, name } = useCaptainSyndicate()
  const [entries, setEntries] = useState<Entry[]>([])
  const [more, setMore] = useState(false)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const load = useCallback(async (after?: string) => {
    const result = await apiRequest<{ entries: Entry[]; more: boolean }>(apiPath(`/api/syndicates/${encodeURIComponent(syndicateId)}/activity`, { after }))
    if (result.ok) {
      setEntries((current) => (after ? [...current, ...result.data.entries] : result.data.entries))
      setMore(result.data.more)
      setError(null)
    } else {
      setError(`Couldn’t load the activity log. ${result.error}`)
    }
  }, [syndicateId])

  useEffect(() => {
    ;(async () => {
      setLoading(true)
      await load()
      setLoading(false)
    })()
  }, [load])

  return (
    <>
      <Helmet>
        <title>Activity log | ShootSync</title>
        <meta name="robots" content="noindex, nofollow" />
      </Helmet>
      <DashboardLayout>
        <div className="space-y-6 max-w-4xl">
          <div>
            <p className="text-sm"><Link to="/settings" className="text-slate-400 hover:text-white">← Settings</Link></p>
            <h1 className="text-2xl font-bold text-white mt-1">Activity log</h1>
            <p className="text-slate-400">
              Every change to {name}’s records: what, by whom and when. Details that changed are named, never shown.
              Nobody can edit this log; entries are removed only when the retention periods in the privacy notice say so.
            </p>
          </div>
          {error && <p role="alert" className="rounded-lg px-4 py-3 bg-red-900/40 text-red-200 border border-red-800">{error}</p>}
          {loading ? (
            <div className="flex justify-center py-12"><LoadingSpinner size="lg" /></div>
          ) : entries.length === 0 && !error ? (
            <Card><p className="text-slate-300">Nothing has been recorded yet.</p></Card>
          ) : (
            <Card>
              <ul className="divide-y divide-slate-700">
                {entries.map((entry) => {
                  const fields = [...new Set(entry.fields.map((f) => FIELD_NAMES[f] ?? f))]
                  return (
                    <li key={entry.id} className="py-3 flex flex-col sm:flex-row sm:items-baseline gap-1 sm:gap-4">
                      <time dateTime={entry.at} className="text-sm text-slate-400 sm:w-44 shrink-0">{when(entry.at)}</time>
                      <div className="text-slate-200">
                        <span className="font-medium text-white">{entry.action}</span>
                        {entry.target && <span>: {entry.target}</span>}
                        <span className="text-slate-400"> · {entry.who}</span>
                        {fields.length > 0 && <p className="text-sm text-slate-400">Changed: {fields.join(', ')}</p>}
                      </div>
                    </li>
                  )
                })}
              </ul>
              {more && (
                <div className="pt-4">
                  <Button variant="secondary" onClick={() => void load(entries[entries.length - 1]?.id)}>Show older</Button>
                </div>
              )}
            </Card>
          )}
        </div>
      </DashboardLayout>
    </>
  )
}
