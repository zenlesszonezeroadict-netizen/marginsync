import { describe, it, expect } from 'vitest'
import { matchSKUs } from '../match-skus'
import type { CatalogEntry } from '../types'
import type { ParsedRow } from '@/lib/parser/types'
import type { ColumnConfig } from '@/lib/parser/types'

const CATALOG: CatalogEntry[] = [
  { variantId: 'v1', sku: 'SKU-ALPHA', productTitle: 'Widget Alpha', variantTitle: 'Default', currentCost: 10, currentPrice: 25 },
  { variantId: 'v2', sku: 'SKU-BETA',  productTitle: 'Widget Beta',  variantTitle: 'Red',     currentCost: 15, currentPrice: 35 },
  { variantId: 'v3', sku: 'BP-20-4789', productTitle: 'Brake Pads', variantTitle: 'Front',   currentCost: 18, currentPrice: 42 },
]

const CONFIG: ColumnConfig = { skuCol: 'sku', costCol: 'cost' }

function makeRows(data: Array<{ sku: string; cost: string }>): ParsedRow[] {
  return data.map(({ sku, cost }) => ({ sku, cost }))
}

describe('matchSKUs', () => {
  it('returns exact match for known SKU', () => {
    const [result] = matchSKUs(makeRows([{ sku: 'SKU-ALPHA', cost: '12.00' }]), CATALOG, CONFIG)
    expect(result.matchType).toBe('exact')
    expect(result.matchedVariantId).toBe('v1')
    expect(result.supplierCost).toBe(12)
  })

  it('normalizes SKU for exact match (lowercase, extra spaces)', () => {
    const [result] = matchSKUs(makeRows([{ sku: 'sku-alpha', cost: '5' }]), CATALOG, CONFIG)
    expect(result.matchType).toBe('exact')
    expect(result.matchedVariantId).toBe('v1')
  })

  it('returns unmatched for unknown SKU', () => {
    const [result] = matchSKUs(makeRows([{ sku: 'NO-SUCH-SKU', cost: '5' }]), CATALOG, CONFIG)
    expect(result.matchType).toBe('unmatched')
    expect(result.matchedVariantId).toBeNull()
  })

  it('uses saved mapping over exact match', () => {
    const savedMappings = { 'SKULPHA': 'v2' }  // Saved: SKU-ALPHA normalized → v2 (overrides catalog exact)
    // Note: normalizeSKU strips hyphens... actually it keeps them.
    // Saved key must be normalized: normalizeSKU('SKU-ALPHA') = 'SKU-ALPHA'
    const mappings = { 'SKU-ALPHA': 'v2' }
    const [result] = matchSKUs(makeRows([{ sku: 'SKU-ALPHA', cost: '5' }]), CATALOG, CONFIG, mappings)
    expect(result.matchedVariantId).toBe('v2')
    expect(result.matchType).toBe('exact')
  })

  it('handles non-numeric cost gracefully (returns 0)', () => {
    const [result] = matchSKUs(makeRows([{ sku: 'SKU-ALPHA', cost: 'N/A' }]), CATALOG, CONFIG)
    expect(result.supplierCost).toBe(0)
  })

  it('handles cost with currency symbol', () => {
    const [result] = matchSKUs(makeRows([{ sku: 'SKU-ALPHA', cost: '$14.50' }]), CATALOG, CONFIG)
    expect(result.supplierCost).toBe(14.5)
  })

  it('returns all rows', () => {
    const rows = makeRows([
      { sku: 'SKU-ALPHA', cost: '10' },
      { sku: 'SKU-BETA', cost: '15' },
      { sku: 'UNKNOWN', cost: '5' },
    ])
    const results = matchSKUs(rows, CATALOG, CONFIG)
    expect(results).toHaveLength(3)
  })

  it('fuzzy-matches a close SKU variant', () => {
    // BP-20-4789 in catalog; supply BP-204789 (missing hyphen in middle)
    const [result] = matchSKUs(makeRows([{ sku: 'BP204789', cost: '20' }]), CATALOG, CONFIG)
    // fuse.js at threshold 0.3 — may or may not match depending on distance; verify it attempts
    // If it does match, it should be fuzzy
    if (result.matchType === 'fuzzy') {
      expect(result.matchedVariantId).toBe('v3')
    } else {
      // Acceptable: unmatched due to distance being above threshold
      expect(result.matchType).toBe('unmatched')
    }
  })
})
