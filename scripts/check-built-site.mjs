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
 * For every guide (/guides/*): a "Last reviewed" date, at least two cited sources,
 *   Article structured data with the same date, og:type article, and a link from /guides.
 * For every tool (/tools/*): a "Last checked" date, at least two sources, a quick answer of
 *   120-160 characters, WebApplication data, FAQPage data matching the questions shown, and a
 *   link from every page's footer.
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

// Each page has the copy built for today and, where its content changes on a date, a dated copy
// for that date (scripts/prerender.mjs). Every copy is checked; links are checked against today's.
const copies = []
for (const [route, entries] of Object.entries(manifest)) {
  if (!Array.isArray(entries) || entries.length === 0 || entries[0].from !== undefined) {
    fail(route, 'manifest entry must be a list of copies, starting with the build-day copy')
    continue
  }
  let previous = ''
  for (const entry of entries) {
    if (!/^[a-z0-9-]+\.html$/.test(entry.file ?? '')) fail(route, `unsafe file name ${entry.file}`)
    if (entry.from !== undefined && (!/^\d{4}-\d{2}-\d{2}$/.test(entry.from) || entry.from <= previous)) fail(route, `dated copy has a bad or out-of-order date ${entry.from}`)
    if (entry.from) previous = entry.from
    const label = entry.from ? `${route} (copy from ${entry.from})` : route
    copies.push({ route, label, from: entry.from, html: read(`prerendered/${entry.file}`) })
  }
}
const pages = Object.fromEntries(copies.filter((copy) => !copy.from).map((copy) => [copy.route, copy.html]))

// A dated copy exists only because the page changes on that date; today the only such change is
// the minimum wage rates lapsing, so every dated copy must show the review notice.
for (const copy of copies.filter((c) => c.from)) {
  if (!copy.html.includes('The minimum wage rates have changed')) fail(copy.label, 'dated copy does not show the rates review notice')
}
// The other way round: a page that shows rates marks them data-rates-until="<date>" (Standard §05.7).
// It must have a dated copy from that date which no longer shows them, or the served page would keep
// the old rates after they lapse until someone rebuilt.
const buildDay = new Intl.DateTimeFormat('en-CA', { timeZone: 'Europe/London' }).format(new Date())
for (const [route, entries] of Object.entries(manifest)) {
  const routeCopies = copies.filter((copy) => copy.route === route)
  for (const until of new Set([...(routeCopies[0]?.html ?? '').matchAll(/data-rates-until="(\d{4}-\d{2}-\d{2})"/g)].map((m) => m[1]))) {
    if (until <= buildDay) continue
    const dated = routeCopies.find((copy) => copy.from === until)
    if (!Array.isArray(entries) || !dated) fail(route, `shows rates until ${until} but has no copy from ${until}`)
    else if (dated.html.includes(`data-rates-until="${until}"`)) fail(route, `its copy from ${until} still shows the rates that lapse that day`)
  }
}

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

for (const { route, label, html } of copies) {
  const fail = (_page, message) => problems.push(`${label}: ${message}`)
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

// Guides (§05 trust signals): every guide carries its review date, cites sources,
// is marked up as an Article with the same date, and is listed on the /guides hub.
const guideRoutes = Object.keys(pages).filter((route) => route.startsWith('/guides/'))
for (const { route, label, html } of copies.filter((copy) => copy.route.startsWith('/guides/'))) {
  const fail = (_page, message) => problems.push(`${label}: ${message}`)
  const reviewed = attr(html, /Last reviewed <time datetime="(\d{4}-\d{2}-\d{2})"/i)
  if (!reviewed) fail(route, 'guide has no "Last reviewed" date')
  const sources = html.split('id="sources"')[1]
  const cited = sources ? [...sources.split('</section>')[0].matchAll(/<a[^>]+href="(https:\/\/[^"]+)"/g)].length : 0
  if (cited < 2) fail(route, `guide cites ${cited} sources, expected at least 2`)
  let article
  for (const m of html.matchAll(/<script[^>]+type="application\/ld\+json"[^>]*>([\s\S]*?)<\/script>/g)) {
    try {
      const data = JSON.parse(m[1])
      if (data['@type'] === 'Article') article = data
    } catch {
      // reported above
    }
  }
  if (!article) fail(route, 'guide has no Article structured data')
  else if (article.dateModified !== reviewed) fail(route, `Article dateModified ${article.dateModified} differs from the page's reviewed date ${reviewed}`)
  if (metaContent(html, 'og:type') !== 'article') fail(route, 'og:type is not article')
  if (pages['/guides'] && !pages['/guides'].includes(`href="${route}"`)) problems.push(`/guides: does not link to ${route}`)
}
if (pages['/guides'] && guideRoutes.length === 0) fail('/guides', 'hub has no guides')

// Tools (§05.1, §05.7): every free tool shows when its figures were last checked, cites at
// least two sources, has a quick answer of 120-160 characters, and publishes its questions as
// FAQPage structured data that matches the questions on the page, one for one. Every tool is
// linked from the footer, so it is reachable from every page (§18.11).
const text = (fragment) => decode(fragment.replace(/<[^>]+>/g, '')).replace(/\s+/g, ' ').trim()
for (const { route, label, html } of copies.filter((copy) => copy.route.startsWith('/tools/'))) {
  const fail = (_page, message) => problems.push(`${label}: ${message}`)
  if (!/Last checked against GOV\.UK on <time datetime="\d{4}-\d{2}-\d{2}"/i.test(html)) fail(route, 'tool has no "Last checked" date')
  const sources = html.split('id="sources"')[1]
  const cited = sources ? new Set([...sources.split('</section>')[0].matchAll(/<a[^>]+href="(https:\/\/[^"]+)"/g)].map((m) => m[1])).size : 0
  if (cited < 2) fail(route, `tool cites ${cited} different sources, expected at least 2`)

  const quick = /<div id="quick-answer"[^>]*>[\s\S]*?<p[^>]*>([\s\S]*?)<\/p>/.exec(html)
  const quickText = quick ? text(quick[1]) : ''
  if (quickText.length < 120 || quickText.length > 160) fail(route, `quick answer is ${quickText.length} characters, expected 120-160`)

  const blocks = []
  for (const m of html.matchAll(/<script[^>]+type="application\/ld\+json"[^>]*>([\s\S]*?)<\/script>/g)) {
    try {
      blocks.push(JSON.parse(m[1]))
    } catch {
      // reported above
    }
  }
  if (!blocks.some((data) => data['@type'] === 'WebApplication')) fail(route, 'tool has no WebApplication structured data')
  const faqPage = blocks.find((data) => data['@type'] === 'FAQPage')
  const questionsHtml = (html.split('id="questions"')[1] ?? '').split('</section>')[0]
  const shown = [...questionsHtml.matchAll(/<h3[^>]*>([\s\S]*?)<\/h3>/g)].map((m) => text(m[1]))
  const published = faqPage ? faqPage.mainEntity.map((q) => q.name) : []
  if (shown.length < 10 || shown.length > 15) fail(route, `tool shows ${shown.length} questions, expected 10-15`)
  if (JSON.stringify(shown) !== JSON.stringify(published)) fail(route, 'FAQPage structured data does not match the questions on the page')

  for (const [other, otherHtml] of Object.entries(pages)) {
    const footer = otherHtml.split('<footer')[1] ?? ''
    if (!footer.includes(`href="${route}"`)) {
      problems.push(`${other}: footer does not link to the tool ${route}`)
      break
    }
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
console.log(`Built-site check passed: ${Object.keys(pages).length} public pages, ${copies.length - Object.keys(pages).length} dated copies, sitemap, robots.txt, og-image.`)
