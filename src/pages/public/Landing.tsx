/**
 * Landing Page - ShootSync
 * SEO-optimized public homepage
 * Implements Autaimate Build Standard v3 — 15-Point SEO Achievement Framework
 *
 * SEO Checklist:
 *  1. Unique, keyword-rich <title> tag
 *  2. Meta description (≤160 chars, CTA-oriented)
 *  3. Canonical URL
 *  4. Open Graph tags (title, description, image, url, type, site_name)
 *  5. Twitter Card tags (card, title, description, image)
 *  6. JSON-LD structured data (SoftwareApplication + Organization + FAQPage)
 *  7. Single semantic <h1> with primary keyword
 *  8. Semantic HTML throughout (header, nav, main, section, article, footer)
 *  9. Alt text on all images / aria-labels on interactive elements
 * 10. Internal linking (features, pricing, login, signup)
 * 11. Mobile-responsive layout (Tailwind breakpoints)
 * 12. Robots meta (index, follow)
 * 13. Heading hierarchy (h1 → h2 → h3, no skips)
 * 14. Structured content sections with descriptive IDs for defined anchors
 * 15. Accessibility: WCAG 2.1 AA (focus states, contrast, ARIA, skip-nav)
 */

import { Link } from 'react-router-dom'
import { Helmet } from 'react-helmet-async'
import {
  Users,
  Target,
  Calendar,
  Mic,
  HardHat,
  UserPlus,
  CheckCircle,
  ArrowRight,
  ChevronDown,
} from 'lucide-react'
import Button from '../../components/common/Button'

const SITE_URL = 'https://shootsync.co.uk'
const SITE_NAME = 'ShootSync'

const JSON_LD_SOFTWARE = {
  '@context': 'https://schema.org',
  '@type': 'SoftwareApplication',
  name: SITE_NAME,
  url: SITE_URL,
  applicationCategory: 'BusinessApplication',
  operatingSystem: 'Web',
  description:
    'Professional shooting syndicate management software for UK syndicates. Manage members, shoots, peg allocation, bag recording, beaters and payments.',
  offers: {
    '@type': 'AggregateOffer',
    priceCurrency: 'GBP',
    lowPrice: '49',
    highPrice: '149',
    offerCount: '2',
  },
  featureList: [
    'Member management',
    'Fair peg allocation algorithm',
    'Shoot day scheduling',
    'Bag recording with voice input',
    'Beater booking & payments',
    'Guest gun management with Stripe payments',
    'PDF shoot briefings',
    'Offline-capable PWA',
  ],
  screenshot: `${SITE_URL}/og-image.png`,
  softwareVersion: '1.0',
  author: {
    '@type': 'Organization',
    name: 'Autaimate',
    url: 'https://autaimate.com',
  },
}

const JSON_LD_ORGANIZATION = {
  '@context': 'https://schema.org',
  '@type': 'Organization',
  name: SITE_NAME,
  url: SITE_URL,
  logo: `${SITE_URL}/icon-512.png`,
  description:
    'UK shooting syndicate management software replacing WhatsApp groups and spreadsheets.',
  contactPoint: {
    '@type': 'ContactPoint',
    contactType: 'customer support',
    url: `${SITE_URL}/contact`,
  },
}

