/**
 * Public site: one price list, and the server serving prerendered pages safely.
 */

import { after, before, describe, it } from 'node:test'
import assert from 'node:assert/strict'
import { mkdtempSync, mkdirSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import path from 'node:path'
import type { Server } from 'node:http'
import type { AddressInfo } from 'node:net'
import type { PrismaClient } from '@prisma/client'
import { PLANS, BILLING_TERMS } from '../src/config/plans.js'
import { PUBLIC_ROUTES } from '../src/config/site.js'
import { GUIDES, formatReviewed } from '../src/content/guides.js'
import { PLAN_PRICES_PENCE } from '../server/plans.js'
import { createApp, currentCopy, londonToday } from '../server/app.js'
import { londonDate } from '../src/utils/beaterPayCalculator.js'
import { createTestStripe, testConfig, testVerifier } from './helpers.js'

describe('plans', () => {
  it('the website prices and the server prices are the same list', () => {
    assert.deepEqual(
      Object.fromEntries(PLANS.map((plan) => [plan.tier, plan.monthlyPrice * 100])),
      PLAN_PRICES_PENCE
    )
  })

  it('every plan the website sells has a Stripe price configured', () => {
    for (const plan of PLANS) assert.ok(testConfig.stripePriceIds[plan.tier], `${plan.tier} has no price ID`)
  })

  it('no free trial is offered, so none is advertised', () => {
    assert.equal(BILLING_TERMS.freeTrial, false)
  })
})

describe('public routes and guides', () => {
  it('every public route has a unique path and a safe, unique file name', () => {
    const paths = PUBLIC_ROUTES.map((route) => route.path)
    const files = PUBLIC_ROUTES.map((route) => route.file)
    assert.equal(new Set(paths).size, paths.length)
    assert.equal(new Set(files).size, files.length)
    for (const file of files) assert.match(file, /^[a-z0-9-]+$/, `unsafe file name ${file}`)
  })

  it('every guide is a public page, and every public page under /guides is a guide', () => {
    const routes = new Set<string>(PUBLIC_ROUTES.map((route) => route.path))
    for (const guide of GUIDES) assert.ok(routes.has(guide.path), `${guide.path} is not in PUBLIC_ROUTES`)
    const guidePaths = new Set<string>(GUIDES.map((guide) => guide.path))
    for (const route of routes) {
      if (route.startsWith('/guides/')) assert.ok(guidePaths.has(route), `${route} is not in GUIDES`)
    }
    assert.ok(routes.has('/guides'), 'the /guides hub is not a public page')
  })

  it('no guide has gone more than a year without its facts being checked', () => {
    // Minimum wage rates change every April and season dates are reviewed each summer.
    // When this fails: re-check the guide against its sources, then update `reviewed`.
    const now = Date.now()
    for (const guide of GUIDES) {
      const reviewed = Date.parse(`${guide.reviewed}T00:00:00Z`)
      assert.ok(Number.isFinite(reviewed), `${guide.path} has an invalid reviewed date`)
      assert.ok(reviewed <= now, `${guide.path} is reviewed in the future`)
      assert.ok(now - reviewed < 366 * 24 * 60 * 60 * 1000, `${guide.path} was last reviewed ${guide.reviewed}: re-check it`)
    }
  })

  it('review dates read the same on the server and in the browser', () => {
    assert.equal(formatReviewed('2026-10-13'), '13 October 2026')
    assert.equal(formatReviewed('2027-01-01'), '1 January 2027')
  })
})

describe('serving the built site', () => {
  let dir: string
  let server: Server
  let base: string

  before(async () => {
    dir = mkdtempSync(path.join(tmpdir(), 'shootsync-site-'))
    writeFileSync(path.join(dir, 'index.html'), 'APP SHELL')
    mkdirSync(path.join(dir, 'prerendered'))
    writeFileSync(path.join(dir, 'prerendered', 'home.html'), 'HOME PAGE')
    writeFileSync(path.join(dir, 'prerendered', 'features.html'), 'FEATURES PAGE')
    writeFileSync(path.join(dir, 'prerendered', 'guide-peg-draw-explained.html'), 'GUIDE PAGE')
    writeFileSync(
      path.join(dir, 'prerendered', 'manifest.json'),
      JSON.stringify({ '/': 'home.html', '/features': 'features.html', '/guides/peg-draw-explained': 'guide-peg-draw-explained.html', '/evil': '../../etc/passwd' })
    )
    mkdirSync(path.join(dir, 'server'))
    writeFileSync(path.join(dir, 'server', 'index.js'), 'SERVER SOURCE')
    writeFileSync(path.join(dir, 'robots.txt'), 'User-agent: *')

    const { stripe } = createTestStripe()
    const app = createApp({ prisma: {} as PrismaClient, stripe, config: testConfig, verifyToken: testVerifier, staticDir: dir })
    server = await new Promise((resolve) => {
      const s = app.listen(0, '127.0.0.1', () => resolve(s))
    })
    base = `http://127.0.0.1:${(server.address() as AddressInfo).port}`
  })

  after(async () => {
    await new Promise((resolve) => server.close(resolve))
    rmSync(dir, { recursive: true, force: true })
  })

  const get = (p: string) => fetch(`${base}${p}`, { redirect: 'manual' })

  it('serves each public page as its prerendered HTML', async () => {
    assert.equal(await (await get('/')).text(), 'HOME PAGE')
    assert.equal(await (await get('/features')).text(), 'FEATURES PAGE')
  })

  it('serves a guide at its nested address', async () => {
    assert.equal(await (await get('/guides/peg-draw-explained')).text(), 'GUIDE PAGE')
    const res = await get('/guides/peg-draw-explained/')
    assert.equal(res.status, 301)
    assert.equal(res.headers.get('location'), '/guides/peg-draw-explained')
  })

  it('serves the app shell for app pages', async () => {
    assert.equal(await (await get('/dashboard')).text(), 'APP SHELL')
  })

  it('never serves the compiled server or a second copy of the pages', async () => {
    assert.equal((await get('/server/index.js')).status, 404)
    assert.equal((await get('/prerendered/home.html')).status, 404)
  })

  it('ignores a manifest entry that tries to leave the prerendered folder', async () => {
    assert.equal(await (await get('/evil')).text(), 'APP SHELL')
  })

  it('redirects a trailing slash to the one canonical address, keeping the query', async () => {
    const res = await get('/features/?ref=x')
    assert.equal(res.status, 301)
    assert.equal(res.headers.get('location'), '/features?ref=x')
  })

  it('a doubled leading slash can never become an off-site redirect', async () => {
    const res = await get('//evil.example/')
    if (res.status === 301) assert.ok(res.headers.get('location')!.startsWith('/') && !res.headers.get('location')!.startsWith('//'))
  })

  it('serves robots.txt as a file, not the app', async () => {
    assert.equal(await (await get('/robots.txt')).text(), 'User-agent: *')
  })
})

describe('serving the copy of a page that is current today (Standard §05.7)', () => {
  let dir: string
  let server: Server
  let base: string
  let today = '2027-03-31'

  before(async () => {
    dir = mkdtempSync(path.join(tmpdir(), 'shootsync-dated-'))
    writeFileSync(path.join(dir, 'index.html'), 'APP SHELL')
    mkdirSync(path.join(dir, 'prerendered'))
    writeFileSync(path.join(dir, 'prerendered', 'tool.html'), 'RATES 2026')
    writeFileSync(path.join(dir, 'prerendered', 'tool--2027-04-01.html'), 'REVIEW NOTICE')
    writeFileSync(path.join(dir, 'prerendered', 'home.html'), 'HOME PAGE')
    writeFileSync(
      path.join(dir, 'prerendered', 'manifest.json'),
      JSON.stringify({
        '/tools/calc': [{ file: 'tool.html' }, { from: '2027-04-01', file: 'tool--2027-04-01.html' }],
        '/': 'home.html',
        '/bad-date': [{ file: 'home.html' }, { from: '1 April', file: 'tool--2027-04-01.html' }],
        '/escape': [{ file: 'home.html' }, { from: '2000-01-01', file: '../../etc/passwd' }],
        '/no-base': [{ from: '2000-01-01', file: 'home.html' }],
      })
    )
    const { stripe } = createTestStripe()
    const app = createApp({ prisma: {} as PrismaClient, stripe, config: testConfig, verifyToken: testVerifier, staticDir: dir, today: () => today })
    server = await new Promise((resolve) => {
      const s = app.listen(0, '127.0.0.1', () => resolve(s))
    })
    base = `http://127.0.0.1:${(server.address() as AddressInfo).port}`
  })

  after(async () => {
    await new Promise((resolve) => server.close(resolve))
    rmSync(dir, { recursive: true, force: true })
  })

  const text = async (p: string) => (await fetch(`${base}${p}`)).text()

  it('serves the build-day copy up to the day before, and the dated copy from that day', async () => {
    today = '2027-03-31'
    assert.equal(await text('/tools/calc'), 'RATES 2026')
    today = '2027-04-01'
    assert.equal(await text('/tools/calc'), 'REVIEW NOTICE')
    today = '2030-01-01'
    assert.equal(await text('/tools/calc'), 'REVIEW NOTICE')
  })

  it('still reads a manifest written in the older shape (path to file name)', async () => {
    assert.equal(await text('/'), 'HOME PAGE')
  })

  it('ignores a dated copy with a bad date or an unsafe file name', async () => {
    today = '2030-01-01'
    assert.equal(await text('/bad-date'), 'HOME PAGE')
    assert.equal(await text('/escape'), 'HOME PAGE')
  })

  it('a page with no build-day copy is not served from the manifest at all', async () => {
    assert.equal(await text('/no-base'), 'APP SHELL')
  })

  it('picks the latest copy whose date has come', () => {
    const copies = [{ from: '', file: 'a.html' }, { from: '2027-04-01', file: 'b.html' }, { from: '2028-04-01', file: 'c.html' }]
    assert.equal(currentCopy(copies, '2027-03-31').file, 'a.html')
    assert.equal(currentCopy(copies, '2027-04-01').file, 'b.html')
    assert.equal(currentCopy(copies, '2028-03-31').file, 'b.html')
    assert.equal(currentCopy(copies, '2028-04-01').file, 'c.html')
  })

  it('the server and the pages agree on the UK date, either side of midnight in summer and winter', () => {
    for (const instant of ['2027-03-31T22:59:59Z', '2027-03-31T23:00:00Z', '2026-12-31T23:59:59Z', '2027-01-01T00:00:00Z']) {
      assert.equal(londonToday(new Date(instant)), londonDate(new Date(instant)), instant)
    }
    assert.equal(londonToday(new Date('2027-03-31T23:00:00Z')), '2027-04-01')
  })
})
