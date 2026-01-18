import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { Helmet } from 'react-helmet-async'
import { useAuth } from '../../hooks/useAuth'
import { useApi } from '../../hooks/useApi'
import DashboardLayout from '../../components/layout/DashboardLayout'
import Card from '../../components/common/Card'
import Button from '../../components/common/Button'
import LoadingSpinner from '../../components/common/LoadingSpinner'

interface Syndicate {
  id: string
  name: string
}

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

export default function Shoots() {
  const { user } = useAuth()
  const syndicateApi = useApi<Syndicate>('syndicates')
  const [, setSyndicateId] = useState<string | null>(null)
  const [shoots, setShoots] = useState<ShootDay[]>([])
  const [loading, setLoading] = useState(true)

  const shootApi = useApi<ShootDay>('shoots')

  useEffect(() => {
    if (user?.id) {
      loadData()
    }
  }, [user?.id])

  const loadData = async () => {
    setLoading(true)
    const syndicates = await syndicateApi.fetchAll({ captainClerkId: user?.id || '' })
    if (syndicates.length > 0) {
      setSyndicateId(syndicates[0].id)
      const shootData = await shootApi.fetchAll({ syndicateId: syndicates[0].id })
      setShoots(shootData)
    }
    setLoading(false)
  }

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('en-GB', {
      weekday: 'short',
      day: 'numeric',
      month: 'short',
      year: 'numeric'
    })
  }

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'SCHEDULED': return 'bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200'
      case 'COMPLETED': return 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200'
      case 'CANCELLED': return 'bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200'
      default: return 'bg-gray-100 text-gray-800 dark:bg-gray-700 dark:text-gray-200'
    }
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

  return (
    <DashboardLayout>
      <Helmet>
        <title>Shoot Days | ShootSync</title>
      </Helmet>

      <div className="space-y-6">
        <div className="flex justify-between items-center">
          <h1 className="text-2xl font-bold text-white">Shoot Days</h1>
          <Link to="/shoots/new">
            <Button>Schedule New Shoot</Button>
          </Link>
        </div>

        {shoots.length === 0 ? (
          <Card>
            <div className="text-center py-8">
              <p className="text-gray-400 mb-4">No shoot days scheduled yet.</p>
              <Link to="/shoots/new">
                <Button>Schedule Your First Shoot</Button>
              </Link>
            </div>
          </Card>
        ) : (
          <div className="space-y-4">
            {shoots.map((shoot) => (
              <Card key={shoot.id} hover>
                <div className="flex justify-between items-start">
                  <div>
                    <h3 className="text-lg font-semibold text-white">{shoot.locationName}</h3>
                    <p className="text-gray-300">{formatDate(shoot.date)} • Meet {shoot.meetTime}</p>
                    <p className="text-gray-400 text-sm mt-1">
                      {shoot.drivesPlanned} drives planned
                      {shoot._count && ` • ${shoot._count.attendances} guns • ${shoot._count.beaterBookings} beaters`}
                    </p>
                  </div>
                  <div className="flex items-center gap-3">
                    <span className={`px-3 py-1 rounded-full text-sm font-medium ${getStatusColor(shoot.status)}`}>
                      {shoot.status}
                    </span>
                    <Link to={`/shoots/${shoot.id}`}>
                      <Button variant="secondary" size="sm">View</Button>
                    </Link>
                  </div>
                </div>
              </Card>
            ))}
          </div>
        )}
      </div>
    </DashboardLayout>
  )
}
