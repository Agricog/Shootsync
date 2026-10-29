import { useCallback, useEffect, useState } from 'react'
import { Helmet } from 'react-helmet-async'
import { useCaptainSyndicate } from '../../context/SyndicateContext'
import { apiPath, apiRequest } from '../../lib/api'
import { SHOOT_STATUS_LABEL } from '../../lib/shootDays'
import DashboardLayout from '../../components/layout/DashboardLayout'
import Card from '../../components/common/Card'
import Button, { ButtonLink } from '../../components/common/Button'
import LoadingSpinner from '../../components/common/LoadingSpinner'

interface ShootDay {
  id: string
  date: string
  locationName: string
  meetTime: string
  status: string
  drivesPlanned: number
  _count?: {
    attendances: number
    beaterBookings: number
  }
}

const formatDate = (iso: string) =>
  new Date(iso).toLocaleDateString('en-GB', { weekday: 'short', day: 'numeric', month: 'short', year: 'numeric', timeZone: 'UTC' })

const statusColour = (status: string) => {
  switch (status) {
    case 'SCHEDULED': return 'bg-blue-900 text-blue-200'
    case 'COMPLETED': return 'bg-green-900 text-green-200'
    case 'CANCELLED': return 'bg-red-900 text-red-200'
    default: return 'bg-slate-700 text-slate-200'
  }
}

export default function Shoots() {
  const syndicate = useCaptainSyndicate()
  const [shoots, setShoots] = useState<ShootDay[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const load = useCallback(async () => {
    setLoading(true)
    setError(null)
    const result = await apiRequest<ShootDay[]>(apiPath('/api/shoots', { syndicateId: syndicate.id }))
    if (result.ok) setShoots(result.data)
    else setError(result.error)
    setLoading(false)
  }, [syndicate.id])

  useEffect(() => {
    void load()
  }, [load])

  return (
    <DashboardLayout>
      <Helmet>
        <title>Shoot days | ShootSync</title>
      </Helmet>

      <div className="space-y-6">
        <div className="flex flex-col sm:flex-row justify-between sm:items-center gap-4">
          <h1 className="text-2xl font-bold text-white">Shoot days</h1>
          <ButtonLink to="/shoots/new">Schedule a shoot day</ButtonLink>
        </div>

        {loading ? (
          <div className="flex justify-center items-center h-64">
            <LoadingSpinner size="lg" />
          </div>
        ) : error ? (
          <Card>
            <div role="alert" className="text-center py-6">
              <p className="text-slate-200 mb-4">{error}</p>
              <Button onClick={() => void load()}>Try again</Button>
            </div>
          </Card>
        ) : shoots.length === 0 ? (
          <Card>
            <div className="text-center py-8">
              <p className="text-slate-300 mb-4">No shoot days scheduled yet.</p>
              <ButtonLink to="/shoots/new">Schedule your first shoot day</ButtonLink>
            </div>
          </Card>
        ) : (
          <ul className="space-y-4">
            {shoots.map((shoot) => (
              <li key={shoot.id}>
                <Card hover>
                  <div className="flex flex-col sm:flex-row justify-between sm:items-start gap-3">
                    <div>
                      <h2 className="text-lg font-semibold text-white">{shoot.locationName}</h2>
                      <p className="text-slate-300">{formatDate(shoot.date)} • Meet {shoot.meetTime}</p>
                      <p className="text-slate-400 text-sm mt-1">
                        {shoot.drivesPlanned} {shoot.drivesPlanned === 1 ? 'drive' : 'drives'} planned
                        {shoot._count && ` • ${shoot._count.attendances} guns • ${shoot._count.beaterBookings} beaters`}
                      </p>
                    </div>
                    <div className="flex items-center gap-3">
                      <span className={`px-3 py-1 rounded-full text-sm font-medium ${statusColour(shoot.status)}`}>
                        {SHOOT_STATUS_LABEL[shoot.status] ?? shoot.status}
                      </span>
                      <ButtonLink to={`/shoots/${shoot.id}`} variant="secondary" size="sm" aria-label={`Open ${shoot.locationName}, ${formatDate(shoot.date)}`}>
                        Open
                      </ButtonLink>
                    </div>
                  </div>
                </Card>
              </li>
            ))}
          </ul>
        )}
      </div>
    </DashboardLayout>
  )
}
