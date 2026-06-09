import { applyRounding } from './apply-rounding'
import { recalculateMargin } from './recalculate-margin'
import type { PricingRule, PricedRow } from './types'
import type { MatchedRow } from '@/lib/matcher/types'

/**
 * Apply a pricing rule to each matched row to compute proposed retail prices.
 *
 * inventoryMap (Step 3): optional Map<variantId, stockQty> — when provided and
 * scarcityRules are configured, items below the stock threshold receive an
 * extra markup percentage on top of the base multiplier.
 *
 * Flags (priority order):
 *   'unmatched'    — no catalog match
 *   'below_margin' — computed margin < marginTarget
 *   'cost_up'      — supplier cost rose vs. catalog cost
 *   'ok'           — everything good
 */
export function computePrices(
  rows: MatchedRow[],
  rule: PricingRule,
  marginTarget: number,
  inventoryMap?: Map<string, number>
): PricedRow[] {
  return rows.map((row): PricedRow => {
    if (row.matchType === 'unmatched' || row.matchedVariantId === null) {
      return { ...row, proposedPrice: null, marginPct: null, flag: 'unmatched' }
    }

    const newCost = row.supplierCost
    let effectiveMultiplier = rule.value

    // Apply scarcity premium if a matching inventory threshold is found
    if (inventoryMap && rule.scarcityRules?.length && row.matchedVariantId) {
      const stock = inventoryMap.get(row.matchedVariantId)
      if (stock !== undefined) {
        for (const sr of rule.scarcityRules) {
          if (stock < sr.inventoryThreshold) {
            effectiveMultiplier = rule.value * (1 + sr.extraMarkupPct / 100)
            break  // first matching threshold wins
          }
        }
      }
    }

    const rawPrice = newCost * effectiveMultiplier
    const proposedPrice = applyRounding(rawPrice, rule.rounding)
    const marginPct = recalculateMargin(proposedPrice, newCost)

    const costUp = row.currentCost !== null && newCost > row.currentCost
    const belowMargin = marginPct !== null && marginPct < marginTarget

    let flag: PricedRow['flag']
    if (belowMargin) {
      flag = 'below_margin'
    } else if (costUp) {
      flag = 'cost_up'
    } else {
      flag = 'ok'
    }

    return { ...row, proposedPrice, marginPct, flag }
  })
}
