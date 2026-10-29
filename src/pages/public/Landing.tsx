/**
 * Home page - ShootSync
 *
 * Primary keyword: shooting syndicate management software
 * Supporting: syndicate shoot software, peg draw, shoot captain, bag book, beaters' pay, guest guns
 *
 * Every claim on this page describes something built and working. Prices come
 * from src/config/plans.ts, questions from src/content/faq.ts. Rendered to static
 * HTML at build time by scripts/prerender.mjs.
 */

import { Link } from 'react-router-dom'
import { ArrowRight, Calendar, CheckCircle, Mic, PoundSterling, Target, UserPlus, Users } from 'lucide-react'
import Seo from '../../components/public/Seo'
import PublicLayout from '../../components/public/PublicLayout'
import { BILLING_TERMS, LOWEST_MONTHLY_PRICE, PLANS } from '../../config/plans'
import { SITE } from '../../config/site'
import { FAQS } from '../../content/faq'

const TITLE = 'Shooting Syndicate Management Software for UK | ShootSync'
const DESCRIPTION = `Shooting syndicate software for UK shoot captains: members, shoot days, a fair peg draw, bag records, beaters' pay and guest guns. From £${LOWEST_MONTHLY_PRICE} a month.`
const QUICK_ANSWER =
  'ShootSync is web software for UK shooting syndicate captains to run members, shoot days, a fair peg draw, bag records, beaters’ pay and guest guns in one place.'

const FEATURES = [
  {
    icon: Target,
    anchor: 'peg-draw',
    linkLabel: 'How the peg draw works',
    title: 'A fair peg draw, every shoot',
    text: 'Starting pegs rotate on each gun’s pegs so far this season, so everyone gets their turn and nobody has to keep score.',
  },
  {
    icon: Calendar,
    anchor: 'shoot-days',
    linkLabel: 'Shoot days and briefing sheets',
    title: 'Shoot days and briefing sheets',
    text: 'Set the date, location, meet time and drives, then download a PDF briefing sheet with the peg list for the morning.',
  },
  {
    icon: Mic,
    anchor: 'bag-records',
    linkLabel: 'Recording the bag',
    title: 'The bag book, by drive',
    text: 'Record pheasant, partridge, duck, woodcock and other quarry drive by drive, by voice or by hand, with the season’s game book kept for you.',
  },
  {
    icon: PoundSterling,
    anchor: 'beaters',
    linkLabel: 'Paying beaters',
    title: 'Beaters’ day rates and pay',
    text: 'Book beaters onto each day. Complete the day and see who’s owed what, mark it paid, and export a sheet for your bank.',
  },
  {
    icon: UserPlus,
    anchor: 'guest-guns',
    linkLabel: 'Guest guns and day fees',
    title: 'Guest guns sorted before the day',
    text: 'Copy a guest their own link to send by text or email. They accept the waiver and leave an emergency contact, and you tick off who has paid their day fee.',
  },
  {
    icon: Users,
    anchor: 'members',
    linkLabel: 'The member list',
    title: 'Your members in one list',
    text: 'Every gun in the syndicate with their contact details, kept by the captain, without anyone needing an account.',
  },
] as const

const SEASON_STEPS = [
  {
    title: 'Set up the syndicate',
    text: 'Name it, set the season dates, the annual subscription and your usual beaters’ day rate.',
  },
  {
    title: 'Add your guns and beaters',
    text: 'Build the member list and the beating team once, and use it all season.',
  },
  {
    title: 'Plan the shoot days',
    text: 'Date, location and postcode, meet time and the number of drives.',
  },
  {
    title: 'Run the peg draw',
    text: 'Run a fair draw for the guns who are out, check it, save it to the day, and print the briefing sheet.',
  },
  {
    title: 'Record the bag',
    text: 'Drive by drive on the day, so the numbers are there when the game book needs filling in.',
  },
  {
    title: 'Settle up',
    text: 'See which guests still owe their day fee. Mark the day complete, pay the beaters what they’re owed, and mark them paid.',
  },
] as const

const PAINS = [
  'The peg draw argued over in the car park',
  'A spreadsheet only the captain can find',
  'Guest day fees chased by text for a fortnight',
  'Beaters’ money worked out on the back of the game card',
  'Bag numbers lost in a WhatsApp thread',
] as const

