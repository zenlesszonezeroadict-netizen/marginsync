import { NextResponse } from 'next/server'
import type { NextRequest } from 'next/server'
import { createClient, createAdminClient } from '@/lib/supabase/server'
import { writePricesToShopify } from '@/lib/shopify/write-prices'
import { fireRunNotification } from '@/lib/notifications/fire-run-notification'
import { MAX_ITEMS_PER_SYNC } from '@/lib/billing/quota'
import { BETA_FREE_MODE } from '@/lib/billing/beta'

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

  const { data: org } = await admin
    .from('organizations')
    .select('plan')
    .eq('id', orgId)
    .single()

  // During beta everything is free — only enforce the Pro paywall once beta ends.
  if (!BETA_FREE_MODE && org?.plan !== 'pro') {
    return NextResponse.json(
      { error: 'Syncing prices to Shopify requires MarginSync Pro. Upgrade from the Billing page.' },
      { status: 402 }
    )
  }

  // ── Parse chunk params (optional — omit for legacy all-at-once mode) ───────
  let body: { chunkSize?: number; offset?: number; isFinal?: boolean } = {}
  try { body = (await request.json()) as typeof body } catch { /* no body */ }

  const chunkSize  = typeof body.chunkSize === 'number' && body.chunkSize > 0 ? body.chunkSize : undefined
  const offset     = typeof body.offset    === 'number' && body.offset    >= 0 ? body.offset    : 0
  const clientFinal = body.isFinal === true
  const isChunked  = chunkSize !== undefined

  // ── Resolve run: claim if previewed, or rejoin if already syncing ──────────
  let run: { id: string; source_filename: string | null; items_below_margin: number | null } | null = null

  if (!isChunked || offset === 0) {
    // First (or only) chunk — attempt the atomic previewed → syncing claim
    const { data: claimed } = await admin
      .from('reprice_runs')
      .update({ status: 'syncing' })
      .eq('id', runId)
      .eq('organization_id', orgId)
      .eq('status', 'previewed')
      .select('id, source_filename, items_below_margin')
      .single()

    if (claimed) {
      run = claimed
    } else {
      // Claim failed — check actual state
      const { data: current } = await admin
        .from('reprice_runs')
        .select('id, source_filename, items_below_margin, status')
        .eq('id', runId)
        .eq('organization_id', orgId)
        .single()

      if (!current) return NextResponse.json({ error: 'Run not found' }, { status: 404 })

      // In chunked mode, rejoining a run already in syncing is OK (chunk retry)
      if (current.status === 'syncing' && isChunked) {
        run = current
      } else {
        const msg =
          current.status === 'completed' ? 'Run already synced to Shopify' :
          current.status === 'syncing'   ? 'Sync already in progress' :
                                           'Run is not in a syncable state'
        return NextResponse.json({ error: msg }, { status: 409 })
      }
    }
  } else {
    // Subsequent chunk — verify the run is still in-progress
    const { data: current } = await admin
      .from('reprice_runs')
      .select('id, source_filename, items_below_margin, status')
      .eq('id', runId)
      .eq('organization_id', orgId)
      .single()

    if (!current) return NextResponse.json({ error: 'Run not found' }, { status: 404 })
    if (current.status !== 'syncing') {
      return NextResponse.json({ error: 'Run is no longer in syncing state' }, { status: 409 })
    }
    run = current
  }

  // ── Count total syncable items (drives client progress bar) ───────────────
  const { count: totalSelected } = await admin
    .from('reprice_run_items')
    .select('id', { count: 'exact', head: true })
    .eq('run_id', runId)
    .eq('selected', true)
    .not('shopify_variant_id', 'is', null)
    .not('new_price', 'is', null)

  if ((totalSelected ?? 0) > MAX_ITEMS_PER_SYNC) {
    return NextResponse.json(
      { error: `Sync is limited to ${MAX_ITEMS_PER_SYNC} items per run. This run has ${totalSelected} selected items. Deselect some items and try again.` },
      { status: 413 }
    )
  }

  // ── Fetch items for this chunk (stable ORDER BY id for correct pagination) ─
  const baseQuery = admin
    .from('reprice_run_items')
    .select('id, shopify_variant_id, new_price')
    .eq('run_id', runId)
    .eq('selected', true)
    .not('shopify_variant_id', 'is', null)
    .not('new_price', 'is', null)
    .order('id')

  const itemQuery = isChunked
    ? baseQuery.range(offset, offset + chunkSize - 1)
    : baseQuery

  const { data: items } = await itemQuery

  if (!items || items.length === 0) {
    // Empty chunk (or nothing to sync) — finalize immediately
    await admin
      .from('reprice_runs')
      .update({ status: 'completed', completed_at: new Date().toISOString() })
      .eq('id', runId)
    return NextResponse.json({
      synced: 0,
      failed: 0,
      total: 0,
      totalSelected: totalSelected ?? 0,
      status: 'completed',
    })
  }

  // ── Shopify connection ─────────────────────────────────────────────────────
  const { data: connection } = await admin
    .from('shopify_connections')
    .select('shop_domain, access_token_encrypted')
    .eq('organization_id', orgId)
    .single()

  if (!connection) {
    return NextResponse.json(
      { error: 'No Shopify connection. Connect your store first.' },
      { status: 400 }
    )
  }

  // ── Write prices (rate-limiter + retry already inside writePricesToShopify) ─
  const updates = items.map((item) => ({
    variantId: item.shopify_variant_id!,
    price: item.new_price!,
  }))

  const results = await writePricesToShopify(
    connection.shop_domain,
    connection.access_token_encrypted,
    updates
  )

  const syncedIds: string[] = []
  const errorItems: Array<{ id: string; error: string }> = []

  for (let i = 0; i < results.length; i++) {
    const result = results[i]
    const item   = items[i]
    if (result.success) {
      syncedIds.push(item.id)
    } else {
      errorItems.push({ id: item.id, error: result.error ?? 'Unknown error' })
    }
  }

  if (syncedIds.length > 0) {
    await admin
      .from('reprice_run_items')
      .update({ synced: true })
      .in('id', syncedIds)
  }

  for (const { id, error } of errorItems) {
    await admin.from('reprice_run_items').update({ error }).eq('id', id)
  }

  // ── Decide whether to finalize the run status ──────────────────────────────
  // Determined server-side only — never trust client isFinal flag
  const isLastChunk = !isChunked || items.length < chunkSize! || (offset + items.length) >= (totalSelected ?? 0)

  type RunStatus = 'pending' | 'parsed' | 'previewed' | 'syncing' | 'completed' | 'failed'
  let finalStatus: RunStatus = 'syncing'
  if (isLastChunk) {
    finalStatus = errorItems.length === 0 || syncedIds.length > 0 ? 'completed' : 'failed'
    await admin
      .from('reprice_runs')
      .update({ status: finalStatus, completed_at: new Date().toISOString() })
      .eq('id', runId)

    void fireRunNotification({
      orgId,
      runId,
      filename: run.source_filename,
      synced: syncedIds.length,
      failed: errorItems.length,
      status: finalStatus,
      itemsBelowMargin: run.items_below_margin ?? 0,
      admin,
    })
  }

  return NextResponse.json({
    synced: syncedIds.length,
    failed: errorItems.length,
    total: items.length,
    totalSelected: totalSelected ?? 0,
    status: finalStatus,
  })
}
