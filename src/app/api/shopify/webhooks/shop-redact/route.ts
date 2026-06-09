import { NextResponse } from 'next/server'
import type { NextRequest } from 'next/server'
import { createAdminClient } from '@/lib/supabase/server'
import { verifyShopifyWebhook } from '@/lib/shopify/verify-webhook'

/**
 * shop/redact
 * Mandatory GDPR webhook — fires 48 hours after a merchant uninstalls the app.
 * Permanently purges all data associated with the shop: runs, SKU mappings,
 * the Shopify connection record, and all uploaded supplier files in Storage.
 *
 * DB deletion order respects FK constraints:
 *   reprice_runs (cascades → reprice_run_items) → sku_mappings → shopify_connections
 *
 * Storage cleanup is fired non-blocking so the 200 response is never delayed
 * by Storage round-trips.
 */
export async function POST(request: NextRequest) {
  const rawBody = await request.text()
  const hmac = request.headers.get('x-shopify-hmac-sha256') ?? ''

  if (!verifyShopifyWebhook(rawBody, hmac)) {
    return new NextResponse('Unauthorized', { status: 401 })
  }

  let payload: { shop_id?: number; shop_domain?: string }
  try {
    payload = JSON.parse(rawBody) as { shop_id?: number; shop_domain?: string }
  } catch {
    return new NextResponse('Bad Request', { status: 400 })
  }

  const shopDomain = payload.shop_domain
  if (!shopDomain) {
    return new NextResponse('Bad Request', { status: 400 })
  }

  const admin = createAdminClient()

  // Resolve org from the shop connection
  const { data: connection } = await admin
    .from('shopify_connections')
    .select('organization_id')
    .eq('shop_domain', shopDomain)
    .single()

  if (!connection) {
    // Already purged or never installed — idempotent success
    console.log(`[GDPR] shop/redact: ${shopDomain} — no connection record found, nothing to purge.`)
    return new NextResponse(null, { status: 200 })
  }

  const orgId = connection.organization_id

  // 1. Delete repricing runs (cascades to reprice_run_items via ON DELETE CASCADE)
  await admin
    .from('reprice_runs')
    .delete()
    .eq('organization_id', orgId)

  // 2. Delete SKU mappings
  await admin
    .from('sku_mappings')
    .delete()
    .eq('organization_id', orgId)

  // 3. Delete the Shopify connection record
  await admin
    .from('shopify_connections')
    .delete()
    .eq('shop_domain', shopDomain)

  console.log(`[GDPR] shop/redact: purged all DB records for shop ${shopDomain} (org ${orgId}).`)

  // 4. Purge uploaded supplier files from Storage — non-blocking so response is instant
  void purgeStorageForOrg(orgId)

  return new NextResponse(null, { status: 200 })
}

async function purgeStorageForOrg(orgId: string): Promise<void> {
  const admin = createAdminClient()
  const BUCKET = 'supplier-files'

  try {
    // List run sub-folders under orgId/
    const { data: folders } = await admin.storage.from(BUCKET).list(orgId)
    if (!folders || folders.length === 0) return

    for (const folder of folders) {
      const prefix = `${orgId}/${folder.name}`

      // List files within each run folder
      const { data: files } = await admin.storage.from(BUCKET).list(prefix)
      if (!files || files.length === 0) continue

      const paths = files.map((f) => `${prefix}/${f.name}`)
      await admin.storage.from(BUCKET).remove(paths)
    }

    console.log(`[GDPR] shop/redact: storage purge complete for org ${orgId}.`)
  } catch (err) {
    // Non-fatal — manual cleanup can be triggered if needed
    console.error(`[GDPR] shop/redact: storage purge failed for org ${orgId}:`, err)
  }
}
