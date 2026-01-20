/**
 * Subscription Hook - ShootSync
 * Check and manage subscription status
 */

import { useState, useEffect } from 'react'

interface SubscriptionStatus {
  isActive: boolean
  status: string | null
  planTier: 'STARTER' | 'STANDARD' | null
  currentPeriodEnd: string | null
  loading: boolean
}

export function useSubscription(syndicateId: string | null) {
  const [subscription, setSubscription] = useState<SubscriptionStatus>({
    isActive: false,
    status: null,
    planTier: null,
    currentPeriodEnd: null,
    loading: true,
  })

  useEffect(() => {
    if (syndicateId) {
      checkSubscription()
    } else {
      setSubscription(prev => ({ ...prev, loading: false }))
    }
  }, [syndicateId])

  const checkSubscription = async () => {
    try {
      const response = await fetch(`/api/subscriptions/status/${syndicateId}`)
      if (response.ok) {
        const data = await response.json()
        setSubscription({
          isActive: data.isActive,
          status: data.status,
          planTier: data.planTier,
          currentPeriodEnd: data.currentPeriodEnd,
          loading: false,
        })
      } else {
        setSubscription(prev => ({ ...prev, loading: false }))
      }
    } catch (error) {
      console.error('Error checking subscription:', error)
      setSubscription(prev => ({ ...prev, loading: false }))
    }
  }

  const startCheckout = async (planTier: 'STARTER' | 'STANDARD', email: string, clerkUserId: string) => {
    try {
      const response = await fetch('/api/subscriptions/create-checkout', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          syndicateId,
          planTier,
          email,
          clerkUserId,
        }),
      })

      if (response.ok) {
        const { url } = await response.json()
        if (url) {
          window.location.href = url
        }
      }
    } catch (error) {
      console.error('Error starting checkout:', error)
    }
  }

  const openPortal = async () => {
    try {
      const response = await fetch('/api/subscriptions/portal', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ syndicateId }),
      })

      if (response.ok) {
        const { url } = await response.json()
        if (url) {
          window.location.href = url
        }
      }
    } catch (error) {
      console.error('Error opening portal:', error)
    }
  }

  return {
    ...subscription,
    checkSubscription,
    startCheckout,
    openPortal,
  }
}
