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
