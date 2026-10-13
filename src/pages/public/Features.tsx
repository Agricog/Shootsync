/**
 * Features page - ShootSync
 *
 * One section per job a shoot captain searches for help with: peg draw, shoot
 * day planning, bag records, beaters' pay, guest guns, members. Each section
 * describes only what a signed-in captain can reach and use in the app today:
 * check the page the captain uses, not a component or library that isn't wired in.
 * Anchors are linked from the home page and the guides.
 */

import { Link } from 'react-router-dom'
import { ArrowRight, Calendar, CheckCircle, Mic, PoundSterling, Target, UserPlus, Users } from 'lucide-react'
import type { LucideIcon } from 'lucide-react'
import Seo from '../../components/public/Seo'
import PublicLayout from '../../components/public/PublicLayout'
import { LOWEST_MONTHLY_PRICE } from '../../config/plans'
import { SITE } from '../../config/site'
import type { GuidePath } from '../../content/guides'

const TITLE = 'Features: Peg Draw, Bag Records, Beaters and Guests | ShootSync'
const DESCRIPTION =
  'How ShootSync runs a shooting syndicate: a fair peg draw, shoot day briefing sheets, bag records by drive, your beating team, and guest guns who pay online.'

interface Section {
  id: string
  icon: LucideIcon
  heading: string
  intro: string
  points: string[]
  note?: string
  /** The guide that covers the same job, linked under the section. */
  guide?: { to: GuidePath; label: string }
}

const SECTIONS: Section[] = [
  {
    id: 'peg-draw',
    icon: Target,
    heading: 'A fair peg draw that remembers the season',
    intro:
      'A random draw is fair on the day and unfair over a season: the same gun can draw the end peg three shoots running. ShootSync keeps every saved draw and uses it to rotate the starting pegs.',
    points: [
      'Tick who is shooting and set the number of pegs',
      'The fair draw keeps each gun off the pegs they have already stood on this season, as far as the whole line allows',
      'Each gun’s pegs so far are shown beside their name, so you can show the guns why',
      'Swap any two guns by hand, save, and the pegs go straight onto the briefing sheet',
    ],
    note: 'Prefer a straight draw? A random draw is one click too.',
    guide: { to: '/guides/peg-draw-explained', label: 'Guide: the peg draw explained' },
  },
  {
    id: 'shoot-days',
    icon: Calendar,
    heading: 'Shoot days and briefing sheets',
    intro:
      'Every shoot day in the season sits on one list, with the details the team needs to turn up in the right place at the right time.',
    points: [
      'Date, location and postcode, meet time and the number of drives',
      'Expected bag and the captain’s notes for the day',
      'Guns and their pegs, and guest guns, for the day in one view',
      'A PDF briefing sheet with the date, meeting details, drives, expected bag, the guns and their pegs, and your notes, ready to print or send',
    ],
    guide: { to: '/guides/shooting-season-dates', label: 'Guide: UK shooting season dates' },
  },
  {
    id: 'bag-records',
    icon: Mic,
    heading: 'Bag records by drive: your game book, kept for you',
    intro:
      'Record the bag as the day goes, drive by drive, rather than reconstructing it at the end of lunch.',
    points: [
      'Pheasant, partridge, duck, woodcock and other quarry, with a note of what “other” was',
      'Say the numbers instead of typing them, on browsers that support speech recognition such as Chrome',
      'The day’s totals by species build as each drive is entered',
      'The shoot day page shows the bag for that day, and your dashboard shows the season’s total bag',
    ],
  },
  {
    id: 'beaters',
    icon: PoundSterling,
    heading: 'Your beating team in one list',
    intro:
      'Keep the beating team’s details in one place the captain controls, instead of scattered across old texts.',
    points: [
      'Each beater’s name, phone, email and notes',
      'Their day rate, starting from the syndicate’s usual rate',
      'Bank details for paying them, shown in full only to the captain',
    ],
    note: 'The money itself moves through your own bank, as it does now.',
    guide: { to: '/guides/paying-beaters-and-pickers-up', label: 'Guide: paying beaters and pickers-up' },
  },
  {
    id: 'guest-guns',
    icon: UserPlus,
    heading: 'Guest guns: waiver, emergency contact and day fee before the day',
    intro:
      'Invite a guest from the shoot day and copy them their own link to send by text or email. They don’t need an account.',
    points: [
      'The guest sees the shoot details: date, location and meet time',
      'They read and accept the guest liability waiver and leave an emergency contact',
      'They pay the day fee by card through Stripe; card details never reach ShootSync',
      'You see who has accepted, declined and paid, and can copy the link again for anyone who hasn’t replied',
    ],
    guide: { to: '/guides/guest-guns', label: 'Guide: guest guns, the law and the etiquette' },
  },
  {
    id: 'members',
    icon: Users,
    heading: 'Your members in one list',
    intro:
      'The captain keeps the syndicate’s member list: who is in, their role and how to reach them.',
    points: [
      'Each gun’s name, email, phone and role',
      'Active, pending and inactive members, so last season’s guns stay on record',
      'Your guns don’t need an account to be on the list',
    ],
  },
]

