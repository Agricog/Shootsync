import { useEffect, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { useAuth } from '../../hooks/useAuth'
import { useApi } from '../../hooks/useApi'
import { useSubscription } from '../../hooks/useSubscription'
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

interface Member {
  id: string
  status: string
}

interface ShootDay {
  id: string
  date: string
  locationName: string
  status: string
}

interface DashboardStats {
  activeMembers: number
  nextShoot: ShootDay | null
  seasonBag: number
  outstandingPayments: number
}

export default function CaptainDashboard() {
  const { user } = useAuth()
  const { fetchAll, loading, error } = useApi<Syndicate>('syndicates')
  const [syndicates, setSyndicates] = useState<Syndicate[]>([])
  const [stats, setStats] = useState<DashboardStats>({
    activeMembers: 0,
    nextShoot: null,
    seasonBag: 0,
    outstandingPayments: 0,
  })
  const [statsLoading, setStatsLoading] = useState(false)

  const memberApi = useApi<Member>('members')
  const shootApi = useApi<ShootDay>('shoots')
  const navigate = useNavigate()
  
  const [syndicateId, setSyndicateId] = useState<string | null>(null)
  const { isActive, loading: subLoading } = useSubscription(syndicateId)

  useEffect(() => {
    if (user?.id) {
      loadSyndicates()
    }
  }, [user?.id])

  const loadSyndicates = async () => {
    const data = await fetchAll({ captainClerkId: user?.id || '' })
    setSyndicates(data)
    
    if (data.length > 0) {
      setSyndicateId(data[0].id)
      loadStats(data[0].id)
    }
  }

  // Redirect to subscribe if no active subscription
  useEffect(() => {
    if (syndicateId && !subLoading && !isActive) {
      navigate('/subscribe')
    }
  }, [syndicateId, subLoading, isActive, navigate])

  const loadStats = async (syndicateId: string) => {
    setStatsLoading(true)
    try {
      // Fetch members
      const members = await memberApi.fetchAll({ syndicateId })
      const activeMembers = members.filter((m: Member) => m.status === 'ACTIVE').length

      // Fetch shoots
      const shoots = await shootApi.fetchAll({ syndicateId })
      const upcomingShoots = shoots
        .filter((s: ShootDay) => new Date(s.date) >= new Date() && s.status === 'SCHEDULED')
        .sort((a: ShootDay, b: ShootDay) => new Date(a.date).getTime() - new Date(b.date).getTime())
      const nextShoot = upcomingShoots.length > 0 ? upcomingShoots[0] : null

      // Fetch season bag totals
      let seasonBag = 0
      try {
        const bagResponse = await fetch(`/api/bags/season?syndicateId=${syndicateId}`)
        if (bagResponse.ok) {
          const bagData = await bagResponse.json()
          seasonBag = bagData.total || 0
        }
      } catch (err) {
        console.error('Failed to fetch bag totals:', err)
      }

      // TODO: Fetch outstanding payments when payment system is implemented
      const outstandingPayments = 0

      setStats({
        activeMembers,
        nextShoot,
        seasonBag,
        outstandingPayments,
      })
    } catch (err) {
      console.error('Failed to load stats:', err)
    }
    setStatsLoading(false)
  }

  if (loading || subLoading) {
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

  // Format next shoot display
  const formatNextShoot = () => {
    if (!stats.nextShoot) return { value: 'TBD', subtitle: 'No shoots scheduled' }
    const date = new Date(stats.nextShoot.date)
    const formatted = date.toLocaleDateString('en-GB', { day: 'numeric', month: 'short' })
    return { value: formatted, subtitle: stats.nextShoot.locationName }
  }

  const nextShootDisplay = formatNextShoot()

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
          <StatCard 
            title="Total Members" 
            value={statsLoading ? '...' : stats.activeMembers.toString()} 
            subtitle="Active members" 
          />
          <StatCard 
            title="Next Shoot" 
            value={statsLoading ? '...' : nextShootDisplay.value} 
            subtitle={nextShootDisplay.subtitle} 
          />
          <StatCard 
            title="Season Bag" 
            value={statsLoading ? '...' : stats.seasonBag.toString()} 
            subtitle="birds recorded" 
          />
          <StatCard 
            title="Outstanding" 
            value={statsLoading ? '...' : `£${stats.outstandingPayments}`} 
            subtitle="payments pending" 
          />
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
