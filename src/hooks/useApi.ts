import { useState, useCallback } from 'react'

const API_URL = import.meta.env.VITE_API_URL || ''

interface UseApiOptions {
  syndicateId?: string
}

export function useApi<T>(endpoint: string, options: UseApiOptions = {}) {
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const buildUrl = useCallback(
    (path: string = '', params: Record<string, string> = {}) => {
      const url = new URL(`${API_URL}/api/${endpoint}${path}`, window.location.origin)
      
      if (options.syndicateId) {
        url.searchParams.set('syndicateId', options.syndicateId)
      }
      
      Object.entries(params).forEach(([key, value]) => {
        if (value) url.searchParams.set(key, value)
      })
      
      return url.toString()
    },
    [endpoint, options.syndicateId]
  )

  const fetchAll = useCallback(
    async (params: Record<string, string> = {}): Promise<T[]> => {
      setLoading(true)
      setError(null)

      try {
        const response = await fetch(buildUrl('', params))
        
        if (!response.ok) {
          throw new Error(`API error: ${response.status}`)
        }

        const data = await response.json()
        return data
      } catch (err) {
        const message = err instanceof Error ? err.message : 'Failed to fetch'
        setError(message)
        return []
      } finally {
        setLoading(false)
      }
    },
    [buildUrl]
  )

  const fetchOne = useCallback(
    async (id: string): Promise<T | null> => {
      setLoading(true)
      setError(null)

      try {
        const response = await fetch(buildUrl(`/${id}`))
        
        if (!response.ok) {
          throw new Error(`API error: ${response.status}`)
        }

        return await response.json()
      } catch (err) {
        const message = err instanceof Error ? err.message : 'Failed to fetch'
        setError(message)
        return null
      } finally {
        setLoading(false)
      }
    },
    [buildUrl]
  )

  const create = useCallback(
    async (data: Partial<T>): Promise<T | null> => {
      setLoading(true)
      setError(null)

      try {
        const response = await fetch(buildUrl(), {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(data),
        })

        if (!response.ok) {
          throw new Error(`API error: ${response.status}`)
        }

        return await response.json()
      } catch (err) {
        const message = err instanceof Error ? err.message : 'Failed to create'
        setError(message)
        return null
      } finally {
        setLoading(false)
      }
    },
    [buildUrl]
  )

  const update = useCallback(
    async (id: string, data: Partial<T>): Promise<T | null> => {
      setLoading(true)
      setError(null)

      try {
        const response = await fetch(buildUrl(`/${id}`), {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(data),
        })

        if (!response.ok) {
          throw new Error(`API error: ${response.status}`)
        }

        return await response.json()
      } catch (err) {
        const message = err instanceof Error ? err.message : 'Failed to update'
        setError(message)
        return null
      } finally {
        setLoading(false)
      }
    },
    [buildUrl]
  )

  const remove = useCallback(
    async (id: string): Promise<boolean> => {
      setLoading(true)
      setError(null)

      try {
        const response = await fetch(buildUrl(`/${id}`), {
          method: 'DELETE',
        })

        if (!response.ok) {
          throw new Error(`API error: ${response.status}`)
        }

        return true
      } catch (err) {
        const message = err instanceof Error ? err.message : 'Failed to delete'
        setError(message)
        return false
      } finally {
        setLoading(false)
      }
    },
    [buildUrl]
  )

  return {
    loading,
    error,
    fetchAll,
    fetchOne,
    create,
    update,
    remove,
  }
}
