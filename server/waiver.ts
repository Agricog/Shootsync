/**
 * The guest gun acknowledgement - ShootSync
 *
 * The words a guest accepts before a shoot day, held on the server so the page, the record and
 * the test all read the same text. Written for England and Wales: an acknowledgement of the
 * ordinary risks of the sport and of the guest's own responsibilities, never a release from
 * liability for death or personal injury caused by negligence. Where the syndicate is a trader
 * dealing with a consumer, section 65 of the Consumer Rights Act 2015 bars such a term; where the
 * liability is business liability outside a consumer contract, section 2(1) of the Unfair Contract
 * Terms Act 1977 bars it; a purely non-commercial members' club may fall outside both, which is
 * why the text does not attempt it in any case. A syndicate may add its own clauses (Settings);
 * they are shown under the standard text.
 *
 * Every acceptance records the version, the exact words shown and their SHA-256, so what a guest
 * agreed to can always be reproduced even after a syndicate changes its own clauses. Change the
 * words here: bump the version, never edit in place.
 *
 * Drafted 29 Oct 2026; checked against the statutes (Firearms Act 1968 s11A as inserted by the
 * Policing and Crime Act 2017; CRA 2015 s65; UCTA 1977 ss1-2) and revised 30 Oct 2026. The owner
 * has decided no solicitor will review it, so it is kept as correct as the primary sources allow.
 */

import { createHash } from 'node:crypto'

export const WAIVER_VERSION = 'uk-2026-10.2'

export const WAIVER_TITLE = 'Guest gun acknowledgement'

export const WAIVER_CLAUSES: readonly string[] = [
  'I confirm that I am a competent and experienced shot, familiar with safe gun handling and shooting etiquette, and that I will be shooting lawfully: with my own shotgun certificate, or, without a certificate, by borrowing a shotgun on private premises under section 11A of the Firearms Act 1968 from a lender aged 18 or over who holds a shotgun certificate for it and either has the right to allow others to shoot game or vermin there or has written authority from someone who does; I will stay in the presence of the lender (or of another adult certificate holder with that right or authority) throughout, and will keep to any conditions on the lender’s certificate.',
  'I confirm that I hold shooting insurance with public liability cover of at least £10 million, in force on the day.',
  'I understand that game shooting carries risks that are part of the sport, including from firearms, dogs, vehicles, terrain and weather, and I accept those ordinary risks. Accepting them does not mean accepting harm caused by anyone’s negligence, and nothing here excuses anyone from liability for it.',
  'I will follow the safety instructions of the shoot captain, the keeper and the shoot’s officials, and I accept that I may be asked to stop shooting at any time.',
  'I am responsible for my own conduct, and I may be liable for loss or damage I cause by unsafe handling or by not following instructions.',
  'I have given a correct emergency contact, who knows I have named them, and I agree to them being contacted if I am hurt or taken ill.',
  'I understand that my name, contact details, emergency contact and this acceptance are held by the syndicate to run the shoot day and keep its records, using ShootSync as its service provider, as set out in ShootSync’s privacy notice.',
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
