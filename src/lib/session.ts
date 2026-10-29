/**
 * Session plumbing - ShootSync
 *
 * 1. Every same-origin /api request carries the signed-in user's Clerk session
 *    token, so the server can tell who is asking. One wrapper covers every
 *    fetch in the app.
 * 2. Signing out clears everything this browser holds for the account: every
 *    localStorage key the app writes (src/lib/storageKeys.ts) and the service
 *    worker caches (Standard §03 Layers 4 and 5).
 */

import { LOCAL_STORAGE_KEYS } from './storageKeys'

interface ClerkLike {
  session?: { getToken: () => Promise<string | null> } | null
}

async function currentToken(): Promise<string | null> {
  const clerk = (window as unknown as { Clerk?: ClerkLike }).Clerk
  try {
    return (await clerk?.session?.getToken()) ?? null
  } catch {
    return null
  }
}

function isOwnApiRequest(input: RequestInfo | URL): boolean {
  try {
    const raw = input instanceof Request ? input.url : String(input)
    const url = new URL(raw, window.location.href)
    return url.origin === window.location.origin && url.pathname.startsWith('/api/')
  } catch {
    return false
  }
}

let installed = false

export function installApiAuth(): void {
  if (installed) return
  installed = true

  const originalFetch = window.fetch.bind(window)

  window.fetch = async (input: RequestInfo | URL, init?: RequestInit): Promise<Response> => {
    if (!isOwnApiRequest(input)) return originalFetch(input, init)

    const token = await currentToken()
    if (!token) return originalFetch(input, init)

    const headers = new Headers(init?.headers ?? (input instanceof Request ? input.headers : undefined))
    if (!headers.has('Authorization')) headers.set('Authorization', `Bearer ${token}`)
    return originalFetch(input, { ...init, headers })
  }
}

/** Remove every trace of the signed-in account from this browser. Never throws. */
export async function clearLocalAccountData(): Promise<void> {
  for (const key of LOCAL_STORAGE_KEYS) {
    try {
      localStorage.removeItem(key)
    } catch {
      /* storage unavailable: nothing to clear */
    }
  }

  try {
    const registration = await navigator.serviceWorker?.getRegistration()
    registration?.active?.postMessage({ type: 'PURGE_CACHES' })
  } catch {
    /* no service worker: nothing to purge */
  }

  try {
    if ('caches' in window) {
      const keys = await caches.keys()
      await Promise.all(keys.filter((key) => key.startsWith('shootsync-')).map((key) => caches.delete(key)))
    }
  } catch {
    /* Cache API unavailable */
  }
}
