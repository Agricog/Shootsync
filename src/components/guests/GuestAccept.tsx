/**
 * Guest Accept Page - ShootSync
 * Guest RSVP, waiver, and payment flow
 */

import { useState } from 'react'
import { Helmet } from 'react-helmet-async'
import Card, { CardHeader, CardContent } from '../../components/common/Card'
import Button from '../../components/common/Button'
import GuestWaiver from '../../components/guests/GuestWaiver'
import { formatCurrency } from '../../config/stripe'
import { formatLongDate } from '../../utils/dateHelpers'

type Step = 'details' | 'waiver' | 'payment' | 'confirmed'

// Mock data - would come from URL params/API
const MOCK_INVITE = {
  guestId: 'g1',
  guestName: 'Mike Guest',
  guestEmail: 'mike@example.com',
  shootId: 's1',
  shootName: 'Beatrice Farm',
  shootDate: '2026-01-18',
  meetTime: '08:30',
  locationPostcode: 'OX15 4AB',
  syndicateName: 'Beatrice Pheasant Syndicate',
  invitedBy: 'John Smith',
  dayFee: 5000, // pence
}

export default function GuestAccept() {
  const [step, setStep] = useState<Step>('details')
  const [isProcessing, setIsProcessing] = useState(false)

  const invite = MOCK_INVITE

  const handleAcceptInvite = () => {
    setStep('waiver')
  }

  const handleDeclineInvite = async () => {
    // TODO: API call to decline
    console.log('[GuestAccept] Declining invite')
  }

  const handleWaiverAccept = async (data: any) => {
    console.log('[GuestAccept] Waiver accepted:', data)
    setStep('payment')
  }

  const handlePayment = async () => {
    setIsProcessing(true)
    try {
      // TODO: Redirect to Stripe Checkout
      console.log('[GuestAccept] Processing payment')
      await new Promise(resolve => setTimeout(resolve, 1500))
      setStep('confirmed')
    } finally {
      setIsProcessing(false)
    }
  }

  return (
    <>
      <Helmet>
        <title>Guest Invitation - ShootSync</title>
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

          {/* Step: Details */}
          {step === 'details' && (
            <Card>
              <CardHeader
                title="You're Invited!"
                subtitle={`${invite.invitedBy} has invited you to shoot`}
              />
              <CardContent>
                <div className="space-y-6">
                  <div className="p-4 bg-slate-800 rounded-lg space-y-3">
                    <div>
                      <p className="text-slate-400 text-sm">Shoot</p>
                      <p className="text-white font-medium">{invite.shootName}</p>
                    </div>
                    <div>
                      <p className="text-slate-400 text-sm">Date</p>
                      <p className="text-white">{formatLongDate(invite.shootDate)}</p>
                    </div>
                    <div>
                      <p className="text-slate-400 text-sm">Meet Time</p>
                      <p className="text-white">{invite.meetTime}</p>
                    </div>
                    <div>
                      <p className="text-slate-400 text-sm">Location</p>
                      <p className="text-white">{invite.locationPostcode}</p>
                    </div>
                    <div>
                      <p className="text-slate-400 text-sm">Syndicate</p>
                      <p className="text-white">{invite.syndicateName}</p>
                    </div>
                  </div>

                  <div className="p-4 bg-green-500/10 border border-green-500/20 rounded-lg">
                    <div className="flex items-center justify-between">
                      <span className="text-slate-300">Guest Day Fee</span>
                      <span className="text-white font-bold text-lg">
                        {formatCurrency(invite.dayFee)}
                      </span>
                    </div>
                  </div>

                  <div className="flex flex-col gap-3">
                    <Button onClick={handleAcceptInvite} fullWidth>
                      Accept Invitation
                    </Button>
                    <Button variant="ghost" onClick={handleDeclineInvite} fullWidth>
                      Decline
                    </Button>
                  </div>
                </div>
              </CardContent>
            </Card>
          )}

          {/* Step: Waiver */}
          {step === 'waiver' && (
            <GuestWaiver
              guestName={invite.guestName}
              shootName={invite.shootName}
              shootDate={formatLongDate(invite.shootDate)}
              syndicateName={invite.syndicateName}
              onAccept={handleWaiverAccept}
            />
          )}

          {/* Step: Payment */}
          {step === 'payment' && (
            <Card>
              <CardHeader title="Payment" subtitle="Complete your booking" />
              <CardContent>
                <div className="space-y-6">
                  <div className="p-4 bg-slate-800 rounded-lg">
                    <div className="flex items-center justify-between mb-4">
                      <span className="text-slate-400">Guest Day Fee</span>
                      <span className="text-white font-bold">
                        {formatCurrency(invite.dayFee)}
                      </span>
                    </div>
                    <div className="pt-4 border-t border-slate-700">
                      <div className="flex items-center justify-between">
                        <span className="text-white font-medium">Total</span>
                        <span className="text-green-500 font-bold text-xl">
                          {formatCurrency(invite.dayFee)}
                        </span>
                      </div>
                    </div>
                  </div>

                  <Button onClick={handlePayment} isLoading={isProcessing} fullWidth>
                    Pay with Card
                  </Button>

                  <p className="text-slate-500 text-xs text-center">
                    Secure payment powered by Stripe
                  </p>
                </div>
              </CardContent>
            </Card>
          )}

          {/* Step: Confirmed */}
          {step === 'confirmed' && (
            <Card>
              <CardContent>
                <div className="text-center py-8">
                  <div className="w-16 h-16 mx-auto mb-4 bg-green-500/10 rounded-full flex items-center justify-center">
                    <svg
                      className="w-8 h-8 text-green-500"
                      fill="none"
                      stroke="currentColor"
                      viewBox="0 0 24 24"
                    >
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        strokeWidth={2}
                        d="M5 13l4 4L19 7"
                      />
                    </svg>
                  </div>
                  <h2 className="text-2xl font-bold text-white mb-2">You're All Set!</h2>
                  <p className="text-slate-400 mb-6">
                    Your booking for {invite.shootName} on {formatLongDate(invite.shootDate)} is confirmed.
                  </p>
                  <div className="p-4 bg-slate-800 rounded-lg text-left space-y-2">
                    <p className="text-slate-400 text-sm">
                      <span className="text-white">Meet:</span> {invite.meetTime}
                    </p>
                    <p className="text-slate-400 text-sm">
                      <span className="text-white">Location:</span> {invite.locationPostcode}
                    </p>
                  </div>
                  <p className="text-slate-500 text-sm mt-6">
                    A confirmation email has been sent to {invite.guestEmail}
                  </p>
                </div>
              </CardContent>
            </Card>
          )}
        </div>
      </div>
    </>
  )
}
