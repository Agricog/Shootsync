/**
 * Settings - captain only.
 *
 * Loads the captain's syndicate from the API and saves changes with PATCH
 * /api/syndicates/:id. Nothing here is hard-coded: what you see is what is saved.
 * The beaters' usual day rate is typed in pounds and pence and saved in pence.
 * Billing opens Stripe's customer portal, where the captain can update their card,
 * see invoices, or cancel.
 */

import { useEffect, useMemo, useState } from 'react'
import { Helmet } from 'react-helmet-async'
import { useSubscription } from '../../hooks/useSubscription'
import { useCanWrite, useCaptainSyndicate, useSyndicates } from '../../context/SyndicateContext'
import { apiRequest } from '../../lib/api'
import DashboardLayout from '../../components/layout/DashboardLayout'
import Card from '../../components/common/Card'
import Button, { ButtonLink } from '../../components/common/Button'
import LoadingSpinner from '../../components/common/LoadingSpinner'
import { PLANS } from '../../config/plans'
import { SITE } from '../../config/site'
import { settingsPayload, toForm, validateSettings, type SettingsForm as Form, type SyndicateSettings as Syndicate } from '../../utils/syndicateSettings'
import { minimumWageNote, parseDayRate } from '../../utils/dayRate'
import { londonDate } from '../../utils/beaterPayCalculator'


const label = 'block text-sm font-medium text-slate-300 mb-1'
const input =
  'w-full px-3 py-2 bg-slate-900 border border-slate-600 rounded-lg text-white focus:outline-none focus:ring-2 focus:ring-green-500 aria-[invalid=true]:border-red-500'

function Field({ id, title, hint, error, children }: { id: string; title: string; hint?: string; error?: string; children: React.ReactNode }) {
  return (
    <div>
      <label htmlFor={id} className={label}>
        {title}
      </label>
      {children}
      <p id={`${id}-note`} className={`mt-1 text-sm ${error ? 'text-red-400' : 'text-slate-400'}`}>
        {error ?? hint}
      </p>
    </div>
  )
}

