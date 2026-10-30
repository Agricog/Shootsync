/**
 * Plain-English validation messages - ShootSync
 *
 * zod's built-in messages ("Too small: expected string to have >=1 characters") are for
 * developers. This turns them into sentences a captain can act on ("Location is required.").
 * It only fills in messages a schema did not write itself: a schema's own wording
 * ("Meet time must be like 08:30") always wins, because zod consults this map last.
 *
 * Installed once, when this module is first imported (server/access.ts imports it, and
 * every route imports access.ts), so no request can be validated before it is in place.
 */

import { z } from 'zod'

/** Field names the captain sees on screen, where the code name would read oddly. */
const LABELS: Record<string, string> = {
  syndicateId: 'Syndicate',
  shootId: 'Shoot day',
  memberId: 'Gun',
  memberIds: 'Guns',
  beaterId: 'Beater',
  beaterIds: 'Beaters',
  invitedByMemberId: 'Inviting gun',
  locationName: 'Location',
  locationAddress: 'Address',
  locationPostcode: 'Postcode',
  locationWhat3Words: 'what3words',
  meetTime: 'Meet time',
  drivesPlanned: 'Drives planned',
  expectedBag: 'Expected bag',
  captainNotes: 'Captain’s notes',
  weatherNotes: 'Weather notes',
  driveNumber: 'Drive number',
  otherDescription: 'Description of other game',
  dayRate: 'Day rate',
  dayFee: 'Day fee',
  bankName: 'Bank name',
  bankSortCode: 'Sort code',
  bankAccountNumber: 'Account number',
  paymentReference: 'Payment reference',
  emergencyContactName: 'Emergency contact name',
  emergencyContactPhone: 'Emergency contact phone',
  bascNumber: 'BASC number',
  insuranceExpiry: 'Insurance expiry date',
  seasonStart: 'Season start',
  seasonEnd: 'Season end',
  subscriptionAmount: 'Members’ subscription',
  subscriptionType: 'Subscription type',
  defaultBeaterRate: 'Default beater rate',
  pegRotationRule: 'Peg rotation',
  numberOfPegs: 'Number of pegs',
  pegNumber: 'Peg number',
  planTier: 'Plan',
  waiverAccepted: 'Waiver',
}

/** "locationPostcode" -> "Location postcode"; the last named part of the path is the field. */
export function fieldLabel(path: readonly PropertyKey[] | undefined): string {
  const key = [...(path ?? [])].reverse().find((part): part is string => typeof part === 'string')
  if (!key) return 'This'
  if (LABELS[key]) return LABELS[key]
  const words = key.replace(/([a-z0-9])([A-Z])/g, '$1 $2').toLowerCase()
  return words.charAt(0).toUpperCase() + words.slice(1)
}

interface RawIssue {
  code?: string
  path?: readonly PropertyKey[]
  input?: unknown
  origin?: string
  minimum?: number | bigint
  maximum?: number | bigint
  inclusive?: boolean
  expected?: string
  format?: string
}

/** The sentence for one issue zod raised without a message of its own. */
export function friendlyMessage(issue: RawIssue): string {
  const label = fieldLabel(issue.path)
  const min = Number(issue.minimum)
  const max = Number(issue.maximum)

  switch (issue.code) {
    case 'invalid_type':
      if (issue.input === undefined || issue.input === null) return `${label} is required.`
      if (issue.expected === 'int') return `${label} must be a whole number.`
      if (issue.expected === 'number') return `${label} must be a number.`
      if (issue.expected === 'boolean') return `${label} must be yes or no.`
      if (issue.expected === 'array') return `${label} must be a list.`
      return `${label} is not valid.`
    case 'too_small':
      if (issue.origin === 'string') return min <= 1 ? `${label} is required.` : `${label} must be at least ${min} characters.`
      if (issue.origin === 'array' || issue.origin === 'set') return min <= 1 ? `${label}: choose at least one.` : `${label}: choose at least ${min}.`
      return issue.inclusive === false ? `${label} must be more than ${min}.` : `${label} must be at least ${min}.`
    case 'too_big':
      if (issue.origin === 'string') return `${label} must be ${max} characters or fewer.`
      if (issue.origin === 'array' || issue.origin === 'set') return `${label}: no more than ${max}.`
      return issue.inclusive === false ? `${label} must be less than ${max}.` : `${label} must be ${max} or less.`
    case 'invalid_format':
      if (issue.format === 'email') return `${label} must be a valid email address.`
      return `${label} is not in the right format.`
    case 'invalid_value':
      return `${label} is not one of the allowed choices.`
    case 'not_multiple_of':
      return `${label} is not a valid amount.`
    case 'unrecognized_keys':
      return 'The request had fields ShootSync does not accept.'
    default:
      return `${label} is not valid.`
  }
}

z.config({ customError: (issue) => friendlyMessage(issue as RawIssue) })

/** What a 400 tells the browser: the first problem as a sentence, and each problem by field. Never the values sent. */
export function validationResponse(issues: readonly z.core.$ZodIssue[]) {
  return {
    error: issues[0]?.message ?? 'Some details were not valid.',
    details: issues.map((issue) => ({ path: issue.path.map(String), message: issue.message })),
  }
}

/**
 * A date a person typed. It must be a real date, and a year a shoot could be in: 2000 to 2100.
 * Without the year check, "28" for 2028 was saved as the year 28 (found in production, 29 Oct 2026).
 */
export const dateString = z
  .string()
  .trim()
  .regex(/^\d{4}-\d{2}-\d{2}$/, 'Enter the date as a day, month and four-digit year')
  // A real day: 31 February would otherwise roll on to 3 March.
  .refine((s) => {
    const day = new Date(`${s}T00:00:00Z`)
    return !Number.isNaN(day.getTime()) && day.toISOString().slice(0, 10) === s
  }, 'Enter a real date')
  .refine((s) => {
    const year = Number(s.slice(0, 4))
    return year >= 2000 && year <= 2100
  }, 'Enter the date with a four-digit year, like 2026')
