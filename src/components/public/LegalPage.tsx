/**
 * Legal Page - shared layout for Privacy, Terms and Contact.
 */

import type { ReactNode } from 'react'
import { Link } from 'react-router-dom'
import PublicLayout from './PublicLayout'

export interface LegalSection {
  id: string
  heading: string
  body: ReactNode
}

interface LegalPageProps {
  title: string
  intro: ReactNode
  updated?: string
  sections: LegalSection[]
  breadcrumb: string
}

export default function LegalPage({ title, intro, updated, sections, breadcrumb }: LegalPageProps) {
  return (
    <PublicLayout>
      <article className="px-4 py-16 sm:py-24">
        <div className="max-w-3xl mx-auto">
          <nav aria-label="Breadcrumb" className="text-sm text-slate-500 mb-6">
            <Link to="/" className="hover:text-white">Home</Link>
            <span aria-hidden="true"> / </span>
            <span aria-current="page" className="text-slate-300">{breadcrumb}</span>
          </nav>
          <h1 className="text-4xl font-bold text-white tracking-tight">{title}</h1>
          {updated && <p className="mt-3 text-sm text-slate-500">Last updated {updated}</p>}
          <div className="mt-6 text-slate-300 leading-relaxed space-y-4">{intro}</div>

          {sections.length > 2 && (
            <nav aria-label="On this page" className="mt-10 bg-slate-800/50 border border-slate-700 rounded-xl p-5">
              <h2 className="text-sm font-semibold text-white mb-3">On this page</h2>
              <ol className="list-decimal list-inside space-y-1 text-sm">
                {sections.map((section) => (
                  <li key={section.id}>
                    <a href={`#${section.id}`} className="text-green-500 hover:text-green-400">{section.heading}</a>
                  </li>
                ))}
              </ol>
            </nav>
          )}

          {sections.map((section) => (
            <section key={section.id} id={section.id} aria-labelledby={`${section.id}-heading`} className="mt-12 scroll-mt-8">
              <h2 id={`${section.id}-heading`} className="text-2xl font-semibold text-white">{section.heading}</h2>
              <div className="mt-4 text-slate-300 leading-relaxed space-y-4 [&_ul]:list-disc [&_ul]:pl-6 [&_ul]:space-y-2 [&_a]:text-green-500 [&_a]:underline [&_a]:underline-offset-2">
                {section.body}
              </div>
            </section>
          ))}
        </div>
      </article>
    </PublicLayout>
  )
}
