/**
 * "Today" for pages whose content changes on a date (Standard §05.7).
 *
 * In the browser there is no provider, so a page reads the UK date from the clock once, when it
 * first renders. At build time scripts/prerender.mjs renders such pages twice: as they read on the
 * build date, and as they will read on each date in CONTENT_CHANGE_DATES (src/entry-prerender.tsx).
 * The server then serves whichever copy is current (server/app.ts), so a crawler or a visitor
 * without JavaScript sees the review notice on the day the rates lapse, with no redeploy.
 */

import { createContext, useContext, useState, type ReactNode } from 'react'
import { londonDate } from '../utils/beaterPayCalculator'

const TodayContext = createContext<string | null>(null)

export function TodayProvider({ today, children }: { today: string; children: ReactNode }) {
  return <TodayContext.Provider value={today}>{children}</TodayContext.Provider>
}

/** "YYYY-MM-DD" in the UK: the build's chosen date when prerendering, the clock in the browser. */
export function useToday(): string {
  const given = useContext(TodayContext)
  const [fromClock] = useState(() => londonDate(new Date()))
  return given ?? fromClock
}
