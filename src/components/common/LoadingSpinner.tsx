/**
 * Loading Spinner Component - ShootSync
 * Accessible loading indicator
 */

type SpinnerSize = 'sm' | 'md' | 'lg' | 'xl'

interface LoadingSpinnerProps {
  size?: SpinnerSize
  className?: string
  label?: string
  fullScreen?: boolean
}

const sizeStyles: Record<SpinnerSize, string> = {
  sm: 'w-4 h-4',
  md: 'w-8 h-8',
  lg: 'w-12 h-12',
  xl: 'w-16 h-16',
}

export default function LoadingSpinner({
  size = 'md',
  className = '',
  label = 'Loading',
  fullScreen = false,
}: LoadingSpinnerProps) {
  const spinner = (
    <div
      className={`flex flex-col items-center justify-center gap-3 ${className}`}
      role="status"
      aria-live="polite"
    >
      <svg
        className={`animate-spin text-green-500 ${sizeStyles[size]}`}
        xmlns="http://www.w3.org/2000/svg"
        fill="none"
        viewBox="0 0 24 24"
        aria-hidden="true"
      >
        <circle
          className="opacity-25"
          cx="12"
          cy="12"
          r="10"
          stroke="currentColor"
          strokeWidth="4"
        />
        <path
          className="opacity-75"
          fill="currentColor"
          d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
        />
      </svg>
      <span className="sr-only">{label}</span>
      {size !== 'sm' && (
        <p className="text-slate-400 text-sm">{label}...</p>
      )}
    </div>
  )

  if (fullScreen) {
    return (
      <div className="fixed inset-0 bg-slate-900/80 backdrop-blur-sm flex items-center justify-center z-50">
        {spinner}
      </div>
    )
  }

  return spinner
}

export function PageLoader() {
  return (
    <div className="min-h-screen bg-slate-900 flex items-center justify-center">
      <LoadingSpinner size="lg" label="Loading ShootSync" />
    </div>
  )
}

export function InlineLoader({ label = 'Loading' }: { label?: string }) {
  return (
    <div className="flex items-center gap-2 text-slate-400">
      <LoadingSpinner size="sm" label={label} />
      <span className="text-sm">{label}...</span>
    </div>
  )
}
