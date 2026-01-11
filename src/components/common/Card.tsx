/**
 * Card Component - ShootSync
 * Reusable card container
 */

interface CardProps {
  children: React.ReactNode
  className?: string
  padding?: 'none' | 'sm' | 'md' | 'lg'
  hover?: boolean
  onClick?: () => void
}

const paddingStyles = {
  none: '',
  sm: 'p-3',
  md: 'p-4',
  lg: 'p-6',
}

export default function Card({
  children,
  className = '',
  padding = 'md',
  hover = false,
  onClick,
}: CardProps) {
  const Component = onClick ? 'button' : 'div'

  return (
    <Component
      onClick={onClick}
      className={`
        bg-slate-800 border border-slate-700 rounded-xl
        ${paddingStyles[padding]}
        ${hover ? 'hover:border-slate-600 hover:bg-slate-750 transition-colors cursor-pointer' : ''}
        ${onClick ? 'w-full text-left focus:outline-none focus:ring-2 focus:ring-green-500 focus:ring-offset-2 focus:ring-offset-slate-900' : ''}
        ${className}
      `}
    >
      {children}
    </Component>
  )
}

interface CardHeaderProps {
  title: string
  subtitle?: string
  action?: React.ReactNode
  className?: string
}

export function CardHeader({ title, subtitle, action, className = '' }: CardHeaderProps) {
  return (
    <div className={`flex items-start justify-between gap-4 ${className}`}>
      <div>
        <h3 className="text-lg font-semibold text-white">{title}</h3>
        {subtitle && (
          <p className="mt-1 text-sm text-slate-400">{subtitle}</p>
        )}
      </div>
      {action && <div className="flex-shrink-0">{action}</div>}
    </div>
  )
}

interface CardContentProps {
  children: React.ReactNode
  className?: string
}

export function CardContent({ children, className = '' }: CardContentProps) {
  return <div className={`mt-4 ${className}`}>{children}</div>
}

interface CardFooterProps {
  children: React.ReactNode
  className?: string
}

export function CardFooter({ children, className = '' }: CardFooterProps) {
  return (
    <div
      className={`
        mt-4 pt-4 border-t border-slate-700
        flex items-center justify-end gap-3
        ${className}
      `}
    >
      {children}
    </div>
  )
}

interface StatCardProps {
  label: string
  value: string | number
  icon?: React.ReactNode
  trend?: {
    value: number
    isPositive: boolean
  }
  className?: string
}

export function StatCard({ label, value, icon, trend, className = '' }: StatCardProps) {
  return (
    <Card className={className}>
      <div className="flex items-start justify-between">
        <div>
          <p className="text-sm text-slate-400">{label}</p>
          <p className="mt-1 text-2xl font-bold text-white">{value}</p>
          {trend && (
            <p
              className={`mt-1 text-sm flex items-center gap-1 ${
                trend.isPositive ? 'text-green-500' : 'text-red-500'
              }`}
            >
              <svg
                className={`w-4 h-4 ${trend.isPositive ? '' : 'rotate-180'}`}
                fill="currentColor"
                viewBox="0 0 20 20"
                aria-hidden="true"
              >
                <path
                  fillRule="evenodd"
                  d="M5.293 9.707a1 1 0 010-1.414l4-4a1 1 0 011.414 0l4 4a1 1 0 01-1.414 1.414L11 7.414V15a1 1 0 11-2 0V7.414L6.707 9.707a1 1 0 01-1.414 0z"
                  clipRule="evenodd"
                />
              </svg>
              {Math.abs(trend.value)}%
            </p>
          )}
        </div>
        {icon && (
          <div className="p-2 bg-slate-700 rounded-lg text-green-500">
            {icon}
          </div>
        )}
      </div>
    </Card>
  )
}
