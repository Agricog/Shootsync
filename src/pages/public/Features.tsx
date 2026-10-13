/**
 * Features page - ShootSync
 *
 * One section per job a shoot captain searches for help with: peg draw, shoot
 * day planning, bag records, beaters' pay, guest guns, members. Each section
 * describes only what is built today. Anchors are linked from the home page.
 */

import { Link } from 'react-router-dom'
import { ArrowRight, Calendar, CheckCircle, Mic, PoundSterling, Target, UserPlus, Users } from 'lucide-react'
import type { LucideIcon } from 'lucide-react'
import Seo from '../../components/public/Seo'
import PublicLayout from '../../components/public/PublicLayout'
import { LOWEST_MONTHLY_PRICE } from '../../config/plans'
import { SITE } from '../../config/site'

const TITLE = 'Features: Peg Draw, Bag Records, Beaters and Guests | ShootSync'
const DESCRIPTION =
  'How ShootSync runs a shooting syndicate: a fair peg draw, shoot day briefing sheets, bag records by drive, beaters’ day rates and pay, and guest guns who pay online.'

interface Section {
  id: string
  icon: LucideIcon
  heading: string
  intro: string
  points: string[]
  note?: string
}

const SECTIONS: Section[] = [
  {
    id: 'peg-draw',
    icon: Target,
    heading: 'A fair peg draw that remembers the season',
    intro:
      'A random draw is fair on the day and unfair over a season: the same gun can draw the end peg three shoots running. ShootSync keeps a record of where every gun has stood and rotates the pegs on that history.',
    points: [
      'For each shoot, every gun is given the peg they have stood on least this season',
      'Guns with the fewest days so far are placed first, so nobody is squeezed out',
      'See the whole allocation before you save it to the shoot day',
      'The peg list goes straight onto the briefing sheet',
    ],
    note: 'It answers the car-park question of whose turn it is with a record everyone can see, not with the captain’s memory.',
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
      'Guns, guests and beaters for the day in one view',
      'A PDF briefing sheet with the date, meeting details, drives, the peg list, the beaters and your notes, ready to print or send',
    ],
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
      'The day’s total builds as each drive is entered',
      'Season totals for every species and the number of shoots completed',
    ],
  },
  {
    id: 'beaters',
    icon: PoundSterling,
    heading: 'Beaters’ day rates and pay',
    intro:
      'Keep the beating team in one list and always know who is owed what.',
    points: [
      'Each beater’s phone, email, day rate and bank details, kept by the captain',
      'See what is owed to each beater and the total outstanding',
      'Mark a beater paid with your bank transfer reference',
      'Export a spreadsheet of names, bank details and amounts, ready for your bank',
    ],
    note: 'ShootSync keeps the record of what’s owed and paid; the money itself moves through your own bank, as it does now.',
  },
  {
    id: 'guest-guns',
    icon: UserPlus,
    heading: 'Guest guns: waiver, emergency contact and day fee before the day',
    intro:
      'Invite a guest from the shoot day and send them their own link. They don’t need an account.',
    points: [
      'The guest sees the shoot details: date, location and meet time',
      'They read and accept the guest liability waiver and leave an emergency contact',
      'They pay the day fee by card through Stripe; card details never reach ShootSync',
      'You see who has accepted, declined and paid, and can copy the link again for anyone who hasn’t replied',
    ],
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

      {SECTIONS.map(({ id, icon: Icon, heading, intro, points, note }, index) => (
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
