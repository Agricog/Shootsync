/**
 * Set up a syndicate - ShootSync
 *
 * The signed-in user becomes its captain. Next stop is choosing a plan for it.
 */

import { useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { Helmet } from 'react-helmet-async'
import { useSyndicates } from '../../context/SyndicateContext'
import { apiRequest } from '../../lib/api'
import { londonDate } from '../../utils/beaterPayCalculator'
import { newSyndicateForm, newSyndicatePayload, validateSettings, type SettingsForm } from '../../utils/syndicateSettings'
import { minimumWageNote, parseDayRate } from '../../utils/dayRate'
import { useUnsavedWork } from '../../lib/unsavedWork'
import DashboardLayout from '../../components/layout/DashboardLayout'
import Card from '../../components/common/Card'
import Button from '../../components/common/Button'

const input =
  'w-full px-3 py-2 bg-slate-900 border border-slate-600 rounded-lg text-white focus:outline-none focus:ring-2 focus:ring-green-500 aria-[invalid=true]:border-red-500'

export default function CreateSyndicate() {
  const navigate = useNavigate()
  const { memberships, reload } = useSyndicates()
  const [form, setForm] = useState<SettingsForm>(() => newSyndicateForm(londonDate(new Date())))
  const [showErrors, setShowErrors] = useState(false)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [created, setCreated] = useState(false)
  useUnsavedWork(!created && form.name.trim() !== '')

  const problems = useMemo(() => validateSettings(form), [form])
  const problem = (key: keyof SettingsForm) => (showErrors ? problems[key] : undefined)

  const field = (key: 'name' | 'seasonStart' | 'seasonEnd' | 'defaultBeaterRate', title: string, hint: string, props: React.InputHTMLAttributes<HTMLInputElement> = {}) => (
    <div>
      <label htmlFor={`syndicate-${key}`} className="block text-sm font-medium text-slate-300 mb-1">{title}</label>
      <input
        id={`syndicate-${key}`}
        className={input}
        value={form[key]}
        aria-invalid={Boolean(problem(key))}
        aria-describedby={`syndicate-${key}-note`}
        onChange={(e) => setForm({ ...form, [key]: e.target.value })}
        {...props}
      />
      <p id={`syndicate-${key}-note`} className={`mt-1 text-sm ${problem(key) ? 'text-red-400' : 'text-slate-400'}`}>
        {problem(key) ?? hint}
      </p>
    </div>
  )

  const submit = async (e: React.FormEvent) => {
    e.preventDefault()
    setShowErrors(true)
    if (Object.keys(problems).length > 0) return
    setSaving(true)
    setError(null)
    const result = await apiRequest<{ id: string }>('/api/syndicates', { method: 'POST', body: newSyndicatePayload(form) })
    if (!result.ok) {
      setError(`Not created: ${result.error}`)
      setSaving(false)
      return
    }
    // Show the new syndicate everywhere, then choose its plan. If the app can't pick it up
    // straight away, say so rather than showing this form again (which invites a duplicate).
    const list = await reload(result.data.id)
    if (!list?.some((m) => m.id === result.data.id)) {
      setCreated(true)
      setSaving(false)
      return
    }
    navigate('/subscribe')
  }

  return (
    <DashboardLayout>
      <Helmet>
        <title>Set up your syndicate | ShootSync</title>
      </Helmet>

      <div className="max-w-2xl mx-auto">
        <h1 className="text-2xl font-bold text-white mb-2">Set up your syndicate</h1>
        <p className="text-slate-300 mb-6">
          You’ll be its captain. You can change any of this later in Settings.
        </p>

        {created ? (
          <Card>
            <div role="alert" className="text-center py-4">
              <h2 className="text-lg font-semibold text-white mb-2">{form.name.trim()} is set up</h2>
              <p className="text-slate-300 mb-6">ShootSync couldn’t load it just now. Reload the page to carry on: don’t create it again.</p>
              <Button onClick={() => window.location.assign('/subscribe')}>Reload</Button>
            </div>
          </Card>
        ) : (
          <Card>
            <form onSubmit={submit} noValidate className="space-y-5">
              {field('name', 'Syndicate name', 'For example Beatrice Pheasant Syndicate.', { maxLength: 100, autoFocus: true, autoComplete: 'organization' })}

              <div className="grid sm:grid-cols-2 gap-4">
                {field('seasonStart', 'Season starts', 'Your first shoot day can be later.', { type: 'date' })}
                {field('seasonEnd', 'Season ends', 'Your last shoot day can be earlier.', { type: 'date' })}
              </div>

              <div className="grid sm:grid-cols-2 gap-4">
                {field('defaultBeaterRate', 'Beaters’ usual day rate (£)', minimumWageNote(parseDayRate(form.defaultBeaterRate) ?? 0, londonDate(new Date())) ?? 'New beaters start on this. Pounds and pence, for example 42.50.', { inputMode: 'decimal' })}
              </div>

              {error && (
                <p role="alert" className="rounded-lg px-3 py-2 bg-red-900/40 text-red-200 border border-red-800 text-sm">{error}</p>
            )}

            <div className="flex flex-wrap gap-3">
              <Button type="submit" isLoading={saving} disabled={saving}>Create the syndicate</Button>
              {memberships.length > 0 && (
                <Button type="button" variant="ghost" onClick={() => navigate('/dashboard')} disabled={saving}>Cancel</Button>
              )}
            </div>
          </form>
        </Card>
        )}
      </div>
    </DashboardLayout>
  )
}
