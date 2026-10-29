/**
 * Read-only notice - ShootSync
 *
 * Shown on every signed-in page while the syndicate on show has no paid-up plan. Everything
 * stays visible and exportable; changes wait until the plan is active again (the server
 * enforces this, server/access.ts). The notice says why, and the one thing to do about it.
 */

import { useSyndicates } from '../../context/SyndicateContext'
import { ButtonLink } from '../common/Button'
import { readOnlyReason } from '../../lib/membership'

export default function ReadOnlyNotice() {
  const { current } = useSyndicates()
  if (!current || current.role !== 'CAPTAIN' || current.subscription.isActive) return null
  const { text, action } = readOnlyReason(current)
  return (
    <div role="status" className="bg-amber-500/10 border-b border-amber-500/30 px-4 py-3">
      <div className="max-w-7xl mx-auto flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-amber-100 text-sm">
        <p>{text}</p>
        <ButtonLink to="/subscribe" size="sm" className="self-start sm:self-auto shrink-0">{action}</ButtonLink>
      </div>
    </div>
  )
}
