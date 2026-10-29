/**
 * Error reporting in the browser - ShootSync
 *
 * Every unexpected error gets a short reference the captain can quote. For now the report goes
 * to the browser console only; batch 9c sends it to Sentry as well, with personal data stripped.
 * Nothing here is ever described to the user as "notified" until that is true.
 */

/** A short, readable reference: "SS-7K3M9Q". Unique enough to match an email to a report. */
export function errorReference(): string {
  const alphabet = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'
  let out = 'SS-'
  const bytes = new Uint8Array(6)
  try {
    crypto.getRandomValues(bytes)
  } catch {
    for (let i = 0; i < bytes.length; i++) bytes[i] = Math.floor(Math.random() * 256)
  }
  for (const b of bytes) out += alphabet[b % alphabet.length]
  return out
}

/** Records an unexpected error and returns its reference. Never throws. */
export function captureError(error: unknown, context: string): string {
  const reference = errorReference()
  try {
    const message = error instanceof Error ? error.message : String(error)
    const stack = error instanceof Error ? error.stack : undefined
    console.error(`[ShootSync ${reference}] ${context}: ${message}`, stack ?? '')
  } catch {
    /* the console itself failed: nothing more to do */
  }
  return reference
}
