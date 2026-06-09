import { NextResponse } from 'next/server'
import { createClient, createAdminClient } from '@/lib/supabase/server'
import { syncCatalog } from '@/lib/shopify/sync-catalog'

export async function POST() {
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
  const { data: connection } = await admin
    .from('shopify_connections')
    .select('shop_domain, access_token_encrypted')
    .eq('organization_id', membership.organization_id)
    .single()

  if (!connection) {
    return NextResponse.json({ error: 'No Shopify connection found. Connect your store first.' }, { status: 400 })
  }

  try {
    const result = await syncCatalog(
      membership.organization_id,
      connection.shop_domain,
      connection.access_token_encrypted
    )
    return NextResponse.json({ ok: true, ...result })
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Sync failed'
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
