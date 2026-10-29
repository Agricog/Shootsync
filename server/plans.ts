/**
 * Plan prices the server expects Stripe to charge, in pence.
 * Must match src/config/plans.ts (tests/plans.test.ts compares them).
 * At boot the server reads the live Stripe prices and logs any mismatch.
 */

export const PLAN_PRICES_PENCE = {
  STARTER: 4900,
  STANDARD: 7900,
} as const

export type PlanTierKey = keyof typeof PLAN_PRICES_PENCE

/**
 * What each plan covers: active guns (members who shoot) and active beaters. null is unlimited.
 * Must match the plan features in src/config/plans.ts (tests/site.test.ts compares them).
 */
export const PLAN_LIMITS = {
  STARTER: { guns: 10, beaters: 15 },
  STANDARD: { guns: 20, beaters: null },
} as const satisfies Record<PlanTierKey, { guns: number | null; beaters: number | null }>
