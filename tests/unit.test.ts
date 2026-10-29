/**
 * Unit tests that need no database: configuration, rate limiting, and the service worker.
 */

import { describe, it } from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import vm from 'node:vm'
import { ConfigError, loadConfig } from '../server/config.js'
import { rateLimit } from '../server/rateLimit.js'

const FULL_ENV = {
  DATABASE_URL: 'postgresql://x',
  CLERK_SECRET_KEY: 'sk_test_x',
  STRIPE_SECRET_KEY: 'sk_test_x',
  STRIPE_WEBHOOK_SECRET: 'whsec_x',
  STRIPE_PRICE_STARTER: 'price_a',
  STRIPE_PRICE_STANDARD: 'price_b',
}

describe('configuration', () => {
  it('refuses to start without every secret, and names the missing ones', () => {
    assert.throws(
      () => loadConfig({ ...FULL_ENV, CLERK_SECRET_KEY: '', STRIPE_WEBHOOK_SECRET: undefined }),
      (err: unknown) => err instanceof ConfigError && err.missing.join(',') === 'CLERK_SECRET_KEY,STRIPE_WEBHOOK_SECRET'
    )
  })

  it('treats a whitespace-only secret as missing', () => {
    assert.throws(() => loadConfig({ ...FULL_ENV, STRIPE_SECRET_KEY: '   ' }), ConfigError)
  })

  it('defaults the site address and allows only that origin', () => {
    const config = loadConfig(FULL_ENV)
    assert.equal(config.frontendUrl, 'https://shootsync.co.uk')
    assert.deepEqual(config.allowedOrigins, ['https://shootsync.co.uk'])
  })

  it('adds extra origins and normalises them to bare origins', () => {
    const config = loadConfig({ ...FULL_ENV, FRONTEND_URL: 'https://shootsync.co.uk/', ALLOWED_ORIGINS: 'https://www.shootsync.co.uk/path, https://shootsync.co.uk' })
    assert.deepEqual(config.allowedOrigins, ['https://shootsync.co.uk', 'https://www.shootsync.co.uk'])
  })
})

describe('rate limit', () => {
  function run(limiter: ReturnType<typeof rateLimit>, ip = '1.1.1.1') {
    let status = 200
    let passed = false
    const res: any = {
      set: () => res,
      status: (code: number) => {
        status = code
        return res
      },
      json: () => res,
    }
    limiter({ ip } as any, res, () => {
      passed = true
    })
    return passed ? 200 : status
  }

  it('allows up to the limit, then answers 429, per client', () => {
    let time = 0
    const limiter = rateLimit({ windowMs: 1000, max: 3, now: () => time })
    assert.deepEqual([run(limiter), run(limiter), run(limiter), run(limiter)], [200, 200, 200, 429])
    assert.equal(run(limiter, '2.2.2.2'), 200)
    time = 1001
    assert.equal(run(limiter), 200)
  })

  it('ignores requests it does not apply to', () => {
    const limiter = rateLimit({ windowMs: 1000, max: 1, applies: () => false })
    assert.deepEqual([run(limiter), run(limiter), run(limiter)], [200, 200, 200])
  })
})

