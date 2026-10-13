/**
 * Guide Page - shared layout for every guide under /guides.
 *
 * Every guide gets the same trust signals, so none can ship without them:
 * breadcrumb, "Last reviewed" date, a short answer up front, contents, numbered
 * sources, an advice note where the subject is legal or tax, and one link to the
 * ShootSync feature that does the job. Article and BreadcrumbList structured data
 * are built here from the same facts the page shows.
 */

import type { ReactNode } from 'react'
import { Link } from 'react-router-dom'
import { ArrowRight } from 'lucide-react'
import Seo from './Seo'
import PublicLayout from './PublicLayout'
import { SITE, absoluteUrl } from '../../config/site'
import { formatReviewed, guideByPath, type GuidePath, type Source } from '../../content/guides'

export interface GuideSection {
  id: string
  heading: string
  body: ReactNode
}

interface GuidePageProps {
  path: GuidePath
  /** <title>: 25-65 characters, ending "| ShootSync". */
  seoTitle: string
  /** 110-170 characters. */
  description: string
  /** The page's one <h1>. */
  title: string
  /** The direct answer, shown first. */
  inShort: ReactNode
  sections: GuideSection[]
  sources: Source[]
  /** Shown above the sources on legal, tax and pay guides. */
  adviceNote?: ReactNode
  feature: { to: string; heading: string; text: string }
}

const prose =
  'text-slate-300 leading-relaxed space-y-4 [&_ul]:list-disc [&_ul]:pl-6 [&_ul]:space-y-2 [&_ol]:list-decimal [&_ol]:pl-6 [&_ol]:space-y-2 [&_a]:text-green-500 [&_a]:underline [&_a]:underline-offset-2 [&_strong]:text-white'

export default function GuidePage({ path, seoTitle, description, title, inShort, sections, sources, adviceNote, feature }: GuidePageProps) {
  const guide = guideByPath(path)
  const url = absoluteUrl(path)

  const jsonLd = [
    {
      '@context': 'https://schema.org',
      '@type': 'BreadcrumbList',
      itemListElement: [
        { '@type': 'ListItem', position: 1, name: 'Home', item: SITE.url },
        { '@type': 'ListItem', position: 2, name: 'Guides', item: absoluteUrl('/guides') },
        { '@type': 'ListItem', position: 3, name: guide.shortTitle, item: url },
      ],
    },
    {
      '@context': 'https://schema.org',
      '@type': 'Article',
      headline: title,
      description,
      url,
      mainEntityOfPage: url,
      image: absoluteUrl(SITE.ogImage),
      dateModified: guide.reviewed,
      inLanguage: 'en-GB',
      author: { '@type': 'Person', name: SITE.operator.knownAs, url: SITE.operator.url },
      publisher: { '@type': 'Organization', name: SITE.name, url: SITE.url, logo: absoluteUrl(SITE.ogImage) },
      citation: sources.map((source) => source.url),
    },
  ]

  return (
    <PublicLayout>
      <Seo title={seoTitle} description={description} path={path} jsonLd={jsonLd} type="article" />

      <article className="px-4 py-16 sm:py-24">
        <div className="max-w-3xl mx-auto">
          <nav aria-label="Breadcrumb" className="text-sm text-slate-500 mb-6">
            <Link to="/" className="hover:text-white">Home</Link>
            <span aria-hidden="true"> / </span>
            <Link to="/guides" className="hover:text-white">Guides</Link>
            <span aria-hidden="true"> / </span>
            <span aria-current="page" className="text-slate-300">{guide.shortTitle}</span>
          </nav>

          <h1 className="text-4xl font-bold text-white tracking-tight">{title}</h1>
          <p className="mt-3 text-sm text-slate-500">
            Last reviewed <time dateTime={guide.reviewed}>{formatReviewed(guide.reviewed)}</time> by{' '}
            {SITE.operator.knownAs}. Sources are listed at the end.
          </p>

          <div id="in-short" className="mt-8 bg-slate-800/50 border border-slate-700 rounded-xl p-6">
            <h2 className="text-lg font-semibold text-white">In short</h2>
            <div className={`mt-3 ${prose}`}>{inShort}</div>
          </div>

          <nav aria-label="On this page" className="mt-8 border-l-2 border-slate-700 pl-5">
            <h2 className="text-sm font-semibold text-white mb-3">On this page</h2>
            <ol className="list-decimal list-inside space-y-1 text-sm">
              {sections.map((section) => (
                <li key={section.id}>
                  <a href={`#${section.id}`} className="text-green-500 hover:text-green-400">{section.heading}</a>
                </li>
              ))}
              <li>
                <a href="#sources" className="text-green-500 hover:text-green-400">Sources</a>
              </li>
            </ol>
          </nav>

          {sections.map((section) => (
            <section key={section.id} id={section.id} aria-labelledby={`${section.id}-heading`} className="mt-12 scroll-mt-8">
              <h2 id={`${section.id}-heading`} className="text-2xl font-semibold text-white">{section.heading}</h2>
              <div className={`mt-4 ${prose}`}>{section.body}</div>
            </section>
          ))}

          <aside aria-labelledby="feature-heading" className="mt-14 bg-green-950/40 border border-green-800 rounded-xl p-6">
            <h2 id="feature-heading" className="text-xl font-semibold text-white">{feature.heading}</h2>
            <p className="mt-3 text-slate-300 leading-relaxed">{feature.text}</p>
            <Link
              to={feature.to}
              className="mt-4 inline-flex items-center gap-2 text-green-400 hover:text-green-300 font-medium focus:outline-none focus-visible:ring-2 focus-visible:ring-green-500 rounded"
            >
              See how ShootSync does it <ArrowRight className="w-4 h-4" aria-hidden="true" />
            </Link>
          </aside>

          <section id="sources" aria-labelledby="sources-heading" className="mt-14 scroll-mt-8">
            <h2 id="sources-heading" className="text-2xl font-semibold text-white">Sources</h2>
            {adviceNote && <div className="mt-4 text-sm text-slate-400 border-l-2 border-amber-600 pl-4">{adviceNote}</div>}
            <ol className="mt-4 list-decimal pl-6 space-y-2 text-sm text-slate-400">
              {sources.map((source) => (
                <li key={source.url}>
                  <a href={source.url} rel="noopener" className="text-green-500 underline underline-offset-2 hover:text-green-400 break-words">
                    {source.label}
                  </a>
                </li>
              ))}
            </ol>
            <p className="mt-6 text-sm text-slate-500">
              Spotted something out of date? Email <a href={`mailto:${SITE.email}`} className="text-green-500 underline underline-offset-2">{SITE.email}</a> and
              we will check it and correct the page.
            </p>
          </section>

          <p className="mt-12 text-sm">
            <Link to="/guides" className="text-green-500 hover:text-green-400">← All guides for shoot captains</Link>
          </p>
        </div>
      </article>
    </PublicLayout>
  )
}
