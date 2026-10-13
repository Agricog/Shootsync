/**
 * Rates Review Notice - shown in place of the minimum wage figures once they have lapsed
 * (Standard §05.7). Pages read "today" through useToday (src/lib/today.tsx), and the build
 * prerenders a dated copy for the day the rates change, so the notice shows from that day
 * without a redeploy, with or without JavaScript.
 */

import { MINIMUM_WAGE } from '../../data/payRules'
import { formatRuleDate, lastDayBefore } from '../../utils/beaterPayCalculator'

export default function RatesReviewNotice() {
  const [rates] = MINIMUM_WAGE.sources
  return (
    <div role="note" className="border-l-4 border-amber-500 bg-amber-950/40 rounded-r-lg p-4 text-slate-200">
      <p className="font-semibold text-white">The minimum wage rates have changed</p>
      <p className="mt-2 text-sm leading-relaxed">
        The rates we last checked applied from {formatRuleDate(MINIMUM_WAGE.appliesFrom)} to{' '}
        {formatRuleDate(lastDayBefore(MINIMUM_WAGE.reviewBy))}. We are checking the new rates before we show them here.
        Until then, see the current rates on{' '}
        <a href={rates.url} rel="noopener" className="text-green-500 underline underline-offset-2 hover:text-green-400">
          GOV.UK
        </a>
        .
      </p>
    </div>
  )
}