export default function Settings() {
  const current = useCaptainSyndicate()
  const canWrite = useCanWrite()
  const { reload } = useSyndicates()
  const [loading, setLoading] = useState(true)
  const [loadError, setLoadError] = useState<string | null>(null)
  const [saved, setSaved] = useState<Syndicate | null>(null)
  const [form, setForm] = useState<Form | null>(null)
  const [showErrors, setShowErrors] = useState(false)
  const [saving, setSaving] = useState(false)
  const [message, setMessage] = useState<{ kind: 'error' | 'success'; text: string } | null>(null)

  const subscription = useSubscription(saved?.id ?? null)
  const [billingError, setBillingError] = useState<string | null>(null)
  const [openingBilling, setOpeningBilling] = useState(false)
  const [exporting, setExporting] = useState(false)
  const [exportError, setExportError] = useState<string | null>(null)

  /** Everything held for the syndicate, as one file. Recorded in the activity log. */
  const downloadEverything = async () => {
    setExporting(true)
    setExportError(null)
    const result = await apiRequest<unknown>(`/api/syndicates/${encodeURIComponent(current.id)}/export`, { method: 'POST' })
    setExporting(false)
    if (!result.ok) {
      setExportError(`Couldn’t prepare the download. ${result.error}`)
      return
    }
    const url = URL.createObjectURL(new Blob([JSON.stringify(result.data, null, 2)], { type: 'application/json' }))
    const link = document.createElement('a')
    link.href = url
    link.download = `${current.name.replace(/[^A-Za-z0-9]+/g, '-').replace(/^-|-$/g, '').toLowerCase() || 'syndicate'}-records-${new Date().toISOString().slice(0, 10)}.json`
    link.click()
    // Some browsers cancel a download whose address is withdrawn at once.
    setTimeout(() => URL.revokeObjectURL(url), 60_000)
  }

  useEffect(() => {
    let stale = false
    ;(async () => {
      setLoading(true)
      setLoadError(null)
      const result = await apiRequest<Syndicate>(`/api/syndicates/${encodeURIComponent(current.id)}`)
      if (stale) return
      if (result.ok) {
        setSaved(result.data)
        setForm(toForm(result.data))
      } else {
        setLoadError(`Could not load your settings. ${result.error}`)
      }
      setLoading(false)
    })()
    return () => {
      stale = true
    }
  }, [current.id])

  const problems = useMemo(() => (form ? validateSettings(form) : {}), [form])
  const dirty = useMemo(() => (form && saved ? JSON.stringify(form) !== JSON.stringify(toForm(saved)) : false), [form, saved])

  const set = <K extends keyof Form>(key: K, value: Form[K]) => {
    setForm((f) => (f ? { ...f, [key]: value } : f))
    setMessage(null)
  }

  const save = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!form || !saved) return
    setShowErrors(true)
    if (Object.keys(problems).length > 0) return
    setSaving(true)
    setMessage(null)
    const result = await apiRequest<Syndicate>(`/api/syndicates/${encodeURIComponent(saved.id)}`, {
      method: 'PATCH',
      body: settingsPayload(form, saved),
    })
    if (result.ok) {
      setSaved(result.data)
      setForm(toForm(result.data))
      setShowErrors(false)
      setMessage({ kind: 'success', text: 'Settings saved.' })
      // The name and season show in the header and on the dashboard.
      void reload(saved.id)
    } else {
      setMessage({ kind: 'error', text: `Not saved: ${result.error}` })
    }
    setSaving(false)
  }

  const openBilling = async () => {
    setOpeningBilling(true)
    setBillingError(null)
    const problem = await subscription.openPortal()
    if (problem) setBillingError(problem)
    setOpeningBilling(false)
  }

  const plan = PLANS.find((p) => p.tier === subscription.planTier)
  const readOnlyFrom = subscription.readOnlyFrom
    ? new Date(subscription.readOnlyFrom).toLocaleDateString('en-GB', { day: 'numeric', month: 'long', year: 'numeric' })
    : null
  const renews = subscription.currentPeriodEnd
    ? new Date(subscription.currentPeriodEnd).toLocaleDateString('en-GB', { day: 'numeric', month: 'long', year: 'numeric' })
    : null
  const err = (key: keyof Form) => (showErrors ? problems[key] : undefined)
  const rateNote = form ? minimumWageNote(parseDayRate(form.defaultBeaterRate) ?? 0, londonDate(new Date())) : null

  return (
    <>
      <Helmet>
        <title>Settings | ShootSync</title>
        <meta name="robots" content="noindex, nofollow" />
      </Helmet>

      <DashboardLayout>
        <div className="max-w-2xl space-y-6">
          <div>
            <h1 className="text-2xl font-bold text-white">Settings</h1>
            <p className="text-slate-400">Your syndicate’s details, season and defaults.</p>
          </div>

          {loading && (
            <div className="flex justify-center py-12">
              <LoadingSpinner size="lg" />
            </div>
          )}
          {loadError && (
            <p role="alert" className="rounded-lg px-4 py-3 bg-red-900/40 text-red-200 border border-red-800">
              {loadError}
            </p>
          )}

          {form && saved && (
            <form onSubmit={save} noValidate className="space-y-6">
              <Card>
                <h2 className="text-lg font-semibold text-white mb-4">Syndicate</h2>
                <Field id="name" title="Syndicate name" error={err('name')}>
                  <input id="name" aria-describedby="name-note" className={input} value={form.name} maxLength={100} aria-invalid={Boolean(err('name'))}
                    onChange={(e) => set('name', e.target.value)} />
                </Field>
              </Card>

              <Card>
                <h2 className="text-lg font-semibold text-white mb-1">Season</h2>
                <p className="text-sm text-slate-400 mb-4">The fair peg draw looks at pegs from the start of the season.</p>
                <div className="grid sm:grid-cols-2 gap-4">
                  <Field id="seasonStart" title="First day" error={err('seasonStart')}>
                    <input id="seasonStart" aria-describedby="seasonStart-note" type="date" className={input} value={form.seasonStart} aria-invalid={Boolean(err('seasonStart'))}
                      onChange={(e) => set('seasonStart', e.target.value)} />
                  </Field>
                  <Field id="seasonEnd" title="Last day" error={err('seasonEnd')}>
                    <input id="seasonEnd" aria-describedby="seasonEnd-note" type="date" className={input} value={form.seasonEnd} aria-invalid={Boolean(err('seasonEnd'))}
                      onChange={(e) => set('seasonEnd', e.target.value)} />
                  </Field>
                </div>
              </Card>

              <Card>
                <h2 className="text-lg font-semibold text-white mb-4">Beaters’ pay</h2>
                <div className="grid sm:grid-cols-2 gap-4">
                  <Field id="defaultBeaterRate" title="Beaters’ usual day rate (£)" hint="New beaters start on this; change anyone’s under Beaters. Pounds and pence, for example 42.50." error={err('defaultBeaterRate')}>
                    <input id="defaultBeaterRate" aria-describedby="defaultBeaterRate-note" inputMode="decimal" className={input} value={form.defaultBeaterRate} aria-invalid={Boolean(err('defaultBeaterRate'))}
                      onChange={(e) => set('defaultBeaterRate', e.target.value)} />
                  </Field>
                </div>
                {rateNote && <p className="mt-3 text-sm text-amber-200">{rateNote}</p>}
              </Card>

              <Card>
                <h2 className="text-lg font-semibold text-white mb-4">Peg draw</h2>
                <fieldset>
                  <legend className={label}>The draw you normally use</legend>
                  <div className="space-y-2 mt-2">
                    {([
                      ['FAIR_ROTATION', 'Fair draw', 'Keeps each gun off pegs they have already had this season.'],
                      ['RANDOM', 'Random draw', 'A straight draw every time.'],
                    ] as const).map(([value, title, text]) => (
                      <label key={value} className="flex items-start gap-3 cursor-pointer">
                        <input type="radio" name="pegRotationRule" className="mt-1 h-4 w-4 accent-green-600" checked={form.pegRotationRule === value}
                          onChange={() => set('pegRotationRule', value)} />
                        <span>
                          <span className="text-white">{title}</span>
                          <span className="block text-sm text-slate-400">{text}</span>
                        </span>
                      </label>
                    ))}
                  </div>
                  <p className="mt-3 text-sm text-slate-400">Both are always available on the peg draw page; this one is shown first.</p>
                </fieldset>
              </Card>

              <Card>
                <h2 className="text-lg font-semibold text-white mb-1">Guest acknowledgement</h2>
                <p className="text-sm text-slate-300 mb-4">
                  Every guest reads and accepts ShootSync’s standard acknowledgement before a day: competence, insurance,
                  the ordinary risks of the sport, following instructions, and an emergency contact. Add anything your
                  shoot also asks of guests below; it is shown to them under the standard text, and the exact words each
                  guest accepted are kept.
                </p>
                <Field id="waiverExtra" title="Your syndicate’s own clauses (optional)" error={err('waiverExtra')} hint="For example: no ground game; shotguns only; dogs by arrangement with the keeper.">
                  <textarea id="waiverExtra" aria-describedby="waiverExtra-note" rows={4} maxLength={2000} className={input} value={form.waiverExtra} aria-invalid={Boolean(err('waiverExtra'))}
                    onChange={(e) => set('waiverExtra', e.target.value)} />
                </Field>
              </Card>

              <div aria-live="polite">
                {message && (
                  <p className={`rounded-lg px-4 py-3 ${message.kind === 'error' ? 'bg-red-900/40 text-red-200 border border-red-800' : 'bg-green-900/40 text-green-200 border border-green-800'}`}>
                    {message.text}
                  </p>
                )}
              </div>
              {showErrors && Object.keys(problems).length > 0 && (
                <p role="alert" className="text-red-300">Check the highlighted fields.</p>
              )}

              <div className="flex gap-3">
                <Button type="submit" isLoading={saving} disabled={saving || !dirty || !canWrite}>
                  Save settings
                </Button>
                {dirty && (
                  <Button type="button" variant="ghost" disabled={saving}
                    onClick={() => { setForm(toForm(saved)); setShowErrors(false); setMessage(null) }}>
                    Undo changes
                  </Button>
                )}
              </div>
            </form>
          )}

          {saved && (
            <Card>
              <h2 className="text-lg font-semibold text-white mb-1">Your records</h2>
              <p className="text-slate-300">
                Download everything ShootSync holds for {current.name} in one file: members, beaters with their bank
                details, shoot days, bags, guests and their signed acknowledgements, payments and the activity log.
                Keep it somewhere safe, and delete it when you no longer need it.
              </p>
              {subscription.deletionDate && (
                <p className="mt-2 text-amber-200">
                  Unless a plan is started, everything for this syndicate is deleted on{' '}
                  {new Date(subscription.deletionDate).toLocaleDateString('en-GB', { day: 'numeric', month: 'long', year: 'numeric' })}. Download it before then.
                </p>
              )}
              <p className="mt-2 text-sm text-slate-400">
                How long each kind of record is kept is in the <a href="/privacy#retention" className="underline">privacy notice</a>.
              </p>
              {exportError && <p role="alert" className="mt-3 text-red-300">{exportError}</p>}
              <div className="mt-4 flex flex-wrap gap-3">
                <Button variant="secondary" onClick={() => void downloadEverything()} disabled={exporting}>
                  {exporting ? 'Preparing…' : 'Download everything'}
                </Button>
                <ButtonLink to="/settings/activity" variant="secondary">Activity log</ButtonLink>
              </div>
            </Card>
          )}

          {saved && (
            <Card>
              <h2 className="text-lg font-semibold text-white mb-1">Plan and billing</h2>
              {subscription.loading ? (
                <p className="text-slate-300">Checking your plan…</p>
              ) : subscription.error ? (
                <p role="alert" className="text-red-300">Couldn’t check your plan just now. {subscription.error}</p>
              ) : subscription.reason === 'dispute' ? (
                <p className="text-amber-200">A payment has been disputed with the card issuer, so the syndicate is read-only until that is settled and a payment has arrived. Email {SITE.email} if this is unexpected.</p>
              ) : subscription.reason === 'overdue' ? (
                <p className="text-amber-200">Your payment is more than two weeks overdue, so the syndicate is read-only. Update your card and pay the open invoice under Manage billing, and everything opens up again.</p>
              ) : subscription.status === 'PAST_DUE' ? (
                <p className="text-amber-200">
                  Your last payment didn’t go through. Everything still works{readOnlyFrom ? ` until ${readOnlyFrom}` : ' for now'} while Stripe tries your card again: update it under Manage billing.
                </p>
              ) : subscription.status === 'UNPAID' ? (
                <p className="text-amber-200">Payments have failed and Stripe has stopped trying, so the syndicate is read-only. Update your card and pay the open invoice under Manage billing.</p>
              ) : subscription.isActive ? (
                <p className="text-slate-300">
                  {plan ? `${plan.name}, £${plan.monthlyPrice} a month.` : 'Your plan is active.'}
                  {renews && ` Paid up to ${renews}.`}
                </p>
              ) : subscription.status === 'INCOMPLETE' ? (
                <p className="text-amber-200">Your first payment hasn’t gone through yet. Finish paying under Manage billing.</p>
              ) : (
                <p className="text-slate-300">No active plan.</p>
              )}
              {/* Only describe the billing page when there is one to open. */}
              {subscription.status && subscription.status !== 'CANCELLED' && (
                <p className="mt-2 text-sm text-slate-400">
                  Under Manage billing you can change plan, update your card, download invoices or cancel. If you cancel, your plan runs to the end of the month you’ve paid for.
                </p>
              )}
              {billingError && <p role="alert" className="mt-3 text-red-300">{billingError}</p>}
              <div className="mt-4">
                {subscription.loading || subscription.error ? null : subscription.status && subscription.status !== 'CANCELLED' ? (
                  <Button variant="secondary" onClick={openBilling} isLoading={openingBilling} disabled={openingBilling}>
                    Manage billing
                  </Button>
                ) : (
                  <ButtonLink to="/subscribe">Choose a plan</ButtonLink>
                )}
              </div>
            </Card>
          )}
        </div>
      </DashboardLayout>
    </>
  )
}
