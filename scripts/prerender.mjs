/**
 * Prerender the public pages (runs after `vite build`, before the site check).
 *
 * For each route in PUBLIC_ROUTES (src/config/site.ts):
 *   - renders the page to HTML with its full head, as it reads today (UK date)
 *   - writes dist/prerendered/<file>.html, using dist/index.html as the shell
 *   - renders it again as it will read on each date in CONTENT_CHANGE_DATES still to come, and
 *     writes dist/prerendered/<file>--<date>.html where that HTML differs (Standard §05.7)
 * Then writes dist/prerendered/manifest.json (read by the server) and dist/sitemap.xml.
 * Manifest: { "/path": [{ "file": "x.html" }, { "from": "2027-04-01", "file": "x--2027-04-01.html" }] }
 */

import { build } from 'vite'
import { mkdir, readFile, rm, writeFile } from 'node:fs/promises'
import path from 'node:path'
import { pathToFileURL } from 'node:url'

const root = process.cwd()
const dist = path.join(root, 'dist')
const ssrOut = path.join(root, 'dist-ssr')

await build({
  logLevel: 'warn',
  // Bundle every dependency into the prerender build, so CommonJS packages
  // (react-helmet-async) resolve the same way they do in the browser bundle.
  ssr: { noExternal: true },
  build: {
    ssr: 'src/entry-prerender.tsx',
    outDir: ssrOut,
    emptyOutDir: true,
    copyPublicDir: false,
  },
})

const { render, PUBLIC_ROUTES, SITE, CONTENT_CHANGE_DATES, londonDate } = await import(pathToFileURL(path.join(ssrOut, 'entry-prerender.js')).href)
const buildDay = londonDate(new Date())
const changeDates = CONTENT_CHANGE_DATES.filter((date) => date > buildDay)

const shell = await readFile(path.join(dist, 'index.html'), 'utf8')
const SEO_BLOCK = /<!-- seo:start -->[\s\S]*?<!-- seo:end -->/
const ROOT = '<div id="root"></div>'
if (!SEO_BLOCK.test(shell)) throw new Error('dist/index.html has no <!-- seo:start --> ... <!-- seo:end --> block')
if (!shell.includes(ROOT)) throw new Error(`dist/index.html has no ${ROOT}`)

await mkdir(path.join(dist, 'prerendered'), { recursive: true })
const manifest = {}

const pageFor = ({ html, head }, route) =>
  shell
    // Functions, not strings, as replacements: a "$&" or "$'" in page text must stay as typed.
    .replace(SEO_BLOCK, () => `<!-- seo:start (prerendered from ${route.path}) -->\n    ${head}\n    <!-- seo:end -->`)
    .replace(ROOT, () => `<div id="root">${html}</div>`)

for (const route of PUBLIC_ROUTES) {
  let page = pageFor(render(route.path, buildDay), route)
  const file = `${route.file}.html`
  await writeFile(path.join(dist, 'prerendered', file), page)
  manifest[route.path] = [{ file }]
  console.log(`prerendered ${route.path} -> prerendered/${file} (${Math.round(page.length / 1024)} KB)`)

  for (const date of changeDates) {
    const next = pageFor(render(route.path, date), route)
    if (next === page) continue
    const dated = `${route.file}--${date}.html`
    await writeFile(path.join(dist, 'prerendered', dated), next)
    manifest[route.path].push({ from: date, file: dated })
    console.log(`prerendered ${route.path} as from ${date} -> prerendered/${dated}`)
    page = next
  }
}

await writeFile(path.join(dist, 'prerendered', 'manifest.json'), JSON.stringify(manifest, null, 2) + '\n')

const today = new Date().toISOString().slice(0, 10)
const urls = PUBLIC_ROUTES.map(
  (route) =>
    `  <url>\n    <loc>${SITE.url}${route.path}</loc>\n    <lastmod>${today}</lastmod>\n    <priority>${route.priority}</priority>\n  </url>`
).join('\n')
await writeFile(
  path.join(dist, 'sitemap.xml'),
  `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n${urls}\n</urlset>\n`
)
console.log(`sitemap.xml: ${PUBLIC_ROUTES.length} URLs`)

await rm(ssrOut, { recursive: true, force: true })
