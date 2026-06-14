import { NextResponse } from 'next/server'
import type { NextRequest } from 'next/server'
import { createClient, createAdminClient } from '@/lib/supabase/server'
import { computePrices } from '@/lib/pricing/compute-prices'
import type { PricingRule } from '@/lib/pricing/types'
import type { MatchedRow } from '@/lib/matcher/types'
import { fetchInventoryMap } from '@/lib/shopify/fetch-inventory'

export async function POST(
  _request: NextRequest,
  { params }: { params: Promise<{ runId: string }> }
) {
  const { runId } = await params
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { data: membership } = await supabase
    .from('organization_members')
    .select('organization_id')
    .eq('user_id', user.id)
    .single()

  if (!membership) return NextResponse.json({ error: 'No organization' }, { status: 400 })

  const orgId = membership.organization_id
  const admin = createAdminClient()

  // Verify run belongs to this org before doing anything
  const { data: runCheck } = await admin
    .from('reprice_runs')
    .select('id')
    .eq('id', runId)
    .eq('organization_id', orgId)
    .single()

  if (!runCheck) return NextResponse.json({ error: 'Run not found' }, { status: 404 })

  // Load org pricing rule + margin target
  const { data: org } = await admin
    .from('organizations')
    .select('pricing_rule, margin_target_pct')
    .eq('id', orgId)
    .single()

  const rule: PricingRule = (org?.pricing_rule as PricingRule | null) ?? {
    type: 'markup',
    value: 1.4,
    rounding: '0.99',
  }
  const marginTarget = org?.margin_target_pct ?? 30

  // Load run items
  const { data: items } = await admin
    .from('reprice_run_items')
    .select('id, supplier_sku, shopify_variant_id, product_title, variant_title, old_cost, new_cost, old_price')
    .eq('run_id', runId)
    .eq('organization_id', orgId)

  if (!items || items.length === 0) {
    return NextResponse.json({ error: 'No items found for this run' }, { status: 404 })
  }

  // Step 3: Fetch live inventory if scarcity rules are configured
  let inventoryMap: Map<string, number> | undefined
  if (rule.scarcityRules && rule.scarcityRules.length > 0) {
    const { data: connection } = await admin
      .from('shopify_connections')
      .select('shop_domain, access_token_encrypted')
      .eq('organization_id', orgId)
      .single()

    if (connection) {
      const variantIds = items
        .map((i) => i.shopify_variant_id)
        .filter((id): id is string => id !== null)

      if (variantIds.length > 0) {
        inventoryMap = await fetchInventoryMap(
          connection.shop_domain,
          connection.access_token_encrypted,
          variantIds
        )
      }
    }
  }

  // Reconstruct MatchedRow[] from DB items
  const matchedRows: MatchedRow[] = items.map((item) => ({
    supplierSku: item.supplier_sku,
    supplierCost: item.new_cost ?? 0,
    matchedVariantId: item.shopify_variant_id,
    matchedSku: item.supplier_sku,
    productTitle: item.product_title,
    variantTitle: item.variant_title,
    currentCost: item.old_cost,
    currentPrice: item.old_price,
    matchType: item.shopify_variant_id ? 'exact' : 'unmatched',
  }))

  const pricedRows = computePrices(matchedRows, rule, marginTarget, inventoryMap)

  // Bulk update run items with computed prices
  const updates = pricedRows.map((row, i) => {
    const dbItem = items[i]
    return admin
      .from('reprice_run_items')
      .update({
        new_price: row.proposedPrice,
        margin_pct: row.marginPct,
        flag: row.flag,
      })
      .eq('id', dbItem.id)
  })

  await Promise.all(updates)

  const changedCount = pricedRows.filter(
    (r) => r.proposedPrice !== null && r.currentPrice !== null && r.proposedPrice !== r.currentPrice
  ).length
  const belowMarginCount = pricedRows.filter((r) => r.flag === 'below_margin').length

  await admin
    .from('reprice_runs')
    .update({
      status: 'previewed',
      items_changed: changedCount,
      items_below_margin: belowMarginCount,
    })
    .eq('id', runId)
    .eq('organization_id', orgId)

  return NextResponse.json({
    total: pricedRows.length,
    changed: changedCount,
    belowMargin: belowMarginCount,
  })
}
