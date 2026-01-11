/**
 * Syndicate Hook - ShootSync
 * Manages current syndicate context
 */

import { useState, useEffect, useCallback } from 'react'
import { useAuth } from './useAuth'
import { captureError } from '../utils/errorTracking'
import type { Syndicate } from '../types/syndicate'
import type { UserRole } from '../config/clerk'

interface UseSyndicateReturn {
  syndicate: Syndicate | null
  isLoading: boolean
  error: string | null
  memberRole: UserRole | null
  refetch: () => Promise<void>
}

export function useSyndicate(): UseSyndicateReturn {
  const { syndicateId, role } = useAuth()
  const [syndicate, setSyndicate] = useState<Syndicate | null>(null)
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const fetchSyndicate = useCallback(async () => {
    if (!syndicateId) {
      setSyndicate(null)
      setIsLoading(false)
      return
    }

    setIsLoading(true)
    setError(null)

    try {
      const response = await fetch(`/api/syndicates/${syndicateId}`, {
        method: 'GET',
        credentials: 'include',
      })

      if (!response.ok) {
        throw new Error('Failed to fetch syndicate')
      }

      const data = await response.json()
      setSyndicate(data)
    } catch (err) {
      captureError(err, 'useSyndicate.fetchSyndicate')
      setError('Failed to load syndicate data')
      setSyndicate(null)
    } finally {
      setIsLoading(false)
    }
  }, [syndicateId])

  useEffect(() => {
    fetchSyndicate()
  }, [fetchSyndicate])

  return {
    syndicate,
    isLoading,
    error,
    memberRole: role,
    refetch: fetchSyndicate,
  }
}

export function useSyndicateSettings() {
  const { syndicate } = useSyndicate()

  return {
    pegRotationRule: syndicate?.pegRotationRule || 'fair_rotation',
    defaultBeaterRate: syndicate?.defaultBeaterRate || 40,
    subscriptionAmount: syndicate?.subscriptionAmount || 0,
    subscriptionType: syndicate?.subscriptionType || 'annual',
    seasonStart: syndicate?.seasonStart,
    seasonEnd: syndicate?.seasonEnd,
  }
}

export function useSeasonDates() {
  const { syndicate } = useSyndicate()

  const isInSeason = useCallback((): boolean => {
    if (!syndicate?.seasonStart || !syndicate?.seasonEnd) {
      return false
    }

    const now = new Date()
    const start = new Date(syndicate.seasonStart)
    const end = new Date(syndicate.seasonEnd)

    return now >= start && now <= end
  }, [syndicate?.seasonStart, syndicate?.seasonEnd])

  const daysRemaining = useCallback((): number | null => {
    if (!syndicate?.seasonEnd) {
      return null
    }

    const now = new Date()
    const end = new Date(syndicate.seasonEnd)
    const diff = end.getTime() - now.getTime()

    if (diff < 0) return 0
    return Math.ceil(diff / (1000 * 60 * 60 * 24))
  }, [syndicate?.seasonEnd])

  return {
    seasonStart: syndicate?.seasonStart,
    seasonEnd: syndicate?.seasonEnd,
    isInSeason: isInSeason(),
    daysRemaining: daysRemaining(),
  }
}