const jsonLd = [
  {
    '@context': 'https://schema.org',
    '@type': 'Organization',
    '@id': `${SITE.url}/#organization`,
    name: SITE.name,
    url: SITE.url,
    logo: `${SITE.url}/icon-512.png`,
    email: SITE.email,
    founder: { '@type': 'Person', name: SITE.operator.legalName },
    parentOrganization: { '@type': 'Organization', name: SITE.operator.tradingAs, url: SITE.operator.url },
    areaServed: 'GB',
  },
  {
    '@context': 'https://schema.org',
    '@type': 'SoftwareApplication',
    name: SITE.name,
    url: SITE.url,
    applicationCategory: 'BusinessApplication',
    operatingSystem: 'Web browser',
    description: QUICK_ANSWER,
    image: `${SITE.url}${SITE.ogImage}`,
    publisher: { '@id': `${SITE.url}/#organization` },
    featureList: FEATURES.map((feature) => feature.title),
    offers: PLANS.map((plan) => ({
      '@type': 'Offer',
      name: `ShootSync ${plan.name}`,
      price: plan.monthlyPrice.toFixed(2),
      priceCurrency: 'GBP',
      url: `${SITE.url}/pricing`,
      priceSpecification: {
        '@type': 'UnitPriceSpecification',
        price: plan.monthlyPrice.toFixed(2),
        priceCurrency: 'GBP',
        unitText: 'MONTH',
        referenceQuantity: { '@type': 'QuantitativeValue', value: 1, unitCode: 'MON' },
      },
    })),
  },
  {
    '@context': 'https://schema.org',
    '@type': 'WebPage',
    name: TITLE,
    url: SITE.url,
    description: DESCRIPTION,
    inLanguage: 'en-GB',
    speakable: { '@type': 'SpeakableSpecification', cssSelector: ['#quick-answer'] },
  },
  {
    '@context': 'https://schema.org',
    '@type': 'FAQPage',
    mainEntity: FAQS.map((faq) => ({
      '@type': 'Question',
      name: faq.question,
      acceptedAnswer: { '@type': 'Answer', text: faq.answer },
    })),
  },
]

const button =
  'inline-flex items-center justify-center gap-2 font-medium rounded-lg px-6 py-3 text-lg transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-green-500 focus-visible:ring-offset-2 focus-visible:ring-offset-slate-900'

