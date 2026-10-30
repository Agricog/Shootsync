/**
 * Page not found - ShootSync
 *
 * Shown for any address the app doesn't have (the server answers these with a 404 status too,
 * server/app.ts). It looks like the rest of the site and says where to go instead.
 */

import { Link } from 'react-router-dom'
import { Helmet } from 'react-helmet-async'
import PublicLayout from '../../components/public/PublicLayout'
import { buttonClasses } from '../../components/common/Button'

export default function NotFound() {
  return (
    <PublicLayout>
      <Helmet>
        <title>Page not found | ShootSync</title>
        <meta name="robots" content="noindex, follow" />
      </Helmet>
      <section className="max-w-2xl mx-auto px-4 sm:px-6 lg:px-8 py-20 text-center">
        <p className="text-sm font-semibold text-green-500 uppercase tracking-wide">404</p>
        <h1 className="mt-2 text-3xl font-bold text-white">There’s no page at this address</h1>
        <p className="mt-4 text-slate-300">
          The link may be out of date or mistyped. If someone sent it to you, ask them to check it.
        </p>
        <div className="mt-8 flex flex-wrap justify-center gap-3">
          <Link to="/" className={buttonClasses()}>Go to the home page</Link>
          <Link to="/dashboard" className={buttonClasses({ variant: 'secondary' })}>Open the app</Link>
        </div>
        <p className="mt-6 text-sm text-slate-400">
          Looking for the guides? <Link to="/guides" className="text-green-400 underline underline-offset-2">They are here.</Link>
        </p>
      </section>
    </PublicLayout>
  )
}
