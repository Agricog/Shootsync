/**
 * Subscription Guard - ShootSync
 * Blocks access to dashboard if no active subscription
 */

import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '../../hooks/useAuth'
import { useSubscription } from '../../hooks/useSubscription'
import LoadingSpinner from '../common/LoadingSpinner'

interface SubscriptionGuardProps {
  children: React.ReactNode
  syndicateId: string | null
}

export default function SubscriptionGuard({ children, syndicateId }: SubscriptionGuardProps) {
  const navigate = useNavigate()
  const { isActive, loading } = useSubscription(syndicateId)
  const [checked, setChecked] = useState(false)

  useEffect(() => {
    if (!loading) {
      setChecked(true)
      if (!isActive && syndicateId) {
        navigate('/subscribe')
      }
    }
  }, [loading, isActive, syndicateId, navigate])

  if (loading || !checked) {
    return (
      <div className="min-h-screen bg-slate-900 flex items-center justify-center">
        <LoadingSpinner size="lg" />
      </div>
    )
  }

  if (!isActive && syndicateId) {
    return null
  }

  return <>{children}</>
}
