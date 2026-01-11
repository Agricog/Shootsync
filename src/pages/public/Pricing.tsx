/**
 * Pricing Page - ShootSync
 * Subscription tiers and pricing
 */

import { Link } from 'react-router-dom'
import { Helmet } from 'react-helmet-async'
import Button from '../../components/common/Button'

const TIERS = [
  {
    name: 'Starter',
    price: 39,
    description: 'Perfect for small syndicates getting started',
    features: [
      'Up to 10 guns',
      'Up to 15 beaters',
      '1 captain login',
      'Basic peg allocation',
      'Bag recording',
      'Email support',
    ],
    limitations: ['No guest management', 'No Stripe payments'],
    cta: 'Start Free Trial',
    highlighted: false,
  },
  {
    name: 'Standard',
    price: 69,
    description: 'Most popular for established syndicates',
    features: [
      'Up to 20 guns',
      'Unlimited beaters',
      '3 admin logins',
      'Fair rotation algorithm',
      'Guest management + payments',
      'PDF briefings',
      'Stripe integration',
      'Priority email support',
    ],
    limitations: [],
    cta: 'Start Free Trial',
    highlighted: true,
  },
  {
    name: 'Estate',
    price: 149,
    description: 'For large estates and multiple shoots',
    features: [
      'Unlimited guns',
      'Unlimited beaters',
      'Unlimited admins',
      'Multiple shoot locations',
      'Let day management',
      'API access',
      'Custom branding',
      'Phone support',
      'Dedicated account manager',
    ],
    limitations: [],
    cta: 'Contact Sales',
    highlighted: false,
  },
]

