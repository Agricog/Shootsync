/**
 * Guest Accept Page - ShootSync
 * Handles guest invitation acceptance, waiver, and payment
 */

import { useEffect, useState } from 'react'
import { useParams, useSearchParams } from 'react-router-dom'
import { Helmet } from 'react-helmet-async'
import Card from '../../components/common/Card'
import Button from '../../components/common/Button'
import Input from '../../components/common/Input'
import LoadingSpinner from '../../components/common/LoadingSpinner'
import { formatCurrency } from '../../config/stripe'
import { formatLongDate, formatTime } from '../../utils/dateHelpers'

type Step = 'loading' | 'details' | 'waiver' | 'payment' | 'confirmed' | 'declined' | 'error'

interface GuestInvite {
  id: string
  name: string
  email: string
  dayFee: number
  rsvpStatus: string
  waiverAccepted: boolean
  invitedByMember?: {
    name: string
  }
  shootDay?: {
    date: string
    locationName: string
    locationAddress?: string
    locationPostcode?: string
    meetTime: string
    syndicate?: {
      name: string
    }
  }
}

const WAIVER_TEXT = `SHOOTING GUEST LIABILITY WAIVER

By accepting this invitation, I acknowledge and agree to the following:

1. COMPETENCY: I confirm that I am a competent and experienced shot, familiar with safe gun handling practices and shooting etiquette.

2. INSURANCE: I confirm that I hold valid shooting insurance with a minimum of £10 million public liability cover that will be in effect on the date of the shoot.

3. ASSUMPTION OF RISK: I understand that shooting involves inherent risks including but not limited to injury from firearms, falls, and other hazards. I voluntarily assume all such risks.

4. COMPLIANCE: I agree to follow all safety instructions given by the shoot captain, gamekeeper, and other officials, and to conduct myself in a safe and sporting manner at all times.

5. RELEASE: I release and hold harmless the syndicate, its members, landowners, and organisers from any liability for personal injury or property damage arising from my participation, except in cases of gross negligence.

6. EMERGENCY CONTACT: I have provided accurate emergency contact information and consent to emergency medical treatment if required.

7. CONDUCT: I agree to respect the countryside, other participants, and the quarry, and to uphold the highest standards of fieldsports conduct.

This waiver is binding upon myself, my heirs, and legal representatives.`

