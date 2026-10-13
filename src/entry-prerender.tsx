/**
 * Prerender entry - used only at build time by scripts/prerender.mjs.
 *
 * Renders each public page to static HTML, with its full <head>, so search
 * engines and link previews (WhatsApp, LinkedIn, iMessage, Slack) see the real
 * page without running JavaScript (Standard §05.5). The browser then loads the
 * normal app over the top. Public pages use no sign-in, so no Clerk here.
 */

import type { ComponentType } from 'react'
import { renderToString } from 'react-dom/server'
import { StaticRouter } from 'react-router-dom/server'
import { HelmetProvider, type HelmetServerState } from 'react-helmet-async'
import Landing from './pages/public/Landing'
import Features from './pages/public/Features'
import Pricing from './pages/public/Pricing'
import Contact from './pages/public/Contact'
import Privacy from './pages/public/Privacy'
import Terms from './pages/public/Terms'
import GuidesHub from './pages/public/guides/GuidesHub'
import PayingBeaters from './pages/public/guides/PayingBeaters'
import PegDraw from './pages/public/guides/PegDraw'
import GuestGuns from './pages/public/guides/GuestGuns'
import SeasonDates from './pages/public/guides/SeasonDates'
import TippingTheKeeper from './pages/public/guides/TippingTheKeeper'
import { PUBLIC_ROUTES, SITE } from './config/site'

export { PUBLIC_ROUTES, SITE }

const PAGES: Record<(typeof PUBLIC_ROUTES)[number]['path'], ComponentType> = {
  '/': Landing,
  '/features': Features,
  '/pricing': Pricing,
  '/guides': GuidesHub,
  '/guides/paying-beaters-and-pickers-up': PayingBeaters,
  '/guides/peg-draw-explained': PegDraw,
  '/guides/guest-guns': GuestGuns,
  '/guides/shooting-season-dates': SeasonDates,
  '/guides/tipping-the-keeper': TippingTheKeeper,
  '/contact': Contact,
  '/privacy': Privacy,
  '/terms': Terms,
}

export function render(path: (typeof PUBLIC_ROUTES)[number]['path']) {
  const Page = PAGES[path]
  if (!Page) throw new Error(`No public page for ${path}`)

  const context: { helmet?: HelmetServerState } = {}
  const html = renderToString(
    <HelmetProvider context={context}>
      <StaticRouter location={path}>
        <Page />
      </StaticRouter>
    </HelmetProvider>
  )

  const helmet = context.helmet
  if (!helmet) throw new Error(`Page ${path} rendered no head tags`)

  const head = [helmet.title, helmet.priority, helmet.meta, helmet.link, helmet.script]
    .map((part) => part.toString())
    .filter(Boolean)
    .join('\n    ')

  return { html, head }
}
