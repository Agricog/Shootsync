/**
 * Peg Display Component - ShootSync
 * Display peg allocations for a shoot
 */

interface Allocation {
  memberId: string
  memberName: string
  pegNumber: number
  isGuest?: boolean
}

interface PegDisplayProps {
  allocations: Allocation[]
  highlightMemberId?: string
  compact?: boolean
}

export default function PegDisplay({
  allocations,
  highlightMemberId,
  compact = false,
}: PegDisplayProps) {
  if (allocations.length === 0) {
    return (
      <p className="text-slate-400 text-center py-4">
        No peg allocations yet
      </p>
    )
  }

  if (compact) {
    return (
      <div className="flex flex-wrap gap-2">
        {allocations.map((allocation) => (
          <CompactPegBadge
            key={allocation.memberId}
            allocation={allocation}
            isHighlighted={allocation.memberId === highlightMemberId}
          />
        ))}
      </div>
    )
  }

  return (
    <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-3">
      {allocations.map((allocation) => (
        <PegCard
          key={allocation.memberId}
          allocation={allocation}
          isHighlighted={allocation.memberId === highlightMemberId}
        />
      ))}
    </div>
  )
}

interface PegCardProps {
  allocation: Allocation
  isHighlighted: boolean
}

function PegCard({ allocation, isHighlighted }: PegCardProps) {
  return (
    <div
      className={`
        p-3 rounded-lg border text-center
        ${
          isHighlighted
            ? 'border-green-500 bg-green-500/10'
            : 'border-slate-700 bg-slate-800'
        }
      `}
    >
      <div
        className={`
          w-10 h-10 mx-auto rounded-full flex items-center justify-center text-lg font-bold mb-2
          ${isHighlighted ? 'bg-green-600 text-white' : 'bg-slate-700 text-white'}
        `}
      >
        {allocation.pegNumber}
      </div>
      <p className="text-white text-sm font-medium truncate">
        {allocation.memberName}
      </p>
      {allocation.isGuest && (
        <span className="inline-block mt-1 px-2 py-0.5 text-xs bg-blue-500/10 text-blue-400 border border-blue-500/20 rounded">
          Guest
        </span>
      )}
    </div>
  )
}

interface CompactPegBadgeProps {
  allocation: Allocation
  isHighlighted: boolean
}

function CompactPegBadge({ allocation, isHighlighted }: CompactPegBadgeProps) {
  return (
    <div
      className={`
        inline-flex items-center gap-2 px-3 py-1.5 rounded-full border
        ${
          isHighlighted
            ? 'border-green-500 bg-green-500/10'
            : 'border-slate-700 bg-slate-800'
        }
      `}
    >
      <span
        className={`
          w-6 h-6 rounded-full flex items-center justify-center text-sm font-bold
          ${isHighlighted ? 'bg-green-600 text-white' : 'bg-slate-700 text-white'}
        `}
      >
        {allocation.pegNumber}
      </span>
      <span className="text-white text-sm">
        {allocation.memberName.split(' ')[0]}
        {allocation.isGuest && (
          <span className="text-blue-400 text-xs ml-1">(G)</span>
        )}
      </span>
    </div>
  )
}

interface SinglePegDisplayProps {
  pegNumber: number
  size?: 'sm' | 'md' | 'lg'
}

export function SinglePegDisplay({ pegNumber, size = 'md' }: SinglePegDisplayProps) {
  const sizeClasses = {
    sm: 'w-8 h-8 text-sm',
    md: 'w-12 h-12 text-lg',
    lg: 'w-16 h-16 text-2xl',
  }

  return (
    <div
      className={`
        ${sizeClasses[size]} 
        bg-green-600 rounded-full flex items-center justify-center text-white font-bold
      `}
    >
      {pegNumber}
    </div>
  )
}
