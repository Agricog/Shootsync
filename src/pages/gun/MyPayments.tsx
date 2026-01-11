/**
 * My Payments Page - ShootSync
 * Payment history for guns
 */

import { Helmet } from 'react-helmet-async'
import DashboardLayout from '../../components/layout/DashboardLayout'
import Card, { CardHeader, CardContent } from '../../components/common/Card'
import { formatCurrency } from '../../config/stripe'

const PAYMENTS = [
  { id: '1', date: '2025-09-01', type: 'subscription', description: 'Annual Subscription 2025-26', amount: 80000, status: 'paid' },
  { id: '2', date: '2025-11-15', type: 'guest_fee', description: 'Guest: Mike Guest (21 Dec)', amount: 5000, status: 'paid' },
]

export default function MyPayments() {
  const totalPaid = PAYMENTS.filter(p => p.status === 'paid').reduce((sum, p) => sum + p.amount, 0)

  return (
    <>
      <Helmet>
        <title>My Payments - ShootSync</title>
        <meta name="robots" content="noindex, nofollow" />
      </Helmet>

      <DashboardLayout
        title="My Payments"
        subtitle="Payment history and outstanding balances"
      >
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-6">
          <Card>
            <CardContent>
              <p className="text-slate-400 text-sm">Subscription Status</p>
              <p className="text-xl font-bold text-green-500 mt-1">Paid</p>
            </CardContent>
          </Card>
          <Card>
            <CardContent>
              <p className="text-slate-400 text-sm">Total Paid This Season</p>
              <p className="text-xl font-bold text-white mt-1">{formatCurrency(totalPaid)}</p>
            </CardContent>
          </Card>
          <Card>
            <CardContent>
              <p className="text-slate-400 text-sm">Outstanding</p>
              <p className="text-xl font-bold text-white mt-1">{formatCurrency(0)}</p>
            </CardContent>
          </Card>
        </div>

        <Card>
          <CardHeader title="Payment History" />
          <CardContent>
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr className="border-b border-slate-700">
                    <th className="text-left py-3 px-4 text-slate-400 font-medium text-sm">Date</th>
                    <th className="text-left py-3 px-4 text-slate-400 font-medium text-sm">Description</th>
                    <th className="text-left py-3 px-4 text-slate-400 font-medium text-sm">Type</th>
                    <th className="text-right py-3 px-4 text-slate-400 font-medium text-sm">Amount</th>
                    <th className="text-right py-3 px-4 text-slate-400 font-medium text-sm">Status</th>
                  </tr>
                </thead>
                <tbody>
                  {PAYMENTS.map((payment) => (
                    <tr key={payment.id} className="border-b border-slate-700/50">
                      <td className="py-3 px-4 text-slate-300 text-sm">
                        {new Date(payment.date).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' })}
                      </td>
                      <td className="py-3 px-4 text-white">{payment.description}</td>
                      <td className="py-3 px-4">
                        <TypeBadge type={payment.type} />
                      </td>
                      <td className="py-3 px-4 text-right text-white">{formatCurrency(payment.amount)}</td>
                      <td className="py-3 px-4 text-right">
                        <StatusBadge status={payment.status} />
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {PAYMENTS.length === 0 && (
              <p className="text-slate-400 text-center py-8">No payments recorded</p>
            )}
          </CardContent>
        </Card>
      </DashboardLayout>
    </>
  )
}

function TypeBadge({ type }: { type: string }) {
  const styles: Record<string, string> = {
    subscription: 'bg-purple-500/10 text-purple-400 border-purple-500/20',
    guest_fee: 'bg-blue-500/10 text-blue-400 border-blue-500/20',
    other: 'bg-slate-500/10 text-slate-400 border-slate-500/20',
  }

  const labels: Record<string, string> = {
    subscription: 'Subscription',
    guest_fee: 'Guest Fee',
    other: 'Other',
  }

  return (
    <span className={`inline-flex px-2 py-1 text-xs font-medium rounded border ${styles[type] || styles.other}`}>
      {labels[type] || type}
    </span>
  )
}

function StatusBadge({ status }: { status: string }) {
  const styles: Record<string, string> = {
    paid: 'bg-green-500/10 text-green-400 border-green-500/20',
    pending: 'bg-amber-500/10 text-amber-400 border-amber-500/20',
    overdue: 'bg-red-500/10 text-red-400 border-red-500/20',
  }

  return (
    <span className={`inline-flex px-2 py-1 text-xs font-medium rounded border ${styles[status]}`}>
      {status.charAt(0).toUpperCase() + status.slice(1)}
    </span>
  )
}
