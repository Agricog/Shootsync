import { useState, useCallback } from 'react'
import { SMARTSUITE_CONFIG, getSmartSuiteHeaders } from '../config/smartsuite'

interface UseSmartSuiteOptions {
  syndicateId?: string
}

interface SmartSuiteRecord {
  id: string
  [key: string]: any
}

interface SmartSuiteResponse<T> {
  items: T[]
  total_items: number
}

export function useSmartSuite<T extends SmartSuiteRecord>(
  tableName: keyof typeof SMARTSUITE_CONFIG.tables,
  options: UseSmartSuiteOptions = {}
) {
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const tableId = SMARTSUITE_CONFIG.tables[tableName]
  const baseUrl = `${SMARTSUITE_CONFIG.baseUrl}/applications/${tableId}/records`

  // Fetch records with optional filters
  const fetchRecords = useCallback(
    async (filters: Record<string, any> = {}): Promise<T[]> => {
      setLoading(true)
      setError(null)

      try {
        // Enforce tenant isolation - always filter by syndicateId if provided
        const finalFilters = options.syndicateId
          ? { ...filters, syndicate_id: options.syndicateId }
          : filters

        const response = await fetch(baseUrl, {
          method: 'POST',
          headers: getSmartSuiteHeaders(),
          body: JSON.stringify({
            filter: finalFilters,
          }),
        })

        if (!response.ok) {
          throw new Error(`SmartSuite API error: ${response.status}`)
        }

        const data: SmartSuiteResponse<T> = await response.json()
        return data.items || []
      } catch (err) {
        const message = err instanceof Error ? err.message : 'Failed to fetch records'
        setError(message)
        console.error('SmartSuite fetch error:', err)
        return []
      } finally {
        setLoading(false)
      }
    },
    [baseUrl, options.syndicateId]
  )

  // Fetch a single record by ID
  const fetchRecord = useCallback(
    async (recordId: string): Promise<T | null> => {
      setLoading(true)
      setError(null)

      try {
        const response = await fetch(`${baseUrl}/${recordId}`, {
          method: 'GET',
          headers: getSmartSuiteHeaders(),
        })

        if (!response.ok) {
          throw new Error(`SmartSuite API error: ${response.status}`)
        }

        const data: T = await response.json()
        return data
      } catch (err) {
        const message = err instanceof Error ? err.message : 'Failed to fetch record'
        setError(message)
        console.error('SmartSuite fetch error:', err)
        return null
      } finally {
        setLoading(false)
      }
    },
    [baseUrl]
  )

  // Create a new record
  const createRecord = useCallback(
    async (data: Partial<T>): Promise<T | null> => {
      setLoading(true)
      setError(null)

      try {
        // Enforce tenant isolation
        const recordData = options.syndicateId
          ? { ...data, syndicate_id: options.syndicateId }
          : data

        const response = await fetch(baseUrl, {
          method: 'POST',
          headers: getSmartSuiteHeaders(),
          body: JSON.stringify(recordData),
        })

        if (!response.ok) {
          throw new Error(`SmartSuite API error: ${response.status}`)
        }

        const newRecord: T = await response.json()
        return newRecord
      } catch (err) {
        const message = err instanceof Error ? err.message : 'Failed to create record'
        setError(message)
        console.error('SmartSuite create error:', err)
        return null
      } finally {
        setLoading(false)
      }
    },
    [baseUrl, options.syndicateId]
  )

  // Update an existing record
  const updateRecord = useCallback(
    async (recordId: string, data: Partial<T>): Promise<T | null> => {
      setLoading(true)
      setError(null)

      try {
        const response = await fetch(`${baseUrl}/${recordId}`, {
          method: 'PATCH',
          headers: getSmartSuiteHeaders(),
          body: JSON.stringify(data),
        })

        if (!response.ok) {
          throw new Error(`SmartSuite API error: ${response.status}`)
        }

        const updatedRecord: T = await response.json()
        return updatedRecord
      } catch (err) {
        const message = err instanceof Error ? err.message : 'Failed to update record'
        setError(message)
        console.error('SmartSuite update error:', err)
        return null
      } finally {
        setLoading(false)
      }
    },
    [baseUrl]
  )

  // Delete a record
  const deleteRecord = useCallback(
    async (recordId: string): Promise<boolean> => {
      setLoading(true)
      setError(null)

      try {
        const response = await fetch(`${baseUrl}/${recordId}`, {
          method: 'DELETE',
          headers: getSmartSuiteHeaders(),
        })

        if (!response.ok) {
          throw new Error(`SmartSuite API error: ${response.status}`)
        }

        return true
      } catch (err) {
        const message = err instanceof Error ? err.message : 'Failed to delete record'
        setError(message)
        console.error('SmartSuite delete error:', err)
        return false
      } finally {
        setLoading(false)
      }
    },
    [baseUrl]
  )

  return {
    loading,
    error,
    fetchRecords,
    fetchRecord,
    createRecord,
    updateRecord,
    deleteRecord,
  }
}
