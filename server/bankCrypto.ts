/**
 * Bank details at rest - ShootSync
 *
 * A beater's sort code and account number are the most sensitive thing ShootSync holds, so they
 * are never stored readable. They are sealed with AES-256-GCM under a key that lives only in
 * the server's environment (BANK_DETAILS_KEY), never in the database: a copy of the database,
 * a backup or a leaked query result holds nothing usable.
 *
 * Each sealed value is bound to its beater (the beater's ID is the GCM associated data), so a
 * value copied onto another beater's row will not open. The format names the key it was sealed
 * with, so the key can be rotated: set the new key as BANK_DETAILS_KEY and the old one as
 * BANK_DETAILS_KEY_PREVIOUS, and everything still opens; the boot step reseals under the new key.
 *
 *   v1.<key id>.<iv>.<tag>.<ciphertext>      (base64url parts; key id = first 8 hex of SHA-256(key))
 *
 * Only the last four digits of the account number are kept readable, for the masked display.
 */

import { createCipheriv, createDecipheriv, createHash, randomBytes } from 'node:crypto'

export interface BankNumbers {
  sortCode: string
  accountNumber: string
}

export interface BankKeys {
  current: Buffer
  previous: Buffer | null
}

/** A key from its environment form: 64 hex characters or 44 base64 characters, 32 bytes either way. */
export function parseBankKey(value: string | undefined | null): Buffer | null {
  const text = value?.trim()
  if (!text) return null
  if (/^[0-9a-f]{64}$/i.test(text)) return Buffer.from(text, 'hex')
  // Strictly 32 bytes of base64: Node would otherwise skip characters it doesn't recognise.
  if (/^[A-Za-z0-9+/]{43}=$/.test(text)) return Buffer.from(text, 'base64')
  throw new Error('BANK_DETAILS_KEY must be 32 bytes: 64 hex characters, or 44 base64 characters.')
}

export function keyId(key: Buffer): string {
  return createHash('sha256').update(key).digest('hex').slice(0, 8)
}

const b64 = (buf: Buffer) => buf.toString('base64url')

/** Seals a beater's numbers. Bound to the beater: it opens only for the same beater ID. */
export function sealBankNumbers(numbers: BankNumbers, beaterId: string, key: Buffer): string {
  const iv = randomBytes(12)
  const cipher = createCipheriv('aes-256-gcm', key, iv)
  cipher.setAAD(Buffer.from(`beater:${beaterId}`, 'utf8'))
  const plain = Buffer.from(JSON.stringify({ s: numbers.sortCode, a: numbers.accountNumber }), 'utf8')
  const sealed = Buffer.concat([cipher.update(plain), cipher.final()])
  return ['v1', keyId(key), b64(iv), b64(cipher.getAuthTag()), b64(sealed)].join('.')
}

export class BankDetailsUnreadable extends Error {
  constructor(reason: string) {
    super(`Bank details could not be opened: ${reason}`)
    this.name = 'BankDetailsUnreadable'
  }
}

/** Which key a sealed value names: lets the boot step find values to reseal after a rotation. */
export function sealedKeyId(sealed: string): string | null {
  const parts = sealed.split('.')
  return parts.length === 5 && parts[0] === 'v1' ? parts[1] : null
}

/** Opens a sealed value. Throws BankDetailsUnreadable if the key is wrong or the value was altered or moved. */
export function openBankNumbers(sealed: string, beaterId: string, keys: BankKeys): BankNumbers {
  const parts = sealed.split('.')
  if (parts.length !== 5 || parts[0] !== 'v1') throw new BankDetailsUnreadable('unknown format')
  const [, id, iv, tag, body] = parts
  const key = [keys.current, keys.previous].find((k): k is Buffer => k !== null && keyId(k) === id)
  if (!key) throw new BankDetailsUnreadable('sealed with a key this server does not have')
  try {
    const decipher = createDecipheriv('aes-256-gcm', key, Buffer.from(iv, 'base64url'))
    decipher.setAAD(Buffer.from(`beater:${beaterId}`, 'utf8'))
    decipher.setAuthTag(Buffer.from(tag, 'base64url'))
    const plain = Buffer.concat([decipher.update(Buffer.from(body, 'base64url')), decipher.final()])
    const parsed = JSON.parse(plain.toString('utf8')) as { s?: unknown; a?: unknown }
    if (typeof parsed.s !== 'string' || typeof parsed.a !== 'string') throw new Error('shape')
    return { sortCode: parsed.s, accountNumber: parsed.a }
  } catch {
    throw new BankDetailsUnreadable('altered, or belongs to a different beater')
  }
}

/** The last four digits shown in place of the account number. */
export function last4(accountNumber: string): string {
  return accountNumber.replace(/\D/g, '').slice(-4)
}
