/** A single product variant in the catalog (real or mock). */
export interface CatalogEntry {
  variantId: string
  sku: string
  productTitle: string
  variantTitle: string
  currentCost: number
  currentPrice: number
}

/** A parsed row after matching against the catalog. */
export interface MatchedRow {
  supplierSku: string
  supplierCost: number
  matchedVariantId: string | null
  matchedSku: string | null
  productTitle: string | null
  variantTitle: string | null
  currentCost: number | null
  currentPrice: number | null
  matchType: 'exact' | 'fuzzy' | 'unmatched'
}
