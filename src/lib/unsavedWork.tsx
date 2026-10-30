/**
 * Unsaved work - ShootSync
 *
 * A form with changes that haven't been saved says so with useUnsavedWork(true). While any form
 * says so:
 *   - closing the tab, reloading or typing a new address gets the browser's own "leave site?"
 *     prompt (the only prompt a page is allowed there);
 *   - a link inside the app (the header, a Back button, a footer link) opens ShootSync's own
 *     dialog instead of navigating, and navigates only if the captain says to leave.
 * The link check is one listener on the document, so every link is covered without each one
 * knowing about it. Saving or cancelling the form (which sets it back to false) lifts both.
 * A forced sign-out (the session clock) sends DISCARD_UNSAVED_EVENT first, so the browser's
 * prompt can't hold up a sign-out the server has already made final.
 */

import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from 'react'
import { useNavigate } from 'react-router-dom'
import ConfirmDialog from '../components/common/ConfirmDialog'
import { inAppNavigation } from './navigationGuard'

interface UnsavedWorkContextValue {
  /** Forms with unsaved changes, by their own key. */
  register: (key: string, dirty: boolean) => void
}

const UnsavedWorkContext = createContext<UnsavedWorkContextValue | null>(null)

/** Sent on window to drop every unsaved-work claim at once, before a navigation that must happen. */
export const DISCARD_UNSAVED_EVENT = 'shootsync:discard-unsaved'

export function UnsavedWorkProvider({ children }: { children: ReactNode }) {
  const [dirtyKeys, setDirtyKeys] = useState<Set<string>>(() => new Set())
  const [pending, setPending] = useState<string | null>(null)
  const navigate = useNavigate()
  const dirty = dirtyKeys.size > 0
  const dirtyRef = useRef(dirty)
  dirtyRef.current = dirty

  const register = useCallback((key: string, isDirty: boolean) => {
    setDirtyKeys((keys) => {
      if (keys.has(key) === isDirty) return keys
      const next = new Set(keys)
      if (isDirty) next.add(key)
      else next.delete(key)
      return next
    })
  }, [])

  // The browser's prompt for leaving the site; the text is the browser's own.
  useEffect(() => {
    if (!dirty) return
    const onBeforeUnload = (e: BeforeUnloadEvent) => {
      e.preventDefault()
      e.returnValue = ''
    }
    window.addEventListener('beforeunload', onBeforeUnload)
    return () => window.removeEventListener('beforeunload', onBeforeUnload)
  }, [dirty])

  useEffect(() => {
    const discard = () => setDirtyKeys(new Set())
    window.addEventListener(DISCARD_UNSAVED_EVENT, discard)
    return () => window.removeEventListener(DISCARD_UNSAVED_EVENT, discard)
  }, [])

  // Links inside the app: caught before the router sees the click.
  useEffect(() => {
    const onClick = (e: MouseEvent) => {
      if (!dirtyRef.current) return
      const anchor = (e.target as Element | null)?.closest?.('a[href]') as HTMLAnchorElement | null
      if (!anchor) return
      const to = inAppNavigation(e, anchor, window.location)
      if (!to) return
      e.preventDefault()
      e.stopPropagation()
      setPending(to)
    }
    document.addEventListener('click', onClick, true)
    return () => document.removeEventListener('click', onClick, true)
  }, [])

  const leave = () => {
    const to = pending
    setPending(null)
    if (!to) return
    // Leaving discards the work, so nothing holds the next page up.
    setDirtyKeys(new Set())
    navigate(to)
  }
  const stay = useCallback(() => setPending(null), [])

  const value = useMemo(() => ({ register }), [register])

  return (
    <UnsavedWorkContext.Provider value={value}>
      {children}
      <ConfirmDialog open={pending !== null} title="Leave without saving?" confirmLabel="Leave and lose the changes" cancelLabel="Stay on this page" onConfirm={leave} onCancel={stay}>
        <p>You have changes on this page that haven’t been saved. If you leave now they are lost.</p>
      </ConfirmDialog>
    </UnsavedWorkContext.Provider>
  )
}

/**
 * Say whether this form has unsaved changes. `key` tells one form from another on the same
 * page; the default is fine for a page with one form.
 */
export function useUnsavedWork(dirty: boolean, key = 'page') {
  const context = useContext(UnsavedWorkContext)
  const register = context?.register
  useEffect(() => {
    if (!register) return
    register(key, dirty)
    return () => register(key, false)
  }, [register, key, dirty])
}
