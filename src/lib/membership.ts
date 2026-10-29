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

export interface PlanNotice {
  /** 'warning': everything still works, but something needs doing. 'read-only': changes are refused. */
  tone: 'warning' | 'read-only'
  text: string
  action: string
}

/** What the captain needs to know about the plan of the syndicate on show, if anything. */
export function planNotice(syndicate: Membership): PlanNotice | null {
  const { name, subscription } = syndicate
  switch (subscription.status) {
    case 'ACTIVE':
    case 'TRIALING':
      return null
    case 'PAST_DUE':
      // Still fully usable while Stripe retries the card (server/access.ts).
      return { tone: 'warning', text: `The last payment for ${name} didn’t go through. Everything still works while Stripe tries your card again over the next few days. Update your card to keep it that way.`, action: 'Update payment' }
    case null:
      return { tone: 'read-only', text: `Choose a plan to start using ${name}. Until then you can look around, but nothing can be saved.`, action: 'Choose a plan' }
    case 'UNPAID':
      return { tone: 'read-only', text: `Payments for ${name} have failed and Stripe has stopped trying, so it’s read-only. Update your card and pay the open invoice under Update payment, and everything opens up again.`, action: 'Update payment' }
    case 'INCOMPLETE':
      // The plan was chosen but its first payment hasn't been taken: paying it opens the
      // syndicate, and choosing another plan would only start a second subscription.
      return { tone: 'read-only', text: `The first payment for ${name} hasn’t gone through yet, so it’s read-only. Finish paying and everything opens up.`, action: 'Update payment' }
    default:
      return { tone: 'read-only', text: `The plan for ${name} isn’t active, so it’s read-only. Everything is still here to view and export.`, action: 'Choose a plan' }
  }
}
