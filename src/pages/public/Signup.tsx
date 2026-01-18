/**
 * Signup Page - ShootSync
 * Clerk-powered registration
 */

import { SignUp } from '@clerk/clerk-react'
import { Helmet } from 'react-helmet-async'
import { Link } from 'react-router-dom'

export default function Signup() {
  return (
    <>
      <Helmet>
        <title>Start Free Trial - ShootSync</title>
        <meta name="robots" content="index, follow" />
      </Helmet>

      <div className="min-h-screen bg-slate-900 flex flex-col justify-center py-12 px-4">
        <div className="sm:mx-auto sm:w-full sm:max-w-md">
          <Link to="/" className="flex items-center justify-center gap-2 mb-8">
            <div className="w-10 h-10 bg-green-600 rounded-lg flex items-center justify-center">
              <span className="text-white font-bold">SS</span>
            </div>
            <span className="text-white font-semibold text-xl">ShootSync</span>
          </Link>

          <div className="flex justify-center">
            <SignUp
              appearance={{
                elements: {
                  rootBox: 'w-full',
                  card: 'bg-slate-800 border border-slate-700 shadow-xl',
                  headerTitle: 'text-white',
                  headerSubtitle: 'text-slate-400',
                  socialButtonsBlockButton: 'bg-slate-700 border-slate-600 text-white hover:bg-slate-600',
                  socialButtonsBlockButtonText: 'text-white',
                  dividerLine: 'bg-slate-600',
                  dividerText: 'text-slate-400',
                  formFieldLabel: 'text-slate-300',
                  formFieldInput: 'bg-slate-700 border-slate-600 text-white',
                  formButtonPrimary: 'bg-green-600 hover:bg-green-700',
                  footerActionLink: 'text-green-500 hover:text-green-400',
                },
              }}
              routing="path"
              path="/signup"
              signInUrl="/login"
              afterSignUpUrl="/dashboard"
            />
          </div>
        </div>
      </div>
    </>
  )
}
