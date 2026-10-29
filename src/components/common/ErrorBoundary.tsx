/**
 * Error Boundary Component - ShootSync
 * Catches React errors and displays fallback UI
 */

import { Component, type ReactNode } from 'react'
import { captureError } from '../../utils/errorTracking'
import { SITE } from '../../config/site'
import Button from './Button'

interface ErrorBoundaryProps {
  children: ReactNode
  fallback?: ReactNode
  onReset?: () => void
}

interface ErrorBoundaryState {
  hasError: boolean
  error: Error | null
  errorInfo: string | null
  /** A short reference the captain can quote, matched to the error report. */
  reference: string | null
}

export default class ErrorBoundary extends Component<ErrorBoundaryProps, ErrorBoundaryState> {
  constructor(props: ErrorBoundaryProps) {
    super(props)
    this.state = {
      hasError: false,
      error: null,
      errorInfo: null,
      reference: null,
    }
    this.handleReset = this.handleReset.bind(this)
  }

  static getDerivedStateFromError(error: Error): Partial<ErrorBoundaryState> {
    return { hasError: true, error }
  }

  componentDidCatch(error: Error, errorInfo: React.ErrorInfo): void {
    const reference = captureError(error, 'ErrorBoundary')
    this.setState({ errorInfo: errorInfo.componentStack || null, reference })
  }

  handleReset(): void {
    this.setState({ hasError: false, error: null, errorInfo: null, reference: null })
    if (this.props.onReset) {
      this.props.onReset()
    }
  }

  render(): ReactNode {
    if (this.state.hasError) {
      if (this.props.fallback) {
        return this.props.fallback
      }

      return (
        <div className="min-h-[400px] flex items-center justify-center p-8">
          <div className="max-w-md w-full text-center">
            <div className="w-16 h-16 mx-auto mb-4 bg-red-500/10 rounded-full flex items-center justify-center">
              <svg
                className="w-8 h-8 text-red-500"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
                aria-hidden="true"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z"
                />
              </svg>
            </div>
            <h2 className="text-xl font-semibold text-white mb-2">Something went wrong</h2>
            <p className="text-slate-300 mb-2">
              This page hit a problem it couldn’t recover from. Nothing you had already saved is affected.
            </p>
            <p className="text-slate-400 text-sm mb-6">
              Try again or reload. If it keeps happening, email{' '}
              <a href={`mailto:${SITE.email}?subject=ShootSync%20problem%20${this.state.reference ?? ''}`} className="text-green-400 underline underline-offset-2">{SITE.email}</a>
              {this.state.reference && <> quoting reference <span className="font-mono text-slate-200">{this.state.reference}</span></>}.
            </p>
            <div className="flex items-center justify-center gap-3">
              <Button variant="secondary" onClick={() => window.location.reload()}>
                Reload the page
              </Button>
              <Button onClick={this.handleReset}>Try again</Button>
            </div>
          </div>
        </div>
      )
    }

    return this.props.children
  }
}

interface ErrorFallbackProps {
  title?: string
  message?: string
  onRetry?: () => void
}

export function ErrorFallback({
  title = 'This couldn’t be loaded',
  message = 'Something went wrong. Try again in a moment.',
  onRetry,
}: ErrorFallbackProps) {
  return (
    <div className="p-6 text-center">
      <div className="w-12 h-12 mx-auto mb-3 bg-red-500/10 rounded-full flex items-center justify-center">
        <svg
          className="w-6 h-6 text-red-500"
          fill="none"
          stroke="currentColor"
          viewBox="0 0 24 24"
          aria-hidden="true"
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth={2}
            d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"
          />
        </svg>
      </div>
      <h3 className="text-lg font-medium text-white mb-1">{title}</h3>
      <p className="text-sm text-slate-400 mb-4">{message}</p>
      {onRetry && (
        <Button size="sm" onClick={onRetry}>
          Retry
        </Button>
      )}
    </div>
  )
}
