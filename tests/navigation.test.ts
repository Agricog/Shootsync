/**
 * A page that is built is in the navigation (Standard §18.11).
 *
 * Every public page must be reachable by a reader, not only by Google through the sitemap:
 * the home page from the logo, the header's pages from the header list in PublicLayout,
 * guides from the /guides hub, tools from the footer's tools list, and the legal pages from
 * the footer. This fails both ways: a page with no way in, and an entry with no page.
 * The header list is read from PublicLayout.tsx itself, so the test checks what ships (§18.13).
 */

import { describe, it } from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { PUBLIC_ROUTES, TOOLS } from '../src/config/site.js'
import { GUIDES } from '../src/content/guides.js'

const root = path.join(path.dirname(fileURLToPath(import.meta.url)), '..')
const layout = readFileSync(path.join(root, 'src/components/public/PublicLayout.tsx'), 'utf8')

/** The header list: `const NAV = [ { to: '/features', ... }, ... ]`. */
export function headerPaths(source: string): string[] {
  const block = /const NAV = \[([\s\S]*?)\] as const/.exec(source)?.[1] ?? ''
  return [...block.matchAll(/to: '([^']+)'/g)].map((m) => m[1])
}

/** Links written straight into the footer's markup, e.g. the legal pages: `<Link to="/privacy"`. */
export function footerLinkPaths(source: string): string[] {
  const footer = source.split('<footer')[1] ?? ''
  return [...footer.matchAll(/<Link to="([^"]+)"/g)].map((m) => m[1])
}

/** The home page is reached from the logo on every page. */
const LOGO = ['/']
/** App pages linked from public pages, which are not public pages themselves. */
const APP_PAGES = new Set(['/signup', '/login'])

describe('every public page is in the navigation', () => {
  const header = headerPaths(layout)
  const footer = footerLinkPaths(layout).filter((p) => !APP_PAGES.has(p))
  const tools = TOOLS.map((tool) => tool.path)
  const guides = GUIDES.map((guide) => guide.path)
  const routes = PUBLIC_ROUTES.map((route) => route.path as string)

  it('reads the header and footer, not nothing', () => {
    assert.ok(header.length >= 3, `header read as ${JSON.stringify(header)}`)
    assert.ok(footer.length >= 2, `footer read as ${JSON.stringify(footer)}`)
    assert.ok(tools.length >= 1)
  })

  it('every public page has a way in', () => {
    const reachable = new Set([...LOGO, ...header, ...footer, ...tools, ...guides])
    const missing = routes.filter((route) => !reachable.has(route))
    assert.deepEqual(missing, [], `no link to: ${missing.join(', ')}`)
  })

  it('every navigation entry is a public page', () => {
    const routeSet = new Set(routes)
    const orphans = [...header, ...footer, ...tools, ...guides].filter((entry) => !routeSet.has(entry))
    assert.deepEqual(orphans, [], `links to pages that are not built: ${orphans.join(', ')}`)
  })

  it('the footer renders the tools list, so a tool in the list is really linked from every page', () => {
    const footerSource = layout.split('<footer')[1] ?? ''
    assert.match(footerSource, /\{TOOLS\.map\(\(tool\) => \([\s\S]*?<Link to=\{tool\.path\}/)
  })

  it('every /tools page is in the tools list, once, and the list holds nothing else', () => {
    const toolRoutes = routes.filter((route) => route.startsWith('/tools/')).sort()
    assert.deepEqual([...tools].sort(), toolRoutes)
    assert.equal(new Set(tools).size, tools.length)
  })

  it('no page is in the header twice', () => {
    assert.equal(new Set(header).size, header.length)
  })

  it('the header stays at four links, so it still fits a phone (§18.10); tools live in the footer', () => {
    assert.equal(header.length, 4)
  })
})

describe('the navigation reader itself', () => {
  it('finds header entries and footer links in a layout like ours', () => {
    const sample = `const NAV = [\n  { to: '/a', label: 'A' },\n  { to: '/b', label: 'B' },\n] as const\n<header><Link to="/x" /></header><footer><Link to="/privacy" /><Link to="/terms" /></footer>`
    assert.deepEqual(headerPaths(sample), ['/a', '/b'])
    assert.deepEqual(footerLinkPaths(sample), ['/privacy', '/terms'])
  })

  it('reads an empty list as empty, so a renamed list cannot pass quietly', () => {
    assert.deepEqual(headerPaths('const MENU = []'), [])
    assert.deepEqual(footerLinkPaths('<header></header>'), [])
  })
})
