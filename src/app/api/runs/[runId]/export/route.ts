import { NextResponse } from 'next/server'
import type { NextRequest } from 'next/server'
import { createClient, createAdminClient } from '@/lib/supabase/server'

export async function GET(
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

  const admin = createAdminClient()

  const { data: run } = await admin
    .from('reprice_runs')
    .select('id, source_filename, status')
    .eq('id', runId)
    .eq('organization_id', membership.organization_id)
    .single()

  if (!run) return NextResponse.json({ error: 'Run not found' }, { status: 404 })

  const { data: items } = await admin
    .from('reprice_run_items')
    .select('supplier_sku, shopify_variant_id, product_title, variant_title, old_cost, new_cost, old_price, new_price, margin_pct, flag, selected')
    .eq('run_id', runId)
    .order('flag', { ascending: true })

  const rows = items ?? []

  const headers = [
    'Supplier SKU',
    'Shopify Variant ID',
    'Product Title',
    'Variant Title',
    'Old Cost',
    'New Cost',
    'Old Price',
    'New Price',
    'Margin %',
    'Flag',
    'Selected',
  ]

  const csvLines = [
    headers.join(','),
    ...rows.map((row) =>
      [
        csvCell(row.supplier_sku),
        csvCell(row.shopify_variant_id),
        csvCell(row.product_title),
        csvCell(row.variant_title),
        row.old_cost ?? '',
        row.new_cost ?? '',
        row.old_price ?? '',
        row.new_price ?? '',
        row.margin_pct !== null ? row.margin_pct.toFixed(2) : '',
        csvCell(row.flag),
        row.selected ? 'yes' : 'no',
      ].join(',')
    ),
  ]

  const csv = csvLines.join('\r\n')
  const baseFilename = run.source_filename?.replace(/\.[^.]+$/, '') ?? `run-${runId.slice(0, 8)}`
  const filename = `${baseFilename}-repriced.csv`

  return new NextResponse(csv, {
    status: 200,
    headers: {
      'Content-Type': 'text/csv; charset=utf-8',
      'Content-Disposition': `attachment; filename="${filename}"`,
    },
  })
}

function csvCell(val: string | null | undefined): string {
  if (val === null || val === undefined) return ''
  const str = String(val)
  if (str.includes(',') || str.includes('"') || str.includes('\n')) {
    return `"${str.replace(/"/g, '""')}"`
  }
  return str
}
