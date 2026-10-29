/**
 * Members - ShootSync
 *
 * The syndicate's gun list. Adding a gun puts them on the list for peg draws, shoot days and
 * guest invites straight away. Nothing is sent to them: guns don't sign in to ShootSync yet,
 * and this page says so rather than implying an invitation went out.
 * Beaters are kept on the Beaters page, with their day rate and pay.
 */

import { useCallback, useEffect, useState } from 'react'
import { Helmet } from 'react-helmet-async'
import { useCaptainSyndicate } from '../../context/SyndicateContext'
import { apiPath, apiRequest } from '../../lib/api'
import DashboardLayout from '../../components/layout/DashboardLayout'
import Card from '../../components/common/Card'
import Button from '../../components/common/Button'
import Input from '../../components/common/Input'
import LoadingSpinner from '../../components/common/LoadingSpinner'

interface Member {
  id: string
  name: string
  email: string
  phone?: string | null
  role: string
  status: 'ACTIVE' | 'PENDING' | 'INACTIVE'
}

const STATUS_LABEL: Record<Member['status'], string> = {
  ACTIVE: 'Active',
  PENDING: 'Not yet active',
  INACTIVE: 'Inactive',
}

const statusColour = (status: Member['status']) => {
  switch (status) {
    case 'ACTIVE': return 'bg-green-900 text-green-200'
    case 'PENDING': return 'bg-yellow-900 text-yellow-200'
    default: return 'bg-slate-700 text-slate-200'
  }
}

const EMPTY_DRAFT = { name: '', email: '', phone: '' }

