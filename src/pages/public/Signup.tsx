/**
 * Signup Page - ShootSync
 * Clerk-powered registration
 */

import { SignUp } from '@clerk/clerk-react'
import { Helmet } from 'react-helmet-async'
import { useSearchParams } from 'react-router-dom'
import Logo from '../../components/common/Logo'
import { DEFAULT_AFTER_SIGN_IN, RETURN_TO_PARAM, safeReturnPath } from '../../lib/returnTo'

export default function Signup() {
  const [searchParams] = useSearchParams()
  // Someone sent here from a page they wanted goes back to it once signed up.
  const returnTo = safeReturnPath(searchParams.get(RETURN_TO_PARAM))
  return (
    <>
      <Helmet>
        <title>Start Free Trial - ShootSync</title>
        <meta name="robots" content="index, follow" />
      </Helmet>

      <div className="min-h-screen bg-slate-900 flex flex-col justify-center py-12 px-4">
        <div className="sm:mx-auto sm:w-full sm:max-w-md">
          <div className="flex justify-center mb-8">
            <Logo size="lg" />
          </div>

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
              signInUrl={returnTo === DEFAULT_AFTER_SIGN_IN ? '/login' : `/login?${RETURN_TO_PARAM}=${encodeURIComponent(returnTo)}`}
              forceRedirectUrl={returnTo}
            />
          </div>
        </div>
      </div>
    </>
  )
}
