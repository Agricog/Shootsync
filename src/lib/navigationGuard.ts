/**
 * Which clicks are a navigation inside the app, for the unsaved-work check (src/lib/unsavedWork.tsx).
 * A plain function, so it is tested without a browser.
 */

/**
 * Is this click a plain navigation inside the app? Anything else (a new tab, a download, another
 * site, an in-page anchor, a right or middle click) is left alone.
 */
export function inAppNavigation(event: { button?: number; metaKey?: boolean; ctrlKey?: boolean; shiftKey?: boolean; altKey?: boolean; defaultPrevented?: boolean }, anchor: { href: string; target?: string; download?: string; origin?: string; pathname?: string; search?: string; hash?: string }, here: { origin: string; pathname: string; search: string }): string | null {
  if (event.defaultPrevented || (event.button ?? 0) !== 0 || event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return null
  if (anchor.target && anchor.target !== '_self') return null
  if (anchor.download !== undefined && anchor.download !== '') return null
  if (!anchor.href || anchor.origin !== here.origin) return null
  if (!anchor.pathname) return null
  const to = `${anchor.pathname}${anchor.search ?? ''}`
  // The same page (a "#section" link, or a link to where we already are) is not leaving.
  if (anchor.pathname === here.pathname && (anchor.search ?? '') === here.search) return null
  return `${to}${anchor.hash ?? ''}`
}
