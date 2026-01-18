import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { useAuth } from '../../hooks/useAuth'
import { useSmartSuite } from '../../hooks/useSmartSuite'
import DashboardLayout from '../../components/layout/DashboardLayout'
import Card, { StatCard } from '../../components/common/Card'
import LoadingSpinner from '../../components/common/LoadingSpinner'
import Button from '../../components/common/Button'

interface Syndicate {
  id: string
  name: string
  season_start: string
  season_end: string
  subscription_amount: number
  status: string
}

export default function CaptainDashboard() {
  const { user } = useAuth()
  const { fetchRecords, loading, error } = useSmartSuite<Syndicate>('syndicates')
  const [syndicates, setSyndicates] = useState<Syndicate[]>([])

  useEffect(() => {
    loadSyndicates()
  }, [])

  const loadSyndicates = async () => {
    // For now, fetch all syndicates where captain_clerk_id matches current user
    const data = await fetchRecords({
      captain_clerk_id: user?.id
    })
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

  // If no syndicates, show setup screen
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

  const activeSyndicate = syndicates[0] // For now, use the first syndicate

  return (
    <DashboardLayout>
      <div className="space-y-6">
        {/* Header */}
        <div className="flex justify-between items-start">
          <div>
            <h1 className="text-2xl font-bold mb-2">{activeSyndicate.name}</h1>
            <p className="text-gray-600 dark:text-gray-400">
              Season: {new Date(activeSyndicate.season_start).toLocaleDateString()} - {new Date(activeSyndicate.season_end).toLocaleDateString()}
            </p>
          </div>
          <Link to="/settings">
            <Button variant="secondary">Settings</Button>
          </Link>
        </div>

        {/* Stats Overview */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          <StatCard
            title="Total Members"
            value="0"
            subtitle="Loading..."
          />
          <StatCard
            title="Next Shoot"
            value="TBD"
            subtitle="No shoots scheduled"
          />
          <StatCard
            title="Season Bag"
            value="0"
            subtitle="birds recorded"
          />
          <StatCard
            title="Outstanding"
            value={`£0`}
            subtitle="payments pending"
          />
        </div>

        {/* Quick Actions */}
        <Card>
          <h2 className="text-lg font-semibold mb-4">Quick Actions</h2>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <Link to="/shoots/new" className="block">
              <Button variant="primary" className="w-full">
                Schedule Shoot Day
              </Button>
            </Link>
            <Link to="/members" className="block">
              <Button variant="secondary" className="w-full">
                Invite Members
              </Button>
            </Link>
            <Link to="/bags/record" className="block">
              <Button variant="secondary" className="w-full">
                Record Bag
              </Button>
            </Link>
          </div>
        </Card>

        {/* Recent Activity */}
        <Card>
          <h2 className="text-lg font-semibold mb-4">Recent Activity</h2>
          <p className="text-gray-600 dark:text-gray-400">
            No recent activity yet. Start by inviting members or scheduling a shoot day.
          </p>
        </Card>

        {/* Upcoming Shoots */}
        <Card>
          <div className="flex justify-between items-center mb-4">
            <h2 className="text-lg font-semibold">Upcoming Shoots</h2>
            <Link to="/shoots">
              <Button variant="ghost" size="sm">View All</Button>
            </Link>
          </div>
          <p className="text-gray-600 dark:text-gray-400">
            No shoots scheduled yet.
          </p>
        </Card>
      </div>
    </DashboardLayout>
  )
}
