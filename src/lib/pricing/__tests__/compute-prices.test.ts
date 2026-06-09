import { describe, it, expect } from 'vitest'
import { computePrices } from '../compute-prices'
import type { PricingRule } from '../types'
import type { MatchedRow } from '@/lib/matcher/types'

const BASE_RULE: PricingRule = { type: 'markup', value: 1.4, rounding: '0.00' }

function makeRow(overrides: Partial<MatchedRow> = {}): MatchedRow {
  return {
    supplierSku: 'SKU-1',
    supplierCost: 10,
    matchedVariantId: 'v1',
    matchedSku: 'SKU-1',
    productTitle: 'Widget',
    variantTitle: 'Default',
    currentCost: 10,
    currentPrice: 14,
    matchType: 'exact',
    ...overrides,
  }
}

describe('computePrices', () => {
  it('computes proposed price as cost × rule.value', () => {
    const [result] = computePrices([makeRow({ supplierCost: 10 })], BASE_RULE, 20)
    expect(result.proposedPrice).toBeCloseTo(14, 2)
  })

  it('returns null proposed price for unmatched rows', () => {
    const [result] = computePrices(
      [makeRow({ matchType: 'unmatched', matchedVariantId: null })],
      BASE_RULE,
      20
    )
    expect(result.proposedPrice).toBeNull()
    expect(result.flag).toBe('unmatched')
  })

  it('flags below_margin when margin < target', () => {
    // cost = 10, price = 14, margin = 28.6% → below 30% target
    const [result] = computePrices([makeRow({ supplierCost: 10 })], BASE_RULE, 30)
    expect(result.flag).toBe('below_margin')
  })

  it('flags ok when margin >= target', () => {
    // cost = 10, price = 14, margin = 28.6% → ok at 20% target
    const [result] = computePrices([makeRow({ supplierCost: 10 })], BASE_RULE, 20)
    expect(result.flag).toBe('ok')
  })

  it('flags cost_up when new cost > old cost and margin is above target', () => {
    const [result] = computePrices(
      [makeRow({ supplierCost: 12, currentCost: 10 })],
      BASE_RULE,
      10  // low target so margin is fine
    )
    expect(result.flag).toBe('cost_up')
  })

  it('prefers below_margin flag over cost_up', () => {
    // cost up AND below margin → below_margin wins
    const [result] = computePrices(
      [makeRow({ supplierCost: 12, currentCost: 10 })],
      BASE_RULE,
      50  // high target so it triggers below_margin
    )
    expect(result.flag).toBe('below_margin')
  })

  it('computes margin percentage correctly', () => {
    // price = 14, cost = 10 → margin = (14-10)/14 * 100 = 28.57%
    const [result] = computePrices([makeRow({ supplierCost: 10 })], BASE_RULE, 20)
    expect(result.marginPct).toBeCloseTo(28.57, 1)
  })

  it('applies 0.99 rounding correctly', () => {
    const rule: PricingRule = { type: 'markup', value: 1.4, rounding: '0.99' }
    // cost = 10, 10 * 1.4 = 14.0 → ceil(14) - 0.01 = 13.99
    const [result] = computePrices([makeRow({ supplierCost: 10 })], rule, 20)
    expect(result.proposedPrice).toBe(13.99)
  })

  it('processes all rows', () => {
    const rows = [makeRow(), makeRow({ supplierSku: 'SKU-2', supplierCost: 20 })]
    const results = computePrices(rows, BASE_RULE, 20)
    expect(results).toHaveLength(2)
  })
})