const JSON_LD_FAQ = {
  '@context': 'https://schema.org',
  '@type': 'FAQPage',
  mainEntity: [
    {
      '@type': 'Question',
      name: 'What is ShootSync?',
      acceptedAnswer: {
        '@type': 'Answer',
        text: 'ShootSync is a professional management platform built specifically for UK shooting syndicates. It replaces WhatsApp groups and spreadsheets with a single system for managing members, shoots, peg allocation, bag recording, beaters and payments.',
      },
    },
    {
      '@type': 'Question',
      name: 'How does peg allocation work?',
      acceptedAnswer: {
        '@type': 'Answer',
        text: "ShootSync uses a fair rotation algorithm that analyses each gun's peg history across the season. It ensures every member gets equal opportunity at every position, eliminating arguments and manual tracking.",
      },
    },
    {
      '@type': 'Question',
      name: 'Can I record bags in the field without signal?',
      acceptedAnswer: {
        '@type': 'Answer',
        text: 'Yes. ShootSync works offline as a Progressive Web App. Record bags by drive — including voice input — and the data syncs automatically when you regain signal.',
      },
    },
    {
      '@type': 'Question',
      name: 'How much does ShootSync cost?',
      acceptedAnswer: {
        '@type': 'Answer',
        text: 'Plans start at £49/month for the Starter tier (up to 10 guns) and £79/month for the Standard tier with guest management, Stripe payments and PDF briefings.',
      },
    },
  ],
}

const FEATURES = [
  {
    icon: Users,
    title: 'Member Management',
    description:
      'Invite members, track subscriptions, manage insurance documents and keep emergency contacts current. No more chasing paperwork.',
  },
  {
    icon: Target,
    title: 'Fair Peg Allocation',
    description:
      'Automated rotation algorithm analyses season history so every gun gets equal opportunity at the best pegs. No more arguments.',
  },
  {
    icon: Calendar,
    title: 'Shoot Day Planning',
    description:
      'Schedule shoots, send reminders, generate briefing PDFs and manage attendance — all from one dashboard.',
  },
  {
    icon: Mic,
    title: 'Bag Recording',
    description:
      'Record bags by drive with voice input. Works offline in the field and syncs automatically when you have signal.',
  },
  {
    icon: HardHat,
    title: 'Beater Management',
    description:
      'Book beaters, track confirmations, manage day rates and process payments. Beaters get their own portal to confirm and check in.',
  },
  {
    icon: UserPlus,
    title: 'Guest Gun Handling',
    description:
      'Invite guests, collect day fees via Stripe, and manage liability waivers automatically. No more chasing bank transfers.',
  },
] as const

const BENEFITS = [
  'Replace WhatsApp groups and spreadsheets',
  'Save 2+ hours of admin every week',
  'Fair, transparent peg allocation every shoot',
  'Professional guest handling with online payments',
  'Works offline in the field — syncs when ready',
  'Beaters confirm bookings and check in themselves',
] as const

