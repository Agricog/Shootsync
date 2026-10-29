import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { Helmet } from 'react-helmet-async'
import { useCanWrite, useCaptainSyndicate } from '../../context/SyndicateContext'
import { apiRequest } from '../../lib/api'
import { emptyShootDraft, newShootPayload, validateShoot, type ShootDraft } from '../../utils/shootForm'
import DashboardLayout from '../../components/layout/DashboardLayout'
import Card from '../../components/common/Card'
import Button from '../../components/common/Button'
import ShootDayFields from '../../components/shoots/ShootDayFields'

export default function ShootCreate() {
  const navigate = useNavigate()
  const syndicate = useCaptainSyndicate()
  const canWrite = useCanWrite()
  const [draft, setDraft] = useState<ShootDraft>(emptyShootDraft)
  const [showErrors, setShowErrors] = useState(false)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const problems = validateShoot(draft)

  const submit = async (e: React.FormEvent) => {
    e.preventDefault()
    setShowErrors(true)
    if (Object.keys(problems).length > 0) return
    setSaving(true)
    setError(null)
    const result = await apiRequest<{ id: string }>('/api/shoots', { method: 'POST', body: newShootPayload(syndicate.id, draft) })
    if (!result.ok) {
      setError(`Not saved: ${result.error}`)
      setSaving(false)
      return
    }
    navigate(`/shoots/${result.data.id}`)
  }

  return (
    <DashboardLayout>
      <Helmet>
        <title>Schedule a shoot day | ShootSync</title>
      </Helmet>

      <div className="max-w-2xl mx-auto">
        <h1 className="text-2xl font-bold text-white mb-6">Schedule a shoot day</h1>

        <Card>
          <form onSubmit={submit} noValidate className="space-y-4">
            <ShootDayFields draft={draft} onChange={setDraft} problems={showErrors ? problems : {}} autoFocusDate />

            {error && (
              <p role="alert" className="rounded-lg px-3 py-2 bg-red-900/40 text-red-200 border border-red-800 text-sm">
                {error}
              </p>
            )}

            <div className="flex flex-wrap gap-3">
              <Button type="submit" isLoading={saving} disabled={saving || !canWrite}>
                Schedule the day
              </Button>
              <Button type="button" variant="ghost" onClick={() => navigate('/shoots')} disabled={saving}>
                Cancel
              </Button>
            </div>
          </form>
        </Card>
      </div>
    </DashboardLayout>
  )
}
