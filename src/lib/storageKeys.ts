/**
 * Everything ShootSync keeps in this browser's localStorage, in one list.
 *
 * Signing out removes every key on it (src/lib/session.ts, Standard §03 Layer 4), and a test
 * fails if the app ever writes a key that is not here.
 */

/** Which of the user's syndicates was on show, so the app opens on it next time. */
export const REMEMBERED_SYNDICATE_KEY = 'shootsync_current_syndicate'

/**
 * When the user last did anything, in any of their ShootSync tabs, so a tab left open in the
 * background never signs them out while they are busy in another (src/hooks/useSessionTimeout.ts).
 */
export const LAST_ACTIVITY_KEY = 'shootsync_last_activity'

/** The old offline queue. Nothing writes it now; it stays listed so sign-out clears any browser that still holds one. */
const RETIRED_OFFLINE_QUEUE_KEY = 'shootsync_offline_queue'

export const LOCAL_STORAGE_KEYS = [REMEMBERED_SYNDICATE_KEY, LAST_ACTIVITY_KEY, RETIRED_OFFLINE_QUEUE_KEY] as const
