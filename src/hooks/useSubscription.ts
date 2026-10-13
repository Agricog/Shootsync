/**
 * Subscription Hook - ShootSync
 * Check and manage subscription status
 */

import { useState, useEffect, useCallback } from 'react'

interface SubscriptionState {
  /** The syndicate this status belongs to. */
  forId: string | null
  isActive: boolean
  status: string | null
  planTier: 'STARTER' | 'STANDARD' | null
  currentPeriodEnd: string | null
  fetching: boolean
}

const EMPTY: SubscriptionState = {
  forId: null,
  isActive: false,
  status: null,
  planTier: null,
  currentPeriodEnd: null,
  fetching: false,
}

async function errorMessage(response: Response, fallback: string): Promise<string> {
  try {
    const data = await response.json()
    return typeof data?.error === 'string' ? data.error : fallback
  } catch {
    return fallback
  }
}

export function useSubscription(syndicateId: string | null) {
  const [state, setState] = useState<SubscriptionState>(EMPTY)

  const checkSubscription = useCallback(async () => {
    if (!syndicateId) return
    setState((prev) => ({ ...prev, fetching: true }))
    try {
      const response = await fetch(`/api/subscriptions/status/${encodeURIComponent(syndicateId)}`)
      if (response.ok) {
        const data = await response.json()
        setState({
          forId: syndicateId,
          isActive: Boolean(data.isActive),
          status: data.status,
          planTier: data.planTier,
          currentPeriodEnd: data.currentPeriodEnd,
          fetching: false,
        })
      } else {
        setState({ ...EMPTY, forId: syndicateId })
      }
    } catch (error) {
      console.error('Error checking subscription:', error)
      setState({ ...EMPTY, forId: syndicateId })
    }
  }, [syndicateId])

  useEffect(() => {
    void checkSubscription()
  }, [checkSubscription])

  // Loading until the status for *this* syndicate has arrived. Derived during render so a
  // page never acts on "not subscribed" before the check has even started.
  const loading = state.fetching || (syndicateId !== null && state.forId !== syndicateId)

  /** Sends the captain to Stripe Checkout. Returns an error message if that could not start. */
  const startCheckout = async (planTier: 'STARTER' | 'STANDARD', email: string): Promise<string | null> => {
    try {
      const response = await fetch('/api/subscriptions/create-checkout', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ syndicateId, planTier, email }),
      })

      if (!response.ok) {
        return await errorMessage(response, 'Could not start checkout. Please try again.')
      }

      const { url } = await response.json()
      if (!url) return 'Could not start checkout. Please try again.'
      window.location.href = url
      return null
    } catch (error) {
      console.error('Error starting checkout:', error)
      return 'Could not reach ShootSync. Please check your connection and try again.'
    }
  }

  /** Opens the Stripe billing portal. Returns an error message if that could not start. */
  const openPortal = async (): Promise<string | null> => {
    try {
      const response = await fetch('/api/subscriptions/portal', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ syndicateId }),
      })

      if (!response.ok) {
        return await errorMessage(response, 'Could not open billing. Please try again.')
      }

      const { url } = await response.json()
      if (!url) return 'Could not open billing. Please try again.'
      window.location.href = url
      return null
    } catch (error) {
      console.error('Error opening portal:', error)
      return 'Could not reach ShootSync. Please check your connection and try again.'
    }
  }

  return {
    isActive: state.forId === syndicateId && state.isActive,
    status: state.status,
    planTier: state.planTier,
    currentPeriodEnd: state.currentPeriodEnd,
    loading,
    checkSubscription,
    startCheckout,
    openPortal,
  }
}
