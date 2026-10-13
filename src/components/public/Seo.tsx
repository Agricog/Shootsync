/**
 * Seo - the complete head for one public page (Autaimate Build Standard §05.1).
 * Every public page uses this, so no page can ship half a set of tags.
 * Rendered into static HTML at build time (scripts/prerender.mjs), so link
 * previews and crawlers get it without running JavaScript (§05.5).
 */

import { Helmet } from 'react-helmet-async'
import { SITE, absoluteUrl } from '../../config/site'

interface SeoProps {
  /** 50-60 characters. */
  title: string
  /** 120-160 characters. */
  description: string
  path: string
  jsonLd?: object[]
  noindex?: boolean
  /** 'article' for guides, so link previews and crawlers know it is an article. */
  type?: 'website' | 'article'
}

export default function Seo({ title, description, path, jsonLd = [], noindex = false, type = 'website' }: SeoProps) {
  const url = absoluteUrl(path)
  const image = `${SITE.url}${SITE.ogImage}`

  return (
    <Helmet prioritizeSeoTags>
      <html lang="en-GB" />
      <title>{title}</title>
      <meta name="description" content={description} />
      <link rel="canonical" href={url} />
      <meta
        name="robots"
        content={noindex ? 'noindex, follow' : 'index, follow, max-image-preview:large, max-snippet:-1, max-video-preview:-1'}
      />

      <meta property="og:type" content={type} />
      <meta property="og:site_name" content={SITE.name} />
      <meta property="og:locale" content={SITE.locale} />
      <meta property="og:title" content={title} />
      <meta property="og:description" content={description} />
      <meta property="og:url" content={url} />
      <meta property="og:image" content={image} />
      <meta property="og:image:width" content="1200" />
      <meta property="og:image:height" content="630" />
      <meta property="og:image:alt" content={SITE.ogImageAlt} />

      <meta name="twitter:card" content="summary_large_image" />
      <meta name="twitter:title" content={title} />
      <meta name="twitter:description" content={description} />
      <meta name="twitter:image" content={image} />
      <meta name="twitter:image:alt" content={SITE.ogImageAlt} />

      <meta name="author" content={`${SITE.operator.legalName}, ${SITE.operator.tradingAs}`} />

      {jsonLd.map((data, index) => (
        <script key={index} type="application/ld+json">
          {JSON.stringify(data)}
        </script>
      ))}
    </Helmet>
  )
}
