/**
 * Pricing page - ShootSync
 * Plans and prices come only from src/config/plans.ts.
 */

import { Link } from 'react-router-dom'
import { CheckCircle } from 'lucide-react'
import Seo from '../../components/public/Seo'
import PublicLayout from '../../components/public/PublicLayout'
import { BILLING_TERMS, LOWEST_MONTHLY_PRICE, PLANS } from '../../config/plans'
import { SITE } from '../../config/site'

const TITLE = `ShootSync Pricing: Syndicate Software from £${LOWEST_MONTHLY_PRICE} a Month`
const DESCRIPTION = `ShootSync pricing for UK shooting syndicates: Starter £${PLANS[0].monthlyPrice} and Standard £${PLANS[1].monthlyPrice} a month. No contract, no set-up fee, ${BILLING_TERMS.moneyBackDays}-day money-back guarantee.`

// Structured data: breadcrumbs only. The plans and prices are described once, as the
// SoftwareApplication's offers on the home page (Landing.tsx). A Product block here made Google treat
// ShootSync as shop goods and ask for shipping, returns, reviews and ratings (Search Console,
// 14 October 2026); none applies to a subscription, and reviews or ratings ShootSync has not been
// given must never be invented. scripts/check-built-site.mjs refuses both.
const jsonLd = [
  {
    '@context': 'https://schema.org',
    '@type': 'BreadcrumbList',
    itemListElement: [
      { '@type': 'ListItem', position: 1, name: 'Home', item: SITE.url },
      { '@type': 'ListItem', position: 2, name: 'Pricing', item: `${SITE.url}/pricing` },
    ],
  },

]

const TERMS = [
  'Billed monthly by card through Stripe',
  'No contract and no set-up fee',
  `${BILLING_TERMS.moneyBackDays}-day money-back guarantee on your first payment`,
  'Cancel any time: your plan runs to the end of the month you’ve paid for',
] as const

export default function Pricing() {
  return (
    <PublicLayout>
      <Seo title={TITLE} description={DESCRIPTION} path="/pricing" jsonLd={jsonLd} />

      <section aria-labelledby="pricing-heading" className="px-4 pt-16 pb-12 sm:pt-24">
        <div className="max-w-3xl mx-auto text-center">
          <nav aria-label="Breadcrumb" className="text-sm text-slate-400 mb-6">
            <Link to="/" className="hover:text-white">Home</Link>
            <span aria-hidden="true"> / </span>
            <span aria-current="page" className="text-slate-300">Pricing</span>
          </nav>
          <h1 id="pricing-heading" className="text-4xl sm:text-5xl font-bold text-white tracking-tight">
            ShootSync pricing
          </h1>
          <p className="mt-6 text-lg text-slate-400">
            One price a month for the whole syndicate, whatever the number of shoot days.
          </p>
        </div>
      </section>

      <section aria-label="Plans" className="px-4 pb-16">
        <div className="max-w-5xl mx-auto grid gap-6 md:grid-cols-2">
          {PLANS.map((plan) => (
            <article
              key={plan.tier}
              className={`relative rounded-2xl p-8 border ${plan.popular ? 'border-green-500 bg-slate-800' : 'border-slate-700 bg-slate-800/50'}`}
            >
              {plan.popular && (
                <p className="absolute -top-3 left-1/2 -translate-x-1/2 bg-green-600 text-white text-xs font-bold px-3 py-1 rounded-full">
                  MOST POPULAR
                </p>
              )}
              <h2 className="text-2xl font-semibold text-white">{plan.name}</h2>
              <p className="mt-2 text-slate-400">{plan.summary}</p>
              <p className="mt-6">
                <span className="text-5xl font-bold text-white">£{plan.monthlyPrice}</span>
                <span className="text-slate-400"> a month</span>
              </p>
              <ul className="mt-8 space-y-3">
                {plan.features.map((feature) => (
                  <li key={feature} className="flex gap-3">
                    <CheckCircle className="w-5 h-5 text-green-500 flex-shrink-0 mt-0.5" aria-hidden="true" />
                    <span>{feature}</span>
                  </li>
                ))}
              </ul>
              <Link
                to="/signup"
                className={`mt-8 block text-center font-medium rounded-lg px-6 py-3 focus:outline-none focus-visible:ring-2 focus-visible:ring-green-500 ${
                  plan.popular ? 'bg-green-600 hover:bg-green-700 text-white' : 'bg-slate-700 hover:bg-slate-600 text-white'
                }`}
              >
                Start with {plan.name}
              </Link>
            </article>
          ))}
        </div>
        <p className="max-w-5xl mx-auto mt-6 text-center text-sm text-slate-400">
          Prices include everything listed. ShootSync is not VAT registered, so no VAT is added.
        </p>
      </section>

      <section aria-labelledby="terms-heading" className="bg-slate-800/40 px-4 py-16">
        <div className="max-w-3xl mx-auto grid gap-10 md:grid-cols-2">
          <div>
            <h2 id="terms-heading" className="text-2xl font-bold text-white">How billing works</h2>
            <ul className="mt-6 space-y-3">
              {TERMS.map((term) => (
                <li key={term} className="flex gap-3">
                  <CheckCircle className="w-5 h-5 text-green-500 flex-shrink-0 mt-0.5" aria-hidden="true" />
                  <span>{term}</span>
                </li>
              ))}
            </ul>
            <p className="mt-4 text-sm text-slate-400">
              Full details are in the <Link to="/terms" className="text-green-500 hover:text-green-400 underline underline-offset-2">terms of service</Link>.
            </p>
          </div>
          <div>
            <h2 className="text-2xl font-bold text-white">Larger estates and several shoots</h2>
            <p className="mt-6 text-slate-400">
              Running more than one shoot, or more than 20 guns? Tell us how your shoot is set up and we’ll
              talk it through with you.
            </p>
            <a
              href={`mailto:${SITE.email}?subject=ShootSync%20for%20a%20larger%20shoot`}
              className="mt-6 inline-block font-medium rounded-lg px-5 py-2.5 bg-slate-700 hover:bg-slate-600 text-white focus:outline-none focus-visible:ring-2 focus-visible:ring-green-500"
            >
              Email {SITE.email}
            </a>
          </div>
        </div>
      </section>
    </PublicLayout>
  )
}
