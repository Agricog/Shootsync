/**
 * My Earnings Page - ShootSync
 * Earnings history for beaters
 */

import { Helmet } from 'react-helmet-async'
import DashboardLayout from '../../components/layout/DashboardLayout'
import Card, { CardHeader, CardContent } from '../../components/common/Card'
import { formatCurrency } from '../../config/stripe'

const EARNINGS = [
  { id: '1', date: '2026-01-11', location: 'Manor Fields', amount: 4000, status: 'owed' as const },
  { id: '2', date: '2026-01-04', location: 'Beatrice Farm', amount: 4000, status: 'owed' as const },
  { id: '3', date: '2025-12-28', location: 'Oakwood Estate', amount: 4000, status: 'paid' as const, paidDate: '2026-01-08' },
  { id: '4', date: '2025-12-21', location: 'Beatrice Farm', amount: 4000, status: 'paid' as const, paidDate: '2026-01-08' },
  { id: '5', date: '2025-12-14', location: 'Manor Fields', amount: 4000, status: 'paid' as const, paidDate: '2025-12-20' },
  { id: '6', date: '2025-12-07', location: 'Beatrice Farm', amount: 4000, status: 'paid' as const, paidDate: '2025-12-20' },
  { id: '7', date: '2025-11-30', location: 'Oakwood Estate', amount: 4000, status: 'paid' as const, paidDate: '2025-12-10' },
  { id: '8', date: '2025-11-23', location: 'Beatrice Farm', amount: 4000, status: 'paid' as const, paidDate: '2025-12-10' },
]

export default function MyEarnings() {
  const totalEarned = EARNINGS.reduce((sum, e) => sum + e.amount, 0)
  const totalPaid = EARNINGS.filter(e => e.status === 'paid').reduce((sum, e) => sum + e.amount, 0)
  const totalOwed = EARNINGS.filter(e => e.status === 'owed').reduce((sum, e) => sum + e.amount, 0)

  return (
    <>
      <Helmet>
        <title>My Earnings - ShootSync</title>
        <meta name="robots" content="noindex, nofollow" />
      </Helmet>

      <DashboardLayout
        title="My Earnings"
        subtitle="Season 2025-26 earnings summary"
      >
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-6">
          <Card>
            <CardContent>
              <p className="text-slate-400 text-sm">Total Earned</p>
              <p className="text-3xl font-bold text-white mt-1">{formatCurrency(totalEarned)}</p>
              <p className="text-slate-500 text-sm mt-1">{EARNINGS.length} days worked</p>
            </CardContent>
          </Card>
          <Card>
            <CardContent>
              <p className="text-slate-400 text-sm">Paid</p>
              <p className="text-3xl font-bold text-green-500 mt-1">{formatCurrency(totalPaid)}</p>
            </CardContent>
          </Card>
          <Card>
            <CardContent>
              <p className="text-slate-400 text-sm">Outstanding</p>
              <p className="text-3xl font-bold text-amber-400 mt-1">{formatCurrency(totalOwed)}</p>
            </CardContent>
          </Card>
        </div>

        <Card>
          <CardHeader title="Earnings History" />
          <CardContent>
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr className="border-b border-slate-700">
                    <th className="text-left py-3 px-4 text-slate-400 font-medium text-sm">Date Worked</th>
                    <th className="text-left py-3 px-4 text-slate-400 font-medium text-sm">Location</th>
                    <th className="text-right py-3 px-4 text-slate-400 font-medium text-sm">Amount</th>
                    <th className="text-right py-3 px-4 text-slate-400 font-medium text-sm">Status</th>
                    <th className="text-right py-3 px-4 text-slate-400 font-medium text-sm">Paid Date</th>
                  </tr>
                </thead>
                <tbody>
                  {EARNINGS.map((earning) => (
                    <tr key={earning.id} className="border-b border-slate-700/50">
                      <td className="py-3 px-4 text-slate-300">
                        {new Date(earning.date).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' })}
                      </td>
                      <td className="py-3 px-4 text-white">{earning.location}</td>
                      <td className="py-3 px-4 text-right text-white">{formatCurrency(earning.amount)}</td>
                      <td className="py-3 px-4 text-right">
                        <span className={`inline-flex px-2 py-1 text-xs font-medium rounded border ${
                          earning.status === 'paid'
                            ? 'bg-green-500/10 text-green-400 border-green-500/20'
                            : 'bg-amber-500/10 text-amber-400 border-amber-500/20'
                        }`}>
                          {earning.status === 'paid' ? 'Paid' : 'Owed'}
                        </span>
                      </td>
                      <td className="py-3 px-4 text-right text-slate-400">
                        {earning.paidDate
                          ? new Date(earning.paidDate).toLocaleDateString('en-GB', { day: 'numeric', month: 'short' })
                          : '-'}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </CardContent>
        </Card>
      </DashboardLayout>
    </>
  )
}
