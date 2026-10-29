/**
 * Navigation Component - ShootSync
 * Header for signed-in pages. The links shown are the ones the user's role in the
 * syndicate on show can use; someone in more than one syndicate can switch here.
 */
import { useEffect, useState } from 'react'
import { Link, useLocation, useNavigate } from 'react-router-dom'
import { UserButton, useUser } from '@clerk/clerk-react'
import { useAuth } from '../../hooks/useAuth'
import { useSyndicates } from '../../context/SyndicateContext'
import Button from '../common/Button'

const CAPTAIN_LINKS = [
  { path: '/dashboard', label: 'Dashboard' },
  { path: '/shoots', label: 'Shoots' },
  { path: '/members', label: 'Members' },
  { path: '/beaters', label: 'Beaters' },
  { path: '/pegs', label: 'Pegs' },
  { path: '/bags/record', label: 'Game book' },
  { path: '/finances', label: 'Beaters’ pay' },
  { path: '/settings', label: 'Settings' },
] as const

export default function Navigation() {
  const location = useLocation()
  const navigate = useNavigate()
  const { isSignedIn, user } = useAuth()
  const { isLoaded } = useUser()
  const { memberships, current, select } = useSyndicates()

  // Phones and tablets get a menu button: the full list doesn't fit across the header.
  const [menuOpen, setMenuOpen] = useState(false)
  useEffect(() => setMenuOpen(false), [location.pathname])
  useEffect(() => {
    if (!menuOpen) return
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && setMenuOpen(false)
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [menuOpen])

  // Only links this user can use in the syndicate on show. Someone with no syndicate yet sees none.
  const navItems = isSignedIn && current?.role === 'CAPTAIN' ? CAPTAIN_LINKS : []

  const switchTo = (syndicateId: string) => {
    select(syndicateId)
    navigate('/dashboard')
  }

  return (
    <header className="bg-slate-900 border-b border-slate-800 sticky top-0 z-50">
      <nav className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex items-center justify-between h-16">
          <div className="flex items-center gap-8">
            <Link to={isSignedIn ? '/dashboard' : '/'} className="flex items-center gap-2">
              <div className="w-8 h-8 bg-green-600 rounded-lg flex items-center justify-center">
                <span className="text-white font-bold text-sm">SS</span>
              </div>
              <span className="text-white font-semibold text-lg hidden sm:block">ShootSync</span>
            </Link>

            {navItems.length > 0 && (
              <div className="hidden xl:flex items-center gap-1">
                {navItems.map((item) => (
                  <Link
                    key={item.path}
                    to={item.path}
                    aria-current={location.pathname === item.path ? 'page' : undefined}
                    className={`px-3 py-2 rounded-lg text-sm font-medium transition-colors ${
                      location.pathname === item.path
                        ? 'bg-slate-800 text-white'
                        : 'text-slate-400 hover:text-white hover:bg-slate-800'
                    }`}
                  >
                    {item.label}
                  </Link>
                ))}
              </div>
            )}
          </div>

          <div className="flex items-center gap-4">
            {!isLoaded ? (
              <div className="w-8 h-8 bg-slate-700 rounded-full animate-pulse" />
            ) : isSignedIn ? (
              <div className="flex items-center gap-3">
                {memberships.length > 1 && current && (
                  <label className="flex items-center">
                    <span className="sr-only">Syndicate</span>
                    <select
                      value={current.id}
                      onChange={(e) => switchTo(e.target.value)}
                      className="max-w-[10rem] sm:max-w-[14rem] truncate rounded-lg bg-slate-800 border border-slate-700 px-2 py-2 text-sm text-slate-200 focus:outline-none focus-visible:ring-2 focus-visible:ring-green-500"
                    >
                      {memberships.map((m) => (
                        <option key={m.id} value={m.id}>{m.name}</option>
                      ))}
                    </select>
                  </label>
                )}
                {navItems.length > 0 && (
                  <button
                    type="button"
                    className="xl:hidden px-3 py-2 rounded-lg text-sm font-medium text-slate-200 bg-slate-800 hover:bg-slate-700 focus:outline-none focus-visible:ring-2 focus-visible:ring-green-500"
                    aria-expanded={menuOpen}
                    aria-controls={menuOpen ? 'app-menu' : undefined}
                    onClick={() => setMenuOpen((open) => !open)}
                  >
                    {menuOpen ? 'Close' : 'Menu'}
                  </button>
                )}
                <span className="text-slate-400 text-sm hidden sm:block">
                  {user?.name}
                </span>
                <UserButton
                  afterSignOutUrl="/"
                  appearance={{
                    elements: {
                      avatarBox: 'w-8 h-8',
                    },
                  }}
                />
              </div>
            ) : (
              <div className="flex items-center gap-2">
                <Link to="/login">
                  <Button variant="ghost" size="sm">Sign In</Button>
                </Link>
                <Link to="/signup">
                  <Button size="sm">Get Started</Button>
                </Link>
              </div>
            )}
          </div>
        </div>
        {navItems.length > 0 && menuOpen && (
          <ul id="app-menu" className="xl:hidden grid grid-cols-2 sm:grid-cols-4 gap-2 pb-4">
            {navItems.map((item) => (
              <li key={item.path}>
                <Link
                  to={item.path}
                  aria-current={location.pathname === item.path ? 'page' : undefined}
                  className={`block px-3 py-3 rounded-lg text-sm font-medium ${
                    location.pathname === item.path ? 'bg-slate-700 text-white' : 'bg-slate-800 text-slate-200 hover:bg-slate-700'
                  }`}
                >
                  {item.label}
                </Link>
              </li>
            ))}
          </ul>
        )}
      </nav>
    </header>
  )
}
