/**
 * Navigation Component - ShootSync
 * Main navigation header
 */

import { Link, useLocation } from 'react-router-dom'
import { useAuth } from '../../hooks/useAuth'
import { useRole } from '../../hooks/useRole'
import { useOffline } from '../../hooks/useOffline'
import Button from '../common/Button'

export default function Navigation() {
  const { isSignedIn, name } = useAuth()
  const { isCaptain } = useRole()
  const { isOnline, pendingCount } = useOffline()
  const location = useLocation()

  const isActive = (path: string) => location.pathname === path

  return (
    <header className="bg-slate-800 border-b border-slate-700 sticky top-0 z-40">
      <nav className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex items-center justify-between h-16">
          <div className="flex items-center gap-8">
            <Link to="/" className="flex items-center gap-2">
              <div className="w-8 h-8 bg-green-600 rounded-lg flex items-center justify-center">
                <span className="text-white font-bold text-sm">SS</span>
              </div>
              <span className="text-white font-semibold text-lg hidden sm:block">
                ShootSync
              </span>
            </Link>

            {isSignedIn && (
              <div className="hidden md:flex items-center gap-1">
                <NavLink to="/dashboard" active={isActive('/dashboard')}>
                  Dashboard
                </NavLink>
                <NavLink to="/shoots" active={isActive('/shoots')}>
                  Shoots
                </NavLink>
                {isCaptain && (
                  <>
                    <NavLink to="/members" active={isActive('/members')}>
                      Members
                    </NavLink>
                    <NavLink to="/beaters" active={isActive('/beaters')}>
                      Beaters
                    </NavLink>
                    <NavLink to="/finances" active={isActive('/finances')}>
                      Finances
                    </NavLink>
                  </>
                )}
              </div>
            )}
          </div>

          <div className="flex items-center gap-4">
            {!isOnline && (
              <div className="flex items-center gap-2 px-3 py-1 bg-amber-500/10 border border-amber-500/20 rounded-full">
                <div className="w-2 h-2 bg-amber-500 rounded-full" />
                <span className="text-amber-500 text-sm">Offline</span>
                {pendingCount > 0 && (
                  <span className="text-amber-400 text-xs">({pendingCount})</span>
                )}
              </div>
            )}

            {isSignedIn ? (
              <div className="flex items-center gap-4">
                <span className="text-slate-400 text-sm hidden sm:block">
                  {name}
                </span>
                <Link to="/settings">
                  <div className="w-8 h-8 bg-slate-700 rounded-full flex items-center justify-center hover:bg-slate-600 transition-colors">
                    <span className="text-white text-sm font-medium">
                      {name?.charAt(0).toUpperCase() || 'U'}
                    </span>
                  </div>
                </Link>
              </div>
            ) : (
              <div className="flex items-center gap-3">
                <Link to="/login">
                  <Button variant="ghost" size="sm">
                    Sign In
                  </Button>
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

interface NavLinkProps {
  to: string
  active: boolean
  children: React.ReactNode
}

function NavLink({ to, active, children }: NavLinkProps) {
  return (
    <Link
      to={to}
      className={`
        px-3 py-2 rounded-lg text-sm font-medium transition-colors
        ${active 
          ? 'bg-slate-700 text-white' 
          : 'text-slate-400 hover:text-white hover:bg-slate-700/50'
        }
      `}
    >
      {children}
    </Link>
  )
}
