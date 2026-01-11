/**
 * Landing Page - ShootSync
 * SEO-optimized public homepage
 */

import { Link } from 'react-router-dom'
import { Helmet } from 'react-helmet-async'
import Button from '../../components/common/Button'

export default function Landing() {
  return (
    <>
      <Helmet>
        <title>ShootSync - Shooting Syndicate Management Software UK</title>
        <meta 
          name="description" 
          content="Professional shooting syndicate management for UK syndicates. Manage members, shoots, peg allocation, bag recording, and payments. Free trial available." 
        />
        <meta name="robots" content="index, follow" />
        <link rel="canonical" href="https://shootsync.co.uk" />
        
        <meta property="og:type" content="website" />
        <meta property="og:title" content="ShootSync - Shooting Syndicate Management Software UK" />
        <meta property="og:description" content="Professional shooting syndicate management for UK syndicates. Manage members, shoots, peg allocation, bag recording, and payments." />
        <meta property="og:url" content="https://shootsync.co.uk" />
        
        <script type="application/ld+json">
          {JSON.stringify({
            "@context": "https://schema.org",
            "@type": "SoftwareApplication",
            "name": "ShootSync",
            "applicationCategory": "BusinessApplication",
            "operatingSystem": "Web",
            "description": "Professional shooting syndicate management software for UK syndicates",
            "offers": {
              "@type": "Offer",
              "price": "39",
              "priceCurrency": "GBP"
            }
          })}
        </script>
      </Helmet>

      <div className="min-h-screen bg-slate-900">
        <header className="bg-slate-900 border-b border-slate-800">
          <nav className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
            <div className="flex items-center justify-between h-16">
              <div className="flex items-center gap-2">
                <div className="w-8 h-8 bg-green-600 rounded-lg flex items-center justify-center">
                  <span className="text-white font-bold text-sm">SS</span>
                </div>
                <span className="text-white font-semibold text-lg">ShootSync</span>
              </div>
              
              <div className="flex items-center gap-4">
                <Link to="/login">
                  <Button variant="ghost" size="sm">Sign In</Button>
                </Link>
                <Link to="/signup">
                  <Button size="sm">Get Started</Button>
                </Link>
              </div>
            </div>
          </nav>
        </header>

        <main>
          <section className="py-20 px-4">
            <div className="max-w-4xl mx-auto text-center">
              <h1 className="text-4xl sm:text-5xl lg:text-6xl font-bold text-white mb-6">
                Manage Your Shooting Syndicate{' '}
                <span className="text-green-500">Professionally</span>
              </h1>
              <p className="text-xl text-slate-400 mb-8 max-w-2xl mx-auto">
                Stop juggling WhatsApp groups and spreadsheets. ShootSync gives you 
                everything you need to run your syndicate smoothly - members, shoots, 
                pegs, bags, and payments in one place.
              </p>
              <div className="flex flex-col sm:flex-row items-center justify-center gap-4">
                <Link to="/signup">
                  <Button size="lg">Start Free Trial</Button>
                </Link>
                <Link to="/features">
                  <Button variant="secondary" size="lg">See Features</Button>
                </Link>
              </div>
            </div>
          </section>

          <section className="py-16 px-4 bg-slate-800/50">
            <div className="max-w-6xl mx-auto">
              <h2 className="text-3xl font-bold text-white text-center mb-12">
                Everything You Need to Run Your Syndicate
              </h2>
              
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
                <FeatureCard
                  title="Member Management"
                  description="Invite members, track subscriptions, manage insurance documents, and keep emergency contacts up to date."
                />
                <FeatureCard
                  title="Fair Peg Allocation"
                  description="Automated fair rotation algorithm ensures every gun gets equal opportunity at the best pegs over the season."
                />
                <FeatureCard
                  title="Shoot Day Planning"
                  description="Schedule shoots, send reminders, generate briefing PDFs, and manage attendance all in one place."
                />
                <FeatureCard
                  title="Bag Recording"
                  description="Record bags by drive with voice input. Works offline in the field and syncs when you have signal."
                />
                <FeatureCard
                  title="Beater Management"
                  description="Track beater attendance, manage day rates, and process payments with Stripe integration."
                />
                <FeatureCard
                  title="Guest Gun Handling"
                  description="Invite guests, collect payments, and manage waivers automatically. No more chasing bank transfers."
                />
              </div>
            </div>
          </section>

          <section className="py-16 px-4">
            <div className="max-w-4xl mx-auto text-center">
              <h2 className="text-3xl font-bold text-white mb-4">
                Trusted by Syndicates Across the UK
              </h2>
              <p className="text-slate-400 mb-8">
                Join the growing number of captains saving hours every week with ShootSync.
              </p>
              <Link to="/signup">
                <Button size="lg">Start Your Free Trial</Button>
              </Link>
              <p className="text-slate-500 text-sm mt-4">
                No credit card required. 14-day free trial.
              </p>
            </div>
          </section>
        </main>

        <footer className="bg-slate-900 border-t border-slate-800 py-8 px-4">
          <div className="max-w-6xl mx-auto flex flex-col sm:flex-row items-center justify-between gap-4">
            <p className="text-slate-500 text-sm">
              © {new Date().getFullYear()} ShootSync. All rights reserved.
            </p>
            <div className="flex items-center gap-6">
              <Link to="/privacy" className="text-slate-500 hover:text-white text-sm">Privacy</Link>
              <Link to="/terms" className="text-slate-500 hover:text-white text-sm">Terms</Link>
              <Link to="/contact" className="text-slate-500 hover:text-white text-sm">Contact</Link>
            </div>
          </div>
        </footer>
      </div>
    </>
  )
}

interface FeatureCardProps {
  title: string
  description: string
}

function FeatureCard({ title, description }: FeatureCardProps) {
  return (
    <div className="bg-slate-800 border border-slate-700 rounded-xl p-6">
      <h3 className="text-lg font-semibold text-white mb-2">{title}</h3>
      <p className="text-slate-400 text-sm">{description}</p>
    </div>
  )
}
