/**
 * Built-site check (Standard §05, §18.7): reads what was actually built, not the source.
 * Runs inside `npm run build`, so a failure stops the deploy on Railway as well as in CI.
 *
 * For every prerendered public page:
 *   - the real page content is in the HTML (not an empty shell)
 *   - exactly one <h1>
 *   - title and description present and within length
 *   - canonical, Open Graph and Twitter tags present, canonical correct
 *   - every JSON-LD block parses
 *   - every internal link goes to a real page, and every #anchor exists on its page
 *   - every asset referenced (scripts, styles, images, og:image, JSON-LD urls) exists in dist
 *   - no script, style, font or image is loaded from another site (§05.3)
 * Plus: sitemap lists exactly the public pages, robots.txt points at it,
 * og-image.png is a real 1200x630 PNG, and the app shell is noindex.
 */

import { existsSync, readFileSync } from 'node:fs'
import path from 'node:path'

const dist = path.join(process.cwd(), 'dist')
const SITE = 'https://shootsync.co.uk'
const APP_ROUTES = new Set(['/login', '/signup'])
const problems = []
const fail = (page, message) => problems.push(`${page}: ${message}`)

const read = (file) => readFileSync(path.join(dist, file), 'utf8')
const manifest = JSON.parse(read('prerendered/manifest.json'))
const pages = Object.fromEntries(Object.entries(manifest).map(([route, file]) => [route, read(`prerendered/${file}`)]))

const attr = (html, regex) => (regex.exec(html) ?? [])[1]
const decode = (s) => s.replace(/&amp;/g, '&').replace(/&#x27;|&#39;/g, "'").replace(/&quot;/g, '"').replace(/&lt;/g, '<').replace(/&gt;/g, '>')
const metaContent = (html, key) => {
  const m = new RegExp(`<meta[^>]+(?:name|property)="${key}"[^>]*content="([^"]*)"`, 'i').exec(html)
    ?? new RegExp(`<meta[^>]+content="([^"]*)"[^>]*(?:name|property)="${key}"`, 'i').exec(html)
  return m ? decode(m[1]) : undefined
}
const ids = (html) => new Set([...html.matchAll(/\sid="([^"]+)"/g)].map((m) => m[1]))

function assetExists(url) {
  const clean = url.split('#')[0].split('?')[0]
  return existsSync(path.join(dist, decodeURIComponent(clean)))
}

for (const [route, html] of Object.entries(pages)) {
  const body = html.split('<div id="root">')[1] ?? ''
  if (body.replace(/<[^>]+>/g, '').trim().length < 400) fail(route, 'page content is missing from the HTML')

  const h1s = (body.match(/<h1[\s>]/g) ?? []).length
  if (h1s !== 1) fail(route, `has ${h1s} <h1> elements, expected 1`)

  const titles = [...html.matchAll(/<title[^>]*>([^<]*)<\/title>/g)].map((m) => decode(m[1]))
  if (titles.length !== 1) fail(route, `has ${titles.length} <title> tags`)
  const title = titles[0] ?? ''
  if (title.length < 25 || title.length > 65) fail(route, `title is ${title.length} characters: "${title}"`)

  const description = metaContent(html, 'description') ?? ''
  if (description.length < 110 || description.length > 170) fail(route, `description is ${description.length} characters`)

  const canonical = attr(html, /<link[^>]+rel="canonical"[^>]+href="([^"]+)"/)
  if (canonical !== `${SITE}${route}`) fail(route, `canonical is ${canonical}, expected ${SITE}${route}`)

  for (const key of ['og:title', 'og:description', 'og:url', 'og:image', 'twitter:card', 'twitter:image', 'robots']) {
    if (!metaContent(html, key)) fail(route, `missing ${key}`)
  }
  if (metaContent(html, 'og:title') !== title) fail(route, 'og:title differs from <title>')
  if (!/index, follow/.test(metaContent(html, 'robots') ?? '')) fail(route, 'robots is not index, follow')
  if (/noindex/.test(metaContent(html, 'robots') ?? '')) fail(route, 'public page is noindex')

  for (const m of html.matchAll(/<script[^>]+type="application\/ld\+json"[^>]*>([\s\S]*?)<\/script>/g)) {
    try {
      const data = JSON.parse(m[1])
      for (const url of JSON.stringify(data).match(/https:\/\/shootsync\.co\.uk\/[^"#]+\.(png|jpg|svg|webp)/g) ?? []) {
        if (!assetExists(url.slice(SITE.length))) fail(route, `structured data points at missing ${url}`)
      }
    } catch {
      fail(route, 'a JSON-LD block does not parse')
    }
  }

  for (const key of ['og:image', 'twitter:image']) {
    const url = metaContent(html, key)
    if (url && (!url.startsWith(SITE) || !assetExists(url.slice(SITE.length)))) fail(route, `${key} ${url} does not exist`)
  }

  for (const m of html.matchAll(/<(?:script|link|img|source)[^>]+(?:src|href)="([^"]+)"/g)) {
    const url = m[1]
    if (/^https?:\/\//.test(url) && !url.startsWith(SITE)) fail(route, `loads from another site: ${url}`)
    else if (url.startsWith('/') && !url.startsWith('//') && !/rel="canonical"/.test(m[0]) && !assetExists(url)) {
      fail(route, `references missing file ${url}`)
    }
  }

  for (const m of body.matchAll(/<a[^>]+href="([^"]+)"/g)) {
    const href = decode(m[1])
    if (/^(mailto:|tel:|https?:)/.test(href)) continue
    if (href.startsWith('#')) {
      if (!ids(html).has(href.slice(1))) fail(route, `link to missing anchor ${href}`)
      continue
    }
    const [target, anchor] = href.split('#')
    if (APP_ROUTES.has(target)) continue
    if (!pages[target]) fail(route, `link to ${href}, which is not a public page`)
    else if (anchor && !ids(pages[target]).has(anchor)) fail(route, `link to ${href}, but ${target} has no #${anchor}`)
  }
}

const sitemap = read('sitemap.xml')
const sitemapUrls = [...sitemap.matchAll(/<loc>([^<]+)<\/loc>/g)].map((m) => m[1]).sort()
const expected = Object.keys(pages).map((route) => `${SITE}${route}`).sort()
if (JSON.stringify(sitemapUrls) !== JSON.stringify(expected)) fail('sitemap.xml', `lists ${sitemapUrls.join(', ')}`)

if (!/^Sitemap: https:\/\/shootsync\.co\.uk\/sitemap\.xml$/m.test(read('robots.txt'))) fail('robots.txt', 'does not point at the sitemap')

if (!existsSync(path.join(dist, 'og-image.png'))) {
  fail('og-image.png', 'does not exist')
} else {
  const png = readFileSync(path.join(dist, 'og-image.png'))
  if (png.toString('ascii', 1, 4) !== 'PNG' || png.readUInt32BE(16) !== 1200 || png.readUInt32BE(20) !== 630) {
    fail('og-image.png', 'is not a 1200x630 PNG')
  }
}

const shell = read('index.html')
if (!/<meta name="robots" content="noindex, follow"/.test(shell)) fail('index.html', 'app shell must be noindex')

if (problems.length > 0) {
  console.error(`Built-site check failed (${problems.length}):\n  - ${problems.join('\n  - ')}`)
  process.exit(1)
}
console.log(`Built-site check passed: ${Object.keys(pages).length} public pages, sitemap, robots.txt, og-image.`)
