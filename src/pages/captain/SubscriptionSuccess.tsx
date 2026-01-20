/**
 * Subscription Success Page - ShootSync
 * Shown after successful subscription checkout
 */

import { useEffect, useState } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import { Helmet } from 'react-helmet-async'
import Card from '../../components/common/Card'
import Button from '../../components/common/Button'
import LoadingSpinner from '../../components/common/LoadingSpinner'

export default function SubscriptionSuccess() {
  const navigate = useNavigate()
  const [searchParams] = useSearchParams()
  const [countdown, setCountdown] = useState(5)

  const sessionId = searchParams.get('session_id')

  useEffect(() => {
    const timer = setInterval(() => {
      setCountdown((prev) => {
        if (prev <= 1) {
          clearInterval(timer)
          navigate('/dashboard')
          return 0
        }
        return prev - 1
      })
    }, 1000)

    return () => clearInterval(timer)
  }, [navigate])

  return (
    <>
      <Helmet>
        <title>Subscription Successful | ShootSync</title>
      </Helmet>

      <div className="min-h-screen bg-slate-900 flex items-center justify-center px-4">
        <Card className="max-w-md w-full">
          <div className="p-8 text-center">
            {/* Success Icon */}
            <div className="w-16 h-16 bg-green-600 rounded-full flex items-center justify-center mx-auto mb-6">
              <svg className="w-8 h-8 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
              </svg>
            </div>

            <h1 className="text-2xl font-bold text-white mb-3">Welcome to ShootSync!</h1>
            <p className="text-slate-400 mb-6">
              Your subscription is now active. You have full access to all features.
            </p>

            <div className="bg-slate-800 rounded-lg p-4 mb-6">
              <p className="text-slate-300 text-sm">
                Redirecting to dashboard in <span className="text-green-500 font-bold">{countdown}</span> seconds...
              </p>
            </div>

            <Button onClick={() => navigate('/dashboard')} className="w-full">
              Go to Dashboard Now
            </Button>
          </div>
        </Card>
      </div>
    </>
  )
}
