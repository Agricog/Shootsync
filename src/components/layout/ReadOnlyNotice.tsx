/**
 * Plan notice - ShootSync
 *
 * Shown on every signed-in captain page when the syndicate's plan needs attention:
 *   - a failed payment Stripe is still retrying: a warning, and everything still works;
 *   - no paid-up plan: read-only. Everything stays visible and exportable; changes wait until
 *     the plan is active again (the server enforces this, server/access.ts).
 * It says why, and the one thing to do about it.
 */

import { useSyndicates } from '../../context/SyndicateContext'
import { ButtonLink } from '../common/Button'
import { planNotice } from '../../lib/membership'

export default function ReadOnlyNotice() {
  const { current } = useSyndicates()
  if (!current || current.role !== 'CAPTAIN') return null
  const notice = planNotice(current)
  if (!notice) return null
  return (
    <div role="status" className="bg-amber-500/10 border-b border-amber-500/30 px-4 py-3">
      <div className="max-w-7xl mx-auto flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-amber-100 text-sm">
        <p>{notice.text}</p>
        <ButtonLink to="/subscribe" size="sm" className="self-start sm:self-auto shrink-0">{notice.action}</ButtonLink>
      </div>
    </div>
  )
}
