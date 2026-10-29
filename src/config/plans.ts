/**
 * ShootSync plans - the single source of truth for every price shown anywhere.
 *
 * Read by: the home page, /pricing, /subscribe and the structured data.
 * Must match server/plans.ts (a test compares them) and the live Stripe prices
 * (the server checks and logs this at boot).
 *
 * Only list a feature here once it is built and working.
 */

export type PlanTier = 'STARTER' | 'STANDARD'

export interface Plan {
  tier: PlanTier
  name: string
  /** Monthly price in whole pounds. */
  monthlyPrice: number
  summary: string
  features: string[]
  popular?: boolean
}

export const PLANS: readonly Plan[] = [
  {
    tier: 'STARTER',
    name: 'Starter',
    monthlyPrice: 49,
    summary: 'For smaller syndicates getting organised.',
    features: [
      'Up to 10 guns',
      'Up to 15 beaters',
      'Shoot day scheduling and PDF briefing sheets',
      'Fair peg rotation across the season',
      'Bag recording by drive, with voice input',
      'Guest gun invites and waivers, with day fees tracked',
      'Beater bookings, pay owed and bank export',
    ],
  },
  {
    tier: 'STANDARD',
    name: 'Standard',
    monthlyPrice: 79,
    summary: 'For established syndicates with a bigger team.',
    features: ['Up to 20 guns', 'Unlimited beaters', 'Everything in Starter', 'Priority support'],
    popular: true,
  },
] as const

/** Billing terms shown beside every price. Keep in step with the Terms page. */
export const BILLING_TERMS = {
  interval: 'month',
  cancelAnytime: true,
  moneyBackDays: 14,
  freeTrial: false,
} as const

export const LOWEST_MONTHLY_PRICE = Math.min(...PLANS.map((plan) => plan.monthlyPrice))