export default function Pricing() {
  return (
    <>
      <Helmet>
        <title>Pricing - ShootSync | Shooting Syndicate Management Software</title>
        <meta
          name="description"
          content="Simple, transparent pricing for ShootSync shooting syndicate management software. Plans from £39/month. 14-day free trial, no credit card required."
        />
        <link rel="canonical" href="https://shootsync.co.uk/pricing" />
      </Helmet>

      <div className="min-h-screen bg-slate-900">
        {/* Header */}
        <header className="bg-slate-900 border-b border-slate-800">
          <nav className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
            <div className="flex items-center justify-between h-16">
              <Link to="/" className="flex items-center gap-2">
                <div className="w-8 h-8 bg-green-600 rounded-lg flex items-center justify-center">
                  <span className="text-white font-bold text-sm">SS</span>
                </div>
                <span className="text-white font-semibold text-lg">ShootSync</span>
              </Link>

              <div className="flex items-center gap-4">
                <Link to="/features" className="text-slate-400 hover:text-white text-sm">
                  Features
                </Link>
                <Link to="/pricing" className="text-white text-sm">
                  Pricing
                </Link>
                <Link to="/login">
                  <Button variant="ghost" size="sm">Sign In</Button>
                </Link>
              </div>
            </div>
          </nav>
        </header>

        <main className="py-16 px-4">
          <div className="max-w-7xl mx-auto">
            {/* Header */}
            <div className="text-center mb-16">
              <h1 className="text-4xl sm:text-5xl font-bold text-white mb-4">
                Simple, Transparent Pricing
              </h1>
              <p className="text-xl text-slate-400 max-w-2xl mx-auto">
                Choose the plan that fits your syndicate. All plans include a 14-day free trial.
              </p>
            </div>

            {/* Pricing Cards */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-8 max-w-5xl mx-auto">
              {TIERS.map((tier) => (
                <div
                  key={tier.name}
                  className={`
                    relative rounded-2xl p-8
                    ${tier.highlighted
                      ? 'bg-green-600 border-2 border-green-500'
                      : 'bg-slate-800 border border-slate-700'
                    }
                  `}
                >
                  {tier.highlighted && (
                    <div className="absolute -top-4 left-1/2 transform -translate-x-1/2">
                      <span className="bg-green-500 text-white text-sm font-medium px-4 py-1 rounded-full">
                        Most Popular
                      </span>
                    </div>
                  )}

                  <div className="text-center mb-6">
                    <h2 className="text-xl font-bold text-white mb-2">{tier.name}</h2>
                    <p className={tier.highlighted ? 'text-green-100' : 'text-slate-400'}>
                      {tier.description}
                    </p>
                  </div>

                  <div className="text-center mb-6">
                    <span className="text-4xl font-bold text-white">£{tier.price}</span>
                    <span className={tier.highlighted ? 'text-green-100' : 'text-slate-400'}>
                      /month
                    </span>
                  </div>

                  <ul className="space-y-3 mb-8">
                    {tier.features.map((feature) => (
                      <li key={feature} className="flex items-start gap-2">
                        <CheckIcon highlighted={tier.highlighted} />
                        <span className={tier.highlighted ? 'text-white' : 'text-slate-300'}>
                          {feature}
                        </span>
                      </li>
                    ))}
                    {tier.limitations.map((limitation) => (
                      <li key={limitation} className="flex items-start gap-2">
                        <XIcon />
                        <span className="text-slate-500">{limitation}</span>
                      </li>
                    ))}
                  </ul>

                  <Link to="/signup">
                    <Button
                      variant={tier.highlighted ? 'secondary' : 'primary'}
                      fullWidth
                    >
                      {tier.cta}
                    </Button>
                  </Link>
                </div>
              ))}
            </div>

            {/* Annual Discount */}
            <div className="mt-12 text-center">
              <p className="text-slate-400">
                Pay annually and get <span className="text-green-500 font-semibold">2 months free</span>
              </p>
            </div>

            {/* FAQ */}
            <div className="mt-20 max-w-3xl mx-auto">
              <h2 className="text-2xl font-bold text-white text-center mb-8">
                Frequently Asked Questions
              </h2>

              <div className="space-y-6">
                <FaqItem
                  question="Can I change plans later?"
                  answer="Yes, you can upgrade or downgrade your plan at any time. Changes take effect on your next billing cycle."
                />
                <FaqItem
                  question="What payment methods do you accept?"
                  answer="We accept all major credit and debit cards through Stripe. We can also arrange BACS payment for annual subscriptions."
                />
                <FaqItem
                  question="Is there a contract?"
                  answer="No, all plans are month-to-month with no long-term commitment. Cancel anytime."
                />
                <FaqItem
                  question="Do you offer discounts for multiple syndicates?"
                  answer="Yes, contact us for volume pricing if you manage multiple syndicates."
                />
              </div>
            </div>
          </div>
        </main>

        {/* Footer */}
        <footer className="bg-slate-900 border-t border-slate-800 py-8 px-4">
          <div className="max-w-6xl mx-auto flex flex-col sm:flex-row items-center justify-between gap-4">
            <p className="text-slate-500 text-sm">
              © {new Date().getFullYear()} ShootSync. All rights reserved.
            </p>
            <div className="flex items-center gap-6">
              <Link to="/privacy" className="text-slate-500 hover:text-white text-sm">Privacy</Link>
              <Link to="/terms" className="text-slate-500 hover:text-white text-sm">Terms</Link>
            </div>
          </div>
        </footer>
      </div>
    </>
  )
}

function CheckIcon({ highlighted }: { highlighted: boolean }) {
  return (
    <svg
      className={`w-5 h-5 flex-shrink-0 ${highlighted ? 'text-white' : 'text-green-500'}`}
      fill="none"
      stroke="currentColor"
      viewBox="0 0 24 24"
    >
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
    </svg>
  )
}

function XIcon() {
  return (
    <svg className="w-5 h-5 flex-shrink-0 text-slate-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
    </svg>
  )
}

interface FaqItemProps {
  question: string
  answer: string
}

function FaqItem({ question, answer }: FaqItemProps) {
  return (
    <div className="bg-slate-800 border border-slate-700 rounded-lg p-6">
      <h3 className="text-white font-medium mb-2">{question}</h3>
      <p className="text-slate-400">{answer}</p>
    </div>
  )
}
