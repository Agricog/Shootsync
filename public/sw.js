/**
 * Service Worker - ShootSync
 * Offline support and caching
 *
 * Rules:
 * - NEVER cache /api/ requests (live data must always come from the server)
 * - Page navigations: network first, cached shell / offline page as fallback
 * - Hashed build assets (/assets/*): cache first (filenames change on every deploy)
 * - Everything else: network first, cache as fallback
 *
 * Bump CACHE_NAME whenever this file's caching behaviour changes,
 * so old caches are deleted on activate.
 */

const CACHE_NAME = 'shootsync-v3';
const OFFLINE_URL = '/offline.html';

const PRECACHE_ASSETS = [
  '/',
  '/offline.html',
  '/manifest.json',
];

// Install - precache essential assets
self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => cache.addAll(PRECACHE_ASSETS))
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

  // Page navigations - network first, fall back to cached app shell, then offline page
  if (request.mode === 'navigate') {
    event.respondWith(
      fetch(request)
        .then((response) => {
          if (response.ok) {
            const copy = response.clone();
            caches.open(CACHE_NAME).then((cache) => cache.put('/', copy));
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

// Background sync for offline bag records
self.addEventListener('sync', (event) => {
  if (event.tag === 'sync-bags') {
    event.waitUntil(syncOfflineBags());
  }
});

async function syncOfflineBags() {
  // Placeholder - IndexedDB queue to be implemented
  console.log('[SW] Syncing offline bag records');
}

// Push notifications (future feature)
self.addEventListener('push', (event) => {
  if (!event.data) return;

  const data = event.data.json();

  event.waitUntil(
    self.registration.showNotification(data.title, {
      body: data.body,
      icon: '/icon-192.png',
      badge: '/icon-192.png',
      data: data.url,
    })
  );
});

self.addEventListener('notificationclick', (event) => {
  event.notification.close();

  if (event.notification.data) {
    event.waitUntil(clients.openWindow(event.notification.data));
  }
});
