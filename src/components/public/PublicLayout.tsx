/**
 * Public Layout - ShootSync
 * Header, skip link and footer shared by every public page, so navigation
 * and legal links are identical everywhere and can't point at a missing page.
 */

import type { ReactNode } from 'react'
import { Link, NavLink } from 'react-router-dom'
import { SITE } from '../../config/site'

const NAV = [
  { to: '/features', label: 'Features' },
  { to: '/pricing', label: 'Pricing' },
  { to: '/contact', label: 'Contact' },
] as const

const focusRing = 'focus:outline-none focus-visible:ring-2 focus-visible:ring-green-500 rounded'

function Logo() {
  return (
    <Link to="/" className={`flex items-center gap-2 ${focusRing}`} aria-label="ShootSync home">
      <span className="w-8 h-8 bg-green-600 rounded-lg flex items-center justify-center" aria-hidden="true">
        <span className="text-white font-bold text-sm">SS</span>
      </span>
      <span className="text-white font-semibold text-lg">ShootSync</span>
    </Link>
  )
}

export default function PublicLayout({ children }: { children: ReactNode }) {
  return (
    <div className="min-h-screen bg-slate-900 text-slate-300 flex flex-col">
      <a
        href="#main-content"
        className="sr-only focus:not-sr-only focus:absolute focus:top-2 focus:left-2 focus:z-50 focus:px-4 focus:py-2 focus:bg-green-600 focus:text-white focus:rounded"
      >
        Skip to main content
      </a>

      <header className="bg-slate-900 border-b border-slate-800">
        <nav className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8" aria-label="Primary">
          <div className="flex items-center justify-between h-16 gap-4">
            <Logo />
            <ul className="hidden sm:flex items-center gap-6">
              {NAV.map((item) => (
                <li key={item.to}>
                  <NavLink
                    to={item.to}
                    className={({ isActive }) =>
                      `text-sm transition-colors px-1 ${focusRing} ${isActive ? 'text-white' : 'text-slate-400 hover:text-white'}`
                    }
                  >
                    {item.label}
                  </NavLink>
                </li>
              ))}
            </ul>
            <div className="flex items-center gap-3">
              <Link to="/login" className={`text-sm text-slate-300 hover:text-white px-2 py-1.5 ${focusRing}`}>
                Sign in
              </Link>
              <Link
                to="/signup"
                className={`text-sm font-medium bg-green-600 hover:bg-green-700 text-white px-3 py-1.5 rounded-lg ${focusRing}`}
              >
                Get started
              </Link>
            </div>
          </div>
        </nav>
      </header>

      <main id="main-content" className="flex-1">
        {children}
      </main>

      <footer className="bg-slate-950 border-t border-slate-800">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12 grid gap-10 sm:grid-cols-3">
          <div>
            <Logo />
            <p className="mt-4 text-sm text-slate-400 max-w-xs">
              Shooting syndicate management software for UK shoot captains: members, shoot days, pegs,
              bags, beaters and guest guns in one place.
            </p>
          </div>
          <div>
            <p className="text-white font-semibold text-sm mb-3">ShootSync</p>
            <ul className="space-y-2 text-sm">
              {NAV.map((item) => (
                <li key={item.to}>
                  <Link to={item.to} className={`text-slate-400 hover:text-white ${focusRing}`}>
                    {item.label}
                  </Link>
                </li>
              ))}
              <li>
                <Link to="/signup" className={`text-slate-400 hover:text-white ${focusRing}`}>
                  Create your syndicate
                </Link>
              </li>
            </ul>
          </div>
          <div>
            <p className="text-white font-semibold text-sm mb-3">Legal</p>
            <ul className="space-y-2 text-sm">
              <li>
                <Link to="/privacy" className={`text-slate-400 hover:text-white ${focusRing}`}>
                  Privacy and cookies
                </Link>
              </li>
              <li>
                <Link to="/terms" className={`text-slate-400 hover:text-white ${focusRing}`}>
                  Terms of service
                </Link>
              </li>
            </ul>
          </div>
        </div>
        <div className="border-t border-slate-800">
          <p className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6 text-xs text-slate-500">
            ShootSync is run by {SITE.operator.legalName}, trading as {SITE.operator.tradingAs}, {SITE.operator.region}.
            ICO registration {SITE.operator.icoRegistration}. Contact{' '}
            <a href={`mailto:${SITE.email}`} className={`text-slate-400 hover:text-white ${focusRing}`}>
              {SITE.email}
            </a>
            .
          </p>
        </div>
      </footer>
    </div>
  )
}
