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
import Pricing from './pages/public/Pricing'
import Features from './pages/public/Features'

// Captain pages
import CaptainDashboard from './pages/captain/Dashboard'
import CreateSyndicate from './pages/captain/CreateSyndicate'
import Members from './pages/captain/Members'
import Beaters from './pages/captain/Beaters'
import Shoots from './pages/captain/Shoots'
import ShootCreate from './pages/captain/ShootCreate'
import BagRecord from './pages/captain/BagRecord'
import Finances from './pages/captain/Finances'
import ShootDetail from './pages/captain/ShootDetail'
import PegAllocation from './pages/captain/PegAllocation'
import Settings from './pages/captain/Settings'

// Gun pages
import GunDashboard from './pages/gun/GunDashboard'
import MyPegs from './pages/gun/MyPegs'
import MyPayments from './pages/gun/MyPayments'

// Beater pages
import BeaterDashboard from './pages/beater/BeaterDashboard'
import MyBookings from './pages/beater/MyBookings'
import MyEarnings from './pages/beater/MyEarnings'

// Guest pages
import GuestAccept from './pages/guest/GuestAccept'

// Auth components
import ProtectedRoute from './components/auth/ProtectedRoute'
import { PublicOnlyRoute } from './components/auth/ProtectedRoute'

export default function App() {
  return (
    <ErrorBoundary>
      <HelmetProvider>
        <BrowserRouter>
          <Routes>
            {/* Public routes */}
            <Route path="/" element={<Landing />} />
            <Route path="/pricing" element={<Pricing />} />
            <Route path="/features" element={<Features />} />
            <Route
              path="/login/*"
              element={
                <PublicOnlyRoute>
                  <Login />
                </PublicOnlyRoute>
              }
            />
            <Route
              path="/signup/*"
              element={
                <PublicOnlyRoute>
                  <Signup />
                </PublicOnlyRoute>
              }
            />

            {/* Captain routes */}
            <Route
              path="/dashboard"
              element={
                <ProtectedRoute>
                  <CaptainDashboard />
                </ProtectedRoute>
              }
            />
            <Route
              path="/pegs"
              element={
                <ProtectedRoute>
                  <PegAllocation />
                </ProtectedRoute>
              }
            />
            <Route
              path="/syndicate/create"
              element={
                <ProtectedRoute>
                  <CreateSyndicate />
                </ProtectedRoute>
              }
            />
            <Route
              path="/members"
              element={
                <ProtectedRoute>
                  <Members />
                </ProtectedRoute>
              }
            />
            <Route
              path="/beaters"
              element={
                <ProtectedRoute>
                  <Beaters />
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
              path="/shoots/new"
              element={
                <ProtectedRoute>
                  <ShootCreate />
                </ProtectedRoute>
              }
            />
            <Route
              path="/shoots/:id"
              element={
                <ProtectedRoute>
                  <ShootDetail />
                </ProtectedRoute>
              }
            />
            <Route
              path="/bags/record"
              element={
                <ProtectedRoute>
                  <BagRecord />
                </ProtectedRoute>
              }
            />
            <Route
              path="/finances"
              element={
                <ProtectedRoute>
                  <Finances />
                </ProtectedRoute>
              }
            />
            <Route
              path="/settings"
              element={
                <ProtectedRoute>
                  <Settings />
                </ProtectedRoute>
              }
            />

            {/* Gun routes */}
            <Route
              path="/gun/dashboard"
              element={
                <ProtectedRoute>
                  <GunDashboard />
                </ProtectedRoute>
              }
            />
            <Route
              path="/my-pegs"
              element={
                <ProtectedRoute>
                  <MyPegs />
                </ProtectedRoute>
              }
            />
            <Route
              path="/my-payments"
              element={
                <ProtectedRoute>
                  <MyPayments />
                </ProtectedRoute>
              }
            />

            {/* Beater routes */}
            <Route
              path="/beater/dashboard"
              element={
                <ProtectedRoute>
                  <BeaterDashboard />
                </ProtectedRoute>
              }
            />
            <Route
              path="/beater/bookings"
              element={
                <ProtectedRoute>
                  <MyBookings />
                </ProtectedRoute>
              }
            />
            <Route
              path="/beater/earnings"
              element={
                <ProtectedRoute>
                  <MyEarnings />
                </ProtectedRoute>
              }
            />

            {/* Guest routes */}
            <Route path="/guest/accept/:token" element={<GuestAccept />} />
            <Route path="/guest/accept" element={<GuestAccept />} />

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
