import Fuse from 'fuse.js'
import { normalizeSKU } from './normalize-sku'
import type { CatalogEntry, MatchedRow } from './types'
import type { ParsedRow } from '@/lib/parser/types'
import type { ColumnConfig } from '@/lib/parser/types'

/** Existing supplier-SKU → Shopify-variant-ID mappings saved by the user. */
export type SavedMappings = Record<string, string>  // normalizedSupplierSku → variantId

/**
 * Match parsed supplier rows against the catalog.
 *
 * Strategy:
 * 1. Check saved user mappings first (highest priority).
 * 2. Exact match on normalized SKU (O(1) via Map).
 * 3. Fuzzy match via Fuse.js at threshold ≤ 0.3.
 * 4. Unmatched otherwise.
 */
export function matchSKUs(
  rows: ParsedRow[],
  catalog: CatalogEntry[],
  config: ColumnConfig,
  savedMappings: SavedMappings = {}
): MatchedRow[] {
  // Build exact-match lookup: normalized catalog SKU → entry
  const exactMap = new Map<string, CatalogEntry>()
  for (const entry of catalog) {
    exactMap.set(normalizeSKU(entry.sku), entry)
  }

  // Build variant-id lookup for saved mappings
  const variantMap = new Map<string, CatalogEntry>()
  for (const entry of catalog) {
    variantMap.set(entry.variantId, entry)
  }

  // Fuse index for fuzzy fallback
  const fuse = new Fuse(catalog, {
    keys: ['sku'],
    threshold: 0.3,
    includeScore: true,
    getFn: (obj, path) => {
      const key = Array.isArray(path) ? path[0] : path
      if (key === 'sku') return normalizeSKU(obj.sku)
      return ''
    },
  })

  return rows.map((row): MatchedRow => {
    const rawSku = row[config.skuCol] ?? ''
    const rawCost = row[config.costCol] ?? '0'
    const supplierSku = rawSku
    const normalizedSupplierSku = normalizeSKU(rawSku)
    const supplierCost = parseFloat(rawCost.replace(/[^0-9.]/g, '')) || 0

    // 1. Saved user mapping
    if (savedMappings[normalizedSupplierSku]) {
      const variantId = savedMappings[normalizedSupplierSku]
      const entry = variantMap.get(variantId)
      if (entry) {
        return makeRow(supplierSku, supplierCost, entry, 'exact')
      }
    }

    // 2. Exact match
    const exact = exactMap.get(normalizedSupplierSku)
    if (exact) {
      return makeRow(supplierSku, supplierCost, exact, 'exact')
    }

    // 3. Fuzzy match
    const fuzzyResults = fuse.search(normalizedSupplierSku)
    if (fuzzyResults.length > 0 && fuzzyResults[0].item) {
      return makeRow(supplierSku, supplierCost, fuzzyResults[0].item, 'fuzzy')
    }

    // 4. Unmatched
    return {
      supplierSku,
      supplierCost,
      matchedVariantId: null,
      matchedSku: null,
      productTitle: null,
      variantTitle: null,
      currentCost: null,
      currentPrice: null,
      matchType: 'unmatched',
    }
  })
}

function makeRow(
  supplierSku: string,
  supplierCost: number,
  entry: CatalogEntry,
  matchType: 'exact' | 'fuzzy'
): MatchedRow {
  return {
    supplierSku,
    supplierCost,
    matchedVariantId: entry.variantId,
    matchedSku: entry.sku,
    productTitle: entry.productTitle,
    variantTitle: entry.variantTitle,
    currentCost: entry.currentCost,
    currentPrice: entry.currentPrice,
    matchType,
  }
}
