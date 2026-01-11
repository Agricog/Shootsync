/**
 * Finances Page - ShootSync
 * Financial overview for captains
 */

import { useState } from 'react'
import { Helmet } from 'react-helmet-async'
import DashboardLayout from '../../components/layout/DashboardLayout'
import { PageGrid } from '../../components/layout/DashboardLayout'
import Card, { CardHeader, CardContent, StatCard } from '../../components/common/Card'
import Button from '../../components/common/Button'
import { formatCurrency } from '../../config/stripe'

export default function Finances() {
  const [activeTab, setActiveTab] = useState<'overview' | 'subscriptions' | 'beaters'>('overview')

  return (
    <>
      <Helmet>
        <title>Finances - ShootSync</title>
        <meta name="robots" content="noindex, nofollow" />
      </Helmet>

      <DashboardLayout
        title="Finances"
        subtitle="Season 2025-26 financial overview"
        action={
          <Button variant="secondary">Export CSV</Button>
        }
      >
        <PageGrid columns={4}>
          <StatCard
            label="Subscriptions Collected"
            value={formatCurrency(640000)}
          />
          <StatCard
            label="Subscriptions Outstanding"
            value={formatCurrency(160000)}
          />
          <StatCard
            label="Guest Fees Collected"
            value={formatCurrency(35000)}
          />
          <StatCard
            label="Beater Payments Due"
            value={formatCurrency(26000)}
          />
        </PageGrid>

        <div className="flex gap-2 mt-8 mb-6">
          <TabButton active={activeTab === 'overview'} onClick={() => setActiveTab('overview')}>
            Overview
          </TabButton>
          <TabButton active={activeTab === 'subscriptions'} onClick={() => setActiveTab('subscriptions')}>
            Subscriptions
          </TabButton>
          <TabButton active={activeTab === 'beaters'} onClick={() => setActiveTab('beaters')}>
            Beater Payments
          </TabButton>
        </div>

        {activeTab === 'overview' && <OverviewTab />}
        {activeTab === 'subscriptions' && <SubscriptionsTab />}
        {activeTab === 'beaters' && <BeatersTab />}
      </DashboardLayout>
    </>
  )
}

function OverviewTab() {
  return (
    <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
      <Card>
        <CardHeader title="Recent Transactions" />
        <CardContent>
          <div className="space-y-3">
            <TransactionRow
              description="Subscription - John Smith"
              amount={80000}
              type="income"
              date="10 Jan 2026"
            />
            <TransactionRow
              description="Beater Payment - Pete Brown"
              amount={-8000}
              type="expense"
              date="8 Jan 2026"
            />
            <TransactionRow
              description="Guest Fee - Mike Guest"
              amount={5000}
              type="income"
              date="5 Jan 2026"
            />
            <TransactionRow
              description="Subscription - Dave Wilson"
              amount={80000}
              type="income"
              date="3 Jan 2026"
            />
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader title="Outstanding Payments" />
        <CardContent>
          <div className="space-y-3">
            <OutstandingRow name="Mike Roberts" amount={80000} dueDate="15 Jan 2026" type="subscription" />
            <OutstandingRow name="Tom Davis" amount={80000} dueDate="15 Jan 2026" type="subscription" />
            <OutstandingRow name="Steve Jones" amount={8000} dueDate="ASAP" type="beater" />
            <OutstandingRow name="Tom Clark" amount={18000} dueDate="ASAP" type="beater" />
          </div>
        </CardContent>
      </Card>
    </div>
  )
}

function SubscriptionsTab() {
  return (
    <Card>
      <CardHeader title="Member Subscriptions" />
      <CardContent>
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr className="border-b border-slate-700">
                <th className="text-left py-3 px-4 text-slate-400 font-medium text-sm">Member</th>
                <th className="text-left py-3 px-4 text-slate-400 font-medium text-sm">Amount</th>
                <th className="text-left py-3 px-4 text-slate-400 font-medium text-sm">Status</th>
                <th className="text-left py-3 px-4 text-slate-400 font-medium text-sm">Paid Date</th>
                <th className="text-right py-3 px-4 text-slate-400 font-medium text-sm">Actions</th>
              </tr>
            </thead>
            <tbody>
              <SubscriptionRow name="John Smith" amount={80000} status="paid" paidDate="10 Jan 2026" />
              <SubscriptionRow name="Dave Wilson" amount={80000} status="paid" paidDate="3 Jan 2026" />
              <SubscriptionRow name="Mike Roberts" amount={80000} status="unpaid" />
              <SubscriptionRow name="Tom Davis" amount={80000} status="unpaid" />
            </tbody>
          </table>
        </div>
      </CardContent>
    </Card>
  )
}

