/**
 * Payment Success Page - ShootSync
 * Shown after successful Stripe checkout
 */

import { useEffect, useState } from 'react'
import { useSearchParams } from 'react-router-dom'
import { Helmet } from 'react-helmet-async'
import Card from '../../components/common/Card'
import LoadingSpinner from '../../components/common/LoadingSpinner'
import { formatCurrency } from '../../config/stripe'

interface SessionData {
  status: string
  customerEmail: string
  amountTotal: number
}

export default function PaymentSuccess() {
  const [searchParams] = useSearchParams()
  const sessionId = searchParams.get('session_id')

  const [loading, setLoading] = useState(true)
  const [session, setSession] = useState<SessionData | null>(null)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (sessionId) {
      verifyPayment()
    } else {
      setError('No session ID provided')
      setLoading(false)
    }
  }, [sessionId])

  const verifyPayment = async () => {
    try {
      const response = await fetch(`/api/stripe/session/${sessionId}`)
      
      if (response.ok) {
        const data = await response.json()
        setSession(data)
      } else {
        setError('Could not verify payment status')
      }
    } catch (err) {
      console.error('Error verifying payment:', err)
      setError('Could not verify payment status')
    }
    setLoading(false)
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-slate-900 flex items-center justify-center">
        <LoadingSpinner size="lg" />
      </div>
    )
  }

  return (
    <>
      <Helmet>
        <title>Payment Successful | ShootSync</title>
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

          {error ? (
            <Card>
              <div className="p-6 text-center">
                <div className="w-16 h-16 mx-auto mb-4 bg-amber-500/10 rounded-full flex items-center justify-center">
                  <svg className="w-8 h-8 text-amber-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                  </svg>
                </div>
                <h2 className="text-xl font-bold text-white mb-2">Verification Issue</h2>
                <p className="text-slate-400 mb-4">{error}</p>
                <p className="text-slate-500 text-sm">
                  If you completed payment, you should receive a confirmation email shortly.
                  Please contact the syndicate if you have any concerns.
                </p>
              </div>
            </Card>
          ) : session?.status === 'paid' ? (
            <Card>
              <div className="p-6 text-center">
                <div className="w-16 h-16 mx-auto mb-4 bg-green-500/10 rounded-full flex items-center justify-center">
                  <svg className="w-8 h-8 text-green-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                  </svg>
                </div>
                <h2 className="text-2xl font-bold text-white mb-2">Payment Successful!</h2>
                <p className="text-slate-400 mb-6">Your booking is now confirmed.</p>

                <div className="p-4 bg-slate-800 rounded-lg text-left space-y-3 mb-6">
                  <div className="flex justify-between">
                    <span className="text-slate-400">Amount paid</span>
                    <span className="text-green-500 font-bold">
                      {session.amountTotal ? formatCurrency(session.amountTotal) : '—'}
                    </span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-slate-400">Confirmation sent to</span>
                    <span className="text-white">{session.customerEmail}</span>
                  </div>
                </div>

                <p className="text-slate-500 text-sm">
                  You'll receive shoot details closer to the date.
                  Have a great day in the field!
                </p>
              </div>
            </Card>
          ) : (
            <Card>
              <div className="p-6 text-center">
                <div className="w-16 h-16 mx-auto mb-4 bg-amber-500/10 rounded-full flex items-center justify-center">
                  <svg className="w-8 h-8 text-amber-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                  </svg>
                </div>
                <h2 className="text-xl font-bold text-white mb-2">Payment Processing</h2>
                <p className="text-slate-400">
                  Your payment is being processed. You'll receive confirmation shortly.
                </p>
              </div>
            </Card>
          )}
        </div>
      </div>
    </>
  )
}
