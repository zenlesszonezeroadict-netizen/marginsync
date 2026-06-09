import { fetchAllVariants } from './client'
import { createAdminClient } from '@/lib/supabase/server'
import type { Json } from '@/lib/types/database'

interface SyncResult {
  upserted: number
  skipped: number
}

/**
 * Syncs Shopify product variants into the sku_mappings table.
 * - Variants with no SKU are skipped.
 * - Uses shopify_variant.sku as the supplier_sku baseline.
 * - Caches product metadata in catalog_cache for use by the matcher.
 * - Upserts on (organization_id, supplier_sku) — ignores conflicts.
 */
export async function syncCatalog(
  orgId: string,
  shopDomain: string,
  encryptedToken: string
): Promise<SyncResult> {
  const variantItems = await fetchAllVariants(shopDomain, encryptedToken)
  const admin = createAdminClient()

  const rows: Array<{
    organization_id: string
    supplier_sku: string
    shopify_variant_id: string
    shopify_sku: string
    catalog_cache: Json
  }> = []

  let skipped = 0

  for (const { product, variant } of variantItems) {
    if (!variant.sku || variant.sku.trim() === '') {
      skipped++
      continue
    }

    const currentPrice = parseFloat(variant.price) || null

    rows.push({
      organization_id: orgId,
      supplier_sku: variant.sku.trim(),
      shopify_variant_id: String(variant.id),
      shopify_sku: variant.sku.trim(),
      catalog_cache: {
        shopify_sku: variant.sku.trim(),
        product_title: product.title,
        variant_title: variant.title === 'Default Title' ? null : variant.title,
        current_price: currentPrice,
        current_cost: null,  // cost requires InventoryItem API — not fetched in MVP
      } as Json,
    })
  }

  if (rows.length === 0) {
    return { upserted: 0, skipped }
  }

  // Batch upsert in chunks of 500 to stay within Supabase limits
  const CHUNK = 500
  for (let i = 0; i < rows.length; i += CHUNK) {
    await admin
      .from('sku_mappings')
      .upsert(rows.slice(i, i + CHUNK), { onConflict: 'organization_id,supplier_sku', ignoreDuplicates: false })
  }

  return { upserted: rows.length, skipped }
}
