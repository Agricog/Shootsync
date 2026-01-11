/**
 * SmartSuite API Hook - ShootSync
 * Secure data access with tenant isolation
 */

import { useCallback } from 'react'
import { useAuth } from './useAuth'
import { SMARTSUITE_TABLES, type SmartSuiteTable } from '../config/smartsuite'
import { captureError } from '../utils/errorTracking'
import type { ApiResponse, SmartSuiteQueryOptions } from '../types/api'

interface TenantContext {
  syndicateId: string
  userId: string
  role: string
}

export function useSmartSuite() {
  const { userId, syndicateId, role } = useAuth()

  const getTenantContext = useCallback((): TenantContext | null => {
    if (!syndicateId || !userId || !role) {
      return null
    }
    return { syndicateId, userId, role }
  }, [syndicateId, userId, role])

  const query = useCallback(async <T>(
    table: SmartSuiteTable,
    options: SmartSuiteQueryOptions = {}
  ): Promise<ApiResponse<T[]>> => {
    const ctx = getTenantContext()
    
    if (!ctx) {
      return {
        success: false,
        error: {
          code: 'NO_TENANT_CONTEXT',
          message: 'User must be authenticated and belong to a syndicate',
        },
      }
    }

    // CRITICAL: Always include syndicate_id filter for tenant isolation
    const filter = {
      syndicate_id: { eq: ctx.syndicateId },
      ...options.filter,
    }

    try {
      const response = await fetch(`/api/smartsuite/${SMARTSUITE_TABLES[table]}`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        credentials: 'include',
        body: JSON.stringify({
          filter,
          sort: options.sort,
          limit: options.limit,
          offset: options.offset,
        }),
      })

      if (!response.ok) {
        throw new Error(`Query failed: ${response.status}`)
      }

      const data = await response.json()
      return { success: true, data }
    } catch (error) {
      captureError(error, `useSmartSuite.query.${table}`)
      return {
        success: false,
        error: {
          code: 'QUERY_FAILED',
          message: 'Failed to fetch data',
        },
      }
    }
  }, [getTenantContext])

  const create = useCallback(async <T>(
    table: SmartSuiteTable,
    data: Record<string, unknown>
  ): Promise<ApiResponse<T>> => {
    const ctx = getTenantContext()
    
    if (!ctx) {
      return {
        success: false,
        error: {
          code: 'NO_TENANT_CONTEXT',
          message: 'User must be authenticated and belong to a syndicate',
        },
      }
    }

    // CRITICAL: Always inject syndicate_id on create
    const recordWithTenant = {
      ...data,
      syndicate_id: ctx.syndicateId,
    }

    try {
      const response = await fetch(`/api/smartsuite/${SMARTSUITE_TABLES[table]}`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
        },
        credentials: 'include',
        body: JSON.stringify(recordWithTenant),
      })

      if (!response.ok) {
        throw new Error(`Create failed: ${response.status}`)
      }

      const result = await response.json()
      return { success: true, data: result }
    } catch (error) {
      captureError(error, `useSmartSuite.create.${table}`)
      return {
        success: false,
        error: {
          code: 'CREATE_FAILED',
          message: 'Failed to create record',
        },
      }
    }
  }, [getTenantContext])

  const update = useCallback(async <T>(
    table: SmartSuiteTable,
    id: string,
    data: Record<string, unknown>
  ): Promise<ApiResponse<T>> => {
    const ctx = getTenantContext()
    
    if (!ctx) {
      return {
        success: false,
        error: {
          code: 'NO_TENANT_CONTEXT',
          message: 'User must be authenticated and belong to a syndicate',
        },
      }
    }

    try {
      const response = await fetch(`/api/smartsuite/${SMARTSUITE_TABLES[table]}/${id}`, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
        },
        credentials: 'include',
        body: JSON.stringify({
          ...data,
          syndicate_id: ctx.syndicateId, // Ensure tenant context
        }),
      })

      if (!response.ok) {
        throw new Error(`Update failed: ${response.status}`)
      }

      const result = await response.json()
      return { success: true, data: result }
    } catch (error) {
      captureError(error, `useSmartSuite.update.${table}`)
      return {
        success: false,
        error: {
          code: 'UPDATE_FAILED',
          message: 'Failed to update record',
        },
      }
    }
  }, [getTenantContext])

  const remove = useCallback(async (
    table: SmartSuiteTable,
    id: string
  ): Promise<ApiResponse<void>> => {
    const ctx = getTenantContext()
    
    if (!ctx) {
      return {
        success: false,
        error: {
          code: 'NO_TENANT_CONTEXT',
          message: 'User must be authenticated and belong to a syndicate',
        },
      }
    }

    try {
      const response = await fetch(`/api/smartsuite/${SMARTSUITE_TABLES[table]}/${id}`, {
        method: 'DELETE',
        headers: {
          'Content-Type': 'application/json',
        },
        credentials: 'include',
        body: JSON.stringify({
          syndicate_id: ctx.syndicateId, // Verify tenant context
        }),
      })

      if (!response.ok) {
        throw new Error(`Delete failed: ${response.status}`)
      }

      return { success: true }
    } catch (error) {
      captureError(error, `useSmartSuite.remove.${table}`)
      return {
        success: false,
        error: {
          code: 'DELETE_FAILED',
          message: 'Failed to delete record',
        },
      }
    }
  }, [getTenantContext])

  return {
    query,
    create,
    update,
    remove,
    isReady: !!getTenantContext(),
  }
}
