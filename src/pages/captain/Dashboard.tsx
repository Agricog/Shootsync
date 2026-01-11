/**
 * Captain Dashboard - ShootSync
 * Main dashboard for syndicate captains
 */

import { Helmet } from 'react-helmet-async'
import DashboardLayout from '../../components/layout/DashboardLayout'
import { PageGrid } from '../../components/layout/DashboardLayout'
import Card, { CardHeader, CardContent, StatCard } from '../../components/common/Card'
import Button from '../../components/common/Button'
import { useSyndicate, useSeasonDates } from '../../hooks/useSyndicate'
import { Link } from 'react-router-dom'

export default function CaptainDashboard() {
  const { syndicate, isLoading } = useSyndicate()
  const { isInSeason, daysRemaining } = useSeasonDates()

  if (isLoading) {
    return (
      <DashboardLayout title="Dashboard">
        <div className="animate-pulse space-y-6">
          <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
            {[1, 2, 3, 4].map(i => (
              <div key={i} className="h-24 bg-slate-800 rounded-xl" />
            ))}
          </div>
        </div>
      </DashboardLayout>
    )
  }

  return (
    <>
      <Helmet>
        <title>Dashboard - ShootSync</title>
        <meta name="robots" content="noindex, nofollow" />
      </Helmet>

      <DashboardLayout
        title={syndicate?.name || 'Dashboard'}
        subtitle={isInSeason ? `${daysRemaining} days remaining in season` : 'Off season'}
        action={
          <Link to="/shoots/new">
            <Button>Create Shoot</Button>
          </Link>
        }
      >
        <PageGrid columns={4}>
          <StatCard
            label="Members"
            value="8"
            icon={<UsersIcon />}
          />
          <StatCard
            label="Shoots This Season"
            value="12"
            icon={<CalendarIcon />}
          />
          <StatCard
            label="Season Bag"
            value="847"
            icon={<TargetIcon />}
          />
          <StatCard
            label="Outstanding"
            value="£320"
            icon={<PoundIcon />}
          />
        </PageGrid>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mt-6">
          <Card>
            <CardHeader
              title="Upcoming Shoots"
              action={
                <Link to="/shoots" className="text-green-500 text-sm hover:text-green-400">
                  View all
                </Link>
              }
            />
            <CardContent>
              <div className="space-y-3">
                <ShootRow date="Sat 18 Jan" location="Beatrice Farm" confirmed={6} total={8} />
                <ShootRow date="Sat 25 Jan" location="Oakwood Estate" confirmed={4} total={8} />
                <ShootRow date="Sat 1 Feb" location="Manor Fields" confirmed={2} total={8} />
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader
              title="Recent Activity"
              action={
                <Link to="/activity" className="text-green-500 text-sm hover:text-green-400">
                  View all
                </Link>
              }
            />
            <CardContent>
              <div className="space-y-3">
                <ActivityRow
                  text="John Smith confirmed for 18 Jan"
                  time="2 hours ago"
                />
                <ActivityRow
                  text="Bag recorded: 72 birds (11 Jan)"
                  time="Yesterday"
                />
                <ActivityRow
                  text="Dave Wilson payment received: £800"
                  time="2 days ago"
                />
              </div>
            </CardContent>
          </Card>
        </div>

        <Card className="mt-6">
          <CardHeader title="Quick Actions" />
          <CardContent>
            <div className="flex flex-wrap gap-3">
              <Link to="/shoots/new">
                <Button variant="secondary" size="sm">Create Shoot</Button>
              </Link>
              <Link to="/members/invite">
                <Button variant="secondary" size="sm">Invite Member</Button>
              </Link>
              <Link to="/beaters/add">
                <Button variant="secondary" size="sm">Add Beater</Button>
              </Link>
              <Link to="/bags/record">
                <Button variant="secondary" size="sm">Record Bag</Button>
              </Link>
            </div>
          </CardContent>
        </Card>
      </DashboardLayout>
    </>
  )
}

interface ShootRowProps {
  date: string
  location: string
  confirmed: number
  total: number
}

function ShootRow({ date, location, confirmed, total }: ShootRowProps) {
  return (
    <div className="flex items-center justify-between py-2 border-b border-slate-700 last:border-0">
      <div>
        <p className="text-white font-medium">{location}</p>
        <p className="text-slate-400 text-sm">{date}</p>
      </div>
      <div className="text-right">
        <p className="text-white">{confirmed}/{total}</p>
        <p className="text-slate-400 text-sm">confirmed</p>
      </div>
    </div>
  )
}

interface ActivityRowProps {
  text: string
  time: string
}

function ActivityRow({ text, time }: ActivityRowProps) {
  return (
    <div className="flex items-center justify-between py-2 border-b border-slate-700 last:border-0">
      <p className="text-slate-300 text-sm">{text}</p>
      <p className="text-slate-500 text-sm">{time}</p>
    </div>
  )
}

function UsersIcon() {
  return (
    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4.354a4 4 0 110 5.292M15 21H3v-1a6 6 0 0112 0v1zm0 0h6v-1a6 6 0 00-9-5.197M13 7a4 4 0 11-8 0 4 4 0 018 0z" />
    </svg>
  )
}

function CalendarIcon() {
  return (
    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
    </svg>
  )
}

function TargetIcon() {
  return (
    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
    </svg>
  )
}

function PoundIcon() {
  return (
    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
    </svg>
  )
}
