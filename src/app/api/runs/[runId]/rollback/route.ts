import { NextResponse } from 'next/server'
import type { NextRequest } from 'next/server'
import { createClient, createAdminClient } from '@/lib/supabase/server'
import { writePricesToShopify } from '@/lib/shopify/write-prices'

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

  const { data: run } = await admin
    .from('reprice_runs')
    .select('id, status, rolled_back_at')
    .eq('id', runId)
    .eq('organization_id', orgId)
    .single()

  if (!run) return NextResponse.json({ error: 'Run not found' }, { status: 404 })
  if (run.status !== 'completed') {
    return NextResponse.json({ error: 'Only completed runs can be rolled back' }, { status: 409 })
  }
  if (run.rolled_back_at) {
    return NextResponse.json({ error: 'Run has already been rolled back' }, { status: 409 })
  }

  const { data: connection } = await admin
    .from('shopify_connections')
    .select('shop_domain, access_token_encrypted')
    .eq('organization_id', orgId)
    .single()

  if (!connection) {
    return NextResponse.json({ error: 'No Shopify connection found' }, { status: 400 })
  }

  // Load synced items that have a recorded old_price to restore
  const { data: items } = await admin
    .from('reprice_run_items')
    .select('id, shopify_variant_id, old_price')
    .eq('run_id', runId)
    .eq('synced', true)
    .not('old_price', 'is', null)
    .not('shopify_variant_id', 'is', null)

  if (!items || items.length === 0) {
    return NextResponse.json(
      { error: 'No synced items with recorded previous prices to restore' },
      { status: 400 }
    )
  }

  const updates = items.map((item) => ({
    variantId: item.shopify_variant_id as string,
    price: item.old_price as number,
  }))

  const results = await writePricesToShopify(
    connection.shop_domain,
    connection.access_token_encrypted,
    updates
  )

  const rolledBack = results.filter((r) => r.success).length
  const failed = results.filter((r) => !r.success).length

  if (rolledBack > 0) {
    await admin
      .from('reprice_runs')
      .update({ rolled_back_at: new Date().toISOString() })
      .eq('id', runId)
  }

  return NextResponse.json({ rolledBack, failed, total: items.length })
}
