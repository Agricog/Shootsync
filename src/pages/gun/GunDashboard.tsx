/**
 * Gun Dashboard - ShootSync
 * Dashboard for syndicate members (guns)
 */

import { Helmet } from 'react-helmet-async'
import { Link } from 'react-router-dom'
import DashboardLayout from '../../components/layout/DashboardLayout'
import { PageGrid } from '../../components/layout/DashboardLayout'
import Card, { CardHeader, CardContent, StatCard } from '../../components/common/Card'
import Button from '../../components/common/Button'

export default function GunDashboard() {
  return (
    <>
      <Helmet>
        <title>Dashboard - ShootSync</title>
        <meta name="robots" content="noindex, nofollow" />
      </Helmet>

      <DashboardLayout
        title="Welcome back, John"
        subtitle="Beatrice Pheasant Syndicate 2025-26"
      >
        <PageGrid columns={3}>
          <StatCard label="Shoots Attended" value="6" />
          <StatCard label="Season Bag Share" value="127" />
          <StatCard label="Next Shoot" value="18 Jan" />
        </PageGrid>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mt-6">
          <Card>
            <CardHeader title="Upcoming Shoots" />
            <CardContent>
              <div className="space-y-4">
                <UpcomingShootCard
                  date="Sat 18 Jan"
                  location="Beatrice Farm"
                  meetTime="08:30"
                  pegNumber={4}
                  confirmed={true}
                />
                <UpcomingShootCard
                  date="Sat 25 Jan"
                  location="Oakwood Estate"
                  meetTime="09:00"
                  confirmed={false}
                />
                <UpcomingShootCard
                  date="Sat 1 Feb"
                  location="Manor Fields"
                  meetTime="08:30"
                  confirmed={false}
                />
              </div>
              <div className="mt-4 pt-4 border-t border-slate-700">
                <Link to="/shoots" className="text-green-500 text-sm hover:text-green-400">
                  View all shoots →
                </Link>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader title="My Peg History" />
            <CardContent>
              <div className="space-y-3">
                <PegHistoryRow date="11 Jan" location="Manor Fields" peg={7} bag={14} />
                <PegHistoryRow date="4 Jan" location="Beatrice Farm" peg={2} bag={18} />
                <PegHistoryRow date="28 Dec" location="Oakwood Estate" peg={5} bag={12} />
                <PegHistoryRow date="21 Dec" location="Beatrice Farm" peg={9} bag={16} />
              </div>
              <div className="mt-4 pt-4 border-t border-slate-700">
                <Link to="/my-pegs" className="text-green-500 text-sm hover:text-green-400">
                  View full history →
                </Link>
              </div>
            </CardContent>
          </Card>
        </div>

        <Card className="mt-6">
          <CardHeader title="Quick Actions" />
          <CardContent>
            <div className="flex flex-wrap gap-3">
              <Link to="/guests/invite">
                <Button variant="secondary" size="sm">Invite Guest</Button>
              </Link>
              <Link to="/bags/record">
                <Button variant="secondary" size="sm">Record Bag</Button>
              </Link>
              <Link to="/my-payments">
                <Button variant="secondary" size="sm">View Payments</Button>
              </Link>
            </div>
          </CardContent>
        </Card>
      </DashboardLayout>
    </>
  )
}

interface UpcomingShootCardProps {
  date: string
  location: string
  meetTime: string
  pegNumber?: number
  confirmed: boolean
}

function UpcomingShootCard({ date, location, meetTime, pegNumber, confirmed }: UpcomingShootCardProps) {
  return (
    <div className="flex items-center justify-between p-3 bg-slate-800/50 rounded-lg border border-slate-700">
      <div>
        <p className="text-white font-medium">{location}</p>
        <p className="text-slate-400 text-sm">{date} • Meet {meetTime}</p>
      </div>
      <div className="text-right">
        {pegNumber ? (
          <div className="flex items-center gap-2">
            <span className="text-slate-400 text-sm">Peg</span>
            <span className="w-8 h-8 bg-green-600 rounded-full flex items-center justify-center text-white font-bold">
              {pegNumber}
            </span>
          </div>
        ) : confirmed ? (
          <span className="text-green-400 text-sm">Confirmed</span>
        ) : (
          <Button size="sm">Confirm</Button>
        )}
      </div>
    </div>
  )
}

interface PegHistoryRowProps {
  date: string
  location: string
  peg: number
  bag: number
}

function PegHistoryRow({ date, location, peg, bag }: PegHistoryRowProps) {
  return (
    <div className="flex items-center justify-between py-2 border-b border-slate-700 last:border-0">
      <div>
        <p className="text-white text-sm">{location}</p>
        <p className="text-slate-500 text-xs">{date}</p>
      </div>
      <div className="flex items-center gap-4 text-sm">
        <span className="text-slate-400">Peg {peg}</span>
        <span className="text-green-400">{bag} birds</span>
      </div>
    </div>
  )
}
