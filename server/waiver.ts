/**
 * The guest gun acknowledgement - ShootSync
 *
 * The words a guest accepts before a shoot day, held on the server so the page, the record and
 * the test all read the same text. Written for England and Wales: an acknowledgement of the
 * ordinary risks of the sport and of the guest's own responsibilities, never a release from
 * liability for death or personal injury caused by negligence, which section 65 of the Consumer
 * Rights Act 2015 (and, between businesses, section 2(1) of the Unfair Contract Terms Act 1977)
 * does not allow. A syndicate may add its own clauses (Settings); they are shown under the standard text.
 *
 * Every acceptance records the version and a SHA-256 of the exact words shown, so what a guest
 * agreed to can always be reproduced. Change the words here: bump the version, never edit in place.
 *
 * Drafted 29 Oct 2026. The owner's solicitor should confirm the wording before the first real
 * guest accepts it (recorded in the runbook).
 */

import { createHash } from 'node:crypto'

export const WAIVER_VERSION = 'uk-2026-10'

export const WAIVER_TITLE = 'Guest gun acknowledgement'

export const WAIVER_CLAUSES: readonly string[] = [
  'I confirm that I am a competent and experienced shot, familiar with safe gun handling and shooting etiquette, and that I will be shooting lawfully: with my own shotgun certificate, or, without a certificate, by borrowing a shotgun from a certificate holder who is the occupier of the land or has the occupier’s written authority, and using it in that person’s presence, as section 11A of the Firearms Act 1968 allows.',
  'I confirm that I hold shooting insurance with public liability cover of at least £10 million, in force on the day.',
  'I understand that game shooting carries risks that are part of the sport, including from firearms, dogs, vehicles, terrain and weather, and I accept those ordinary risks. This does not cover harm caused by anyone’s negligence.',
  'I will follow the safety instructions of the shoot captain, the keeper and the shoot’s officials, and I accept that I may be asked to stop shooting at any time.',
  'I am responsible for my own conduct, and for any loss or damage I cause by unsafe handling or by not following instructions.',
  'I have given a correct emergency contact, and I agree to them being contacted, and to emergency treatment, if I am hurt.',
  'I understand that my name, contact details, emergency contact and this acceptance are held by the syndicate and by ShootSync as set out in ShootSync’s privacy notice.',
  'Nothing in this acknowledgement limits anyone’s liability for death or personal injury caused by negligence, or for anything else that the law does not allow to be limited.',
]

/** The exact words shown to and accepted by a guest, including the syndicate's own clauses. */
export function waiverText(syndicateExtra: string | null | undefined): string {
  const standard = [WAIVER_TITLE.toUpperCase(), '', ...WAIVER_CLAUSES.map((clause, i) => `${i + 1}. ${clause}`)]
  const extra = syndicateExtra?.trim()
  if (extra) standard.push('', 'This syndicate also asks that:', '', extra)
  return standard.join('\n')
}

/** A SHA-256 of the exact words, hex. Stored with every acceptance. */
export function waiverHash(text: string): string {
  return createHash('sha256').update(text, 'utf8').digest('hex')
}
