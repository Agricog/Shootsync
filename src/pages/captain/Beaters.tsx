/**
 * Beaters - the captain's beating team.
 *
 * Add, edit, deactivate and reactivate beaters. Bank details are never sent back to the
 * browser on this page (the API masks them to "on file, ending 5678"); to change them the
 * captain types new ones, and leaving the fields blank keeps what is saved. Full details
 * appear only on the captain's Beaters' pay page, where they are needed to pay people.
 * Day rates are whole pounds.
 */

import { useCallback, useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { Helmet } from 'react-helmet-async'
import { useCaptainSyndicate } from '../../context/SyndicateContext'
import { apiRequest } from '../../lib/api'
import DashboardLayout from '../../components/layout/DashboardLayout'
import Card from '../../components/common/Card'
import Button from '../../components/common/Button'
import LoadingSpinner from '../../components/common/LoadingSpinner'
import { draftFrom, emptyDraft, payloadFrom, type BeaterDraft as Draft } from '../../utils/beaterForm'

interface Beater {
  id: string
  name: string
  email?: string | null
  phone?: string | null
  dayRate: number
  status: 'ACTIVE' | 'INACTIVE'
  bankName?: string | null
  bankDetailsOnFile: boolean
  bankAccountLast4: string | null
  notes?: string | null
}

async function send(path: string, method: 'GET' | 'POST' | 'PATCH' | 'DELETE', body?: unknown): Promise<{ ok: true; data: any } | { ok: false; error: string }> {
  const result = await apiRequest<any>(path, { method, body })
  return result.ok ? { ok: true, data: result.data } : { ok: false, error: result.error }
}

const input = 'w-full px-3 py-2 bg-slate-900 border border-slate-600 rounded-lg text-white placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-green-500'

function BeaterForm({ draft, onChange, existing, saving, error, onSubmit, onCancel, submitLabel, onClearBank }: {
  draft: Draft
  onChange: (d: Draft) => void
  existing?: Beater
  saving: boolean
  error: string | null
  onSubmit: () => void
  onCancel: () => void
  submitLabel: string
  onClearBank?: () => void
}) {
  const [confirmClear, setConfirmClear] = useState(false)
  const field = (key: keyof Draft, title: string, props: React.InputHTMLAttributes<HTMLInputElement> = {}) => (
    <label className="block">
      <span className="block text-sm font-medium text-slate-300 mb-1">{title}</span>
      <input className={input} value={draft[key]} onChange={(e) => onChange({ ...draft, [key]: e.target.value })} {...props} />
    </label>
  )
  const keepHint = existing?.bankDetailsOnFile ? `On file, account ending ${existing.bankAccountLast4}. Leave blank to keep.` : undefined

  return (
    <form
      className="space-y-4"
      onSubmit={(e) => {
        e.preventDefault()
        onSubmit()
      }}
    >
      <div className="grid sm:grid-cols-2 gap-4">
        {field('name', 'Name', { required: true, maxLength: 100, autoComplete: 'off', autoFocus: true })}
        {field('dayRate', 'Day rate (£)', { inputMode: 'numeric', required: true })}
        {field('phone', 'Phone', { type: 'tel', maxLength: 30 })}
        {field('email', 'Email', { type: 'email', maxLength: 254 })}
      </div>
      <fieldset className="grid sm:grid-cols-3 gap-4">
        <legend className="text-sm font-medium text-slate-300 mb-2 sm:col-span-3">Bank details, for paying them</legend>
        {field('bankName', 'Bank', { maxLength: 100 })}
        {field('bankSortCode', 'Sort code', { inputMode: 'numeric', placeholder: existing?.bankDetailsOnFile ? 'Unchanged' : '12-34-56', autoComplete: 'off' })}
        {field('bankAccountNumber', 'Account number', { inputMode: 'numeric', placeholder: existing?.bankDetailsOnFile ? 'Unchanged' : '8 digits', autoComplete: 'off' })}
        {keepHint && (
          <p className="text-sm text-slate-500 sm:col-span-3 -mt-2">
            {keepHint}{' '}
            {onClearBank && (
              <button type="button" className="underline text-red-300 hover:text-red-200" disabled={saving}
                onClick={() => (confirmClear ? onClearBank() : setConfirmClear(true))}>
                {confirmClear ? 'Yes, delete the saved bank details' : 'Delete saved bank details'}
                <span className="sr-only" aria-live="polite">{confirmClear ? 'Press again to confirm.' : ''}</span>
              </button>
            )}
          </p>
        )}
      </fieldset>
      <label className="block">
        <span className="block text-sm font-medium text-slate-300 mb-1">Notes</span>
        <textarea className={input} rows={2} maxLength={2000} value={draft.notes} onChange={(e) => onChange({ ...draft, notes: e.target.value })} />
      </label>
      {error && (
        <p role="alert" className="rounded-lg px-3 py-2 bg-red-900/40 text-red-200 border border-red-800 text-sm">
          {error}
        </p>
      )}
      <div className="flex gap-3">
        <Button type="submit" isLoading={saving} disabled={saving}>
          {submitLabel}
        </Button>
        <Button type="button" variant="ghost" onClick={onCancel} disabled={saving}>
          Cancel
        </Button>
      </div>
    </form>
  )
}

export default function Beaters() {
  const syndicate = useCaptainSyndicate()
  const syndicateId = syndicate.id
  const defaultRate = syndicate.defaultBeaterRate
  const [beaters, setBeaters] = useState<Beater[]>([])
  const [loading, setLoading] = useState(true)
  const [showInactive, setShowInactive] = useState(false)
  const [editing, setEditing] = useState<string | 'new' | null>(null)
  const [draft, setDraft] = useState<Draft>(() => emptyDraft(syndicate.defaultBeaterRate))
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [notice, setNotice] = useState<string | null>(null)

  const load = useCallback(async (id: string) => {
    const result = await send(`/api/beaters?syndicateId=${encodeURIComponent(id)}`, 'GET')
    if (result.ok) setBeaters(result.data)
    else setError(result.error)
  }, [])

  useEffect(() => {
    ;(async () => {
      setLoading(true)
      await load(syndicateId)
      setLoading(false)
    })()
  }, [syndicateId, load])

  const startNew = () => {
    setEditing('new')
    setDraft(emptyDraft(defaultRate))
    setError(null)
    setNotice(null)
  }

  const startEdit = (beater: Beater) => {
    setEditing(beater.id)
    setDraft(draftFrom(beater))
    setError(null)
    setNotice(null)
  }

  const save = async () => {
    if (!editing) return
    const isEdit = editing !== 'new'
    const payload = payloadFrom(draft, isEdit)
    if ('error' in payload) {
      setError(payload.error ?? null)
      return
    }
    setSaving(true)
    setError(null)
    const result = isEdit
      ? await send(`/api/beaters/${encodeURIComponent(editing)}`, 'PATCH', payload.body)
      : await send('/api/beaters', 'POST', { ...payload.body, syndicateId })
    setSaving(false)
    if (!result.ok) {
      setError(result.error)
      return
    }
    setEditing(null)
    setNotice(isEdit ? `${draft.name.trim()} updated.` : `${draft.name.trim()} added.`)
    await load(syndicateId)
  }

  const clearBank = async (beater: Beater) => {
    setSaving(true)
    setError(null)
    const result = await send(`/api/beaters/${encodeURIComponent(beater.id)}`, 'PATCH', { clearBankDetails: true })
    setSaving(false)
    if (!result.ok) {
      setError(result.error)
      return
    }
    // The form stays open, so anything typed in it isn't lost.
    setNotice(`${beater.name}’s bank details have been deleted.`)
    await load(syndicateId)
  }

  const setStatus = async (beater: Beater, status: Beater['status']) => {
    setError(null)
    const result = await send(`/api/beaters/${encodeURIComponent(beater.id)}`, 'PATCH', { status })
    if (!result.ok) setError(result.error)
    else {
      setNotice(status === 'ACTIVE' ? `${beater.name} is back in the team.` : `${beater.name} is no longer active. Anything they’re owed still shows under Beaters’ pay.`)
      await load(syndicateId)
    }
  }

  const visible = beaters.filter((b) => showInactive || b.status === 'ACTIVE')
  const inactiveCount = beaters.filter((b) => b.status !== 'ACTIVE').length

  return (
    <>
      <Helmet>
        <title>Beaters | ShootSync</title>
        <meta name="robots" content="noindex, nofollow" />
      </Helmet>
      <DashboardLayout>
        <div className="space-y-6 max-w-3xl">
          <div className="flex flex-wrap justify-between items-start gap-4">
            <div>
              <h1 className="text-2xl font-bold text-white">Beaters</h1>
              <p className="text-slate-400">
                Your beating team. Book them onto a day from the shoot day page; pay is under{' '}
                <Link to="/finances" className="text-green-400 underline">Beaters’ pay</Link>.
              </p>
            </div>
            {editing !== 'new' && <Button onClick={startNew}>Add beater</Button>}
          </div>

          <div role="status" aria-live="polite">
            {notice && <p className="rounded-lg px-4 py-3 bg-green-900/40 text-green-200 border border-green-800">{notice}</p>}
          </div>
          {error && !editing && (
            <p role="alert" className="rounded-lg px-4 py-3 bg-red-900/40 text-red-200 border border-red-800">
              {error}
            </p>
          )}

          {editing === 'new' && (
            <Card>
              <h2 className="text-lg font-semibold text-white mb-4">Add a beater</h2>
              <BeaterForm draft={draft} onChange={setDraft} saving={saving} error={error} onSubmit={save}
                onCancel={() => { setEditing(null); setError(null) }} submitLabel="Add beater" />
            </Card>
          )}

          {loading ? (
            <div className="flex justify-center py-12">
              <LoadingSpinner size="lg" />
            </div>
          ) : visible.length === 0 && editing !== 'new' ? (
            <Card>
              <p className="text-slate-300">No beaters yet. Add your beating team to book them onto shoot days.</p>
            </Card>
          ) : (
            <ul className="space-y-3">
              {visible.map((beater) => (
                <li key={beater.id}>
                  <Card>
                    {editing === beater.id ? (
                      <>
                        <h2 className="text-lg font-semibold text-white mb-4">Edit {beater.name}</h2>
                        <BeaterForm draft={draft} onChange={setDraft} existing={beater} saving={saving} error={error} onSubmit={save}
                          onClearBank={() => clearBank(beater)}
                          onCancel={() => { setEditing(null); setError(null) }} submitLabel="Save changes" />
                      </>
                    ) : (
                      <div className="flex flex-wrap justify-between gap-4">
                        <div className="min-w-0">
                          <h2 className="text-lg font-semibold text-white">
                            {beater.name}
                            {beater.status !== 'ACTIVE' && <span className="ml-2 text-xs px-2 py-0.5 rounded bg-slate-700 text-slate-200">Inactive</span>}
                          </h2>
                          <p className="text-sm text-slate-400">£{beater.dayRate} a day</p>
                          {beater.phone && <a href={`tel:${beater.phone}`} className="block text-sm text-slate-300 hover:text-white">{beater.phone}</a>}
                          {beater.email && <p className="text-sm text-slate-300">{beater.email}</p>}
                          <p className="text-sm text-slate-500 mt-1">
                            {beater.bankDetailsOnFile ? `Bank details on file, account ending ${beater.bankAccountLast4}` : 'No bank details yet'}
                          </p>
                        </div>
                        <div className="flex items-start gap-2">
                          <Button size="sm" variant="secondary" onClick={() => startEdit(beater)} disabled={editing !== null}>
                            Edit
                          </Button>
                          {beater.status === 'ACTIVE' ? (
                            <Button size="sm" variant="ghost" onClick={() => setStatus(beater, 'INACTIVE')} disabled={editing !== null}>
                              Make inactive
                            </Button>
                          ) : (
                            <Button size="sm" variant="ghost" onClick={() => setStatus(beater, 'ACTIVE')} disabled={editing !== null}>
                              Reactivate
                            </Button>
                          )}
                        </div>
                      </div>
                    )}
                  </Card>
                </li>
              ))}
            </ul>
          )}

          {inactiveCount > 0 && (
            <button type="button" className="text-sm text-slate-400 hover:text-white underline" onClick={() => setShowInactive((v) => !v)}>
              {showInactive ? 'Hide inactive beaters' : `Show ${inactiveCount} inactive ${inactiveCount === 1 ? 'beater' : 'beaters'}`}
            </button>
          )}
        </div>
      </DashboardLayout>
    </>
  )
}