export default function Members() {
  const syndicate = useCaptainSyndicate()
  const [members, setMembers] = useState<Member[]>([])
  const [loading, setLoading] = useState(true)
  const [loadError, setLoadError] = useState<string | null>(null)

  const [adding, setAdding] = useState(false)
  const [draft, setDraft] = useState(EMPTY_DRAFT)
  const [saving, setSaving] = useState(false)
  const [addError, setAddError] = useState<string | null>(null)

  const [updating, setUpdating] = useState<string | null>(null)
  const [rowError, setRowError] = useState<{ id: string; message: string } | null>(null)

  const load = useCallback(async () => {
    setLoading(true)
    setLoadError(null)
    const result = await apiRequest<Member[]>(apiPath('/api/members', { syndicateId: syndicate.id }))
    if (result.ok) setMembers(result.data)
    else setLoadError(result.error)
    setLoading(false)
  }, [syndicate.id])

  useEffect(() => {
    void load()
  }, [load])

  const add = async (e: React.FormEvent) => {
    e.preventDefault()
    setSaving(true)
    setAddError(null)
    const result = await apiRequest<Member>('/api/members', {
      method: 'POST',
      body: {
        syndicateId: syndicate.id,
        name: draft.name.trim(),
        email: draft.email.trim(),
        phone: draft.phone.trim() || undefined,
      },
    })
    setSaving(false)
    if (!result.ok) {
      setAddError(`Not added: ${result.error}`)
      return
    }
    setMembers((list) => [...list, result.data].sort((a, b) => a.name.localeCompare(b.name)))
    setDraft(EMPTY_DRAFT)
    setAdding(false)
  }

  const setStatus = async (member: Member, status: Member['status']) => {
    setUpdating(member.id)
    setRowError(null)
    const result = await apiRequest<Member>(`/api/members/${encodeURIComponent(member.id)}/status`, { method: 'PATCH', body: { status } })
    setUpdating(null)
    if (!result.ok) {
      setRowError({ id: member.id, message: result.error })
      return
    }
    setMembers((list) => list.map((m) => (m.id === member.id ? result.data : m)))
  }

  const count = (status: Member['status']) => members.filter((m) => m.status === status).length

  return (
    <DashboardLayout>
      <Helmet>
        <title>Members | ShootSync</title>
      </Helmet>

      <div className="space-y-6">
        <div className="flex flex-col sm:flex-row justify-between sm:items-center gap-4">
          <div>
            <h1 className="text-2xl font-bold text-white">Members</h1>
            {!loading && !loadError && (
              <p className="text-slate-300 text-sm mt-1">
                {count('ACTIVE')} active
                {count('PENDING') > 0 && ` · ${count('PENDING')} not yet active`}
                {count('INACTIVE') > 0 && ` · ${count('INACTIVE')} inactive`}
              </p>
            )}
          </div>
          {!adding && <Button onClick={() => setAdding(true)}>Add a member</Button>}
        </div>

        {adding && (
          <Card>
            <h2 className="text-lg font-semibold text-white mb-1">Add a member</h2>
            <p className="text-sm text-slate-300 mb-4">
              They go straight onto your gun list for peg draws and shoot days. Nothing is sent to them.
            </p>
            <form onSubmit={add} className="space-y-4">
              <Input label="Name" value={draft.name} onChange={(e) => setDraft({ ...draft, name: e.target.value })} required maxLength={100} autoFocus />
              <Input label="Email" type="email" value={draft.email} onChange={(e) => setDraft({ ...draft, email: e.target.value })} required maxLength={254} />
              <Input label="Phone (optional)" type="tel" value={draft.phone} onChange={(e) => setDraft({ ...draft, phone: e.target.value })} maxLength={30} />
              {addError && (
                <p role="alert" className="rounded-lg px-3 py-2 bg-red-900/40 text-red-200 border border-red-800 text-sm">{addError}</p>
              )}
              <div className="flex flex-wrap gap-3">
                <Button type="submit" isLoading={saving} disabled={saving}>Add to the list</Button>
                <Button type="button" variant="ghost" onClick={() => { setAdding(false); setAddError(null) }} disabled={saving}>
                  Cancel
                </Button>
              </div>
            </form>
          </Card>
        )}

        {loading ? (
          <div className="flex justify-center items-center h-64">
            <LoadingSpinner size="lg" />
          </div>
        ) : loadError ? (
          <Card>
            <div role="alert" className="text-center py-6">
              <p className="text-slate-200 mb-4">{loadError}</p>
              <Button onClick={() => void load()}>Try again</Button>
            </div>
          </Card>
        ) : members.length === 0 ? (
          !adding && (
            <Card>
              <div className="text-center py-8">
                <p className="text-slate-300 mb-4">No members yet. Add your guns to use the peg draw and shoot day sheets.</p>
                <Button onClick={() => setAdding(true)}>Add your first member</Button>
              </div>
            </Card>
          )
        ) : (
          <ul className="space-y-4">
            {members.map((member) => (
              <li key={member.id}>
                <Card>
                  <div className="flex flex-col sm:flex-row justify-between sm:items-start gap-3">
                    <div className="min-w-0">
                      <h2 className="text-lg font-semibold text-white">{member.name}</h2>
                      <p className="text-slate-300 break-words">{member.email}</p>
                      {member.phone && <p className="text-slate-400 text-sm">{member.phone}</p>}
                    </div>
                    <div className="flex flex-col sm:items-end gap-2">
                      <span className={`self-start sm:self-auto px-3 py-1 rounded-full text-sm font-medium ${statusColour(member.status)}`}>
                        {STATUS_LABEL[member.status] ?? member.status}
                      </span>
                      {updating === member.id ? (
                        <LoadingSpinner size="sm" />
                      ) : member.status === 'ACTIVE' ? (
                        <Button variant="ghost" size="sm" onClick={() => void setStatus(member, 'INACTIVE')}>
                          Make inactive
                        </Button>
                      ) : (
                        <Button variant="ghost" size="sm" onClick={() => void setStatus(member, 'ACTIVE')}>
                          {member.status === 'PENDING' ? 'Make active' : 'Make active again'}
                        </Button>
                      )}
                    </div>
                  </div>
                  {rowError?.id === member.id && (
                    <p role="alert" className="mt-3 rounded-lg px-3 py-2 bg-red-900/40 text-red-200 border border-red-800 text-sm">
                      {rowError.message}
                    </p>
                  )}
                </Card>
              </li>
            ))}
          </ul>
        )}
      </div>
    </DashboardLayout>
  )
}
