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
import Privacy from './pages/public/Privacy'
import Terms from './pages/public/Terms'
import Contact from './pages/public/Contact'
import GuidesHub from './pages/public/guides/GuidesHub'
import PayingBeaters from './pages/public/guides/PayingBeaters'
import PegDraw from './pages/public/guides/PegDraw'
import GuestGuns from './pages/public/guides/GuestGuns'
import SeasonDates from './pages/public/guides/SeasonDates'
import TippingTheKeeper from './pages/public/guides/TippingTheKeeper'
import ShootingSyndicates from './pages/public/guides/ShootingSyndicates'
import ShootingGameBook from './pages/public/guides/ShootingGameBook'
import BeaterPayCalculator from './pages/public/tools/BeaterPayCalculator'

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
import Subscribe from './pages/captain/Subscribe'
import SubscriptionSuccess from './pages/captain/SubscriptionSuccess'

// Guest pages
import GuestAccept from './pages/guest/GuestAccept'
import PaymentSuccess from './pages/guest/PaymentSuccess'

// Auth components
import ProtectedRoute from './components/auth/ProtectedRoute'
import { PublicOnlyRoute } from './components/auth/ProtectedRoute'
import CaptainRoute from './components/auth/CaptainRoute'
import { SyndicateProvider } from './context/SyndicateContext'

export default function App() {
  return (
    <ErrorBoundary>
      <HelmetProvider>
        <BrowserRouter>
          <SyndicateProvider>
            <Routes>
              {/* Public routes */}
              <Route path="/" element={<Landing />} />
              <Route path="/pricing" element={<Pricing />} />
              <Route path="/features" element={<Features />} />
              <Route path="/privacy" element={<Privacy />} />
              <Route path="/terms" element={<Terms />} />
              <Route path="/contact" element={<Contact />} />
              <Route path="/guides" element={<GuidesHub />} />
              <Route path="/guides/paying-beaters-and-pickers-up" element={<PayingBeaters />} />
              <Route path="/guides/peg-draw-explained" element={<PegDraw />} />
              <Route path="/guides/guest-guns" element={<GuestGuns />} />
              <Route path="/guides/shooting-season-dates" element={<SeasonDates />} />
              <Route path="/guides/tipping-the-keeper" element={<TippingTheKeeper />} />
              <Route path="/guides/shooting-syndicates" element={<ShootingSyndicates />} />
              <Route path="/guides/shooting-game-book" element={<ShootingGameBook />} />
              <Route path="/tools/beater-pay-calculator" element={<BeaterPayCalculator />} />
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
                    <CaptainRoute>
                      <CaptainDashboard />
                    </CaptainRoute>
                  </ProtectedRoute>
                }
              />
              <Route
                path="/pegs"
                element={
                  <ProtectedRoute>
                    <CaptainRoute>
                      <PegAllocation />
                    </CaptainRoute>
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
                    <CaptainRoute>
                      <Members />
                    </CaptainRoute>
                  </ProtectedRoute>
                }
              />
              <Route
                path="/beaters"
                element={
                  <ProtectedRoute>
                    <CaptainRoute>
                      <Beaters />
                    </CaptainRoute>
                  </ProtectedRoute>
                }
              />
              <Route
                path="/shoots"
                element={
                  <ProtectedRoute>
                    <CaptainRoute>
                      <Shoots />
                    </CaptainRoute>
                  </ProtectedRoute>
                }
              />
              <Route
                path="/shoots/new"
                element={
                  <ProtectedRoute>
                    <CaptainRoute>
                      <ShootCreate />
                    </CaptainRoute>
                  </ProtectedRoute>
                }
              />
              <Route
                path="/shoots/:id"
                element={
                  <ProtectedRoute>
                    <CaptainRoute>
                      <ShootDetail />
                    </CaptainRoute>
                  </ProtectedRoute>
                }
              />
              <Route
                path="/bags/record"
                element={
                  <ProtectedRoute>
                    <CaptainRoute>
                      <BagRecord />
                    </CaptainRoute>
                  </ProtectedRoute>
                }
              />
              <Route
                path="/finances"
                element={
                  <ProtectedRoute>
                    <CaptainRoute>
                      <Finances />
                    </CaptainRoute>
                  </ProtectedRoute>
                }
              />
              <Route
                path="/settings"
                element={
                  <ProtectedRoute>
                    <CaptainRoute>
                      <Settings />
                    </CaptainRoute>
                  </ProtectedRoute>
                }
              />

              {/* Guest routes */}
              <Route path="/guest/accept/:token" element={<GuestAccept />} />
              <Route path="/guest/accept" element={<GuestAccept />} />
              <Route path="/guest/payment-success" element={<PaymentSuccess />} />

              {/* Subscription routes */}
              <Route
                path="/subscribe"
                element={
                  <ProtectedRoute>
                    <CaptainRoute>
                      <Subscribe />
                    </CaptainRoute>
                  </ProtectedRoute>
                }
              />
              <Route
                path="/subscription/success"
                element={
                  <ProtectedRoute>
                    <CaptainRoute>
                      <SubscriptionSuccess />
                    </CaptainRoute>
                  </ProtectedRoute>
                }
              />

              {/* Fallback */}
              <Route path="*" element={<NotFound />} />
            </Routes>
          </SyndicateProvider>
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
