/**
 * Error Tracking - ShootSync
 * Sentry integration placeholder (configure when Sentry added)
 */

interface ErrorContext {
  component?: string
  action?: string
  userId?: string
  syndicateId?: string
  extra?: Record<string, unknown>
}

export const captureError = (
  error: unknown,
  context: string,
  extra?: ErrorContext
): void => {
  const errorMessage = error instanceof Error ? error.message : String(error)
  const errorStack = error instanceof Error ? error.stack : undefined

  console.error(`[ShootSync Error] ${context}:`, {
    message: errorMessage,
    stack: errorStack,
    ...extra,
    timestamp: new Date().toISOString()
  })

  // TODO: Replace with Sentry when configured
  // Sentry.captureException(error, {
  //   tags: { context, ...extra },
  // })
}

export const captureMessage = (
  message: string,
  level: 'info' | 'warning' | 'error' = 'info',
  context?: ErrorContext
): void => {
  const logMethod = level === 'error' ? console.error : level === 'warning' ? console.warn : console.log
  
  logMethod(`[ShootSync ${level.toUpperCase()}] ${message}`, {
    ...context,
    timestamp: new Date().toISOString()
  })

  // TODO: Replace with Sentry when configured
  // Sentry.captureMessage(message, level)
}

export const setUserContext = (
  userId: string,
  email?: string,
  role?: string
): void => {
  console.log('[ShootSync] User context set:', { userId, email, role })

  // TODO: Replace with Sentry when configured
  // Sentry.setUser({ id: userId, email, role })
}

export const clearUserContext = (): void => {
  console.log('[ShootSync] User context cleared')

  // TODO: Replace with Sentry when configured
  // Sentry.setUser(null)
}

export const trackPerformance = (
  name: string,
  duration: number,
  context?: Record<string, unknown>
): void => {
  if (duration > 1000) {
    console.warn(`[ShootSync Performance] Slow operation: ${name} took ${duration}ms`, context)
  }
}
