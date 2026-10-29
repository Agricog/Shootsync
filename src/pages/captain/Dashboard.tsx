import { useCallback, useEffect, useRef, useState } from 'react'
import { Navigate } from 'react-router-dom'
import { Helmet } from 'react-helmet-async'
import { useCanWrite, useCaptainSyndicate } from '../../context/SyndicateContext'
import { apiPath, apiRequest } from '../../lib/api'
import { londonDate } from '../../utils/beaterPayCalculator'
import { nextShootFrom } from '../../lib/shootDays'
import { formatCurrency } from '../../config/stripe'
import DashboardLayout from '../../components/layout/DashboardLayout'
import Card, { StatCard } from '../../components/common/Card'
import Button, { ButtonLink } from '../../components/common/Button'

interface Member {
  id: string
  status: string
  role: string
}

interface ShootDay {
  id: string
  date: string
  locationName: string
  status: string
}

interface DashboardStats {
  activeMembers: number | null
  nextShoot: ShootDay | null | undefined
  seasonBag: number | null
  owedToBeaters: number | null
}

const UNKNOWN: DashboardStats = { activeMembers: null, nextShoot: undefined, seasonBag: null, owedToBeaters: null }

const dash = '–'

export default function CaptainDashboard() {
  const syndicate = useCaptainSyndicate()
  const [stats, setStats] = useState<DashboardStats>(UNKNOWN)
  const [loading, setLoading] = useState(true)
  const [problems, setProblems] = useState<string[]>([])

  // Only the latest load may update the screen: after switching syndicate, a slow answer
  // about the previous one is thrown away rather than shown under the new one's name.
  const latest = useRef(0)

  const load = useCallback(async () => {
    const mine = ++latest.current
    setLoading(true)
    const id = syndicate.id
    const [members, shoots, bag, owed] = await Promise.all([
      apiRequest<Member[]>(apiPath('/api/members', { syndicateId: id })),
      apiRequest<ShootDay[]>(apiPath('/api/shoots', { syndicateId: id })),
      apiRequest<{ total?: number }>(apiPath('/api/bags/season', { syndicateId: id })),
      apiRequest<{ totalOutstanding?: number }>(apiPath('/api/beaters/payments/owed', { syndicateId: id })),
    ])
    if (mine !== latest.current) return
    // A figure that didn't load shows as a dash, never as a misleading nought.
    setStats({
      activeMembers: members.ok ? members.data.filter((m) => m.status === 'ACTIVE' && m.role !== 'BEATER').length : null,
      nextShoot: shoots.ok ? nextShootFrom(shoots.data, londonDate(new Date())) : undefined,
      seasonBag: bag.ok ? bag.data.total ?? 0 : null,
      owedToBeaters: owed.ok ? owed.data.totalOutstanding ?? 0 : null,
    })
    setProblems([...new Set([members, shoots, bag, owed].flatMap((r) => (r.ok ? [] : [r.error])))])
    setLoading(false)
  }, [syndicate.id])

  // A syndicate that has never had a plan starts on the plan page. One whose plan has lapsed
  // opens as usual, read-only, with the notice saying why.
  const neverSubscribed = syndicate.subscription.status === null
  const canWrite = useCanWrite()
  useEffect(() => {
    if (!neverSubscribed) void load()
  }, [load, neverSubscribed])

  if (neverSubscribed) return <Navigate to="/subscribe" replace />

  const next = stats.nextShoot
  const nextShoot =
    next === undefined
      ? { value: dash, subtitle: 'Couldn’t load shoot days' }
      : next === null
        ? { value: 'None', subtitle: 'No shoot days scheduled' }
        : { value: new Date(next.date).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', timeZone: 'UTC' }), subtitle: next.locationName }

  const show = (value: string) => (loading ? '…' : value)
  const seasonDate = (iso: string) => new Date(iso).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric', timeZone: 'UTC' })

  return (
    <DashboardLayout>
      <Helmet>
        <title>Dashboard | ShootSync</title>
      </Helmet>

      <div className="space-y-6">
        <div className="flex flex-col sm:flex-row justify-between items-start gap-4">
          <div>
            <h1 className="text-2xl font-bold mb-2 text-white">{syndicate.name}</h1>
            <p className="text-slate-300">
              Season: {seasonDate(syndicate.seasonStart)} to {seasonDate(syndicate.seasonEnd)}
            </p>
          </div>
          <ButtonLink to="/settings" variant="secondary">Settings</ButtonLink>
        </div>

        {problems.length > 0 && !loading && (
          <div role="alert" className="rounded-lg border border-amber-500/40 bg-amber-900/20 p-4 text-amber-100">
            <p>Some figures didn’t load: {problems.join(' ')}</p>
            <Button variant="secondary" size="sm" className="mt-3" onClick={() => void load()}>Try again</Button>
          </div>
        )}

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          <StatCard title="Members" value={show(stats.activeMembers === null ? dash : String(stats.activeMembers))} subtitle="Active guns" />
          <StatCard title="Next shoot" value={show(nextShoot.value)} subtitle={loading ? undefined : nextShoot.subtitle} />
          <StatCard title="Season bag" value={show(stats.seasonBag === null ? dash : String(stats.seasonBag))} subtitle="Head this season" />
          <StatCard title="Beaters owed" value={show(stats.owedToBeaters === null ? dash : formatCurrency(stats.owedToBeaters))} subtitle="Not yet paid" />
        </div>

        <Card>
          <h2 className="text-lg font-semibold text-white mb-4">Quick actions</h2>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            {canWrite && <ButtonLink to="/shoots/new" fullWidth>Schedule a shoot day</ButtonLink>}
            <ButtonLink to="/members" variant="secondary" fullWidth>Members</ButtonLink>
            <ButtonLink to="/bags/record" variant="secondary" fullWidth>Game book</ButtonLink>
          </div>
        </Card>
      </div>
    </DashboardLayout>
  )
}
