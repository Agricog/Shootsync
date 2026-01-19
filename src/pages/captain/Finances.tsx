/**
 * Finances Page - ShootSync
 * Financial overview for captains
 */

import { useEffect, useState } from 'react'
import { Helmet } from 'react-helmet-async'
import { useAuth } from '../../hooks/useAuth'
import { useApi } from '../../hooks/useApi'
import DashboardLayout from '../../components/layout/DashboardLayout'
import Card, { CardHeader, CardContent, StatCard } from '../../components/common/Card'
import Button from '../../components/common/Button'
import LoadingSpinner from '../../components/common/LoadingSpinner'
import { formatCurrency } from '../../config/stripe'

interface Syndicate {
  id: string
  name: string
}

interface BeaterPayment {
  id: string
  amount: number
  status: string
}

interface BeaterSummary {
  id: string
  name: string
  email?: string
  phone?: string
  bankName?: string
  bankSortCode?: string
  bankAccountNumber?: string
  dayRate: number
  daysWorked: number
  totalEarned: number
  totalPaid: number
  totalOutstanding: number
  payments: BeaterPayment[]
}

interface PaymentSummary {
  beaters: BeaterSummary[]
  totals: {
    totalOutstanding: number
    totalPaid: number
    totalEarned: number
  }
}

