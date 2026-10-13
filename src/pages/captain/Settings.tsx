/**
 * Settings - captain only.
 *
 * Loads the captain's syndicate from the API and saves changes with PATCH
 * /api/syndicates/:id. Nothing here is hard-coded: what you see is what is saved.
 * Money units: the members' subscription and the beaters' default day rate are whole pounds.
 * Billing opens Stripe's customer portal, where the captain can update their card,
 * see invoices, or cancel.
 */

import { useEffect, useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { Helmet } from 'react-helmet-async'
import { useAuth } from '../../hooks/useAuth'
import { useSubscription } from '../../hooks/useSubscription'
import DashboardLayout from '../../components/layout/DashboardLayout'
import Card from '../../components/common/Card'
import Button from '../../components/common/Button'
import LoadingSpinner from '../../components/common/LoadingSpinner'
import { PLANS } from '../../config/plans'
import { settingsPayload, toForm, validateSettings, type SettingsForm as Form, type SyndicateSettings as Syndicate } from '../../utils/syndicateSettings'


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
      <p id={`${id}-note`} className={`mt-1 text-sm ${error ? 'text-red-400' : 'text-slate-500'}`}>
        {error ?? hint}
      </p>
    </div>
  )
}

export default function Settings() {
  const { user } = useAuth()
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

  useEffect(() => {
    if (!user?.id) return
    ;(async () => {
      setLoading(true)
      try {
        const response = await fetch('/api/syndicates')
        if (!response.ok) throw new Error(String(response.status))
        const list: Syndicate[] = await response.json()
        if (list.length > 0) {
          setSaved(list[0])
          setForm(toForm(list[0]))
        }
      } catch {
        setLoadError('Could not load your settings. Check your connection and try again.')
      }
      setLoading(false)
    })()
  }, [user?.id])

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
    try {
      const response = await fetch(`/api/syndicates/${encodeURIComponent(saved.id)}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(settingsPayload(form, saved)),
      })
      const body = await response.json().catch(() => null)
      if (!response.ok) throw new Error(body?.details?.[0]?.message || body?.error || `Something went wrong (${response.status})`)
      setSaved(body)
      setForm(toForm(body))
      setShowErrors(false)
      setMessage({ kind: 'success', text: 'Settings saved.' })
    } catch (err) {
      setMessage({ kind: 'error', text: `Not saved: ${err instanceof Error ? err.message : 'please try again.'}` })
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
  const renews = subscription.currentPeriodEnd
    ? new Date(subscription.currentPeriodEnd).toLocaleDateString('en-GB', { day: 'numeric', month: 'long', year: 'numeric' })
    : null
  const err = (key: keyof Form) => (showErrors ? problems[key] : undefined)

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

          {!loading && !loadError && !saved && (
            <Card>
              <p className="text-slate-300">
                You haven’t set up a syndicate yet. <Link to="/dashboard" className="text-green-400 underline">Create your syndicate</Link> first.
              </p>
            </Card>
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
                <h2 className="text-lg font-semibold text-white mb-4">Money</h2>
                <div className="grid sm:grid-cols-2 gap-4">
                  <Field id="subscriptionAmount" title="Members’ subscription (£)" hint="What each gun pays the syndicate." error={err('subscriptionAmount')}>
                    <input id="subscriptionAmount" aria-describedby="subscriptionAmount-note" inputMode="numeric" className={input} value={form.subscriptionAmount} aria-invalid={Boolean(err('subscriptionAmount'))}
                      onChange={(e) => set('subscriptionAmount', e.target.value)} />
                  </Field>
                  <Field id="subscriptionType" title="Paid">
                    <select id="subscriptionType" className={input} value={form.subscriptionType}
                      onChange={(e) => set('subscriptionType', e.target.value as Form['subscriptionType'])}>
                      <option value="ANNUAL">For the season</option>
                      <option value="PER_SHOOT">Per shoot day</option>
                      <option value="HYBRID">Part season, part per day</option>
                    </select>
                  </Field>
                  <Field id="defaultBeaterRate" title="Beaters’ usual day rate (£)" hint="New beaters start on this; change anyone’s under Beaters." error={err('defaultBeaterRate')}>
                    <input id="defaultBeaterRate" aria-describedby="defaultBeaterRate-note" inputMode="numeric" className={input} value={form.defaultBeaterRate} aria-invalid={Boolean(err('defaultBeaterRate'))}
                      onChange={(e) => set('defaultBeaterRate', e.target.value)} />
                  </Field>
                </div>
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
                  <p className="mt-3 text-sm text-slate-500">Both are always available on the peg draw page; this one is shown first.</p>
                </fieldset>
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
                <Button type="submit" isLoading={saving} disabled={saving || !dirty}>
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
              <h2 className="text-lg font-semibold text-white mb-1">Plan and billing</h2>
              {subscription.isActive ? (
                <p className="text-slate-300">
                  {plan ? `${plan.name}, £${plan.monthlyPrice} a month.` : 'Your plan is active.'}
                  {renews && ` Paid up to ${renews}.`}
                </p>
              ) : (
                <p className="text-slate-300">No active plan.</p>
              )}
              <p className="mt-2 text-sm text-slate-400">
                Update your card, download invoices or cancel. If you cancel, your plan runs to the end of the month you’ve paid for.
              </p>
              {billingError && <p role="alert" className="mt-3 text-red-300">{billingError}</p>}
              <div className="mt-4">
                {subscription.status ? (
                  <Button variant="secondary" onClick={openBilling} isLoading={openingBilling} disabled={openingBilling}>
                    Manage billing
                  </Button>
                ) : (
                  <Link to="/subscribe" className="inline-flex items-center px-4 py-2 rounded-lg bg-green-600 hover:bg-green-700 text-white font-medium">
                    Choose a plan
                  </Link>
                )}
              </div>
            </Card>
          )}
        </div>
      </DashboardLayout>
    </>
  )
}
