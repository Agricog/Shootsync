/**
 * Sending email - ShootSync
 *
 * One way out: Resend's HTTP API, from notices@shootsync.co.uk (the domain is verified in Resend and
 * sends from its EU region, Ireland; Resend keeps its own records of what it sent in the United
 * States, as the privacy notice says). No library: a single fetch, so there is nothing more to keep
 * up to date.
 *
 * Every send carries an idempotency key that names the message (for example the syndicate, the
 * deletion date, which warning, and a fingerprint of the exact email). Resend sends a message with
 * a key it has seen in the last 24 hours only once, so a retry after a timeout, or two servers
 * overlapping during a deploy, can't send it twice.
 *
 * Nothing about a recipient is logged: errors say what failed, never to whom. Resend's own error
 * wording is never passed on (it can quote an address); only its HTTP status and error code are.
 */

/** Who ShootSync's emails come from, and where replies go. */
export const MAIL_FROM = 'ShootSync <notices@shootsync.co.uk>'
export const MAIL_REPLY_TO = 'hello@shootsync.co.uk'

export interface OutgoingEmail {
  to: string
  subject: string
  /** Plain text, always: every email can be read without HTML. */
  text: string
  html: string
  /** Names the message, so it is sent once however many times it is asked for. */
  idempotencyKey: string
}

export interface Mailer {
  /** Resolves with the provider's message ID; rejects with a MailError if it wasn't accepted. */
  send(email: OutgoingEmail): Promise<{ id: string }>
}

export class MailError extends Error {
  /**
   * @param status Resend's HTTP status, or null if it couldn't be reached (the email may or may not
   *   have been accepted: a retry with the same idempotency key settles it).
   * @param code Resend's error code, such as 'validation_error'. Never its message.
   */
  constructor(message: string, readonly status: number | null, readonly code: string | null = null) {
    super(message)
    this.name = 'MailError'
  }
}

/** Resend API keys start re_ and are long; anything else is a paste gone wrong. */
export function isResendKey(value: string): boolean {
  return /^re_[A-Za-z0-9_]{16,}$/.test(value)
}

const RESEND_URL = 'https://api.resend.com/emails'
const TIMEOUT_MS = 10_000

export function resendMailer(apiKey: string, fetchImpl: typeof fetch = fetch): Mailer {
  return {
    async send(email) {
      let response: Response
      try {
        response = await fetchImpl(RESEND_URL, {
          method: 'POST',
          headers: {
            Authorization: `Bearer ${apiKey}`,
            'Content-Type': 'application/json',
            'Idempotency-Key': email.idempotencyKey,
          },
          body: JSON.stringify({
            from: MAIL_FROM,
            to: [email.to],
            reply_to: MAIL_REPLY_TO,
            subject: email.subject,
            text: email.text,
            html: email.html,
          }),
          signal: AbortSignal.timeout(TIMEOUT_MS),
        })
      } catch (err) {
        throw new MailError(`Resend could not be reached: ${err instanceof Error ? err.name : 'unknown error'}`, null)
      }
      const body = (await response.json().catch(() => null)) as { id?: unknown; name?: unknown } | null
      if (!response.ok || typeof body?.id !== 'string') {
        // The status and Resend's error code only: its message text can quote an address.
        const code = typeof body?.name === 'string' && /^[a-z_]{1,64}$/.test(body.name) ? body.name : null
        throw new MailError(`Resend refused the email (HTTP ${response.status}${code ? `, ${code}` : ''})`, response.status, code)
      }
      return { id: body.id }
    },
  }
}

/** HTML-escape text that goes into an email body. */
export function escapeHtml(text: string): string {
  return text.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;').replace(/'/g, '&#39;')
}