export default function Finances() {
  const { user } = useAuth()
  const syndicateApi = useApi<Syndicate>('syndicates')
  
  const [syndicateId, setSyndicateId] = useState<string | null>(null)
  const [activeTab, setActiveTab] = useState<'overview' | 'beaters'>('overview')
  const [loading, setLoading] = useState(true)
  const [paymentData, setPaymentData] = useState<PaymentSummary | null>(null)
  const [paying, setPaying] = useState<string | null>(null)

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
      await loadPaymentData(syndicates[0].id)
    }
    setLoading(false)
  }

  const loadPaymentData = async (synId: string) => {
    try {
      const response = await fetch(`/api/beaters/payments/summary?syndicateId=${synId}`)
      if (response.ok) {
        const data = await response.json()
        setPaymentData(data)
      }
    } catch (err) {
      console.error('Error loading payment data:', err)
    }
  }

  const handlePayBeater = async (beaterId: string) => {
    const reference = prompt('Enter payment reference (e.g., bank transfer ref):')
    if (!reference) return

    setPaying(beaterId)
    try {
      const response = await fetch(`/api/beaters/pay-all/${beaterId}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ paymentReference: reference }),
      })

      if (response.ok) {
        if (syndicateId) {
          await loadPaymentData(syndicateId)
        }
      }
    } catch (err) {
      console.error('Error paying beater:', err)
    }
    setPaying(null)
  }

  const exportCSV = () => {
    if (!paymentData) return

    const headers = ['Name', 'Email', 'Phone', 'Bank Name', 'Sort Code', 'Account Number', 'Days Worked', 'Day Rate', 'Total Earned', 'Total Paid', 'Outstanding']
    const rows = paymentData.beaters.map(b => [
      b.name,
      b.email || '',
      b.phone || '',
      b.bankName || '',
      b.bankSortCode || '',
      b.bankAccountNumber || '',
      b.daysWorked.toString(),
      (b.dayRate / 100).toFixed(2),
      (b.totalEarned / 100).toFixed(2),
      (b.totalPaid / 100).toFixed(2),
      (b.totalOutstanding / 100).toFixed(2),
    ])

    const csvContent = [
      headers.join(','),
      ...rows.map(row => row.map(cell => `"${cell}"`).join(','))
    ].join('\n')

    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' })
    const link = document.createElement('a')
    link.href = URL.createObjectURL(blob)
    link.download = `beater-payments-${new Date().toISOString().split('T')[0]}.csv`
    link.click()
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

  const totals = paymentData?.totals || { totalOutstanding: 0, totalPaid: 0, totalEarned: 0 }

  return (
    <>
      <Helmet>
        <title>Finances - ShootSync</title>
        <meta name="robots" content="noindex, nofollow" />
      </Helmet>

      <DashboardLayout>
        <div className="space-y-6">
          <div className="flex justify-between items-center">
            <div>
              <h1 className="text-2xl font-bold text-white">Finances</h1>
              <p className="text-slate-400">Season 2025-26 financial overview</p>
            </div>
            <Button variant="secondary" onClick={exportCSV}>
              Export CSV
            </Button>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <StatCard
              title="Total Earned (Beaters)"
              value={formatCurrency(totals.totalEarned)}
              subtitle="This season"
            />
            <StatCard
              title="Total Paid"
              value={formatCurrency(totals.totalPaid)}
              subtitle="Payments made"
            />
            <StatCard
              title="Outstanding"
              value={formatCurrency(totals.totalOutstanding)}
              subtitle="Payments due"
            />
          </div>

          <div className="flex gap-2">
            <TabButton active={activeTab === 'overview'} onClick={() => setActiveTab('overview')}>
              Overview
            </TabButton>
            <TabButton active={activeTab === 'beaters'} onClick={() => setActiveTab('beaters')}>
              Beater Payments
            </TabButton>
          </div>

          {activeTab === 'overview' && (
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              <Card>
                <CardHeader title="Outstanding Beater Payments" />
                <CardContent>
                  {paymentData?.beaters.filter(b => b.totalOutstanding > 0).length === 0 ? (
                    <p className="text-slate-400">No outstanding payments</p>
                  ) : (
                    <div className="space-y-3">
                      {paymentData?.beaters
                        .filter(b => b.totalOutstanding > 0)
                        .map(beater => (
                          <div key={beater.id} className="flex items-center justify-between py-2 border-b border-slate-700 last:border-0">
                            <div>
                              <p className="text-white text-sm">{beater.name}</p>
                              <p className="text-slate-500 text-xs">{beater.daysWorked} days worked</p>
                            </div>
                            <span className="text-amber-400">{formatCurrency(beater.totalOutstanding)}</span>
                          </div>
                        ))}
                    </div>
                  )}
                </CardContent>
              </Card>

              <Card>
                <CardHeader title="Payment Summary" />
                <CardContent>
                  <div className="space-y-4">
                    <div className="flex justify-between items-center py-2">
                      <span className="text-slate-400">Active Beaters</span>
                      <span className="text-white font-medium">{paymentData?.beaters.length || 0}</span>
                    </div>
                    <div className="flex justify-between items-center py-2">
                      <span className="text-slate-400">Total Days Worked</span>
                      <span className="text-white font-medium">
                        {paymentData?.beaters.reduce((sum, b) => sum + b.daysWorked, 0) || 0}
                      </span>
                    </div>
                    <div className="flex justify-between items-center py-2 border-t border-slate-700">
                      <span className="text-slate-400">Beaters with Outstanding</span>
                      <span className="text-amber-400 font-medium">
                        {paymentData?.beaters.filter(b => b.totalOutstanding > 0).length || 0}
                      </span>
                    </div>
                  </div>
                </CardContent>
              </Card>
            </div>
          )}

          {activeTab === 'beaters' && (
            <Card>
              <CardHeader title="Beater Payments" />
              <CardContent>
                {paymentData?.beaters.length === 0 ? (
                  <p className="text-slate-400">No beaters found. Add beaters from the Beaters page.</p>
                ) : (
                  <div className="overflow-x-auto">
                    <table className="w-full">
                      <thead>
                        <tr className="border-b border-slate-700">
                          <th className="text-left py-3 px-4 text-slate-400 font-medium text-sm">Beater</th>
                          <th className="text-left py-3 px-4 text-slate-400 font-medium text-sm">Days</th>
                          <th className="text-left py-3 px-4 text-slate-400 font-medium text-sm">Earned</th>
                          <th className="text-left py-3 px-4 text-slate-400 font-medium text-sm">Paid</th>
                          <th className="text-left py-3 px-4 text-slate-400 font-medium text-sm">Outstanding</th>
                          <th className="text-left py-3 px-4 text-slate-400 font-medium text-sm">Bank Details</th>
                          <th className="text-right py-3 px-4 text-slate-400 font-medium text-sm">Actions</th>
                        </tr>
                      </thead>
                      <tbody>
                        {paymentData?.beaters.map(beater => (
                          <tr key={beater.id} className="border-b border-slate-700/50">
                            <td className="py-3 px-4">
                              <p className="text-white">{beater.name}</p>
                              {beater.email && <p className="text-slate-500 text-xs">{beater.email}</p>}
                            </td>
                            <td className="py-3 px-4 text-slate-300">{beater.daysWorked}</td>
                            <td className="py-3 px-4 text-slate-300">{formatCurrency(beater.totalEarned)}</td>
                            <td className="py-3 px-4 text-green-400">{formatCurrency(beater.totalPaid)}</td>
                            <td className="py-3 px-4 text-amber-400">
                              {beater.totalOutstanding > 0 ? formatCurrency(beater.totalOutstanding) : '-'}
                            </td>
                            <td className="py-3 px-4">
                              {beater.bankSortCode && beater.bankAccountNumber ? (
                                <div className="text-xs text-slate-400">
                                  <p>{beater.bankName || 'Bank'}</p>
                                  <p>{beater.bankSortCode} / {beater.bankAccountNumber}</p>
                                </div>
                              ) : (
                                <span className="text-slate-500 text-xs">Not provided</span>
                              )}
                            </td>
                            <td className="py-3 px-4 text-right">
                              {beater.totalOutstanding > 0 && (
                                <Button 
                                  size="sm" 
                                  onClick={() => handlePayBeater(beater.id)}
                                  disabled={paying === beater.id}
                                >
                                  {paying === beater.id ? 'Processing...' : 'Mark Paid'}
                                </Button>
                              )}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </CardContent>
            </Card>
          )}
        </div>
      </DashboardLayout>
    </>
  )
}

interface TabButtonProps {
  active: boolean
  onClick: () => void
  children: React.ReactNode
}

function TabButton({ active, onClick, children }: TabButtonProps) {
  return (
    <button
      onClick={onClick}
      className={`
        px-4 py-2 text-sm font-medium rounded-lg transition-colors
        ${active 
          ? 'bg-slate-700 text-white' 
          : 'text-slate-400 hover:text-white hover:bg-slate-800'
        }
      `}
    >
      {children}
    </button>
  )
}
