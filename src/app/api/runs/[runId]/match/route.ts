import { NextResponse } from 'next/server'
import type { NextRequest } from 'next/server'
import { createClient, createAdminClient } from '@/lib/supabase/server'
import { downloadSupplierFile } from '@/lib/supabase/storage'
import { parseFile } from '@/lib/parser/parse-file'
import { matchSKUs } from '@/lib/matcher/match-skus'
import { loadLiveCatalog } from '@/lib/matcher/live-catalog'
import { MOCK_CATALOG } from '@/lib/matcher/mock-catalog'
import type { ColumnConfig } from '@/lib/parser/types'
import type { SavedMappings } from '@/lib/matcher/match-skus'
import { normalizeSKU } from '@/lib/matcher/normalize-sku'

export async function POST(
  request: NextRequest,
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

  // Fetch run (must belong to org)
  const { data: run } = await admin
    .from('reprice_runs')
    .select('id, source_filename, column_config, status, organization_id')
    .eq('id', runId)
    .eq('organization_id', orgId)
    .single()

  if (!run) return NextResponse.json({ error: 'Run not found' }, { status: 404 })
  if (run.status !== 'parsed') {
    return NextResponse.json({ error: 'Run is not in parsed state' }, { status: 409 })
  }

  const columnConfig = run.column_config as ColumnConfig | null
  if (!columnConfig?.skuCol || !columnConfig?.costCol) {
    return NextResponse.json({ error: 'Column config not set — complete map-columns step first' }, { status: 409 })
  }

  // Re-parse the file from storage
  const storagePath = `${orgId}/${runId}/${run.source_filename}`
  let buffer: Buffer
  try {
    buffer = await downloadSupplierFile(storagePath)
  } catch {
    return NextResponse.json({ error: 'Could not retrieve uploaded file' }, { status: 500 })
  }

  const rows = await parseFile(buffer, run.source_filename ?? 'file.csv', 'text/csv')

  // Load saved SKU mappings for this org
  const { data: mappingRows } = await admin
    .from('sku_mappings')
    .select('supplier_sku, shopify_variant_id')
    .eq('organization_id', orgId)

  const savedMappings: SavedMappings = {}
  for (const m of mappingRows ?? []) {
    savedMappings[normalizeSKU(m.supplier_sku)] = m.shopify_variant_id
  }

  // Use live catalog from sku_mappings if available; fall back to mock catalog
  const liveCatalog = await loadLiveCatalog(orgId)
  const catalog = liveCatalog.length > 0 ? liveCatalog : MOCK_CATALOG
  const matchedRows = matchSKUs(rows, catalog, columnConfig, savedMappings)

  // Upsert run items
  const itemsToInsert = matchedRows.map((row) => ({
    run_id: runId,
    organization_id: orgId,
    supplier_sku: row.supplierSku,
    shopify_variant_id: row.matchedVariantId,
    product_title: row.productTitle,
    variant_title: row.variantTitle,
    old_cost: row.currentCost,
    new_cost: row.supplierCost,
    old_price: row.currentPrice,
    flag: row.matchType === 'unmatched' ? 'unmatched' as const : null,
    selected: true,
    synced: false,
  }))

  await admin.from('reprice_run_items').delete().eq('run_id', runId)
  await admin.from('reprice_run_items').insert(itemsToInsert)

  const unmatchedCount = matchedRows.filter((r) => r.matchType === 'unmatched').length

  // Update aggregates
  await admin
    .from('reprice_runs')
    .update({ items_total: matchedRows.length })
    .eq('id', runId)

  return NextResponse.json({
    matched: matchedRows.length - unmatchedCount,
    unmatched: unmatchedCount,
    total: matchedRows.length,
  })
}
