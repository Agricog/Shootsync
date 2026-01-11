/**
 * Beaters Page - ShootSync
 * Beater management for captains
 */

import { useState } from 'react'
import { Helmet } from 'react-helmet-async'
import DashboardLayout from '../../components/layout/DashboardLayout'
import Card, { CardHeader, CardContent } from '../../components/common/Card'
import Button from '../../components/common/Button'
import Modal, { ModalFooter } from '../../components/common/Modal'
import Input from '../../components/common/Input'
import { validateInput } from '../../utils/validation'
import { formatCurrency } from '../../config/stripe'
import type { Beater } from '../../types/member'

const MOCK_BEATERS: Beater[] = [
  { id: '1', syndicateId: '1', name: 'Pete Brown', email: 'pete@example.com', phone: '07700 900010', dayRate: 40, stripeOnboardingComplete: true, totalDaysWorked: 8, totalOwed: 0, totalPaid: 320, status: 'active' },
  { id: '2', syndicateId: '1', name: 'Steve Jones', email: 'steve@example.com', phone: '07700 900011', dayRate: 40, stripeOnboardingComplete: true, totalDaysWorked: 6, totalOwed: 80, totalPaid: 160, status: 'active' },
  { id: '3', syndicateId: '1', name: 'Tom Clark', email: 'tom@example.com', phone: '07700 900012', dayRate: 45, stripeOnboardingComplete: false, totalDaysWorked: 4, totalOwed: 180, totalPaid: 0, status: 'pending_stripe' },
]

export default function Beaters() {
  const [beaters] = useState<Beater[]>(MOCK_BEATERS)
  const [isAddModalOpen, setIsAddModalOpen] = useState(false)
  const [addForm, setAddForm] = useState({ name: '', email: '', phone: '', dayRate: '40' })
  const [addErrors, setAddErrors] = useState<Record<string, string>>({})
  const [isAdding, setIsAdding] = useState(false)

  const handleAdd = async (e: React.FormEvent) => {
    e.preventDefault()
    const errors: Record<string, string> = {}

    if (!addForm.name.trim()) errors.name = 'Name is required'

    const emailValidation = validateInput(addForm.email, 'email')
    if (!emailValidation.isValid) errors.email = 'Valid email is required'

    const phoneValidation = validateInput(addForm.phone, 'phone')
    if (!phoneValidation.isValid) errors.phone = 'Valid phone number is required'

    const rateValidation = validateInput(addForm.dayRate, 'currency')
    if (!rateValidation.isValid) errors.dayRate = 'Valid day rate is required'

    if (Object.keys(errors).length > 0) {
      setAddErrors(errors)
      return
    }

    setIsAdding(true)
    try {
      console.log('[Beaters] Adding:', addForm)
      await new Promise(resolve => setTimeout(resolve, 1000))
      setIsAddModalOpen(false)
      setAddForm({ name: '', email: '', phone: '', dayRate: '40' })
    } catch (err) {
      setAddErrors({ form: 'Failed to add beater' })
    } finally {
      setIsAdding(false)
    }
  }

  const totalOwed = beaters.reduce((sum, b) => sum + b.totalOwed, 0)

  return (
    <>
      <Helmet>
        <title>Beaters - ShootSync</title>
        <meta name="robots" content="noindex, nofollow" />
      </Helmet>

      <DashboardLayout
        title="Beaters"
        subtitle={`${beaters.length} beaters, ${formatCurrency(totalOwed * 100)} outstanding`}
        action={
          <Button onClick={() => setIsAddModalOpen(true)}>
            Add Beater
          </Button>
        }
      >
        <Card>
          <CardHeader title="All Beaters" />
          <CardContent>
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr className="border-b border-slate-700">
                    <th className="text-left py-3 px-4 text-slate-400 font-medium text-sm">Name</th>
                    <th className="text-left py-3 px-4 text-slate-400 font-medium text-sm">Contact</th>
                    <th className="text-left py-3 px-4 text-slate-400 font-medium text-sm">Day Rate</th>
                    <th className="text-left py-3 px-4 text-slate-400 font-medium text-sm">Days Worked</th>
                    <th className="text-left py-3 px-4 text-slate-400 font-medium text-sm">Owed</th>
                    <th className="text-left py-3 px-4 text-slate-400 font-medium text-sm">Stripe</th>
                    <th className="text-right py-3 px-4 text-slate-400 font-medium text-sm">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {beaters.map((beater) => (
                    <tr key={beater.id} className="border-b border-slate-700/50 hover:bg-slate-800/50">
                      <td className="py-3 px-4">
                        <p className="text-white font-medium">{beater.name}</p>
                      </td>
                      <td className="py-3 px-4">
                        <p className="text-slate-300 text-sm">{beater.email}</p>
                        <p className="text-slate-500 text-sm">{beater.phone}</p>
                      </td>
                      <td className="py-3 px-4 text-slate-300">
                        {formatCurrency(beater.dayRate * 100)}
                      </td>
                      <td className="py-3 px-4 text-slate-300">
                        {beater.totalDaysWorked}
                      </td>
                      <td className="py-3 px-4">
                        <span className={beater.totalOwed > 0 ? 'text-amber-400' : 'text-slate-400'}>
                          {formatCurrency(beater.totalOwed * 100)}
                        </span>
                      </td>
                      <td className="py-3 px-4">
                        {beater.stripeOnboardingComplete ? (
                          <span className="text-green-400 text-sm">Connected</span>
                        ) : (
                          <span className="text-amber-400 text-sm">Pending</span>
                        )}
                      </td>
                      <td className="py-3 px-4 text-right space-x-2">
                        {beater.totalOwed > 0 && beater.stripeOnboardingComplete && (
                          <Button variant="primary" size="sm">Pay</Button>
                        )}
                        <Button variant="ghost" size="sm">View</Button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </CardContent>
        </Card>

        <Modal
          isOpen={isAddModalOpen}
          onClose={() => setIsAddModalOpen(false)}
          title="Add Beater"
          description="Add a new beater to your syndicate"
        >
          <form onSubmit={handleAdd}>
            {addErrors.form && (
              <div className="mb-4 p-3 bg-red-500/10 border border-red-500/20 rounded-lg">
                <p className="text-red-500 text-sm">{addErrors.form}</p>
              </div>
            )}

            <div className="space-y-4">
              <Input
                label="Full name"
                value={addForm.name}
                onChange={(e) => setAddForm(prev => ({ ...prev, name: e.target.value }))}
                error={addErrors.name}
                required
              />
              <Input
                type="email"
                label="Email address"
                value={addForm.email}
                onChange={(e) => setAddForm(prev => ({ ...prev, email: e.target.value }))}
                error={addErrors.email}
                hint="Used for Stripe Connect onboarding"
                required
              />
              <Input
                type="tel"
                label="Phone number"
                value={addForm.phone}
                onChange={(e) => setAddForm(prev => ({ ...prev, phone: e.target.value }))}
                error={addErrors.phone}
                required
              />
              <Input
                type="number"
                label="Day rate (£)"
                value={addForm.dayRate}
                onChange={(e) => setAddForm(prev => ({ ...prev, dayRate: e.target.value }))}
                error={addErrors.dayRate}
                required
              />
            </div>

            <ModalFooter>
              <Button variant="secondary" onClick={() => setIsAddModalOpen(false)}>
                Cancel
              </Button>
              <Button type="submit" isLoading={isAdding}>
                Add Beater
              </Button>
            </ModalFooter>
          </form>
        </Modal>
      </DashboardLayout>
    </>
  )
}
