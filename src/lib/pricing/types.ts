import type { MatchedRow } from '@/lib/matcher/types'

/** Rounding modes for computed retail prices. */
export type RoundingMode = '0.99' | '0.00' | 'none'

/** Step 3: conditional markup rule based on Shopify inventory level. */
export interface ScarcityRule {
  inventoryThreshold: number  // trigger when stock < this value
  extraMarkupPct: number      // add this % on top of base multiplier (e.g. 10 = +10%)
}

/** The persisted pricing rule for an org. */
export interface PricingRule {
  type: 'markup'
  value: number          // e.g. 1.4 = 40% markup over cost
  rounding: RoundingMode
  scarcityRules?: ScarcityRule[]
}

/** A matched row after the pricing engine has applied the rule. */
export interface PricedRow extends MatchedRow {
  proposedPrice: number | null
  marginPct: number | null
  flag: 'ok' | 'cost_up' | 'below_margin' | 'unmatched'
}

export const DEFAULT_PRICING_RULE: PricingRule = {
  type: 'markup',
  value: 1.4,
  rounding: '0.99',
}