export default function Landing() {
  return (
    <>
      <Helmet>
        {/* 1. Title tag */}
        <title>
          ShootSync — Shooting Syndicate Management Software | UK
        </title>

        {/* 2. Meta description */}
        <meta
          name="description"
          content="Professional shooting syndicate management for UK syndicates. Manage members, shoots, peg allocation, bag recording and payments in one place. Plans from £49/month."
        />

        {/* 12. Robots */}
        <meta name="robots" content="index, follow" />

        {/* 3. Canonical */}
        <link rel="canonical" href={SITE_URL} />

        {/* 4. Open Graph */}
        <meta property="og:type" content="website" />
        <meta property="og:site_name" content={SITE_NAME} />
        <meta
          property="og:title"
          content="ShootSync — Shooting Syndicate Management Software | UK"
        />
        <meta
          property="og:description"
          content="Professional shooting syndicate management for UK syndicates. Manage members, shoots, peg allocation, bag recording and payments in one place."
        />
        <meta property="og:url" content={SITE_URL} />
        <meta property="og:image" content={`${SITE_URL}/og-image.png`} />
        <meta property="og:image:width" content="1200" />
        <meta property="og:image:height" content="630" />
        <meta property="og:image:alt" content="ShootSync — manage your shooting syndicate professionally" />
        <meta property="og:locale" content="en_GB" />

        {/* 5. Twitter Card */}
        <meta name="twitter:card" content="summary_large_image" />
        <meta
          name="twitter:title"
          content="ShootSync — Shooting Syndicate Management Software | UK"
        />
        <meta
          name="twitter:description"
          content="Professional shooting syndicate management for UK syndicates. Manage members, shoots, peg allocation, bag recording and payments in one place."
        />
        <meta name="twitter:image" content={`${SITE_URL}/og-image.png`} />
        <meta name="twitter:image:alt" content="ShootSync — manage your shooting syndicate professionally" />

        {/* Geo */}
        <meta name="geo.region" content="GB" />

        {/* 6. JSON-LD structured data (3 schemas) */}
        <script type="application/ld+json">
          {JSON.stringify(JSON_LD_SOFTWARE)}
        </script>
        <script type="application/ld+json">
          {JSON.stringify(JSON_LD_ORGANIZATION)}
        </script>
        <script type="application/ld+json">
          {JSON.stringify(JSON_LD_FAQ)}
        </script>
      </Helmet>

      <div className="min-h-screen bg-slate-900 text-slate-300">
        {/* 15. Skip-nav for accessibility */}
        <a
          href="#main-content"
          className="sr-only focus:not-sr-only focus:absolute focus:top-2 focus:left-2 focus:z-50 focus:px-4 focus:py-2 focus:bg-green-600 focus:text-white focus:rounded"
        >
          Skip to main content
        </a>

        {/* ── HEADER / NAV ── */}
        {/* 8. Semantic <header> + <nav> */}
        <header className="bg-slate-900 border-b border-slate-800">
          <nav
            className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8"
            aria-label="Primary navigation"
          >
            <div className="flex items-center justify-between h-16">
              <Link
                to="/"
                className="flex items-center gap-2 focus:outline-none focus-visible:ring-2 focus-visible:ring-green-500 rounded"
                aria-label="ShootSync home"
              >
                <div className="w-8 h-8 bg-green-600 rounded-lg flex items-center justify-center">
                  <span className="text-white font-bold text-sm" aria-hidden="true">
                    SS
                  </span>
                </div>
                <span className="text-white font-semibold text-lg">
                  ShootSync
                </span>
              </Link>

              <div className="hidden sm:flex items-center gap-6">
                <Link
                  to="/features"
                  className="text-slate-400 hover:text-white text-sm transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-green-500 rounded px-1"
                >
                  Features
                </Link>
                <Link
                  to="/pricing"
                  className="text-slate-400 hover:text-white text-sm transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-green-500 rounded px-1"
                >
                  Pricing
                </Link>
              </div>

              <div className="flex items-center gap-3">
                <Link to="/login">
                  <Button variant="ghost" size="sm">
                    Sign In
                  </Button>
                </Link>
                <Link to="/signup">
                  <Button size="sm">Get Started</Button>
                </Link>
              </div>
            </div>
          </nav>
        </header>

        {/* ── MAIN ── */}
        <main id="main-content">
          {/* ── HERO ── */}
          {/* 7. Single semantic <h1> with primary keyword */}
          <section
            id="hero"
            className="relative py-20 sm:py-28 px-4 overflow-hidden"
            aria-labelledby="hero-heading"
          >
            {/* Subtle background grain */}
            <div
              className="absolute inset-0 opacity-[0.03]"
              style={{
                backgroundImage:
                  'url("data:image/svg+xml,%3Csvg viewBox=\'0 0 256 256\' xmlns=\'http://www.w3.org/2000/svg\'%3E%3Cfilter id=\'noise\'%3E%3CfeTurbulence type=\'fractalNoise\' baseFrequency=\'0.9\' numOctaves=\'4\' stitchTiles=\'stitch\'/%3E%3C/filter%3E%3Crect width=\'100%25\' height=\'100%25\' filter=\'url(%23noise)\'/%3E%3C/svg%3E")',
              }}
              aria-hidden="true"
            />

            <div className="relative max-w-4xl mx-auto text-center">
              <h1
                id="hero-heading"
                className="text-4xl sm:text-5xl lg:text-6xl font-bold text-white mb-6 leading-tight"
              >
                Manage Your Shooting Syndicate{' '}
                <span className="text-green-500">Professionally</span>
              </h1>

              <p className="text-lg sm:text-xl text-slate-400 mb-10 max-w-2xl mx-auto leading-relaxed">
                Stop juggling WhatsApp groups and spreadsheets. ShootSync gives
                you everything you need to run your syndicate smoothly — members,
                shoots, pegs, bags, and payments in one place.
              </p>

              <div className="flex flex-col sm:flex-row items-center justify-center gap-4">
                <Link to="/signup">
                  <Button size="lg">
                    Get Started
                    <ArrowRight className="ml-2 h-5 w-5" aria-hidden="true" />
                  </Button>
                </Link>
                <Link to="/features">
                  <Button variant="secondary" size="lg">
                    See Features
                  </Button>
                </Link>
              </div>

              {/* Trust signal */}
              <p className="text-slate-500 text-sm mt-6">
                Built for UK shoot captains · Plans from £49/month
              </p>

              {/* Scroll hint */}
              <div className="mt-12 animate-bounce" aria-hidden="true">
                <ChevronDown className="h-6 w-6 text-slate-600 mx-auto" />
              </div>
            </div>
          </section>

          {/* ── FEATURES ── */}
          {/* 13. Heading hierarchy: h2 under h1 */}
          {/* 14. Descriptive section ID */}
          <section
            id="features"
            className="py-16 sm:py-20 px-4 bg-slate-800/50"
            aria-labelledby="features-heading"
          >
            <div className="max-w-6xl mx-auto">
              <div className="text-center mb-14">
                <h2
                  id="features-heading"
                  className="text-3xl sm:text-4xl font-bold text-white mb-4"
                >
                  Everything You Need to Run Your Syndicate
                </h2>
                <p className="text-slate-400 max-w-2xl mx-auto">
                  From pre-season setup to end-of-day bag totals, ShootSync
                  handles the admin so you can focus on the shooting.
                </p>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
                {FEATURES.map((feature) => (
                  <FeatureCard
                    key={feature.title}
                    icon={feature.icon}
                    title={feature.title}
                    description={feature.description}
                  />
                ))}
              </div>
            </div>
          </section>

          {/* ── BENEFITS / WHY SHOOTSYNC ── */}
          <section
            id="benefits"
            className="py-16 sm:py-20 px-4"
            aria-labelledby="benefits-heading"
          >
            <div className="max-w-4xl mx-auto">
              <div className="text-center mb-12">
                <h2
                  id="benefits-heading"
                  className="text-3xl sm:text-4xl font-bold text-white mb-4"
                >
                  Why Captains Choose ShootSync
                </h2>
                <p className="text-slate-400">
                  Purpose-built for how UK syndicates actually work.
                </p>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                {BENEFITS.map((benefit) => (
                  <div
                    key={benefit}
                    className="flex items-start gap-3 p-4 rounded-lg bg-slate-800/40 border border-slate-700/50"
                  >
                    <CheckCircle
                      className="h-5 w-5 text-green-500 mt-0.5 shrink-0"
                      aria-hidden="true"
                    />
                    <span className="text-slate-300">{benefit}</span>
                  </div>
                ))}
              </div>
            </div>
          </section>

          {/* ── FAQ ── */}
          {/* Matches JSON-LD FAQPage schema above */}
          <section
            id="faq"
            className="py-16 sm:py-20 px-4 bg-slate-800/50"
            aria-labelledby="faq-heading"
          >
            <div className="max-w-3xl mx-auto">
              <h2
                id="faq-heading"
                className="text-3xl sm:text-4xl font-bold text-white text-center mb-12"
              >
                Frequently Asked Questions
              </h2>

              <div className="space-y-6">
                {JSON_LD_FAQ.mainEntity.map((item) => (
                  <article
                    key={item.name}
                    className="bg-slate-800 border border-slate-700 rounded-xl p-6"
                  >
                    <h3 className="text-lg font-semibold text-white mb-2">
                      {item.name}
                    </h3>
                    <p className="text-slate-400 text-sm leading-relaxed">
                      {item.acceptedAnswer.text}
                    </p>
                  </article>
                ))}
              </div>
            </div>
          </section>

          {/* ── CTA ── */}
          <section
            id="cta"
            className="py-16 sm:py-20 px-4"
            aria-labelledby="cta-heading"
          >
            <div className="max-w-4xl mx-auto text-center">
              <h2
                id="cta-heading"
                className="text-3xl sm:text-4xl font-bold text-white mb-4"
              >
                Ready to Run Your Syndicate Properly?
              </h2>
              <p className="text-slate-400 mb-8 max-w-xl mx-auto">
                Join the growing number of shoot captains saving hours every
                week with ShootSync.
              </p>
              <Link to="/signup">
                <Button size="lg">
                  Get Started
                  <ArrowRight className="ml-2 h-5 w-5" aria-hidden="true" />
                </Button>
              </Link>
            </div>
          </section>
        </main>

        {/* ── FOOTER ── */}
        {/* 8. Semantic <footer> */}
        {/* 10. Internal links */}
        <footer className="bg-slate-900 border-t border-slate-800 py-8 px-4">
          <div className="max-w-6xl mx-auto">
            <div className="flex flex-col sm:flex-row items-center justify-between gap-4">
              <p className="text-slate-500 text-sm">
                &copy; {new Date().getFullYear()} ShootSync. All rights
                reserved.
              </p>

              <nav aria-label="Footer navigation">
                <div className="flex items-center gap-6">
                  <Link
                    to="/features"
                    className="text-slate-500 hover:text-white text-sm transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-green-500 rounded px-1"
                  >
                    Features
                  </Link>
                  <Link
                    to="/pricing"
                    className="text-slate-500 hover:text-white text-sm transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-green-500 rounded px-1"
                  >
                    Pricing
                  </Link>
                  <Link
                    to="/privacy"
                    className="text-slate-500 hover:text-white text-sm transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-green-500 rounded px-1"
                  >
                    Privacy
                  </Link>
                  <Link
                    to="/terms"
                    className="text-slate-500 hover:text-white text-sm transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-green-500 rounded px-1"
                  >
                    Terms
                  </Link>
                  <Link
                    to="/contact"
                    className="text-slate-500 hover:text-white text-sm transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-green-500 rounded px-1"
                  >
                    Contact
                  </Link>
                </div>
              </nav>
            </div>

            <div className="mt-4 text-center sm:text-left">
              <p className="text-slate-600 text-xs">
                Built by{' '}
                <a
                  href="https://autaimate.com"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-slate-500 hover:text-white transition-colors underline underline-offset-2 focus:outline-none focus-visible:ring-2 focus-visible:ring-green-500 rounded"
                >
                  Autaimate
                </a>
              </p>
            </div>
          </div>
        </footer>
      </div>
    </>
  )
}

/* ── FEATURE CARD ── */

interface FeatureCardProps {
  icon: React.ComponentType<{ className?: string }>
  title: string
  description: string
}

function FeatureCard({ icon: Icon, title, description }: FeatureCardProps) {
  return (
    <article className="bg-slate-800 border border-slate-700 rounded-xl p-6 transition-colors hover:border-slate-600">
      <div className="w-10 h-10 bg-green-600/10 border border-green-600/20 rounded-lg flex items-center justify-center mb-4">
        <Icon className="h-5 w-5 text-green-500" aria-hidden="true" />
      </div>
      <h3 className="text-lg font-semibold text-white mb-2">{title}</h3>
      <p className="text-slate-400 text-sm leading-relaxed">{description}</p>
    </article>
  )
}
