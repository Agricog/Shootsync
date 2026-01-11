/**
 * Features Page - ShootSync
 * Detailed feature overview
 */

import { Link } from 'react-router-dom'
import { Helmet } from 'react-helmet-async'
import Button from '../../components/common/Button'

export default function Features() {
  return (
    <>
      <Helmet>
        <title>Features - ShootSync | Shooting Syndicate Management Software</title>
        <meta
          name="description"
          content="Discover ShootSync features: member management, fair peg allocation, bag recording with voice input, guest payments, beater management, and more."
        />
        <link rel="canonical" href="https://shootsync.co.uk/features" />
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
                <Link to="/features" className="text-white text-sm">
                  Features
                </Link>
                <Link to="/pricing" className="text-slate-400 hover:text-white text-sm">
                  Pricing
                </Link>
                <Link to="/login">
                  <Button variant="ghost" size="sm">Sign In</Button>
                </Link>
              </div>
            </div>
          </nav>
        </header>

        <main>
          {/* Hero */}
          <section className="py-16 px-4">
            <div className="max-w-4xl mx-auto text-center">
              <h1 className="text-4xl sm:text-5xl font-bold text-white mb-6">
                Everything You Need to Run Your Syndicate
              </h1>
              <p className="text-xl text-slate-400 mb-8">
                Purpose-built for UK shooting syndicates. Replace WhatsApp groups and
                spreadsheets with professional tools.
              </p>
              <Link to="/signup">
                <Button size="lg">Start Free Trial</Button>
              </Link>
            </div>
          </section>

          {/* Feature Sections */}
          <section className="py-16 px-4 bg-slate-800/30">
            <div className="max-w-6xl mx-auto">
              <FeatureSection
                title="Member Management"
                description="Keep all your syndicate members organized in one place"
                features={[
                  'Invite members via email with magic links',
                  'Track subscription payments and status',
                  'Store insurance documents securely',
                  'Emergency contact information',
                  'BASC number verification',
                  'Member communication history',
                ]}
                imagePosition="right"
              />
            </div>
          </section>

          <section className="py-16 px-4">
            <div className="max-w-6xl mx-auto">
              <FeatureSection
                title="Fair Peg Allocation"
                description="End the arguments with mathematically fair peg rotation"
                features={[
                  'Automated fair rotation algorithm',
                  'Track who has had which peg',
                  'Fairness score for transparency',
                  'Manual override when needed',
                  'Guest gun integration',
                  'Historical peg data',
                ]}
                imagePosition="left"
              />
            </div>
          </section>

          <section className="py-16 px-4 bg-slate-800/30">
            <div className="max-w-6xl mx-auto">
              <FeatureSection
                title="Shoot Day Planning"
                description="Organize your shoot days with precision"
                features={[
                  'Schedule shoots with location details',
                  'what3words integration for meeting points',
                  'Automatic reminders to members',
                  'Attendance tracking and confirmation',
                  'Generate PDF briefing sheets',
                  'Weather notes and special instructions',
                ]}
                imagePosition="right"
              />
            </div>
          </section>

          <section className="py-16 px-4">
            <div className="max-w-6xl mx-auto">
              <FeatureSection
                title="Bag Recording"
                description="Record bags in the field, even offline"
                features={[
                  'Voice input for hands-free recording',
                  'Works offline in poor signal areas',
                  'Syncs automatically when back online',
                  'Track by drive and species',
                  'Season totals and statistics',
                  'Export data for records',
                ]}
                imagePosition="left"
              />
            </div>
          </section>

          <section className="py-16 px-4 bg-slate-800/30">
            <div className="max-w-6xl mx-auto">
              <FeatureSection
                title="Beater Management"
                description="Keep your beaters organized and paid on time"
                features={[
                  'Maintain beater contact database',
                  'Book beaters for each shoot',
                  'Confirm attendance via app',
                  'Track days worked and earnings',
                  'Stripe Connect for instant payments',
                  'No bank details stored - fully secure',
                ]}
                imagePosition="right"
              />
            </div>
          </section>

          <section className="py-16 px-4">
            <div className="max-w-6xl mx-auto">
              <FeatureSection
                title="Guest Gun Management"
                description="Invite guests and collect payments seamlessly"
                features={[
                  'Send professional email invitations',
                  'Built-in liability waiver',
                  'Online payment via Stripe',
                  'Emergency contact collection',
                  'Automatic peg allocation',
                  'Confirmation emails',
                ]}
                imagePosition="left"
              />
            </div>
          </section>

          {/* CTA */}
          <section className="py-20 px-4 bg-green-600">
            <div className="max-w-4xl mx-auto text-center">
              <h2 className="text-3xl font-bold text-white mb-4">
                Ready to Modernize Your Syndicate?
              </h2>
              <p className="text-green-100 mb-8">
                Join syndicates across the UK who are saving hours every week with ShootSync.
              </p>
              <Link to="/signup">
                <Button variant="secondary" size="lg">
                  Start Your Free Trial
                </Button>
              </Link>
              <p className="text-green-100 text-sm mt-4">
                14 days free. No credit card required.
              </p>
            </div>
          </section>
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

interface FeatureSectionProps {
  title: string
  description: string
  features: string[]
  imagePosition: 'left' | 'right'
}

function FeatureSection({ title, description, features, imagePosition }: FeatureSectionProps) {
  const content = (
    <div>
      <h2 className="text-3xl font-bold text-white mb-4">{title}</h2>
      <p className="text-slate-400 mb-6">{description}</p>
      <ul className="space-y-3">
        {features.map((feature) => (
          <li key={feature} className="flex items-start gap-3">
            <svg
              className="w-5 h-5 text-green-500 flex-shrink-0 mt-0.5"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
            </svg>
            <span className="text-slate-300">{feature}</span>
          </li>
        ))}
      </ul>
    </div>
  )

  const placeholder = (
    <div className="bg-slate-800 border border-slate-700 rounded-xl aspect-video flex items-center justify-center">
      <span className="text-slate-600">Feature Screenshot</span>
    </div>
  )

  return (
    <div className="grid grid-cols-1 lg:grid-cols-2 gap-12 items-center">
      {imagePosition === 'left' ? (
        <>
          {placeholder}
          {content}
        </>
      ) : (
        <>
          {content}
          {placeholder}
        </>
      )}
    </div>
  )
}
