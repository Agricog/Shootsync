/**
 * Main Entry Point - ShootSync
 * Wrapped with Clerk authentication provider
 */

import React from 'react'
import ReactDOM from 'react-dom/client'
import { ClerkProvider } from '@clerk/clerk-react'
import App from './App'
import SessionHygiene from './components/auth/SessionHygiene'
import { installApiAuth } from './lib/session'
import './index.css'

const clerkPubKey = import.meta.env.VITE_CLERK_PUBLISHABLE_KEY

if (!clerkPubKey) {
  throw new Error('Missing VITE_CLERK_PUBLISHABLE_KEY environment variable')
}

// Attach the session token to every /api request before anything renders.
installApiAuth()

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <ClerkProvider publishableKey={clerkPubKey}>
      <SessionHygiene />
      <App />
    </ClerkProvider>
  </React.StrictMode>
)

// Register service worker for PWA/offline support
if ('serviceWorker' in navigator && import.meta.env.PROD) {
  window.addEventListener('load', () => {
    navigator.serviceWorker
      .register('/sw.js')
      .then((registration) => {
        // Pick up new deploys in long-lived tabs (Standard §06.5).
        setInterval(() => {
          registration.update().catch(() => undefined)
        }, 60 * 60 * 1000)
      })
      .catch((error) => {
        console.warn('Service worker registration failed:', error)
      })
  })
}
