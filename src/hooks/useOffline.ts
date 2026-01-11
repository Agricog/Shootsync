/**
 * Offline Hook - ShootSync
 * Manages offline state and request queuing for PWA
 */

import { useState, useEffect, useCallback } from 'react'
import { captureError } from '../utils/errorTracking'

interface OfflineRequest {
  id: string
  type: 'bag_record' | 'attendance' | 'check_in'
  data: Record<string, unknown>
  timestamp: number
  retryCount: number
}

const OFFLINE_QUEUE_KEY = 'shootsync_offline_queue'
const MAX_RETRIES = 3

export function useOffline() {
  const [isOnline, setIsOnline] = useState(
    typeof navigator !== 'undefined' ? navigator.onLine : true
  )
  const [pendingCount, setPendingCount] = useState(0)
  const [isSyncing, setIsSyncing] = useState(false)

  useEffect(() => {
    const handleOnline = () => {
      setIsOnline(true)
      syncOfflineQueue()
    }

    const handleOffline = () => {
      setIsOnline(false)
    }

    window.addEventListener('online', handleOnline)
    window.addEventListener('offline', handleOffline)

    // Check pending items on mount
    updatePendingCount()

    return () => {
      window.removeEventListener('online', handleOnline)
      window.removeEventListener('offline', handleOffline)
    }
  }, [])

  const updatePendingCount = useCallback(() => {
    try {
      const queue = getOfflineQueue()
      setPendingCount(queue.length)
    } catch (err) {
      captureError(err, 'useOffline.updatePendingCount')
    }
  }, [])

  const queueOfflineRequest = useCallback(
    async (type: OfflineRequest['type'], data: Record<string, unknown>): Promise<string> => {
      const request: OfflineRequest = {
        id: generateId(),
        type,
        data,
        timestamp: Date.now(),
        retryCount: 0,
      }

      try {
        const queue = getOfflineQueue()
        queue.push(request)
        localStorage.setItem(OFFLINE_QUEUE_KEY, JSON.stringify(queue))
        updatePendingCount()

        if (isOnline) {
          syncOfflineQueue()
        }

        return request.id
      } catch (err) {
        captureError(err, 'useOffline.queueOfflineRequest')
        throw err
      }
    },
    [isOnline, updatePendingCount]
  )

  const syncOfflineQueue = useCallback(async () => {
    if (isSyncing || !isOnline) return

    setIsSyncing(true)

    try {
      const queue = getOfflineQueue()
      const failedRequests: OfflineRequest[] = []

      for (const request of queue) {
        try {
          await processOfflineRequest(request)
        } catch (err) {
          if (request.retryCount < MAX_RETRIES) {
            failedRequests.push({
              ...request,
              retryCount: request.retryCount + 1,
            })
          } else {
            captureError(err, 'useOffline.syncOfflineQueue.maxRetries', {
              extra: { requestId: request.id, type: request.type },
            })
          }
        }
      }

      localStorage.setItem(OFFLINE_QUEUE_KEY, JSON.stringify(failedRequests))
      updatePendingCount()
    } catch (err) {
      captureError(err, 'useOffline.syncOfflineQueue')
    } finally {
      setIsSyncing(false)
    }
  }, [isSyncing, isOnline, updatePendingCount])

  const clearOfflineQueue = useCallback(() => {
    localStorage.removeItem(OFFLINE_QUEUE_KEY)
    updatePendingCount()
  }, [updatePendingCount])

  return {
    isOnline,
    pendingCount,
    isSyncing,
    queueOfflineRequest,
    syncOfflineQueue,
    clearOfflineQueue,
  }
}

function getOfflineQueue(): OfflineRequest[] {
  try {
    const stored = localStorage.getItem(OFFLINE_QUEUE_KEY)
    return stored ? JSON.parse(stored) : []
  } catch {
    return []
  }
}

async function processOfflineRequest(request: OfflineRequest): Promise<void> {
  const endpoints: Record<OfflineRequest['type'], string> = {
    bag_record: '/api/bags',
    attendance: '/api/attendance',
    check_in: '/api/check-in',
  }

  const response = await fetch(endpoints[request.type], {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    credentials: 'include',
    body: JSON.stringify({
      ...request.data,
      offlineId: request.id,
      offlineTimestamp: request.timestamp,
    }),
  })

  if (!response.ok) {
    throw new Error(`Sync failed: ${response.status}`)
  }
}

function generateId(): string {
  return `offline_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`
}
