/**
 * Subscribe Page - ShootSync
 * Plan selection and checkout for the syndicate on show.
 */

import { useState } from 'react'
import { Link, Navigate, useNavigate } from 'react-router-dom'
import { Helmet } from 'react-helmet-async'
import { useAuth } from '../../hooks/useAuth'
import { useSubscription } from '../../hooks/useSubscription'
import { useCaptainSyndicate, useSyndicates } from '../../context/SyndicateContext'
import Card from '../../components/common/Card'
import Button from '../../components/common/Button'
import { BILLING_TERMS, PLANS } from '../../config/plans'

export default function Subscribe() {
  const { email } = useAuth()
  const syndicate = useCaptainSyndicate()
  const { memberships, select } = useSyndicates()
  const navigate = useNavigate()
  const others = memberships.filter((m) => m.id !== syndicate.id)
  const [checkingOut, setCheckingOut] = useState<string | null>(null)
  const [checkoutError, setCheckoutError] = useState<string | null>(null)
  const [openingBilling, setOpeningBilling] = useState(false)

  const { startCheckout, openPortal } = useSubscription(syndicate.id)

  if (syndicate.subscription.isActive) return <Navigate to="/dashboard" replace />

  const handleSelectPlan = async (tier: 'STARTER' | 'STANDARD') => {
    if (!email) {
      setCheckoutError('Your account has no email address. Add one in your profile (top right), then try again.')
      return
    }
    setCheckingOut(tier)
    setCheckoutError(null)
    const failure = await startCheckout(tier, email)
    if (failure) {
      setCheckoutError(failure)
      setCheckingOut(null)
    }
  }

  const handleOpenBilling = async () => {
    setOpeningBilling(true)
    setCheckoutError(null)
    const failure = await openPortal()
    if (failure) {
      setCheckoutError(failure)
      setOpeningBilling(false)
    }
  }

  // Someone with more than one syndicate is never stuck on this page for one of them.
  const otherSyndicates = others.length > 0 && (
    <nav aria-label="Your other syndicates" className="mt-8 text-center">
      <p className="text-slate-300 text-sm mb-3">Not now? Go to another of your syndicates:</p>
      <div className="flex flex-wrap justify-center gap-2">
        {others.map((m) => (
          <Button key={m.id} variant="secondary" size="sm" onClick={() => { select(m.id); navigate('/dashboard') }}>
            {m.name}
          </Button>
        ))}
      </div>
    </nav>
  )

  // A syndicate that has had a plan can still be looked at and exported while it's read-only.
  const backToSyndicate = syndicate.subscription.status !== null && (
    <p className="mt-6 text-center">
      <Link to="/dashboard" className="text-green-400 underline underline-offset-2 hover:text-green-300">
        Back to {syndicate.name}
      </Link>
    </p>
  )

  // A failed payment is put right by updating the card, not by buying a second plan.
  const status = syndicate.subscription.status
  if (status === 'PAST_DUE' || status === 'INCOMPLETE') {
    return (
      <>
        <Helmet>
          <title>Update your payment | ShootSync</title>
        </Helmet>
        <div className="min-h-screen bg-slate-900 flex items-center justify-center px-4">
          <Card className="max-w-md w-full">
            <div className="p-8 text-center">
              <h1 className="text-2xl font-bold text-white mb-3">
                {status === 'INCOMPLETE' ? 'Your first payment hasn’t gone through' : 'Your last payment didn’t go through'}
              </h1>
              <p className="text-slate-300 mb-6">
                Update your card for {syndicate.name} and Stripe will take the payment again. Your plan and records are kept.
              </p>
              {checkoutError && <p role="alert" className="mb-4 text-red-200">{checkoutError}</p>}
              <Button onClick={() => void handleOpenBilling()} isLoading={openingBilling} disabled={openingBilling} className="w-full">
                Update payment details
              </Button>
              {backToSyndicate}
              {otherSyndicates}
            </div>
          </Card>
        </div>
      </>
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
              Subscribe to start managing <span className="text-green-400">{syndicate.name}</span>
            </p>
          </div>

          {checkoutError && (
            <div role="alert" className="mb-6 rounded-lg border border-red-500/40 bg-red-900/20 p-4 text-center text-red-200">
              {checkoutError}
            </div>
          )}

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
                    <span className="text-4xl font-bold text-white">£{plan.monthlyPrice}</span>
                    <span className="text-slate-400">/month</span>
                  </div>
                </div>

                <ul className="space-y-3 mb-8">
                  {plan.features.map((feature, index) => (
                    <li key={index} className="flex items-center gap-2">
                      <svg className="w-5 h-5 text-green-500 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                      </svg>
                      <span className="text-white">{feature}</span>
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
          <p className="text-center text-slate-400 text-sm mt-8">
            No contract. Every plan has a {BILLING_TERMS.moneyBackDays}-day money-back guarantee.
          </p>
          {backToSyndicate}
          {otherSyndicates}
        </div>
      </div>
    </>
  )
}
