/**
 * Service Worker - ShootSync
 * Offline support and caching
 *
 * Rules:
 * - NEVER cache /api/ requests (live data must always come from the server)
 * - Nothing is saved for later: with no signal the app shows the offline page and says so.
 *   (An offline game book is planned; it will live in IndexedDB, not here.)
 * - Page navigations: network first, cached shell / offline page as fallback
 * - Hashed build assets (/assets/*): cache first (filenames change on every deploy)
 * - Everything else: network first, cache as fallback
 *
 * Bump CACHE_NAME whenever this file's caching behaviour changes,
 * so old caches are deleted on activate.
 */

const CACHE_NAME = 'shootsync-v4';
const OFFLINE_URL = '/offline.html';

// The app shell is fetched from an app path, never from '/', which is a prerendered public page.
const APP_SHELL_URL = '/dashboard';
const PRECACHE_ASSETS = ['/offline.html', '/manifest.json'];

// Install - precache the offline page and the app shell (stored as '/')
self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then(async (cache) => {
      await cache.addAll(PRECACHE_ASSETS);
      const shell = await fetch(APP_SHELL_URL).catch(() => null);
      if (shell && shell.ok) await cache.put('/', shell);
    })
  );
  self.skipWaiting();
});

// Activate - delete every old cache (removes stale v1 API responses)
self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((cacheNames) =>
      Promise.all(
        cacheNames
          .filter((name) => name !== CACHE_NAME)
          .map((name) => caches.delete(name))
      )
    )
  );
  self.clients.claim();
});

self.addEventListener('fetch', (event) => {
  const request = event.request;

  // Only handle GET
  if (request.method !== 'GET') return;

  const url = new URL(request.url);

  // Only handle same-origin
  if (url.origin !== self.location.origin) return;

  // Never touch API calls - always go straight to the network
  if (url.pathname.startsWith('/api/')) return;

  // Page navigations - network first, fall back to the cached app shell, then the offline page.
  // Only the app shell is kept as '/': a prerendered public page (marked by the prerender
  // script) is never stored in its place, or the home page could show the last guide read.
  if (request.mode === 'navigate') {
    event.respondWith(
      fetch(request)
        .then((response) => {
          if (response.ok) {
            // Decide from one copy, store another untouched: the page itself is not delayed.
            const toRead = response.clone();
            const toStore = response.clone();
            toRead.text().then(async (text) => {
              if (text.includes('prerendered from')) return;
              const cache = await caches.open(CACHE_NAME);
              await cache.put('/', toStore);
            }).catch(() => undefined);
          }
          return response;
        })
        .catch(async () => {
          const shell = await caches.match('/');
          return shell || caches.match(OFFLINE_URL);
        })
    );
    return;
  }

  // Hashed build assets - cache first (safe: new deploys get new filenames)
  if (url.pathname.startsWith('/assets/')) {
    event.respondWith(
      caches.match(request).then((cached) => {
        if (cached) return cached;
        return fetch(request).then((response) => {
          if (response.ok) {
            const copy = response.clone();
            caches.open(CACHE_NAME).then((cache) => cache.put(request, copy));
          }
          return response;
        });
      })
    );
    return;
  }

  // Everything else - network first, cache as fallback
  event.respondWith(
    fetch(request)
      .then((response) => {
        if (response.ok) {
          const copy = response.clone();
          caches.open(CACHE_NAME).then((cache) => cache.put(request, copy));
        }
        return response;
      })
      .catch(async () => {
        const cached = await caches.match(request);
        return cached || new Response('Offline', { status: 503, statusText: 'Service Unavailable' });
      })
  );
});

// Purge all ShootSync caches - posted by the app before sign-out (Standard §03 Layer 5)
self.addEventListener('message', (event) => {
  if (event.data && event.data.type === 'PURGE_CACHES') {
    event.waitUntil(
      caches.keys().then((keys) =>
        Promise.all(
          keys
            .filter((key) => key.startsWith('shootsync-'))
            .map((key) => caches.delete(key))
        )
      )
    );
  }
});
