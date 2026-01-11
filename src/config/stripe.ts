/**
 * Stripe Configuration - ShootSync
 * Payment processing setup
 */

export const STRIPE_CONFIG = {
  publishableKey: import.meta.env.VITE_STRIPE_PUBLISHABLE_KEY || '',
  
  connectReturnUrl: `${import.meta.env.VITE_APP_URL || ''}/beater/stripe-complete`,
  connectRefreshUrl: `${import.meta.env.VITE_APP_URL || ''}/beater/stripe-refresh`,
  
  guestPaymentSuccessUrl: `${import.meta.env.VITE_APP_URL || ''}/guest/payment-success`,
  guestPaymentCancelUrl: `${import.meta.env.VITE_APP_URL || ''}/guest/payment-cancelled`,
  
  currency: 'gbp',
  country: 'GB',
  
  beaterPayoutFee: 0.0025,
  beaterPayoutFixed: 10,
  
  platformFeePercent: 0.02,
} as const

export const calculatePayoutAmount = (
  grossAmount: number
): { net: number; fee: number } => {
  const fee = Math.round(grossAmount * STRIPE_CONFIG.beaterPayoutFee) + STRIPE_CONFIG.beaterPayoutFixed
  return {
    net: grossAmount - fee,
    fee
  }
}

export const calculatePlatformFee = (amount: number): number => {
  return Math.round(amount * STRIPE_CONFIG.platformFeePercent)
}

export const formatCurrency = (
  amountInPence: number,
  includeSymbol: boolean = true
): string => {
  const pounds = amountInPence / 100
  const formatted = pounds.toFixed(2)
  return includeSymbol ? `£${formatted}` : formatted
}

export const parseCurrencyInput = (input: string): number | null => {
  const cleaned = input.replace(/[£,\s]/g, '')
  const parsed = parseFloat(cleaned)
  
  if (isNaN(parsed) || parsed < 0) {
    return null
  }
  
  return Math.round(parsed * 100)
}

export const SUBSCRIPTION_TIERS = {
  starter: {
    name: 'Starter',
    priceMonthly: 3900,
    priceAnnual: 39000,
    maxGuns: 10,
    maxBeaters: 15,
    maxAdmins: 1,
    features: ['Basic peg allocation', 'Bag recording', 'Member management'],
  },
  standard: {
    name: 'Standard',
    priceMonthly: 6900,
    priceAnnual: 69000,
    maxGuns: 20,
    maxBeaters: -1,
    maxAdmins: 3,
    features: ['Everything in Starter', 'Guest management', 'Stripe payments', 'PDF briefings'],
  },
  estate: {
    name: 'Estate',
    priceMonthly: 14900,
    priceAnnual: 149000,
    maxGuns: -1,
    maxBeaters: -1,
    maxAdmins: -1,
    features: ['Everything in Standard', 'Multiple shoots', 'Let day management', 'API access', 'Priority support'],
  },
} as const

export type SubscriptionTier = keyof typeof SUBSCRIPTION_TIERS
