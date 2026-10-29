/**
 * After paying for a plan - ShootSync
 *
 * Stripe sends the captain back here the moment the card is accepted, but the plan only
 * counts once Stripe's webhook has told ShootSync, which usually takes a second or two and
 * occasionally longer. This page waits for that, checking every couple of seconds, so the
 * captain is never bounced back to the plan page for a plan they have just paid for.
 */

import { useEffect, useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { Helmet } from 'react-helmet-async'
import { useCaptainSyndicate, useSyndicates } from '../../context/SyndicateContext'
import Card from '../../components/common/Card'
import Button from '../../components/common/Button'
import LoadingSpinner from '../../components/common/LoadingSpinner'

const CHECK_EVERY_MS = 2_000
const GIVE_UP_AFTER_CHECKS = 15

export default function SubscriptionSuccess() {
  const navigate = useNavigate()
  const syndicate = useCaptainSyndicate()
  const { reload } = useSyndicates()
  const [checks, setChecks] = useState(0)
  const active = syndicate.subscription.isActive
  const stillWaiting = !active && checks < GIVE_UP_AFTER_CHECKS
  const busy = useRef(false)

  useEffect(() => {
    if (!stillWaiting) return
    const timer = setTimeout(async () => {
      if (busy.current) return
      busy.current = true
      await reload(syndicate.id)
      busy.current = false
      setChecks((n) => n + 1)
    }, CHECK_EVERY_MS)
    return () => clearTimeout(timer)
  }, [stillWaiting, checks, reload, syndicate.id])

  return (
    <>
      <Helmet>
        <title>Your plan | ShootSync</title>
      </Helmet>

      <div className="min-h-screen bg-slate-900 flex items-center justify-center px-4">
        <Card className="max-w-md w-full">
          <div className="p-8 text-center" aria-live="polite">
            {active ? (
              <>
                <div className="w-16 h-16 bg-green-600 rounded-full flex items-center justify-center mx-auto mb-6" aria-hidden="true">
                  <svg className="w-8 h-8 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                  </svg>
                </div>
                <h1 className="text-2xl font-bold text-white mb-3">You’re all set</h1>
                <p className="text-slate-300 mb-6">The plan for {syndicate.name} is active.</p>
                <Button onClick={() => navigate('/dashboard')} className="w-full">Go to your dashboard</Button>
              </>
            ) : stillWaiting ? (
              <>
                <div className="flex justify-center mb-6"><LoadingSpinner size="lg" /></div>
                <h1 className="text-2xl font-bold text-white mb-3">Payment received</h1>
                <p className="text-slate-300">Finishing setting up your plan. This usually takes a few seconds.</p>
              </>
            ) : (
              <>
                <h1 className="text-2xl font-bold text-white mb-3">Still finishing off</h1>
                <p className="text-slate-300 mb-6">
                  Stripe hasn’t confirmed your plan to us yet. Your payment is safe and you won’t be charged twice.
                  Check again in a minute, or email hello@shootsync.co.uk if it still isn’t showing.
                </p>
                <Button onClick={() => setChecks(0)} className="w-full">Check again</Button>
              </>
            )}
          </div>
        </Card>
      </div>
    </>
  )
}
