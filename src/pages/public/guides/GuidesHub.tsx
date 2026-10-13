/**
 * Guides hub - /guides. Lists every guide in src/content/guides.ts, so a new
 * guide appears here as soon as it is added to that list.
 */

import { Link } from 'react-router-dom'
import { ArrowRight } from 'lucide-react'
import Seo from '../../../components/public/Seo'
import PublicLayout from '../../../components/public/PublicLayout'
import { SITE, absoluteUrl } from '../../../config/site'
import { GUIDES, formatReviewed } from '../../../content/guides'

const TITLE = 'Guides for Shoot Captains and Syndicates | ShootSync'
const DESCRIPTION =
  'Practical guides for UK shoot captains: paying beaters, the peg draw, guest guns and the law, shooting season dates and tipping the keeper, with sources.'

const jsonLd = [
  {
    '@context': 'https://schema.org',
    '@type': 'BreadcrumbList',
    itemListElement: [
      { '@type': 'ListItem', position: 1, name: 'Home', item: SITE.url },
      { '@type': 'ListItem', position: 2, name: 'Guides', item: absoluteUrl('/guides') },
    ],
  },
  {
    '@context': 'https://schema.org',
    '@type': 'CollectionPage',
    name: TITLE,
    url: absoluteUrl('/guides'),
    description: DESCRIPTION,
    inLanguage: 'en-GB',
    isPartOf: { '@type': 'WebSite', name: SITE.name, url: SITE.url },
    mainEntity: {
      '@type': 'ItemList',
      itemListElement: GUIDES.map((guide, index) => ({
        '@type': 'ListItem',
        position: index + 1,
        name: guide.shortTitle,
        url: absoluteUrl(guide.path),
      })),
    },
  },
]

export default function GuidesHub() {
  return (
    <PublicLayout>
      <Seo title={TITLE} description={DESCRIPTION} path="/guides" jsonLd={jsonLd} />

      <section aria-labelledby="guides-heading" className="px-4 py-16 sm:py-24">
        <div className="max-w-4xl mx-auto">
          <nav aria-label="Breadcrumb" className="text-sm text-slate-400 mb-6">
            <Link to="/" className="hover:text-white">Home</Link>
            <span aria-hidden="true"> / </span>
            <span aria-current="page" className="text-slate-300">Guides</span>
          </nav>
          <h1 id="guides-heading" className="text-4xl sm:text-5xl font-bold text-white tracking-tight">
            Guides for shoot captains
          </h1>
          <p className="mt-6 text-lg text-slate-400 max-w-2xl">
            The questions that land on a shoot captain every season, answered properly. Each guide shows when its
            facts were last checked and lists the sources, with the law and HMRC guidance first.
          </p>

          <ul className="mt-12 grid gap-6 sm:grid-cols-2">
            {GUIDES.map((guide) => (
              <li key={guide.path}>
                <Link
                  to={guide.path}
                  className="group block h-full bg-slate-800/50 border border-slate-700 hover:border-green-600 rounded-xl p-6 transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-green-500"
                >
                  <h2 className="text-xl font-semibold text-white group-hover:text-green-400">{guide.shortTitle}</h2>
                  <p className="mt-3 text-slate-400 leading-relaxed">{guide.summary}</p>
                  <p className="mt-4 flex items-center justify-between text-sm">
                    <span className="text-slate-400">
                      Reviewed <time dateTime={guide.reviewed}>{formatReviewed(guide.reviewed)}</time>
                    </span>
                    <span className="flex items-center gap-1 text-green-500">
                      Read <ArrowRight className="w-4 h-4" aria-hidden="true" />
                    </span>
                  </p>
                </Link>
              </li>
            ))}
          </ul>

          <div className="mt-16 border-t border-slate-800 pt-10">
            <h2 className="text-2xl font-semibold text-white">Running a syndicate?</h2>
            <p className="mt-3 text-slate-400 max-w-2xl">
              ShootSync keeps your members, shoot days, peg draw, bag records, beaters’ pay and guest guns in one
              place, so the season’s admin isn’t all in your head.
            </p>
            <div className="mt-6 flex flex-wrap gap-4">
              <Link to="/features" className="inline-flex items-center gap-2 text-green-400 hover:text-green-300 font-medium">
                See the features <ArrowRight className="w-4 h-4" aria-hidden="true" />
              </Link>
              <Link to="/pricing" className="inline-flex items-center gap-2 text-green-400 hover:text-green-300 font-medium">
                See the pricing <ArrowRight className="w-4 h-4" aria-hidden="true" />
              </Link>
            </div>
          </div>
        </div>
      </section>
    </PublicLayout>
  )
}
