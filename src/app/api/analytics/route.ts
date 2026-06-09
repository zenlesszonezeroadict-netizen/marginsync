import { NextResponse } from 'next/server'
import { createClient, createAdminClient } from '@/lib/supabase/server'

export async function GET() {
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

  // Last 30 completed runs, oldest-first so charts read left→right
  const { data: runs } = await admin
    .from('reprice_runs')
    .select('id, created_at, source_filename, items_total, items_changed, items_below_margin')
    .eq('organization_id', orgId)
    .eq('status', 'completed')
    .order('created_at', { ascending: true })
    .limit(30)

  const empty = { runs: [], totals: { retailValue: 0, profit: 0, avgMargin: null as number | null, totalChanged: 0 } }
  if (!runs || runs.length === 0) return NextResponse.json(empty)

  const runIds = runs.map((r) => r.id)

  const { data: items } = await admin
    .from('reprice_run_items')
    .select('run_id, margin_pct, new_price, new_cost')
    .in('run_id', runIds)
    .eq('synced', true)
    .not('new_price', 'is', null)

  // Aggregate per run in JS
  const statsByRun = new Map<string, { margins: number[]; retailValue: number; profit: number }>()
  for (const item of items ?? []) {
    if (!statsByRun.has(item.run_id)) {
      statsByRun.set(item.run_id, { margins: [], retailValue: 0, profit: 0 })
    }
    const s = statsByRun.get(item.run_id)!
    if (item.margin_pct !== null) s.margins.push(item.margin_pct)
    if (item.new_price !== null) {
      s.retailValue += item.new_price
      s.profit += item.new_price - (item.new_cost ?? 0)
    }
  }

  const analyticsRuns = runs.map((run) => {
    const s = statsByRun.get(run.id)
    const avgMargin =
      s && s.margins.length > 0
        ? Math.round((s.margins.reduce((a, b) => a + b, 0) / s.margins.length) * 10) / 10
        : null
    return {
      id: run.id,
      date: run.created_at,
      filename: run.source_filename ?? 'Unnamed',
      itemsChanged: run.items_changed ?? 0,
      itemsTotal: run.items_total ?? 0,
      avgMargin,
      retailValue: Math.round((s?.retailValue ?? 0) * 100) / 100,
      profit: Math.round((s?.profit ?? 0) * 100) / 100,
    }
  })

  const allMargins = analyticsRuns.flatMap((r) => (r.avgMargin !== null ? [r.avgMargin] : []))
  const overallAvgMargin =
    allMargins.length > 0
      ? Math.round((allMargins.reduce((a, b) => a + b, 0) / allMargins.length) * 10) / 10
      : null

  return NextResponse.json({
    runs: analyticsRuns,
    totals: {
      retailValue: Math.round(analyticsRuns.reduce((a, r) => a + r.retailValue, 0) * 100) / 100,
      profit: Math.round(analyticsRuns.reduce((a, r) => a + r.profit, 0) * 100) / 100,
      avgMargin: overallAvgMargin,
      totalChanged: analyticsRuns.reduce((a, r) => a + r.itemsChanged, 0),
    },
  })
}