describe('service worker', () => {
  const source = readFileSync(fileURLToPath(new URL('../public/sw.js', import.meta.url)), 'utf8')

  function loadWorker(pages: Record<string, string> = {}) {
    const listeners: Record<string, (event: any) => void> = {}
    const deleted: string[] = []
    const stored: Record<string, string> = {}
    const self = {
      location: { origin: 'https://shootsync.co.uk' },
      addEventListener: (type: string, fn: (event: any) => void) => {
        listeners[type] = fn
      },
      skipWaiting: () => undefined,
      clients: { claim: () => undefined },
      registration: { showNotification: () => undefined },
    }
    const caches = {
      keys: async () => ['shootsync-v1', 'shootsync-v2', 'someone-else'],
      delete: async (key: string) => {
        deleted.push(key)
        return true
      },
      match: async () => undefined,
      open: async () => ({
        put: async (key: string | { url: string }, response: Response) => { stored[typeof key === 'string' ? key : key.url] = await response.text() },
        addAll: async () => undefined,
      }),
    }
    const fetch = async (input: string | { url: string }) => {
      const url = new URL(typeof input === 'string' ? input : input.url, 'https://shootsync.co.uk')
      return new Response(pages[url.pathname] ?? 'ok')
    }
    vm.runInNewContext(source, { self, caches, fetch, URL, Response, console, clients: {} })
    return { listeners, deleted, stored }
  }

  function fetchEvent(url: string, mode = 'cors', method = 'GET') {
    let responded = false
    return {
      event: { request: { url, method, mode }, respondWith: () => { responded = true }, waitUntil: () => undefined },
      responded: () => responded,
    }
  }

  it('never answers an API request from cache', () => {
    const { listeners } = loadWorker()
    for (const path of ['/api/syndicates?captainClerkId=x', '/api/members/abc', '/api/health']) {
      const { event, responded } = fetchEvent(`https://shootsync.co.uk${path}`)
      listeners.fetch(event)
      assert.equal(responded(), false, `${path} was intercepted`)
    }
  })

  it('handles page navigations and build assets', () => {
    const { listeners } = loadWorker()
    const page = fetchEvent('https://shootsync.co.uk/dashboard', 'navigate')
    listeners.fetch(page.event)
    assert.equal(page.responded(), true)
    const asset = fetchEvent('https://shootsync.co.uk/assets/index-abc123.js')
    listeners.fetch(asset.event)
    assert.equal(asset.responded(), true)
  })

  it('keeps only the app shell as the offline fallback, never a prerendered public page', async () => {
    const shell = '<!-- seo:start --><div id="root"></div>'
    const guide = '<!-- seo:start (prerendered from /guides/peg-draw-explained) --><div id="root">Guide</div>'
    const { listeners, stored } = loadWorker({ '/dashboard': shell, '/guides/peg-draw-explained': guide, '/': guide })
    // Install fetches the shell from an app path and stores it as '/'.
    let installed: Promise<unknown> = Promise.resolve()
    listeners.install({ waitUntil: (p: Promise<unknown>) => { installed = p } })
    await installed
    assert.equal(stored['/'], shell)
    // Reading a guide must not replace it.
    const page = fetchEvent('https://shootsync.co.uk/guides/peg-draw-explained', 'navigate')
    listeners.fetch(page.event)
    await new Promise((r) => setTimeout(r, 20))
    assert.equal(stored['/'], shell)
    // Opening an app page refreshes it.
    const app = fetchEvent('https://shootsync.co.uk/shoots', 'navigate')
    const { listeners: l2, stored: s2 } = loadWorker({ '/shoots': shell + '<!-- v2 -->' })
    l2.fetch(app.event)
    await new Promise((r) => setTimeout(r, 20))
    assert.equal(s2['/'], shell + '<!-- v2 -->')
  })

  it('leaves other sites and non-GET requests alone', () => {
    const { listeners } = loadWorker()
    const other = fetchEvent('https://api.clerk.com/v1/me')
    listeners.fetch(other.event)
    assert.equal(other.responded(), false)
    const post = fetchEvent('https://shootsync.co.uk/dashboard', 'navigate', 'POST')
    listeners.fetch(post.event)
    assert.equal(post.responded(), false)
  })

  it('purges only its own caches when told to at sign-out', async () => {
    const { listeners, deleted } = loadWorker()
    let pending: Promise<unknown> = Promise.resolve()
    listeners.message({ data: { type: 'PURGE_CACHES' }, waitUntil: (p: Promise<unknown>) => { pending = p } })
    await pending
    assert.deepEqual(deleted.sort(), ['shootsync-v1', 'shootsync-v2'])
  })
})
