/**
 * Captain pages - ShootSync
 *
 * Wraps every page that works on a syndicate as its captain. Waits for the user's
 * syndicates to load, sends someone with no syndicate to create one, and refuses
 * (politely) anyone who isn't the captain of the syndicate on show. The server makes
 * the same decision on every request; this keeps the screen honest about it.
 */

import { type ReactNode } from 'react'
import { Navigate } from 'react-router-dom'
import { CaptainSyndicateProvider, useSyndicates } from '../../context/SyndicateContext'
import { PageLoader } from '../common/LoadingSpinner'
import DashboardLayout from '../layout/DashboardLayout'
import Card from '../common/Card'
import Button, { ButtonLink } from '../common/Button'

export default function CaptainRoute({ children }: { children: ReactNode }) {
  const { state, error, current, reload } = useSyndicates()

  if (state === 'idle' || state === 'loading') return <PageLoader />

  if (state === 'error') {
    return (
      <DashboardLayout>
        <Card>
          <div role="alert" className="text-center py-6">
            <h1 className="text-xl font-semibold text-white mb-2">Your syndicate didn’t load</h1>
            <p className="text-slate-300 mb-6">{error}</p>
            <Button onClick={() => void reload()}>Try again</Button>
          </div>
        </Card>
      </DashboardLayout>
    )
  }

  if (!current) return <Navigate to="/syndicate/create" replace />

  if (current.role !== 'CAPTAIN') {
    return (
      <DashboardLayout>
        <Card>
          <div className="text-center py-6">
            <h1 className="text-xl font-semibold text-white mb-2">This page is for the captain</h1>
            <p className="text-slate-300 mb-6">
              Only the captain of {current.name} can open it. If you run a syndicate of your own, choose it from the syndicate list at the top of the page.
            </p>
            <ButtonLink to="/" variant="secondary">Back to the home page</ButtonLink>
          </div>
        </Card>
      </DashboardLayout>
    )
  }

  return <CaptainSyndicateProvider value={current}>{children}</CaptainSyndicateProvider>
}
