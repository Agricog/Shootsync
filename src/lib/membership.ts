/**
 * The signed-in user's syndicates, as GET /api/me describes them, and which one the app shows.
 * Pure functions: the React side is src/context/SyndicateContext.tsx.
 */

export type MembershipRole = 'CAPTAIN' | 'GUN'

export interface Membership {
  id: string
  name: string
  role: MembershipRole
  /** The user's own place on the gun list in this syndicate, if they have one. */
  memberId: string | null
  seasonStart: string
  seasonEnd: string
  /** Whole pounds: what a new beater starts on. */
  defaultBeaterRate: number
  pegRotationRule: 'FAIR_ROTATION' | 'RANDOM' | 'MANUAL'
  subscription: {
    status: string | null
    planTier: 'STARTER' | 'STANDARD' | null
    isActive: boolean
    currentPeriodEnd: string | null
  }
}

/**
 * The syndicate to show: the one chosen last time on this device if the user still belongs
 * to it, otherwise the first one they captain, otherwise the first they shoot in.
 */
export function chooseSyndicate(memberships: readonly Membership[], remembered: string | null): Membership | null {
  if (memberships.length === 0) return null
  return (
    memberships.find((m) => m.id === remembered) ??
    memberships.find((m) => m.role === 'CAPTAIN') ??
    memberships[0]
  )
}

/** Accepts only what the server is documented to send, so a bad response can't masquerade as a role. */
export function parseMemberships(body: unknown): Membership[] | null {
  const list = (body as { syndicates?: unknown } | null)?.syndicates
  if (!Array.isArray(list)) return null
  const valid = list.filter(
    (m): m is Membership =>
      typeof m === 'object' && m !== null &&
      typeof (m as Membership).id === 'string' &&
      typeof (m as Membership).name === 'string' &&
      ((m as Membership).role === 'CAPTAIN' || (m as Membership).role === 'GUN') &&
      typeof (m as Membership).subscription === 'object' && (m as Membership).subscription !== null
  )
  return valid.length === list.length ? valid : null
}

/** Why a captain's syndicate is read-only, and the one thing to do about it. */
export function readOnlyReason(syndicate: Membership): { text: string; action: string } {
  switch (syndicate.subscription.status) {
    case null:
      return { text: `Choose a plan to start using ${syndicate.name}. Until then you can look around, but nothing can be saved.`, action: 'Choose a plan' }
    case 'PAST_DUE':
      return { text: `The last payment for ${syndicate.name} didn’t go through, so it’s read-only. Update your card and everything opens up again.`, action: 'Update payment' }
    case 'INCOMPLETE':
      // The plan was chosen but its first payment hasn't been taken: paying it opens the
      // syndicate, and choosing another plan would only start a second subscription.
      return { text: `The first payment for ${syndicate.name} hasn’t gone through yet, so it’s read-only. Finish paying and everything opens up.`, action: 'Update payment' }
    default:
      return { text: `The plan for ${syndicate.name} isn’t active, so it’s read-only. Everything is still here to view and export.`, action: 'Choose a plan' }
  }
}
