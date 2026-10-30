/**
 * Finances - beaters' pay, captain only.
 *
 * What's owed comes from completed shoot days: each beater booked and marked Confirmed
 * on a completed day is owed their booked day rate (server/beaterPay.ts). Money from the
 * API is in pence. The captain pays through their own bank, then marks the beater paid
 * here with the bank reference. The export lists everyone owed, ready for the bank.
 */

import { useCallback, useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { Helmet } from 'react-helmet-async'
import { useCanWrite, useCaptainSyndicate } from '../../context/SyndicateContext'
import { apiPath, apiRequest } from '../../lib/api'
import DashboardLayout from '../../components/layout/DashboardLayout'
import Card, { StatCard } from '../../components/common/Card'
import Button from '../../components/common/Button'
import LoadingSpinner from '../../components/common/LoadingSpinner'
import { formatCurrency } from '../../config/stripe'
import { toCsv } from '../../utils/csv'
import { formatDayMonth } from '../../utils/dateHelpers'

interface Owed {
  paymentId: string
  amount: number
  shootDate: string
  locationName: string
}

interface BeaterPay {
  id: string
  name: string
  email?: string | null
  phone?: string | null
  status: string
  bankName?: string | null
  bankDetailsOnFile: boolean
  bankAccountLast4: string | null
  dayRatePence: number
  daysWorked: number
  daysThisTaxYear: number
  daysExpectedThisTaxYear: number
  casualLimit: 'under' | 'atLimit' | 'expectedOver' | 'over'
  totalEarned: number
  totalPaid: number
  totalOutstanding: number
  owed: Owed[]
}

interface BankExportRow {
  beaterId: string
  name: string
  bankName: string | null
  sortCode: string | null
  accountNumber: string | null
  unreadable: boolean
  owedPence: number
  days: number
}

interface PaySummary {
  beaters: BeaterPay[]
  totals: { totalOutstanding: number; totalPaid: number; totalEarned: number }
  taxYear: { start: string; end: string }
  casualDayLimit: number
}

const taxYearLabel = (start: string) => {
  const y = new Date(start).getUTCFullYear()
  return `${y}/${String((y + 1) % 100).padStart(2, '0')}`
}

export default function Finances() {
  const { id: syndicateId } = useCaptainSyndicate()
  const canWrite = useCanWrite()
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [data, setData] = useState<PaySummary | null>(null)
  const [payingId, setPayingId] = useState<string | null>(null)
  const [reference, setReference] = useState('')
  const [saving, setSaving] = useState(false)
  const [notice, setNotice] = useState<string | null>(null)
  const [exporting, setExporting] = useState(false)
  // Numbers shown on request, one beater at a time; forgotten when the page is left.
  const [shown, setShown] = useState<Record<string, { sortCode: string; accountNumber: string }>>({})

  const load = useCallback(async (id: string) => {
    const result = await apiRequest<PaySummary>(apiPath('/api/beaters/payments/summary', { syndicateId: id }))
    if (result.ok) {
      setData(result.data)
      setError(null)
    } else {
      setError(`Could not load beaters’ pay. ${result.error}`)
    }
  }, [])

  useEffect(() => {
    ;(async () => {
      setLoading(true)
      await load(syndicateId)
      setLoading(false)
    })()
  }, [syndicateId, load])

  const markPaid = async (beater: BeaterPay) => {
    setSaving(true)
    setError(null)
    const result = await apiRequest<{ total?: number }>(`/api/beaters/${encodeURIComponent(beater.id)}/pay`, {
      method: 'POST',
      // Exactly what's on screen: if any amount has changed since, nothing is marked.
      body: {
        payments: beater.owed.map((o) => ({ paymentId: o.paymentId, amount: o.amount })),
        paymentReference: reference.trim() || undefined,
      },
    })
    if (result.ok) {
      setNotice(`${beater.name} marked paid ${formatCurrency(result.data?.total ?? beater.totalOutstanding)}.`)
      setPayingId(null)
      setReference('')
      await load(syndicateId)
    } else if (result.status === 409) {
      await load(syndicateId)
      setPayingId(null)
      setError(`Nothing marked paid: what ${beater.name} is owed has changed. The amounts below are up to date; check them against your bank before marking paid.`)
    } else {
      setError(`Not saved: ${beater.name} is still shown as owed. ${result.error}`)
    }
    setSaving(false)
  }

  const showBankDetails = async (beater: BeaterPay) => {
    setError(null)
    const result = await apiRequest<{ sortCode: string; accountNumber: string }>(`/api/beaters/${encodeURIComponent(beater.id)}/bank-details/reveal`, { method: 'POST' })
    if (result.ok) setShown((current) => ({ ...current, [beater.id]: result.data }))
    else setError(`Couldn’t show ${beater.name}’s bank details. ${result.error}`)
  }

  const exportForBank = async () => {
    setExporting(true)
    setError(null)
    // The numbers come from the server for this export only, and the export is recorded.
    const result = await apiRequest<{ rows: BankExportRow[] }>('/api/beaters/payments/bank-export', { method: 'POST', body: { syndicateId } })
    setExporting(false)
    if (!result.ok) {
      setError(`Couldn’t export for the bank. ${result.error}`)
      return
    }
    const header = ['Name', 'Bank', 'Sort code', 'Account number', 'Amount (£)', 'Days', 'Reference']
    const rows = result.data.rows.map((b) => [
      b.name,
      b.bankName ?? '',
      b.sortCode ?? '',
      b.accountNumber ?? '',
      (b.owedPence / 100).toFixed(2),
      String(b.days),
      'Beating',
    ])
    const csv = toCsv([header, ...rows])
    const unreadable = result.data.rows.filter((r) => r.unreadable).map((r) => r.name)
    if (unreadable.length) {
      setError(`Exported, but ${unreadable.join(', ')} ${unreadable.length === 1 ? 'is' : 'are'} in it without bank details: theirs can’t be opened. Ask for them again and enter them on the Beaters page.`)
    }
    // The byte-order mark makes Excel read names with accents and apostrophes correctly.
    const url = URL.createObjectURL(new Blob(['\uFEFF' + csv], { type: 'text/csv;charset=utf-8' }))
    const link = document.createElement('a')
    link.href = url
    link.download = `beaters-owed-${new Date().toISOString().slice(0, 10)}.csv`
    link.click()
    // Some browsers cancel a download whose address is withdrawn at once.
    setTimeout(() => URL.revokeObjectURL(url), 60_000)
  }

  if (loading) {
    return (
      <DashboardLayout>
        <div className="flex justify-center items-center h-64">
          <LoadingSpinner size="lg" />
        </div>
      </DashboardLayout>
    )
  }

  const totals = data?.totals ?? { totalOutstanding: 0, totalPaid: 0, totalEarned: 0 }
  const owedCount = data?.beaters.filter((b) => b.totalOutstanding > 0).length ?? 0
  const owedWithoutBank = data?.beaters.filter((b) => b.totalOutstanding > 0 && !b.bankDetailsOnFile) ?? []

  return (
    <>
      <Helmet>
        <title>Beaters’ Pay | ShootSync</title>
        <meta name="robots" content="noindex, nofollow" />
      </Helmet>

      <DashboardLayout>
        <div className="space-y-6 max-w-4xl">
          <div className="flex flex-wrap justify-between items-start gap-4">
            <div>
              <h1 className="text-2xl font-bold text-white">Beaters’ pay</h1>
              <p className="text-slate-400">
                What’s owed comes from completed shoot days: every beater marked Confirmed is owed their day rate.
              </p>
            </div>
            <Button variant="secondary" onClick={() => void exportForBank()} disabled={owedCount === 0 || exporting}>
              {exporting ? 'Preparing…' : 'Export for bank'}
            </Button>
          </div>

          {error && (
            <p role="alert" className="rounded-lg px-4 py-3 bg-red-900/40 text-red-200 border border-red-800">
              {error}
            </p>
          )}
          {notice && (
            <p role="status" className="rounded-lg px-4 py-3 bg-green-900/40 text-green-200 border border-green-800">
              {notice}
            </p>
          )}

          {owedCount > 0 && (
            <p className="text-sm text-slate-400">
              The export lists each beater, what they’re owed and their bank details, one row each, ready for
              your bank’s bulk payment page or to pay one by one. Banks differ in the file they accept, so check
              yours before uploading it as it is. Opening and re-saving it in Excel can strip leading zeros from
              account numbers. Bank details are kept sealed: each export, and each time they’re shown, is recorded
              in the syndicate’s activity log. Delete the file once you’ve paid.
              {owedWithoutBank.length > 0 &&
                ` ${owedWithoutBank.map((b) => b.name).join(', ')} ${owedWithoutBank.length === 1 ? 'has' : 'have'} no bank details yet, so ${owedWithoutBank.length === 1 ? 'is' : 'are'} exported without them.`}
            </p>
          )}

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <StatCard title="Owed now" value={formatCurrency(totals.totalOutstanding)} subtitle={`${owedCount} ${owedCount === 1 ? 'beater' : 'beaters'}`} />
            <StatCard title="Paid so far" value={formatCurrency(totals.totalPaid)} subtitle="Marked paid" />
            <StatCard title="Total earned" value={formatCurrency(totals.totalEarned)} subtitle="All completed days" />
          </div>

          {data && data.beaters.length === 0 && (
            <Card>
              <p className="text-slate-300">
                No beaters yet. Add your beating team under <Link to="/beaters" className="text-green-400 underline">Beaters</Link>, book
                them onto a shoot day, and mark the day complete afterwards.
              </p>
            </Card>
          )}

          {data?.beaters.map((beater) => (
            <Card key={beater.id}>
              <div className="flex flex-wrap justify-between gap-4">
                <div className="min-w-0">
                  <h2 className="text-lg font-semibold text-white">
                    {beater.name}
                    {beater.status !== 'ACTIVE' && <span className="ml-2 text-xs text-slate-400">(inactive)</span>}
                  </h2>
                  <p className="text-sm text-slate-400">
                    {formatCurrency(beater.dayRatePence)} a day · {beater.daysWorked} {beater.daysWorked === 1 ? 'day' : 'days'} worked ·{' '}
                    {beater.daysThisTaxYear} in the {taxYearLabel(data.taxYear.start)} tax year
                    {beater.daysExpectedThisTaxYear > beater.daysThisTaxYear &&
                      ` (${beater.daysExpectedThisTaxYear} with days booked)`}
                  </p>
                  {beater.casualLimit !== 'under' && (
                    <p className="mt-2 text-sm text-amber-300 border-l-2 border-amber-500 pl-3">
                      {beater.casualLimit === 'over'
                        ? `Over ${data.casualDayLimit} days this tax year. Under HMRC’s casual beaters rules, PAYE applies.`
                        : beater.casualLimit === 'expectedOver'
                          ? `Days booked will take them over ${data.casualDayLimit} this tax year. HMRC’s rules look at days expected, so PAYE applies.`
                          : `At ${data.casualDayLimit} days this tax year. One more day takes them over HMRC’s casual limit, and PAYE applies.`}{' '}
                      <Link to="/guides/paying-beaters-and-pickers-up#tax" className="underline">What that means</Link>
                    </p>
                  )}
                  <p className="mt-2 text-sm text-slate-400">
                    {!beater.bankDetailsOnFile ? (
                      'No bank details yet'
                    ) : shown[beater.id] ? (
                      `${beater.bankName ?? 'Bank'} · ${shown[beater.id].sortCode} · ${shown[beater.id].accountNumber}`
                    ) : (
                      <>
                        {`${beater.bankName ?? 'Bank'} · account ending ${beater.bankAccountLast4 ?? '····'}`}{' '}
                        <button type="button" onClick={() => void showBankDetails(beater)} className="underline text-slate-300 hover:text-white">
                          Show
                        </button>
                      </>
                    )}
                  </p>
                </div>
                <div className="text-right ml-auto">
                  <p className="text-2xl font-bold text-white">{formatCurrency(beater.totalOutstanding)}</p>
                  <p className="text-sm text-slate-400">{beater.totalOutstanding > 0 ? 'owed' : 'nothing owed'}</p>
                </div>
              </div>

              {beater.owed.length > 0 && (
                <>
                  <ul className="mt-4 divide-y divide-slate-700 text-sm">
                    {beater.owed.map((o) => (
                      <li key={o.paymentId} className="flex justify-between py-2 text-slate-300">
                        <span>
                          {formatDayMonth(o.shootDate)} · {o.locationName}
                        </span>
                        <span>{formatCurrency(o.amount)}</span>
                      </li>
                    ))}
                  </ul>

                  {payingId === beater.id ? (
                    <form
                      className="mt-4 flex flex-wrap items-end gap-3"
                      onSubmit={(e) => {
                        e.preventDefault()
                        markPaid(beater)
                      }}
                    >
                      <label className="flex-1 min-w-[12rem]">
                        <span className="block text-sm text-slate-300 mb-1">Bank reference (optional)</span>
                        <input
                          value={reference}
                          onChange={(e) => setReference(e.target.value)}
                          maxLength={100}
                          className="w-full px-3 py-2 bg-slate-900 border border-slate-600 rounded-lg text-white"
                          placeholder="e.g. BEATING DEC"
                          autoFocus
                        />
                      </label>
                      <Button type="submit" isLoading={saving} disabled={saving}>
                        Mark {formatCurrency(beater.totalOutstanding)} paid
                      </Button>
                      <Button type="button" variant="ghost" onClick={() => setPayingId(null)} disabled={saving}>
                        Cancel
                      </Button>
                    </form>
                  ) : (
                    <div className="mt-4">
                      <Button
                        size="sm"
                        disabled={!canWrite}
                        onClick={() => {
                          setPayingId(beater.id)
                          setReference('')
                          setNotice(null)
                        }}
                      >
                        Mark paid
                      </Button>
                    </div>
                  )}
                </>
              )}
            </Card>
          ))}
        </div>
      </DashboardLayout>
    </>
  )
}
