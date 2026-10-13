/**
 * Public site facts - one place, used by every public page, the structured data,
 * the prerender script and the sitemap.
 */

export const SITE = {
  name: 'ShootSync',
  url: 'https://shootsync.co.uk',
  email: 'hello@shootsync.co.uk',
  ogImage: '/og-image.png',
  ogImageAlt: 'ShootSync - shooting syndicate management software for UK shoot captains',
  locale: 'en_GB',
  operator: {
    legalName: 'Michael Stevenson',
    knownAs: 'Mick Stevenson',
    tradingAs: 'Autaimate',
    url: 'https://autaimate.com',
    icoRegistration: 'ZC115961',
    region: 'Cornwall, United Kingdom',
  },
} as const

/** Public, indexable routes. The prerender script renders each one; the sitemap lists each one. */
export const PUBLIC_ROUTES = [
  { path: '/', file: 'home', priority: '1.0' },
  { path: '/features', file: 'features', priority: '0.9' },
  { path: '/pricing', file: 'pricing', priority: '0.9' },
  { path: '/guides', file: 'guides', priority: '0.8' },
  { path: '/guides/paying-beaters-and-pickers-up', file: 'guide-paying-beaters-and-pickers-up', priority: '0.7' },
  { path: '/guides/peg-draw-explained', file: 'guide-peg-draw-explained', priority: '0.7' },
  { path: '/guides/guest-guns', file: 'guide-guest-guns', priority: '0.7' },
  { path: '/guides/shooting-season-dates', file: 'guide-shooting-season-dates', priority: '0.7' },
  { path: '/guides/tipping-the-keeper', file: 'guide-tipping-the-keeper', priority: '0.7' },
  { path: '/contact', file: 'contact', priority: '0.5' },
  { path: '/privacy', file: 'privacy', priority: '0.3' },
  { path: '/terms', file: 'terms', priority: '0.3' },
] as const

export const absoluteUrl = (path: string) => `${SITE.url}${path}`
