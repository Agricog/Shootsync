/**
 * Guest Accept Page - ShootSync
 */

import { useState } from 'react'
import { Helmet } from 'react-helmet-async'
import Card, { CardHeader, CardContent } from '../../components/common/Card'
import Button from '../../components/common/Button'
import Input from '../../components/common/Input'
import { formatCurrency } from '../../config/stripe'
import { formatLongDate } from '../../utils/dateHelpers'
import { validateRequired, validateInput } from '../../utils/validation'

type Step = 'details' | 'waiver' | 'payment' | 'confirmed'

const MOCK_INVITE = {
  guestName: 'Mike Guest',
  guestEmail: 'mike@example.com',
  shootName: 'Beatrice Farm',
  shootDate: '2026-01-18',
  meetTime: '08:30',
  locationPostcode: 'OX15 4AB',
  syndicateName: 'Beatrice Pheasant Syndicate',
  invitedBy: 'John Smith',
  dayFee: 5000,
}

export default function GuestAccept() {
  const [step, setStep] = useState<Step>('details')
  const [isProcessing, setIsProcessing] = useState(false)
  const [waiverData, setWaiverData] = useState({ emergencyContactName: '', emergencyContactPhone: '' })
  const [errors, setErrors] = useState<Record<string, string>>({})
  const [hasAcceptedWaiver, setHasAcceptedWaiver] = useState(false)

  const invite = MOCK_INVITE

  const handleWaiverSubmit = () => {
    const newErrors: Record<string, string> = {}
    const nameError = validateRequired(waiverData.emergencyContactName, 'Emergency contact name')
    if (nameError) newErrors.emergencyContactName = nameError
    const phoneValidation = validateInput(waiverData.emergencyContactPhone, 'phone')
    if (!phoneValidation.isValid) newErrors.emergencyContactPhone = 'Valid phone required'
    if (!hasAcceptedWaiver) newErrors.acceptance = 'You must accept the waiver'
    if (Object.keys(newErrors).length > 0) { setErrors(newErrors); return }
    setStep('payment')
  }

  const handlePayment = async () => {
    setIsProcessing(true)
    await new Promise(resolve => setTimeout(resolve, 1500))
    setStep('confirmed')
    setIsProcessing(false)
  }

  return (
    <>
      <Helmet>
        <title>Guest Invitation - ShootSync</title>
        <meta name="robots" content="noindex, nofollow" />
      </Helmet>

      <div className="min-h-screen bg-slate-900 py-12 px-4">
        <div className="max-w-lg mx-auto">
          <div className="flex items-center justify-center gap-2 mb-8">
            <div className="w-10 h-10 bg-green-600 rounded-lg flex items-center justify-center">
              <span className="text-white font-bold">SS</span>
            </div>
            <span className="text-white font-semibold text-xl">ShootSync</span>
          </div>

          {step === 'details' && (
            <Card>
              <CardHeader title="You're Invited!" subtitle={`${invite.invitedBy} has invited you to shoot`} />
              <CardContent>
                <div className="space-y-6">
                  <div className="p-4 bg-slate-800 rounded-lg space-y-3">
                    <p className="text-slate-400 text-sm">Shoot</p>
                    <p className="text-white">{invite.shootName}</p>
                    <p className="text-slate-400 text-sm">Date</p>
                    <p className="text-white">{formatLongDate(invite.shootDate)}</p>
                    <p className="text-slate-400 text-sm">Meet Time</p>
                    <p className="text-white">{invite.meetTime}</p>
                  </div>
                  <div className="p-4 bg-green-500/10 border border-green-500/20 rounded-lg flex justify-between">
                    <span className="text-slate-300">Guest Day Fee</span>
                    <span className="text-white font-bold">{formatCurrency(invite.dayFee)}</span>
                  </div>
                  <Button onClick={() => setStep('waiver')} fullWidth>Accept Invitation</Button>
                  <Button variant="ghost" fullWidth>Decline</Button>
                </div>
              </CardContent>
            </Card>
          )}

          {step === 'waiver' && (
            <Card>
              <CardHeader title="Liability Waiver" />
              <CardContent>
                <div className="space-y-6">
                  <div className="h-40 overflow-y-auto p-4 bg-slate-800 rounded-lg text-slate-300 text-sm">
                    <p>By accepting, I confirm I am a competent shot with appropriate insurance, understand the risks, and agree to follow safety instructions.</p>
                  </div>
                  <Input label="Emergency Contact Name" value={waiverData.emergencyContactName} onChange={(e) => setWaiverData(p => ({ ...p, emergencyContactName: e.target.value }))} error={errors.emergencyContactName} required />
                  <Input type="tel" label="Emergency Contact Phone" value={waiverData.emergencyContactPhone} onChange={(e) => setWaiverData(p => ({ ...p, emergencyContactPhone: e.target.value }))} error={errors.emergencyContactPhone} required />
                  <label className="flex items-start gap-3 cursor-pointer">
                    <input type="checkbox" checked={hasAcceptedWaiver} onChange={(e) => setHasAcceptedWaiver(e.target.checked)} className="mt-1 w-4 h-4 rounded border-slate-600 bg-slate-700 text-green-600" />
                    <span className="text-sm text-white">I accept the waiver terms</span>
                  </label>
                  {errors.acceptance && <p className="text-red-500 text-sm">{errors.acceptance}</p>}
                  <Button onClick={handleWaiverSubmit} disabled={!hasAcceptedWaiver} fullWidth>Continue to Payment</Button>
                </div>
              </CardContent>
            </Card>
          )}

          {step === 'payment' && (
            <Card>
              <CardHeader title="Payment" />
              <CardContent>
                <div className="space-y-6">
                  <div className="p-4 bg-slate-800 rounded-lg flex justify-between">
                    <span className="text-slate-400">Total</span>
                    <span className="text-green-500 font-bold text-xl">{formatCurrency(invite.dayFee)}</span>
                  </div>
                  <Button onClick={handlePayment} isLoading={isProcessing} fullWidth>Pay with Card</Button>
                  <p className="text-slate-500 text-xs text-center">Secure payment via Stripe</p>
                </div>
              </CardContent>
            </Card>
          )}

          {step === 'confirmed' && (
            <Card>
              <CardContent>
                <div className="text-center py-8">
                  <div className="w-16 h-16 mx-auto mb-4 bg-green-500/10 rounded-full flex items-center justify-center">
                    <svg className="w-8 h-8 text-green-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                    </svg>
                  </div>
                  <h2 className="text-2xl font-bold text-white mb-2">You're All Set!</h2>
                  <p className="text-slate-400">Booking confirmed for {invite.shootName}</p>
                </div>
              </CardContent>
            </Card>
          )}
        </div>
      </div>
    </>
  )
}
