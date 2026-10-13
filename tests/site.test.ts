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
import { PLAN_PRICES_PENCE } from '../server/plans.js'
import { createApp } from '../server/app.js'
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
    writeFileSync(path.join(dir, 'prerendered', 'manifest.json'), JSON.stringify({ '/': 'home.html', '/features': 'features.html', '/evil': '../../etc/passwd' }))
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
