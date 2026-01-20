/**
 * Subscribe Page - ShootSync
 * Plan selection and checkout
 */

import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { Helmet } from 'react-helmet-async'
import { useAuth } from '../../hooks/useAuth'
import { useApi } from '../../hooks/useApi'
import { useSubscription } from '../../hooks/useSubscription'
import Card from '../../components/common/Card'
import Button from '../../components/common/Button'
import LoadingSpinner from '../../components/common/LoadingSpinner'

interface Syndicate {
  id: string
  name: string
  stripeSubscriptionStatus?: string
}

const PLANS = [
  {
    tier: 'STARTER' as const,
    name: 'Starter',
    price: 49,
    features: [
      'Up to 10 guns',
      'Up to 15 beaters',
      '1 captain login',
      'Shoot scheduling',
      'Peg allocation',
      'Bag recording',
      'Guest management',
      'PDF briefings',
    ],
  },
  {
    tier: 'STANDARD' as const,
    name: 'Standard',
    price: 79,
    features: [
      'Up to 20 guns',
      'Unlimited beaters',
      '3 admin logins',
      'All Starter features',
      'Priority support',
    ],
    popular: true,
  },
]

export default function Subscribe() {
  const navigate = useNavigate()
  const { user } = useAuth()
  const syndicateApi = useApi<Syndicate>('syndicates')
  
  const [syndicate, setSyndicate] = useState<Syndicate | null>(null)
  const [loading, setLoading] = useState(true)
  const [checkingOut, setCheckingOut] = useState<string | null>(null)

  const { isActive, startCheckout } = useSubscription(syndicate?.id || null)

  useEffect(() => {
    if (user?.id) {
      loadSyndicate()
    }
  }, [user?.id])

  useEffect(() => {
    if (!loading && isActive) {
      navigate('/dashboard')
    }
  }, [loading, isActive, navigate])

  const loadSyndicate = async () => {
    const syndicates = await syndicateApi.fetchAll({ captainClerkId: user?.id || '' })
    if (syndicates.length > 0) {
      setSyndicate(syndicates[0])
    }
    setLoading(false)
  }

  const handleSelectPlan = async (tier: 'STARTER' | 'STANDARD') => {
    if (!syndicate || !user?.primaryEmailAddress?.emailAddress) return
    
    setCheckingOut(tier)
    await startCheckout(tier, user.primaryEmailAddress.emailAddress, user.id)
    setCheckingOut(null)
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-slate-900 flex items-center justify-center">
        <LoadingSpinner size="lg" />
      </div>
    )
  }

  if (!syndicate) {
    return (
      <div className="min-h-screen bg-slate-900 flex items-center justify-center">
        <Card>
          <div className="p-8 text-center">
            <h2 className="text-xl font-bold text-white mb-4">No Syndicate Found</h2>
            <p className="text-slate-400 mb-6">Create a syndicate first to subscribe.</p>
            <Button onClick={() => navigate('/syndicate/create')}>
              Create Syndicate
            </Button>
          </div>
        </Card>
      </div>
    )
  }

  return (
    <>
      <Helmet>
        <title>Choose Your Plan | ShootSync</title>
      </Helmet>

      <div className="min-h-screen bg-slate-900 py-12 px-4">
        <div className="max-w-4xl mx-auto">
          {/* Header */}
          <div className="text-center mb-12">
            <div className="flex items-center justify-center gap-2 mb-6">
              <div className="w-10 h-10 bg-green-600 rounded-lg flex items-center justify-center">
                <span className="text-white font-bold">SS</span>
              </div>
              <span className="text-white font-semibold text-xl">ShootSync</span>
            </div>
            <h1 className="text-3xl font-bold text-white mb-3">Choose Your Plan</h1>
            <p className="text-slate-400">
              Subscribe to start managing <span className="text-green-500">{syndicate.name}</span>
            </p>
          </div>

          {/* Plans */}
          <div className="grid md:grid-cols-2 gap-6">
            {PLANS.map((plan) => (
              <div
                key={plan.tier}
                className={`relative rounded-xl border-2 p-6 ${
                  plan.popular
                    ? 'border-green-500 bg-slate-800'
                    : 'border-slate-700 bg-slate-800/50'
                }`}
              >
                {plan.popular && (
                  <div className="absolute -top-3 left-1/2 -translate-x-1/2">
                    <span className="bg-green-500 text-white text-xs font-bold px-3 py-1 rounded-full">
                      MOST POPULAR
                    </span>
                  </div>
                )}

                <div className="text-center mb-6">
                  <h3 className="text-xl font-bold text-white mb-2">{plan.name}</h3>
                  <div className="flex items-baseline justify-center gap-1">
                    <span className="text-4xl font-bold text-white">£{plan.price}</span>
                    <span className="text-slate-400">/month</span>
                  </div>
                </div>

                <ul className="space-y-3 mb-8">
                  {plan.features.map((feature, index) => (
                    <li key={index} className="flex items-center gap-2">
                      <svg className="w-5 h-5 text-green-500 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                      </svg>
                      <span className="text-slate-300">{feature}</span>
                    </li>
                  ))}
                </ul>

                <Button
                  onClick={() => handleSelectPlan(plan.tier)}
                  disabled={checkingOut !== null}
                  variant={plan.popular ? 'primary' : 'secondary'}
                  className="w-full"
                >
                  {checkingOut === plan.tier ? 'Redirecting...' : `Choose ${plan.name}`}
                </Button>
              </div>
            ))}
          </div>

          {/* Footer */}
          <p className="text-center text-slate-500 text-sm mt-8">
            Cancel anytime. All plans include a 14-day money-back guarantee.
          </p>
        </div>
      </div>
    </>
  )
}
