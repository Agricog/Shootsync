/**
 * Login Page - ShootSync
 * Clerk-powered authentication
 */

import { SignIn } from '@clerk/clerk-react'
import { Helmet } from 'react-helmet-async'
import { useSearchParams } from 'react-router-dom'
import { SESSION_ENDED_TEXT, SIGNED_OUT_PARAM, signedOutReason } from '../../lib/sessionClock'
import { DEFAULT_AFTER_SIGN_IN, RETURN_TO_PARAM, safeReturnPath } from '../../lib/returnTo'
import Logo from '../../components/common/Logo'

export default function Login() {
  const [searchParams] = useSearchParams()
  const signedOut = signedOutReason(searchParams.get(SIGNED_OUT_PARAM))
  // Back to the page they were on, if the address says which; the dashboard otherwise.
  const returnTo = safeReturnPath(searchParams.get(RETURN_TO_PARAM))
  return (
    <>
      <Helmet>
        <title>Sign In - ShootSync</title>
        <meta name="robots" content="noindex, nofollow" />
      </Helmet>

      <div className="min-h-screen bg-slate-900 flex flex-col justify-center py-12 px-4">
        <div className="sm:mx-auto sm:w-full sm:max-w-md">
          <div className="flex justify-center mb-8">
            <Logo size="lg" />
          </div>

          {signedOut && (
            <p role="status" className="mb-6 rounded-lg px-4 py-3 bg-amber-500/10 border border-amber-500/30 text-amber-100 text-sm text-center">
              {SESSION_ENDED_TEXT[signedOut]}
            </p>
          )}

          <div className="flex justify-center">
            <SignIn
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
                  identityPreviewText: 'text-white',
                  identityPreviewEditButton: 'text-green-500',
                },
              }}
              routing="path"
              path="/login"
              signUpUrl={returnTo === DEFAULT_AFTER_SIGN_IN ? '/signup' : `/signup?${RETURN_TO_PARAM}=${encodeURIComponent(returnTo)}`}
              forceRedirectUrl={returnTo}
            />
          </div>
        </div>
      </div>
    </>
  )
}
