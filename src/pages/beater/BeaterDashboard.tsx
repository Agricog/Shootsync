/**
 * Beater Dashboard - ShootSync
 * Dashboard for beaters
 */

import { Helmet } from 'react-helmet-async'
import { Link } from 'react-router-dom'
import DashboardLayout from '../../components/layout/DashboardLayout'
import { PageGrid } from '../../components/layout/DashboardLayout'
import Card, { CardHeader, CardContent, StatCard } from '../../components/common/Card'
import Button from '../../components/common/Button'
import { formatCurrency } from '../../config/stripe'

export default function BeaterDashboard() {
  const todaysShoot = {
    date: '2026-01-11',
    location: 'Manor Fields',
    meetTime: '08:30',
    isToday: true,
    checkedIn: false,
  }

  return (
    <>
      <Helmet>
        <title>Beater Dashboard - ShootSync</title>
        <meta name="robots" content="noindex, nofollow" />
      </Helmet>

      <DashboardLayout
        title="Welcome back, Pete"
        subtitle="Beatrice Pheasant Syndicate"
      >
        {todaysShoot.isToday && !todaysShoot.checkedIn && (
          <Card className="mb-6 border-green-500/50 bg-green-500/5">
            <CardContent>
              <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
                <div>
                  <p className="text-green-400 font-semibold text-lg">Today's Shoot</p>
                  <p className="text-white">{todaysShoot.location}</p>
                  <p className="text-slate-400 text-sm">Meet: {todaysShoot.meetTime}</p>
                </div>
                <Button size="lg">Check In</Button>
              </div>
            </CardContent>
          </Card>
        )}

        <PageGrid columns={3}>
          <StatCard label="Days This Season" value="8" />
          <StatCard label="Total Earned" value={formatCurrency(32000)} />
          <StatCard label="Outstanding" value={formatCurrency(8000)} />
        </PageGrid>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mt-6">
          <Card>
            <CardHeader title="Upcoming Bookings" />
            <CardContent>
              <div className="space-y-3">
                <BookingRow
                  date="Sat 18 Jan"
                  location="Beatrice Farm"
                  rate={40}
                  status="confirmed"
                />
                <BookingRow
                  date="Sat 25 Jan"
                  location="Oakwood Estate"
                  rate={40}
                  status="invited"
                />
                <BookingRow
                  date="Sat 1 Feb"
                  location="Manor Fields"
                  rate={40}
                  status="invited"
                />
              </div>
              <div className="mt-4 pt-4 border-t border-slate-700">
                <Link to="/beater/bookings" className="text-green-500 text-sm hover:text-green-400">
                  View all bookings →
                </Link>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader title="Recent Earnings" />
            <CardContent>
              <div className="space-y-3">
                <EarningRow date="11 Jan" location="Manor Fields" amount={4000} status="owed" />
                <EarningRow date="4 Jan" location="Beatrice Farm" amount={4000} status="owed" />
                <EarningRow date="28 Dec" location="Oakwood Estate" amount={4000} status="paid" />
                <EarningRow date="21 Dec" location="Beatrice Farm" amount={4000} status="paid" />
              </div>
              <div className="mt-4 pt-4 border-t border-slate-700">
                <Link to="/beater/earnings" className="text-green-500 text-sm hover:text-green-400">
                  View all earnings →
                </Link>
              </div>
            </CardContent>
          </Card>
        </div>
      </DashboardLayout>
    </>
  )
}

interface BookingRowProps {
  date: string
  location: string
  rate: number
  status: 'invited' | 'confirmed' | 'declined'
}

function BookingRow({ date, location, rate, status }: BookingRowProps) {
  return (
    <div className="flex items-center justify-between py-2 border-b border-slate-700 last:border-0">
      <div>
        <p className="text-white text-sm">{location}</p>
        <p className="text-slate-500 text-xs">{date} • {formatCurrency(rate * 100)}</p>
      </div>
      <div>
        {status === 'invited' ? (
          <div className="flex gap-2">
            <Button size="sm">Confirm</Button>
            <Button size="sm" variant="ghost">Decline</Button>
          </div>
        ) : status === 'confirmed' ? (
          <span className="text-green-400 text-sm">Confirmed ✓</span>
        ) : (
          <span className="text-slate-500 text-sm">Declined</span>
        )}
      </div>
    </div>
  )
}

interface EarningRowProps {
  date: string
  location: string
  amount: number
  status: 'owed' | 'paid'
}

function EarningRow({ date, location, amount, status }: EarningRowProps) {
  return (
    <div className="flex items-center justify-between py-2 border-b border-slate-700 last:border-0">
      <div>
        <p className="text-white text-sm">{location}</p>
        <p className="text-slate-500 text-xs">{date}</p>
      </div>
      <div className="text-right">
        <p className={status === 'paid' ? 'text-green-400' : 'text-amber-400'}>
          {formatCurrency(amount)}
        </p>
        <p className="text-slate-500 text-xs">{status === 'paid' ? 'Paid' : 'Owed'}</p>
      </div>
    </div>
  )
}