function BeatersTab() {
  return (
    <Card>
      <CardHeader 
        title="Beater Payments" 
        action={<Button size="sm">Pay All Outstanding</Button>}
      />
      <CardContent>
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr className="border-b border-slate-700">
                <th className="text-left py-3 px-4 text-slate-400 font-medium text-sm">Beater</th>
                <th className="text-left py-3 px-4 text-slate-400 font-medium text-sm">Days Worked</th>
                <th className="text-left py-3 px-4 text-slate-400 font-medium text-sm">Total Earned</th>
                <th className="text-left py-3 px-4 text-slate-400 font-medium text-sm">Paid</th>
                <th className="text-left py-3 px-4 text-slate-400 font-medium text-sm">Outstanding</th>
                <th className="text-right py-3 px-4 text-slate-400 font-medium text-sm">Actions</th>
              </tr>
            </thead>
            <tbody>
              <BeaterPaymentRow name="Pete Brown" daysWorked={8} earned={32000} paid={32000} outstanding={0} />
              <BeaterPaymentRow name="Steve Jones" daysWorked={6} earned={24000} paid={16000} outstanding={8000} />
              <BeaterPaymentRow name="Tom Clark" daysWorked={4} earned={18000} paid={0} outstanding={18000} />
            </tbody>
          </table>
        </div>
      </CardContent>
    </Card>
  )
}

interface TransactionRowProps {
  description: string
  amount: number
  type: 'income' | 'expense'
  date: string
}

function TransactionRow({ description, amount, type, date }: TransactionRowProps) {
  return (
    <div className="flex items-center justify-between py-2 border-b border-slate-700 last:border-0">
      <div>
        <p className="text-white text-sm">{description}</p>
        <p className="text-slate-500 text-xs">{date}</p>
      </div>
      <span className={type === 'income' ? 'text-green-400' : 'text-red-400'}>
        {type === 'income' ? '+' : ''}{formatCurrency(amount)}
      </span>
    </div>
  )
}

interface OutstandingRowProps {
  name: string
  amount: number
  dueDate: string
  type: 'subscription' | 'beater'
}

function OutstandingRow({ name, amount, dueDate, type }: OutstandingRowProps) {
  return (
    <div className="flex items-center justify-between py-2 border-b border-slate-700 last:border-0">
      <div>
        <p className="text-white text-sm">{name}</p>
        <p className="text-slate-500 text-xs">{type === 'subscription' ? 'Subscription' : 'Beater payment'} • Due {dueDate}</p>
      </div>
      <span className="text-amber-400">{formatCurrency(amount)}</span>
    </div>
  )
}

interface SubscriptionRowProps {
  name: string
  amount: number
  status: 'paid' | 'unpaid'
  paidDate?: string
}

function SubscriptionRow({ name, amount, status, paidDate }: SubscriptionRowProps) {
  return (
    <tr className="border-b border-slate-700/50">
      <td className="py-3 px-4 text-white">{name}</td>
      <td className="py-3 px-4 text-slate-300">{formatCurrency(amount)}</td>
      <td className="py-3 px-4">
        <span className={`inline-flex px-2 py-1 text-xs font-medium rounded border ${
          status === 'paid' 
            ? 'bg-green-500/10 text-green-400 border-green-500/20' 
            : 'bg-amber-500/10 text-amber-400 border-amber-500/20'
        }`}>
          {status.charAt(0).toUpperCase() + status.slice(1)}
        </span>
      </td>
      <td className="py-3 px-4 text-slate-400">{paidDate || '-'}</td>
      <td className="py-3 px-4 text-right">
        {status === 'unpaid' && <Button size="sm" variant="secondary">Send Reminder</Button>}
      </td>
    </tr>
  )
}

interface BeaterPaymentRowProps {
  name: string
  daysWorked: number
  earned: number
  paid: number
  outstanding: number
}

function BeaterPaymentRow({ name, daysWorked, earned, paid, outstanding }: BeaterPaymentRowProps) {
  return (
    <tr className="border-b border-slate-700/50">
      <td className="py-3 px-4 text-white">{name}</td>
      <td className="py-3 px-4 text-slate-300">{daysWorked}</td>
      <td className="py-3 px-4 text-slate-300">{formatCurrency(earned)}</td>
      <td className="py-3 px-4 text-green-400">{formatCurrency(paid)}</td>
      <td className="py-3 px-4 text-amber-400">{outstanding > 0 ? formatCurrency(outstanding) : '-'}</td>
      <td className="py-3 px-4 text-right">
        {outstanding > 0 && <Button size="sm">Pay Now</Button>}
      </td>
    </tr>
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
