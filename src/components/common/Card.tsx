import { ReactNode, MouseEventHandler } from 'react'

export interface CardProps {
  children: ReactNode
  className?: string
  padding?: 'none' | 'sm' | 'md' | 'lg'
  hover?: boolean
  onClick?: MouseEventHandler<HTMLDivElement>
}

export default function Card({ 
  children, 
  className = '',
  padding = 'md',
  hover = false,
  onClick
}: CardProps) {
  const paddingClasses = {
    none: '',
    sm: 'p-3',
    md: 'p-6',
    lg: 'p-8',
  }

  const hoverClass = hover ? 'hover:shadow-md transition-shadow cursor-pointer' : ''

  return (
    <div 
      className={`bg-slate-800 rounded-lg border border-slate-700 shadow-sm ${paddingClasses[padding]} ${hoverClass} ${className}`}
      onClick={onClick}
    >
      {children}
    </div>
  )
}

// CardHeader - supports both children-based and props-based usage
interface CardHeaderProps {
  title?: string
  subtitle?: string
  action?: ReactNode
  children?: ReactNode
  className?: string
}

export function CardHeader({ 
  title, 
  subtitle, 
  action, 
  children, 
  className = '' 
}: CardHeaderProps) {
  if (children && !title) {
    return <div className={`mb-4 ${className}`}>{children}</div>
  }

  return (
    <div className={`mb-4 ${className}`}>
      <div className="flex items-start justify-between">
        <div>
          {title && (
            <h3 className="text-lg font-semibold text-white">
              {title}
            </h3>
          )}
          {subtitle && (
            <p className="text-sm text-slate-400 mt-1">
              {subtitle}
            </p>
          )}
        </div>
        {action && <div>{action}</div>}
      </div>
      {children}
    </div>
  )
}

export function CardContent({ children, className = '' }: { children: ReactNode; className?: string }) {
  return <div className={className}>{children}</div>
}

export function CardFooter({ children, className = '' }: { children: ReactNode; className?: string }) {
  return (
    <div className={`mt-4 pt-4 border-t border-slate-700 ${className}`}>
      {children}
    </div>
  )
}

// StatCard for dashboard metrics - supports both title and label
interface StatCardProps {
  title?: string
  label?: string
  value: string | number
  subtitle?: string
  icon?: ReactNode
  className?: string
}

export function StatCard({ 
  title, 
  label,
  value, 
  subtitle, 
  icon,
  className = '' 
}: StatCardProps) {
  const displayTitle = title || label || ''
  
  return (
    <Card className={className}>
      <div className="flex items-start justify-between">
        <div>
          <p className="text-sm text-slate-400 mb-1">{displayTitle}</p>
          <p className="text-2xl font-bold text-white">{value}</p>
          {subtitle && (
            <p className="text-sm text-slate-400 mt-1">{subtitle}</p>
          )}
        </div>
        {icon && <div className="text-slate-500">{icon}</div>}
      </div>
    </Card>
  )
}
