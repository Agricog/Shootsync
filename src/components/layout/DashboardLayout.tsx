/**
 * Dashboard Layout Component - ShootSync
 * Wrapper for authenticated pages
 */

import { type ReactNode } from 'react'
import Navigation from './Navigation'
import Footer from './Footer'
import { useSessionTimeout } from '../../hooks/useSessionTimeout'
import { useOffline } from '../../hooks/useOffline'
import ErrorBoundary from '../common/ErrorBoundary'

interface DashboardLayoutProps {
  children: ReactNode
  title?: string
  subtitle?: string
  action?: ReactNode
  fullWidth?: boolean
}

export default function DashboardLayout({
  children,
  title,
  subtitle,
  action,
  fullWidth = false,
}: DashboardLayoutProps) {
  useSessionTimeout({
    onTimeout: () => {
      console.log('[ShootSync] Session timed out')
    },
  })

  const { isOnline, pendingCount, isSyncing } = useOffline()

  return (
    <div className="min-h-screen bg-slate-900 flex flex-col">
      <Navigation />

      {!isOnline && (
        <div className="bg-amber-500/10 border-b border-amber-500/20 px-4 py-2">
          <div className="max-w-7xl mx-auto flex items-center justify-center gap-2 text-amber-500 text-sm">
            <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 20 20" aria-hidden="true">
              <path fillRule="evenodd" d="M8.257 3.099c.765-1.36 2.722-1.36 3.486 0l5.58 9.92c.75 1.334-.213 2.98-1.742 2.98H4.42c-1.53 0-2.493-1.646-1.743-2.98l5.58-9.92zM11 13a1 1 0 11-2 0 1 1 0 012 0zm-1-8a1 1 0 00-1 1v3a1 1 0 002 0V6a1 1 0 00-1-1z" clipRule="evenodd" />
            </svg>
            <span>
              You are offline. Changes will be saved and synced when you reconnect.
              {pendingCount > 0 && ` (${pendingCount} pending)`}
              {isSyncing && ' Syncing...'}
            </span>
          </div>
        </div>
      )}

      <main className="flex-1">
        <div className={fullWidth ? '' : 'max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8'}>
          {(title || action) && (
            <div className="mb-8 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
              <div>
                {title && (
                  <h1 className="text-2xl font-bold text-white">{title}</h1>
                )}
                {subtitle && (
                  <p className="mt-1 text-slate-400">{subtitle}</p>
                )}
              </div>
              {action && <div className="flex-shrink-0">{action}</div>}
            </div>
          )}

          <ErrorBoundary>
            {children}
          </ErrorBoundary>
        </div>
      </main>

      <Footer />
    </div>
  )
}

interface PageSectionProps {
  children: ReactNode
  className?: string
}

export function PageSection({ children, className = '' }: PageSectionProps) {
  return (
    <section className={`mb-8 ${className}`}>
      {children}
    </section>
  )
}

interface PageGridProps {
  children: ReactNode
  columns?: 1 | 2 | 3 | 4
  className?: string
}

export function PageGrid({ children, columns = 3, className = '' }: PageGridProps) {
  const colStyles = {
    1: 'grid-cols-1',
    2: 'grid-cols-1 md:grid-cols-2',
    3: 'grid-cols-1 md:grid-cols-2 lg:grid-cols-3',
    4: 'grid-cols-1 md:grid-cols-2 lg:grid-cols-4',
  }

  return (
    <div className={`grid ${colStyles[columns]} gap-6 ${className}`}>
      {children}
    </div>
  )
}
