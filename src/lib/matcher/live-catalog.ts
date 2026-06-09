import { createAdminClient } from '@/lib/supabase/server'
import type { CatalogEntry } from './types'

interface CatalogCache {
  shopify_sku?: string | null
  product_title?: string | null
  variant_title?: string | null
  current_price?: number | null
  current_cost?: number | null
}

/**
 * Builds a CatalogEntry[] from the sku_mappings table for a given org.
 * Falls back to an empty array if no mappings exist (triggers unmatched for all rows).
 */
export async function loadLiveCatalog(orgId: string): Promise<CatalogEntry[]> {
  const admin = createAdminClient()

  const { data: mappings } = await admin
    .from('sku_mappings')
    .select('shopify_variant_id, shopify_sku, catalog_cache')
    .eq('organization_id', orgId)
    .not('shopify_variant_id', 'is', null)

  if (!mappings || mappings.length === 0) return []

  return mappings.map((m): CatalogEntry => {
    const cache = (m.catalog_cache ?? {}) as CatalogCache
    return {
      variantId: m.shopify_variant_id!,
      sku: m.shopify_sku ?? '',
      productTitle: cache.product_title ?? '',
      variantTitle: cache.variant_title ?? '',
      currentCost: cache.current_cost ?? 0,
      currentPrice: cache.current_price ?? 0,
    }
  })
}
