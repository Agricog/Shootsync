/**
 * App Component - ShootSync
 * Main routing configuration
 */

import { BrowserRouter, Routes, Route } from 'react-router-dom'
import { HelmetProvider } from 'react-helmet-async'
import ErrorBoundary from './components/common/ErrorBoundary'

// Public pages
import Landing from './pages/public/Landing'
import Login from './pages/public/Login'
import Signup from './pages/public/Signup'

// Captain pages
import CaptainDashboard from './pages/captain/Dashboard'
import Members from './pages/captain/Members'
import Beaters from './pages/captain/Beaters'
import Shoots from './pages/captain/Shoots'
import Finances from './pages/captain/Finances'
import Settings from './pages/captain/Settings'

// Auth components
import ProtectedRoute from './components/auth/ProtectedRoute'
import { PublicOnlyRoute } from './components/auth/ProtectedRoute'
import RoleGuard from './components/auth/RoleGuard'

export default function App() {
  return (
    <ErrorBoundary>
      <HelmetProvider>
        <BrowserRouter>
          <Routes>
            {/* Public routes */}
            <Route path="/" element={<Landing />} />
            <Route
              path="/login"
              element={
                <PublicOnlyRoute>
                  <Login />
                </PublicOnlyRoute>
              }
            />
            <Route
              path="/signup"
              element={
                <PublicOnlyRoute>
                  <Signup />
                </PublicOnlyRoute>
              }
            />

            {/* Protected routes - Captain only */}
            <Route
              path="/dashboard"
              element={
                <ProtectedRoute>
                  <CaptainDashboard />
                </ProtectedRoute>
              }
            />
            <Route
              path="/members"
              element={
                <ProtectedRoute>
                  <RoleGuard allowedRoles={['captain']}>
                    <Members />
                  </RoleGuard>
                </ProtectedRoute>
              }
            />
            <Route
              path="/beaters"
              element={
                <ProtectedRoute>
                  <RoleGuard allowedRoles={['captain']}>
                    <Beaters />
                  </RoleGuard>
                </ProtectedRoute>
              }
            />
            <Route
              path="/shoots"
              element={
                <ProtectedRoute>
                  <Shoots />
                </ProtectedRoute>
              }
            />
            <Route
              path="/finances"
              element={
                <ProtectedRoute>
                  <RoleGuard allowedRoles={['captain']}>
                    <Finances />
                  </RoleGuard>
                </ProtectedRoute>
              }
            />
            <Route
              path="/settings"
              element={
                <ProtectedRoute>
                  <RoleGuard allowedRoles={['captain']}>
                    <Settings />
                  </RoleGuard>
                </ProtectedRoute>
              }
            />

            {/* Fallback */}
            <Route path="*" element={<NotFound />} />
          </Routes>
        </BrowserRouter>
      </HelmetProvider>
    </ErrorBoundary>
  )
}

function NotFound() {
  return (
    <div className="min-h-screen bg-slate-900 flex items-center justify-center">
      <div className="text-center">
        <h1 className="text-4xl font-bold text-white mb-4">404</h1>
        <p className="text-slate-400 mb-6">Page not found</p>
        <a href="/" className="text-green-500 hover:text-green-400">
          Return home
        </a>
      </div>
    </div>
  )
}
