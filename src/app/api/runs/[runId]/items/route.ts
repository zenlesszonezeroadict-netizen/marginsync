import { NextResponse } from 'next/server'
import type { NextRequest } from 'next/server'
import { createClient, createAdminClient } from '@/lib/supabase/server'

const VALID_FILTERS = ['all', 'ok', 'cost_up', 'below_margin', 'unmatched'] as const
type FilterParam = typeof VALID_FILTERS[number]

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ runId: string }> }
) {
  const { runId } = await params
  const { searchParams } = new URL(request.url)

  const page  = Math.max(1, parseInt(searchParams.get('page')  ?? '1',  10))
  const limit = Math.min(200, Math.max(1, parseInt(searchParams.get('limit') ?? '50', 10)))

  // ?filter= is primary; fall back to legacy ?flag= param
  const rawFilter = searchParams.get('filter') ?? searchParams.get('flag') ?? 'all'
  const filter: FilterParam = (VALID_FILTERS as readonly string[]).includes(rawFilter)
    ? (rawFilter as FilterParam)
    : 'all'

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
    .select('id, items_total')
    .eq('id', runId)
    .eq('organization_id', membership.organization_id)
    .single()
  if (!run) return NextResponse.json({ error: 'Run not found' }, { status: 404 })

  const from = (page - 1) * limit
  const to   = from + limit - 1

  // Items query — { count: 'exact' } returns total matching rows independent of range
  let itemQuery = admin
    .from('reprice_run_items')
    .select(
      'id, supplier_sku, shopify_variant_id, product_title, variant_title,' +
      ' old_cost, new_cost, old_price, new_price, margin_pct, flag, selected, synced',
      { count: 'exact' }
    )
    .eq('run_id', runId)
    .order('flag', { ascending: true })
    .range(from, to)

  if (filter !== 'all') {
    itemQuery = itemQuery.eq('flag', filter)
  }

  // Aggregate counts (all flags + selected) — run fully in parallel with items query
  const [itemsResult, okRes, costUpRes, belowMarginRes, unmatchedRes, selectedRes] =
    await Promise.all([
      itemQuery,
      admin.from('reprice_run_items').select('id', { count: 'exact', head: true }).eq('run_id', runId).eq('flag', 'ok'),
      admin.from('reprice_run_items').select('id', { count: 'exact', head: true }).eq('run_id', runId).eq('flag', 'cost_up'),
      admin.from('reprice_run_items').select('id', { count: 'exact', head: true }).eq('run_id', runId).eq('flag', 'below_margin'),
      admin.from('reprice_run_items').select('id', { count: 'exact', head: true }).eq('run_id', runId).eq('flag', 'unmatched'),
      admin.from('reprice_run_items').select('id', { count: 'exact', head: true }).eq('run_id', runId).eq('selected', true).not('shopify_variant_id', 'is', null),
    ])

  const allCount   = run.items_total ?? 0
  const totalCount = filter === 'all' ? allCount : (itemsResult.count ?? 0)
  const totalPages = Math.max(1, Math.ceil(totalCount / limit))

  return NextResponse.json({
    items:      itemsResult.data ?? [],
    totalCount,
    page,
    limit,
    totalPages,
    counts: {
      all:           allCount,
      ok:            okRes.count        ?? 0,
      cost_up:       costUpRes.count    ?? 0,
      below_margin:  belowMarginRes.count ?? 0,
      unmatched:     unmatchedRes.count ?? 0,
      selectedForSync: selectedRes.count ?? 0,
    },
    // Backward-compatible fields
    matchedCount: (okRes.count ?? 0) + (costUpRes.count ?? 0) + (belowMarginRes.count ?? 0),
    total: allCount,
  })
}
