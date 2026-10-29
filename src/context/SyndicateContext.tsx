/**
 * Which syndicate the app is showing, and the user's role in it - ShootSync
 *
 * Loaded once per sign-in from GET /api/me. Every signed-in page reads the syndicate from
 * here instead of fetching its own list, so the whole app always agrees on one syndicate,
 * and a user with more than one can switch between them from the header.
 */

import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from 'react'
import { useAuth } from '@clerk/clerk-react'
import { apiRequest } from '../lib/api'
import { chooseSyndicate, parseMemberships, type Membership } from '../lib/membership'
import { REMEMBERED_SYNDICATE_KEY } from '../lib/storageKeys'

type LoadState = 'idle' | 'loading' | 'ready' | 'error'

interface SyndicateContextValue {
  state: LoadState
  error: string | null
  memberships: Membership[]
  current: Membership | null
  /** Show another of the user's syndicates. */
  select: (syndicateId: string) => void
  /** Fetch the list again (after creating a syndicate, subscribing, or a failed load). Resolves to the new list. */
  reload: (selectId?: string) => Promise<Membership[] | null>
}

const SyndicateContext = createContext<SyndicateContextValue | null>(null)

function remembered(): string | null {
  try {
    return localStorage.getItem(REMEMBERED_SYNDICATE_KEY)
  } catch {
    return null
  }
}

function remember(id: string): void {
  try {
    localStorage.setItem(REMEMBERED_SYNDICATE_KEY, id)
  } catch {
    /* storage unavailable: the choice lasts for this visit only */
  }
}

export function SyndicateProvider({ children }: { children: ReactNode }) {
  const { isLoaded, isSignedIn, userId } = useAuth()
  const [state, setState] = useState<LoadState>('idle')
  const [error, setError] = useState<string | null>(null)
  const [memberships, setMemberships] = useState<Membership[]>([])
  const [currentId, setCurrentId] = useState<string | null>(null)
  // Ignore a slow answer that arrives after the user has signed out or switched account.
  const generation = useRef(0)

  // Once the list has loaded, a refresh happens behind the page on show: the page stays put
  // (a refresh must never unmount the screen that asked for it), and a failed refresh keeps
  // the list already held rather than replacing the page with an error.
  const loadedOnce = useRef(false)

  const reload = useCallback(async (selectId?: string) => {
    const mine = ++generation.current
    if (!loadedOnce.current) setState('loading')
    setError(null)
    const result = await apiRequest<unknown>('/api/me')
    if (mine !== generation.current) return null
    const list = result.ok ? parseMemberships(result.data) : null
    if (!list) {
      if (!loadedOnce.current) {
        setError(result.ok ? 'ShootSync sent an answer it could not read. Reload the page.' : result.error)
        setState('error')
      }
      return null
    }
    loadedOnce.current = true
    const chosen = chooseSyndicate(list, selectId ?? remembered())
    setMemberships(list)
    setCurrentId(chosen?.id ?? null)
    if (chosen) remember(chosen.id)
    setState('ready')
    return list
  }, [])

  useEffect(() => {
    if (!isLoaded) return
    if (isSignedIn && userId) {
      // A different account starts from nothing: never show one user's syndicates to another.
      loadedOnce.current = false
      setMemberships([])
      setCurrentId(null)
      void reload()
    } else {
      generation.current++
      loadedOnce.current = false
      setMemberships([])
      setCurrentId(null)
      setError(null)
      setState('idle')
    }
  }, [isLoaded, isSignedIn, userId, reload])

  const select = useCallback((syndicateId: string) => {
    setCurrentId((previous) => {
      const exists = memberships.some((m) => m.id === syndicateId)
      if (!exists) return previous
      remember(syndicateId)
      return syndicateId
    })
  }, [memberships])

  const value = useMemo<SyndicateContextValue>(() => ({
    state,
    error,
    memberships,
    current: memberships.find((m) => m.id === currentId) ?? null,
    select,
    reload,
  }), [state, error, memberships, currentId, select, reload])

  return <SyndicateContext.Provider value={value}>{children}</SyndicateContext.Provider>
}

export function useSyndicates(): SyndicateContextValue {
  const value = useContext(SyndicateContext)
  if (!value) throw new Error('useSyndicates must be used inside <SyndicateProvider>')
  return value
}

/**
 * The syndicate a captain's page works on. Only available inside <CaptainRoute>, which
 * guarantees there is one and that the signed-in user is its captain.
 */
const CaptainSyndicateContext = createContext<Membership | null>(null)

export const CaptainSyndicateProvider = CaptainSyndicateContext.Provider

export function useCaptainSyndicate(): Membership {
  const value = useContext(CaptainSyndicateContext)
  if (!value) throw new Error('useCaptainSyndicate must be used inside <CaptainRoute>')
  return value
}
