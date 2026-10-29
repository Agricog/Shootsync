/**
 * Subscription Hook - ShootSync
 * The plan for a syndicate: its status, and the two ways to change it (Stripe Checkout to
 * start one, Stripe's billing portal to manage one).
 */

import { useState, useEffect, useCallback } from 'react'
import { apiRequest } from '../lib/api'

interface SubscriptionState {
  /** The syndicate this status belongs to. */
  forId: string | null
  isActive: boolean
  status: string | null
  planTier: 'STARTER' | 'STANDARD' | null
  currentPeriodEnd: string | null
  /** Why the status couldn't be read, if it couldn't. Never taken to mean "not subscribed". */
  error: string | null
  fetching: boolean
}

const EMPTY: SubscriptionState = {
  forId: null,
  isActive: false,
  status: null,
  planTier: null,
  currentPeriodEnd: null,
  error: null,
  fetching: false,
}

interface StatusResponse {
  isActive: boolean
  status: string | null
  planTier: 'STARTER' | 'STANDARD' | null
  currentPeriodEnd: string | null
}

export function useSubscription(syndicateId: string | null) {
  const [state, setState] = useState<SubscriptionState>(EMPTY)

  const checkSubscription = useCallback(async () => {
    if (!syndicateId) return
    setState((prev) => ({ ...prev, fetching: true }))
    const result = await apiRequest<StatusResponse>(`/api/subscriptions/status/${encodeURIComponent(syndicateId)}`)
    if (result.ok) {
      setState({
        forId: syndicateId,
        isActive: Boolean(result.data.isActive),
        status: result.data.status,
        planTier: result.data.planTier,
        currentPeriodEnd: result.data.currentPeriodEnd,
        error: null,
        fetching: false,
      })
    } else {
      setState({ ...EMPTY, forId: syndicateId, error: result.error })
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
    const result = await apiRequest<{ url?: string }>('/api/subscriptions/create-checkout', {
      method: 'POST',
      body: { syndicateId, planTier, email },
    })
    if (!result.ok) return result.error
    if (!result.data?.url) return 'Could not start checkout. Please try again.'
    window.location.href = result.data.url
    return null
  }

  /** Opens the Stripe billing portal. Returns an error message if that could not start. */
  const openPortal = async (): Promise<string | null> => {
    const result = await apiRequest<{ url?: string }>('/api/subscriptions/portal', {
      method: 'POST',
      body: { syndicateId },
    })
    if (!result.ok) return result.error
    if (!result.data?.url) return 'Could not open billing. Please try again.'
    window.location.href = result.data.url
    return null
  }

  return {
    isActive: state.forId === syndicateId && state.isActive,
    status: state.status,
    planTier: state.planTier,
    currentPeriodEnd: state.currentPeriodEnd,
    error: state.error,
    loading,
    checkSubscription,
    startCheckout,
    openPortal,
  }
}