export default function Landing() {
  return (
    <PublicLayout>
      <Seo title={TITLE} description={DESCRIPTION} path="/" jsonLd={jsonLd} />

      {/* Hero */}
      <section aria-labelledby="hero-heading" className="px-4 pt-20 pb-16 sm:pt-28 sm:pb-20">
        <div className="max-w-4xl mx-auto text-center">
          <p className="text-green-500 font-medium text-sm tracking-wide uppercase mb-4">For UK shoot captains</p>
          <h1 id="hero-heading" className="text-4xl sm:text-5xl lg:text-6xl font-bold text-white tracking-tight leading-tight">
            Shooting syndicate management software
          </h1>
          <p className="mt-6 text-lg sm:text-xl text-slate-400 max-w-2xl mx-auto">
            Run your syndicate’s season from one place: members, shoot days, a fair peg draw, the bag
            book, beaters’ pay and guest guns, instead of WhatsApp threads and a spreadsheet.
          </p>
          <div className="mt-10 flex flex-col sm:flex-row gap-4 justify-center">
            <Link to="/signup" className={`${button} bg-green-600 hover:bg-green-700 text-white`}>
              Create your syndicate
              <ArrowRight className="w-5 h-5" aria-hidden="true" />
            </Link>
            <Link to="/features" className={`${button} bg-slate-700 hover:bg-slate-600 text-white`}>
              See what it does
            </Link>
          </div>
          <p className="mt-6 text-sm text-slate-400">
            From £{LOWEST_MONTHLY_PRICE} a month · No contract · {BILLING_TERMS.moneyBackDays}-day money-back guarantee
          </p>
        </div>
      </section>

      {/* Quick answer (Standard §05.1 point 14) */}
      <section aria-label="ShootSync in one sentence" className="px-4 pb-16">
        <p
          id="quick-answer"
          className="max-w-3xl mx-auto text-center text-slate-300 border border-slate-700 bg-slate-800/50 rounded-xl px-6 py-5"
        >
          {QUICK_ANSWER}
        </p>
      </section>

      {/* The problem */}
      <section aria-labelledby="problem-heading" className="bg-slate-800/40 px-4 py-20">
        <div className="max-w-5xl mx-auto grid gap-12 lg:grid-cols-2 items-center">
          <div>
            <h2 id="problem-heading" className="text-3xl font-bold text-white">
              Running a syndicate shouldn’t mean running the admin
            </h2>
            <p className="mt-4 text-slate-400">
              Most syndicates are held together by one captain’s phone. The shooting is the easy part. It’s
              the subs, the pegs, the guests, the beaters and the bag book that eat the evenings. ShootSync
              puts all of it in one place the captain controls.
            </p>
          </div>
          <ul className="space-y-3">
            {PAINS.map((pain) => (
              <li key={pain} className="flex items-start gap-3 bg-slate-900 border border-slate-700 rounded-lg px-4 py-3">
                <span className="text-red-400 mt-0.5" aria-hidden="true">✕</span>
                <span>{pain}</span>
              </li>
            ))}
          </ul>
        </div>
      </section>

      {/* Features */}
      <section id="features" aria-labelledby="features-heading" className="px-4 py-20">
        <div className="max-w-7xl mx-auto">
          <div className="text-center max-w-3xl mx-auto mb-14">
            <h2 id="features-heading" className="text-3xl sm:text-4xl font-bold text-white">
              Everything a shoot captain does, in one place
            </h2>
            <p className="mt-4 text-slate-400">
              From setting up the season to paying the beaters after the last drive.
            </p>
          </div>
          <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
            {FEATURES.map(({ icon: Icon, anchor, linkLabel, title, text }) => (
              <article key={anchor} className="bg-slate-800 border border-slate-700 rounded-xl p-6">
                <div className="w-11 h-11 bg-green-600/15 rounded-lg flex items-center justify-center mb-4" aria-hidden="true">
                  <Icon className="w-6 h-6 text-green-500" />
                </div>
                <h3 className="text-lg font-semibold text-white mb-2">{title}</h3>
                <p className="text-slate-400 text-sm leading-relaxed">{text}</p>
                <Link
                  to={`/features#${anchor}`}
                  className="mt-4 inline-block text-sm text-green-400 hover:text-green-300 focus:outline-none focus-visible:ring-2 focus-visible:ring-green-500 rounded"
                >
                  {linkLabel}
                </Link>
              </article>
            ))}
          </div>
        </div>
      </section>

      {/* How a season runs */}
      <section aria-labelledby="season-heading" className="bg-slate-800/40 px-4 py-20">
        <div className="max-w-5xl mx-auto">
          <h2 id="season-heading" className="text-3xl sm:text-4xl font-bold text-white text-center">
            How a syndicate season runs in ShootSync
          </h2>
          <ol className="mt-12 grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
            {SEASON_STEPS.map((step, index) => (
              <li key={step.title} className="bg-slate-900 border border-slate-700 rounded-xl p-6">
                <span className="text-green-500 font-semibold text-sm">Step {index + 1}</span>
                <h3 className="mt-1 text-lg font-semibold text-white">{step.title}</h3>
                <p className="mt-2 text-sm text-slate-400">{step.text}</p>
              </li>
            ))}
          </ol>
        </div>
      </section>

      {/* Pricing summary */}
      <section aria-labelledby="pricing-heading" className="px-4 py-20">
        <div className="max-w-5xl mx-auto">
          <div className="text-center">
            <h2 id="pricing-heading" className="text-3xl sm:text-4xl font-bold text-white">
              Simple monthly pricing
            </h2>
            <p className="mt-4 text-slate-400">
              No contract and no set-up fee. {BILLING_TERMS.moneyBackDays}-day money-back guarantee on every plan.
            </p>
          </div>
          <div className="mt-12 grid gap-6 md:grid-cols-2">
            {PLANS.map((plan) => (
              <article
                key={plan.tier}
                className={`rounded-xl p-8 border ${plan.popular ? 'border-green-500 bg-slate-800' : 'border-slate-700 bg-slate-800/50'}`}
              >
                <h3 className="text-xl font-semibold text-white">{plan.name}</h3>
                <p className="mt-2 text-sm text-slate-400">{plan.summary}</p>
                <p className="mt-6">
                  <span className="text-4xl font-bold text-white">£{plan.monthlyPrice}</span>
                  <span className="text-slate-400"> a month</span>
                </p>
                <ul className="mt-6 space-y-2 text-sm">
                  {plan.features.slice(0, 4).map((feature) => (
                    <li key={feature} className="flex gap-2">
                      <CheckCircle className="w-5 h-5 text-green-500 flex-shrink-0" aria-hidden="true" />
                      <span>{feature}</span>
                    </li>
                  ))}
                </ul>
              </article>
            ))}
          </div>
          <p className="mt-8 text-center">
            <Link to="/pricing" className="text-green-500 hover:text-green-400 focus:outline-none focus-visible:ring-2 focus-visible:ring-green-500 rounded">
              Compare plans in full
            </Link>
          </p>
        </div>
      </section>

      {/* Who builds it (E-E-A-T, §05.1 point 10) */}
      <section aria-labelledby="about-heading" className="bg-slate-800/40 px-4 py-20">
        <div className="max-w-3xl mx-auto">
          <h2 id="about-heading" className="text-3xl font-bold text-white">Who’s behind ShootSync</h2>
          <p className="mt-4 text-slate-400">
            ShootSync is built and run in Cornwall by {SITE.operator.knownAs},
            trading as {SITE.operator.tradingAs}, after more than forty years working in agriculture,
            construction and hospitality. It is a small, independent business: when you email, you reach the
            person who builds the software.
          </p>
          <p className="mt-4 text-slate-400">
            Your syndicate’s information is yours. Each captain sees only their own syndicate, card payments
            are handled by Stripe, and the site uses no advertising or tracking cookies. Read the{' '}
            <Link to="/privacy" className="text-green-500 hover:text-green-400 underline underline-offset-2">
              privacy notice
            </Link>{' '}
            for the detail.
          </p>
        </div>
      </section>

      {/* FAQ */}
      <section id="faq" aria-labelledby="faq-heading" className="px-4 py-20">
        <div className="max-w-3xl mx-auto">
          <h2 id="faq-heading" className="text-3xl sm:text-4xl font-bold text-white text-center">
            Questions shoot captains ask
          </h2>
          <div className="mt-12 space-y-4">
            {FAQS.map((faq) => (
              <details key={faq.question} className="group bg-slate-800 border border-slate-700 rounded-xl">
                <summary className="cursor-pointer list-none px-6 py-4 flex justify-between items-center gap-4 focus:outline-none focus-visible:ring-2 focus-visible:ring-green-500 rounded-xl">
                  <h3 className="text-base font-semibold text-white">{faq.question}</h3>
                  <span className="text-green-500 text-xl group-open:rotate-45 transition-transform" aria-hidden="true">+</span>
                </summary>
                <p className="px-6 pb-5 text-slate-400 text-sm leading-relaxed">{faq.answer}</p>
              </details>
            ))}
          </div>
        </div>
      </section>

      {/* Final call to action */}
      <section aria-labelledby="cta-heading" className="px-4 pb-24">
        <div className="max-w-4xl mx-auto text-center bg-green-700/20 border border-green-700/40 rounded-2xl px-6 py-14">
          <h2 id="cta-heading" className="text-3xl font-bold text-white">Ready for a calmer season?</h2>
          <p className="mt-4 text-slate-300">
            Set up your syndicate in a few minutes, then choose a plan. No contract, and your money back
            within {BILLING_TERMS.moneyBackDays} days if it isn’t right.
          </p>
          <Link to="/signup" className={`${button} mt-8 bg-green-600 hover:bg-green-700 text-white`}>
            Create your syndicate
            <ArrowRight className="w-5 h-5" aria-hidden="true" />
          </Link>
        </div>
      </section>
    </PublicLayout>
  )
}
