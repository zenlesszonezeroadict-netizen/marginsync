import { NextResponse } from 'next/server'
import type { NextRequest } from 'next/server'
import { createClient, createAdminClient } from '@/lib/supabase/server'
import type { ColumnConfig } from '@/lib/parser/types'

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
    .select('id, status, source_filename, column_config, items_total, items_changed, items_below_margin, created_at')
    .eq('id', runId)
    .eq('organization_id', membership.organization_id)
    .single()

  if (!run) return NextResponse.json({ error: 'Run not found' }, { status: 404 })

  const columnConfig = run.column_config as (ColumnConfig & { headers?: string[] }) | null

  return NextResponse.json({
    id: run.id,
    status: run.status,
    sourceFilename: run.source_filename,
    headers: columnConfig?.headers ?? [],
    columnConfig: columnConfig
      ? { skuCol: columnConfig.skuCol ?? '', costCol: columnConfig.costCol ?? '' }
      : null,
    itemsTotal: run.items_total,
    itemsChanged: run.items_changed,
    itemsBelowMargin: run.items_below_margin,
    createdAt: run.created_at,
  })
}

export async function PATCH(
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

  const body = await request.json() as { skuCol: string; costCol: string }
  if (!body.skuCol || !body.costCol) {
    return NextResponse.json({ error: 'skuCol and costCol are required' }, { status: 400 })
  }

  const admin = createAdminClient()

  // Fetch existing run to preserve headers in column_config
  const { data: existing } = await admin
    .from('reprice_runs')
    .select('column_config')
    .eq('id', runId)
    .eq('organization_id', membership.organization_id)
    .single()

  if (!existing) return NextResponse.json({ error: 'Run not found' }, { status: 404 })

  const existingConfig = existing.column_config as Record<string, unknown> | null
  const updated = {
    ...(existingConfig ?? {}),
    skuCol: body.skuCol,
    costCol: body.costCol,
  }

  await admin
    .from('reprice_runs')
    .update({ column_config: updated })
    .eq('id', runId)

  return NextResponse.json({ ok: true })
}
