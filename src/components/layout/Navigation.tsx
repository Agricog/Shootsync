/**
 * Navigation Component - ShootSync
 * Main header with auth-aware navigation
 */
import { Link, useLocation } from 'react-router-dom'
import { UserButton, useUser } from '@clerk/clerk-react'
import { useAuth } from '../../hooks/useAuth'
import Button from '../common/Button'

export default function Navigation() {
  const location = useLocation()
  const { isSignedIn, user } = useAuth()
  const { isLoaded } = useUser()

  const navItems = isSignedIn
    ? [
        { path: '/dashboard', label: 'Dashboard' },
        { path: '/shoots', label: 'Shoots' },
        { path: '/members', label: 'Members' },
        { path: '/beaters', label: 'Beaters' },
        { path: '/pegs', label: 'Pegs' },
        { path: '/finances', label: 'Finances' },
      ]
    : []

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

            {isSignedIn && (
              <div className="hidden md:flex items-center gap-1">
                {navItems.map((item) => (
                  <Link
                    key={item.path}
                    to={item.path}
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
      </nav>
    </header>
  )
}