const jsonLd = [
  {
    '@context': 'https://schema.org',
    '@type': 'BreadcrumbList',
    itemListElement: [
      { '@type': 'ListItem', position: 1, name: 'Home', item: SITE.url },
      { '@type': 'ListItem', position: 2, name: 'Features', item: `${SITE.url}/features` },
    ],
  },
  {
    '@context': 'https://schema.org',
    '@type': 'WebPage',
    name: TITLE,
    url: `${SITE.url}/features`,
    description: DESCRIPTION,
    inLanguage: 'en-GB',
    isPartOf: { '@type': 'WebSite', name: SITE.name, url: SITE.url },
  },
]

export default function Features() {
  return (
    <PublicLayout>
      <Seo title={TITLE} description={DESCRIPTION} path="/features" jsonLd={jsonLd} />

      <section aria-labelledby="features-heading" className="px-4 pt-16 pb-10 sm:pt-24">
        <div className="max-w-3xl mx-auto text-center">
          <nav aria-label="Breadcrumb" className="text-sm text-slate-500 mb-6">
            <Link to="/" className="hover:text-white">Home</Link>
            <span aria-hidden="true"> / </span>
            <span aria-current="page" className="text-slate-300">Features</span>
          </nav>
          <h1 id="features-heading" className="text-4xl sm:text-5xl font-bold text-white tracking-tight">
            What ShootSync does for a shoot captain
          </h1>
          <p className="mt-6 text-lg text-slate-400">
            Six jobs every syndicate captain does each season, in one place. Here is exactly what each part does today.
          </p>
          <ul className="mt-8 flex flex-wrap justify-center gap-2 text-sm">
            {SECTIONS.map((section) => (
              <li key={section.id}>
                <a href={`#${section.id}`} className="inline-block px-3 py-1.5 rounded-full bg-slate-800 border border-slate-700 hover:border-green-600 hover:text-white">
                  {section.heading.split(':')[0]}
                </a>
              </li>
            ))}
          </ul>
        </div>
      </section>

      {SECTIONS.map(({ id, icon: Icon, heading, intro, points, note, guide }, index) => (
        <section
          key={id}
          id={id}
          aria-labelledby={`${id}-heading`}
          className={`px-4 py-16 scroll-mt-8 ${index % 2 === 0 ? 'bg-slate-800/40' : ''}`}
        >
          <div className="max-w-3xl mx-auto">
            <div className="w-12 h-12 bg-green-600/15 rounded-lg flex items-center justify-center mb-5" aria-hidden="true">
              <Icon className="w-6 h-6 text-green-500" />
            </div>
            <h2 id={`${id}-heading`} className="text-2xl sm:text-3xl font-bold text-white">{heading}</h2>
            <p className="mt-4 text-slate-400 leading-relaxed">{intro}</p>
            <ul className="mt-6 space-y-3">
              {points.map((point) => (
                <li key={point} className="flex gap-3">
                  <CheckCircle className="w-5 h-5 text-green-500 flex-shrink-0 mt-0.5" aria-hidden="true" />
                  <span>{point}</span>
                </li>
              ))}
            </ul>
            {note && <p className="mt-6 text-sm text-slate-400 border-l-2 border-green-600 pl-4">{note}</p>}
            {guide && (
              <p className="mt-6 text-sm">
                <Link to={guide.to} className="inline-flex items-center gap-1 text-green-500 hover:text-green-400">
                  {guide.label} <ArrowRight className="w-4 h-4" aria-hidden="true" />
                </Link>
              </p>
            )}
          </div>
        </section>
      ))}

      <section aria-labelledby="features-cta" className="px-4 py-20">
        <div className="max-w-3xl mx-auto text-center">
          <h2 id="features-cta" className="text-3xl font-bold text-white">Set up your syndicate</h2>
          <p className="mt-4 text-slate-400">
            Plans from £{LOWEST_MONTHLY_PRICE} a month, no contract.{' '}
            <Link to="/pricing" className="text-green-500 hover:text-green-400 underline underline-offset-2">Compare plans</Link>{' '}
            or read the{' '}
            <Link to="/#faq" className="text-green-500 hover:text-green-400 underline underline-offset-2">questions captains ask</Link>.
          </p>
          <Link
            to="/signup"
            className="mt-8 inline-flex items-center gap-2 font-medium rounded-lg px-6 py-3 text-lg bg-green-600 hover:bg-green-700 text-white focus:outline-none focus-visible:ring-2 focus-visible:ring-green-500"
          >
            Create your syndicate
            <ArrowRight className="w-5 h-5" aria-hidden="true" />
          </Link>
        </div>
      </section>
    </PublicLayout>
  )
}
