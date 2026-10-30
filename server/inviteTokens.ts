/**
 * Guest invitation links - ShootSync
 *
 * A guest's link carries a 64-character token (32 random bytes). The database holds only the
 * SHA-256 of it (guest_guns.invite_token, migration 0007), the way a password is stored: anyone
 * who could read the table still could not open a guest's page. The token itself exists in the
 * link the captain is shown when the guest is added or the link is renewed, and nowhere else.
 *
 * A link is looked up by hashing what arrives and matching the hash. Renewing a link replaces
 * the hash, so the old link stops working the moment a new one is made.
 */

import { createHash, randomBytes } from 'node:crypto'

/** What a token in a link looks like. Anything else is refused before the database is asked. */
export const INVITE_TOKEN_PATTERN = /^[a-f0-9]{64}$/

/** The stored form: SHA-256 of the token's text, as 64 hex characters. */
export function hashInviteToken(token: string): string {
  return createHash('sha256').update(token, 'utf8').digest('hex')
}

/** A fresh token for a link, and the hash to store for it. */
export function newInviteToken(): { token: string; hash: string } {
  const token = randomBytes(32).toString('hex')
  return { token, hash: hashInviteToken(token) }
}

/** The path a guest's link opens, for the token given. */
export function inviteLinkPath(token: string): string {
  return `/guest/accept/${token}`
}