export default function GuestAccept() {
  const { token } = useParams<{ token: string }>()
  const [searchParams] = useSearchParams()
  const tokenFromQuery = searchParams.get('token')
  const inviteToken = token || tokenFromQuery

  const [step, setStep] = useState<Step>('loading')
  const [invite, setInvite] = useState<GuestInvite | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [isProcessing, setIsProcessing] = useState(false)

  const [waiverData, setWaiverData] = useState({
    emergencyContactName: '',
    emergencyContactPhone: '',
  })
  const [formErrors, setFormErrors] = useState<Record<string, string>>({})
  const [hasAcceptedWaiver, setHasAcceptedWaiver] = useState(false)

  useEffect(() => {
    if (inviteToken) {
      loadInvite()
    } else {
      setError('No invitation token provided')
      setStep('error')
    }
  }, [inviteToken])

  const loadInvite = async () => {
    try {
      const response = await fetch(`/api/guests/token/${inviteToken}`)
      
      if (!response.ok) {
        if (response.status === 404) {
          setError('This invitation is invalid or has expired.')
        } else {
          setError('Failed to load invitation. Please try again.')
        }
        setStep('error')
        return
      }

      const data = await response.json()
      setInvite(data)

      // Determine initial step based on current status
      if (data.rsvpStatus === 'CONFIRMED') {
        setStep('confirmed')
      } else if (data.rsvpStatus === 'DECLINED') {
        setStep('declined')
      } else {
        setStep('details')
      }
    } catch (err) {
      console.error('Error loading invite:', err)
      setError('Failed to load invitation. Please check your connection.')
      setStep('error')
    }
  }

  const handleDecline = async () => {
    if (!invite) return

    setIsProcessing(true)
    try {
      const response = await fetch(`/api/guests/${invite.id}/decline`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
      })

      if (response.ok) {
        setStep('declined')
      } else {
        setError('Failed to decline invitation. Please try again.')
      }
    } catch (err) {
      console.error('Error declining:', err)
      setError('Failed to decline invitation. Please try again.')
    }
    setIsProcessing(false)
  }

  const validateWaiverForm = (): boolean => {
    const errors: Record<string, string> = {}

    if (!waiverData.emergencyContactName.trim()) {
      errors.emergencyContactName = 'Emergency contact name is required'
    }

    if (!waiverData.emergencyContactPhone.trim()) {
      errors.emergencyContactPhone = 'Emergency contact phone is required'
    } else if (!/^[\d\s+()-]{10,}$/.test(waiverData.emergencyContactPhone.trim())) {
      errors.emergencyContactPhone = 'Please enter a valid phone number'
    }

    if (!hasAcceptedWaiver) {
      errors.waiver = 'You must accept the waiver to continue'
    }

    setFormErrors(errors)
    return Object.keys(errors).length === 0
  }

  const handleWaiverSubmit = async () => {
    if (!validateWaiverForm() || !invite) return

    setIsProcessing(true)
    try {
      const response = await fetch(`/api/guests/${invite.id}/accept`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          emergencyContactName: waiverData.emergencyContactName.trim(),
          emergencyContactPhone: waiverData.emergencyContactPhone.trim(),
          waiverAccepted: true,
        }),
      })

      if (response.ok) {
        // If day fee is 0, skip payment
        if (invite.dayFee === 0) {
          setStep('confirmed')
        } else {
          setStep('payment')
        }
      } else {
        const errorData = await response.json()
        setError(errorData.error || 'Failed to accept waiver. Please try again.')
      }
    } catch (err) {
      console.error('Error accepting waiver:', err)
      setError('Failed to accept waiver. Please try again.')
    }
    setIsProcessing(false)
  }

  const handlePayment = async () => {
    // TODO: Integrate Stripe payment
    // For now, mark as confirmed after "payment"
    setIsProcessing(true)
    await new Promise(resolve => setTimeout(resolve, 1500))
    setStep('confirmed')
    setIsProcessing(false)
  }

  if (step === 'loading') {
    return (
      <div className="min-h-screen bg-slate-900 flex items-center justify-center">
        <LoadingSpinner size="lg" />
      </div>
    )
  }

  return (
    <>
      <Helmet>
        <title>Guest Invitation | ShootSync</title>
        <meta name="robots" content="noindex, nofollow" />
      </Helmet>

      <div className="min-h-screen bg-slate-900 py-12 px-4">
        <div className="max-w-lg mx-auto">
          {/* Logo */}
          <div className="flex items-center justify-center gap-2 mb-8">
            <div className="w-10 h-10 bg-green-600 rounded-lg flex items-center justify-center">
              <span className="text-white font-bold">SS</span>
            </div>
            <span className="text-white font-semibold text-xl">ShootSync</span>
          </div>

          {/* Error State */}
          {step === 'error' && (
            <Card>
              <div className="text-center py-8">
                <div className="w-16 h-16 mx-auto mb-4 bg-red-500/10 rounded-full flex items-center justify-center">
                  <svg className="w-8 h-8 text-red-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </div>
                <h2 className="text-xl font-bold text-white mb-2">Invitation Error</h2>
                <p className="text-slate-400">{error}</p>
              </div>
            </Card>
          )}

          {/* Details Step */}
          {step === 'details' && invite && (
            <Card>
              <div className="p-6">
                <h1 className="text-2xl font-bold text-white mb-2">You're Invited!</h1>
                <p className="text-slate-400 mb-6">
                  {invite.invitedByMember?.name || 'A syndicate member'} has invited you to shoot
                </p>

                <div className="space-y-6">
                  {/* Shoot Details */}
                  <div className="p-4 bg-slate-800 rounded-lg space-y-4">
                    <div>
                      <p className="text-slate-500 text-sm">Syndicate</p>
                      <p className="text-white font-medium">{invite.shootDay?.syndicate?.name || 'Shooting Syndicate'}</p>
                    </div>
                    <div>
                      <p className="text-slate-500 text-sm">Location</p>
                      <p className="text-white font-medium">{invite.shootDay?.locationName}</p>
                      {invite.shootDay?.locationPostcode && (
                        <p className="text-slate-400 text-sm">{invite.shootDay.locationPostcode}</p>
                      )}
                    </div>
                    <div>
                      <p className="text-slate-500 text-sm">Date</p>
                      <p className="text-white font-medium">
                        {invite.shootDay?.date ? formatLongDate(invite.shootDay.date) : 'TBC'}
                      </p>
                    </div>
                    <div>
                      <p className="text-slate-500 text-sm">Meet Time</p>
                      <p className="text-white font-medium">
                        {invite.shootDay?.meetTime ? formatTime(invite.shootDay.meetTime) : 'TBC'}
                      </p>
                    </div>
                  </div>

                  {/* Day Fee */}
                  {invite.dayFee > 0 && (
                    <div className="p-4 bg-green-500/10 border border-green-500/20 rounded-lg flex justify-between items-center">
                      <span className="text-slate-300">Guest Day Fee</span>
                      <span className="text-white font-bold text-xl">{formatCurrency(invite.dayFee)}</span>
                    </div>
                  )}

                  {/* Actions */}
                  <div className="space-y-3">
                    <Button onClick={() => setStep('waiver')} fullWidth>
                      Accept Invitation
                    </Button>
                    <Button 
                      variant="ghost" 
                      onClick={handleDecline} 
                      disabled={isProcessing}
                      fullWidth
                    >
                      {isProcessing ? 'Processing...' : 'Decline'}
                    </Button>
                  </div>
                </div>
              </div>
            </Card>
          )}

          {/* Waiver Step */}
          {step === 'waiver' && invite && (
            <Card>
              <div className="p-6">
                <h1 className="text-2xl font-bold text-white mb-2">Liability Waiver</h1>
                <p className="text-slate-400 mb-6">Please read and accept the waiver to continue</p>

                <div className="space-y-6">
                  {/* Waiver Text */}
                  <div className="h-48 overflow-y-auto p-4 bg-slate-800 rounded-lg">
                    <pre className="text-slate-300 text-sm whitespace-pre-wrap font-sans">
                      {WAIVER_TEXT}
                    </pre>
                  </div>

                  {/* Emergency Contact */}
                  <div className="space-y-4">
                    <Input
                      label="Emergency Contact Name"
                      value={waiverData.emergencyContactName}
                      onChange={(e) => setWaiverData(prev => ({ ...prev, emergencyContactName: e.target.value }))}
                      error={formErrors.emergencyContactName}
                      placeholder="Full name"
                      required
                    />
                    <Input
                      type="tel"
                      label="Emergency Contact Phone"
                      value={waiverData.emergencyContactPhone}
                      onChange={(e) => setWaiverData(prev => ({ ...prev, emergencyContactPhone: e.target.value }))}
                      error={formErrors.emergencyContactPhone}
                      placeholder="+44 7xxx xxxxxx"
                      required
                    />
                  </div>

                  {/* Waiver Acceptance */}
                  <label className="flex items-start gap-3 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={hasAcceptedWaiver}
                      onChange={(e) => setHasAcceptedWaiver(e.target.checked)}
                      className="mt-1 w-5 h-5 rounded border-slate-600 bg-slate-700 text-green-600 focus:ring-green-500"
                    />
                    <span className="text-sm text-white">
                      I have read and accept the liability waiver terms
                    </span>
                  </label>
                  {formErrors.waiver && (
                    <p className="text-red-500 text-sm">{formErrors.waiver}</p>
                  )}

                  {error && (
                    <div className="p-3 bg-red-500/10 border border-red-500/20 rounded-lg">
                      <p className="text-red-400 text-sm">{error}</p>
                    </div>
                  )}

                  {/* Actions */}
                  <div className="space-y-3">
                    <Button 
                      onClick={handleWaiverSubmit} 
                      disabled={!hasAcceptedWaiver || isProcessing}
                      fullWidth
                    >
                      {isProcessing ? 'Processing...' : invite.dayFee > 0 ? 'Continue to Payment' : 'Confirm Attendance'}
                    </Button>
                    <Button 
                      variant="ghost" 
                      onClick={() => setStep('details')}
                      disabled={isProcessing}
                      fullWidth
                    >
                      Back
                    </Button>
                  </div>
                </div>
              </div>
            </Card>
          )}

          {/* Payment Step */}
          {step === 'payment' && invite && (
            <Card>
              <div className="p-6">
                <h1 className="text-2xl font-bold text-white mb-2">Payment</h1>
                <p className="text-slate-400 mb-6">Complete your booking with secure payment</p>

                <div className="space-y-6">
                  {/* Payment Summary */}
                  <div className="p-4 bg-slate-800 rounded-lg space-y-3">
                    <div className="flex justify-between">
                      <span className="text-slate-400">Guest day fee</span>
                      <span className="text-white">{formatCurrency(invite.dayFee)}</span>
                    </div>
                    <div className="border-t border-slate-700 pt-3 flex justify-between">
                      <span className="text-white font-medium">Total</span>
                      <span className="text-green-500 font-bold text-xl">{formatCurrency(invite.dayFee)}</span>
                    </div>
                  </div>

                  {/* Stripe Payment Button - TODO: Replace with actual Stripe integration */}
                  <Button 
                    onClick={handlePayment} 
                    disabled={isProcessing}
                    fullWidth
                  >
                    {isProcessing ? 'Processing Payment...' : `Pay ${formatCurrency(invite.dayFee)}`}
                  </Button>

                  <p className="text-slate-500 text-xs text-center">
                    Secure payment powered by Stripe
                  </p>
                </div>
              </div>
            </Card>
          )}

          {/* Confirmed Step */}
          {step === 'confirmed' && invite && (
            <Card>
              <div className="p-6 text-center">
                <div className="w-16 h-16 mx-auto mb-4 bg-green-500/10 rounded-full flex items-center justify-center">
                  <svg className="w-8 h-8 text-green-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                  </svg>
                </div>
                <h2 className="text-2xl font-bold text-white mb-2">You're All Set!</h2>
                <p className="text-slate-400 mb-6">
                  Your booking for {invite.shootDay?.locationName} is confirmed
                </p>

                <div className="p-4 bg-slate-800 rounded-lg text-left space-y-3 mb-6">
                  <div>
                    <p className="text-slate-500 text-sm">Date</p>
                    <p className="text-white">
                      {invite.shootDay?.date ? formatLongDate(invite.shootDay.date) : 'TBC'}
                    </p>
                  </div>
                  <div>
                    <p className="text-slate-500 text-sm">Meet Time</p>
                    <p className="text-white">
                      {invite.shootDay?.meetTime ? formatTime(invite.shootDay.meetTime) : 'TBC'}
                    </p>
                  </div>
                  <div>
                    <p className="text-slate-500 text-sm">Location</p>
                    <p className="text-white">{invite.shootDay?.locationName}</p>
                    {invite.shootDay?.locationPostcode && (
                      <p className="text-slate-400 text-sm">{invite.shootDay.locationPostcode}</p>
                    )}
                  </div>
                </div>

                <p className="text-slate-500 text-sm">
                  A confirmation email has been sent to {invite.email}
                </p>
              </div>
            </Card>
          )}

          {/* Declined Step */}
          {step === 'declined' && (
            <Card>
              <div className="p-6 text-center">
                <div className="w-16 h-16 mx-auto mb-4 bg-slate-700 rounded-full flex items-center justify-center">
                  <svg className="w-8 h-8 text-slate-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </div>
                <h2 className="text-2xl font-bold text-white mb-2">Invitation Declined</h2>
                <p className="text-slate-400">
                  You have declined this invitation. The host has been notified.
                </p>
              </div>
            </Card>
          )}
        </div>
      </div>
    </>
  )
}
