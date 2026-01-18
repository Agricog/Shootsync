import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { useAuth } from '../../hooks/useAuth'
import { useApi } from '../../hooks/useApi'
import DashboardLayout from '../../components/layout/DashboardLayout'
import Card, { StatCard } from '../../components/common/Card'
import LoadingSpinner from '../../components/common/LoadingSpinner'
import Button from '../../components/common/Button'

interface Syndicate {
  id: string
  name: string
  seasonStart: string
  seasonEnd: string
  subscriptionAmount: number
  status: string
}

export default function CaptainDashboard() {
  const { user } = useAuth()
  const { fetchAll, loading, error } = useApi<Syndicate>('syndicates')
  const [syndicates, setSyndicates] = useState<Syndicate[]>([])

  useEffect(() => {
    if (user?.id) {
      loadSyndicates()
    }
  }, [user?.id])

  const loadSyndicates = async () => {
    const data = await fetchAll({ captainClerkId: user?.id || '' })
    setSyndicates(data)
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

  if (error) {
    return (
      <DashboardLayout>
        <div className="bg-red-50 dark:bg-red-900/20 p-4 rounded-lg">
          <p className="text-red-800 dark:text-red-200">Error loading syndicates: {error}</p>
          <Button onClick={loadSyndicates} className="mt-4">
            Retry
          </Button>
        </div>
      </DashboardLayout>
    )
  }

  if (syndicates.length === 0) {
    return (
      <DashboardLayout>
        <div className="max-w-2xl mx-auto text-center py-12">
          <h1 className="text-3xl font-bold mb-4">Welcome to ShootSync! 🎯</h1>
          <p className="text-gray-600 dark:text-gray-400 mb-8">
            Let's get started by creating your first syndicate.
          </p>
          <Link to="/syndicate/create">
            <Button size="lg">Create Your Syndicate</Button>
          </Link>
        </div>
      </DashboardLayout>
    )
  }

  const activeSyndicate = syndicates[0]

  return (
    <DashboardLayout>
      <div className="space-y-6">
        <div className="flex justify-between items-start">
          <div>
           <h1 className="text-2xl font-bold mb-2 text-white">{activeSyndicate.name}</h1>
            <p className="text-gray-300">
  Season: {new Date(activeSyndicate.seasonStart).toLocaleDateString()} - {new Date(activeSyndicate.seasonEnd).toLocaleDateString()}
</p>
          </div>
          <Link to="/settings">
            <Button variant="secondary">Settings</Button>
          </Link>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          <StatCard title="Total Members" value="0" subtitle="Active members" />
          <StatCard title="Next Shoot" value="TBD" subtitle="No shoots scheduled" />
          <StatCard title="Season Bag" value="0" subtitle="birds recorded" />
          <StatCard title="Outstanding" value="£0" subtitle="payments pending" />
        </div>

        <Card>
          <h2 className="text-lg font-semibold mb-4">Quick Actions</h2>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <Link to="/shoots/new" className="block">
              <Button variant="primary" className="w-full">Schedule Shoot Day</Button>
            </Link>
            <Link to="/members" className="block">
              <Button variant="secondary" className="w-full">Invite Members</Button>
            </Link>
            <Link to="/bags/record" className="block">
              <Button variant="secondary" className="w-full">Record Bag</Button>
            </Link>
          </div>
        </Card>

        <Card>
          <h2 className="text-lg font-semibold mb-4">Recent Activity</h2>
          <p className="text-gray-600 dark:text-gray-400">
            No recent activity yet. Start by inviting members or scheduling a shoot day.
          </p>
        </Card>
      </div>
    </DashboardLayout>
  )
}
