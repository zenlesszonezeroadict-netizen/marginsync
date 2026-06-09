import { NextResponse } from 'next/server'
import { createClient, createAdminClient } from '@/lib/supabase/server'
import { decryptToken } from '@/lib/crypto/token'
import { createSubscription } from '@/lib/shopify/billing'

export async function POST() {
  const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? 'http://localhost:3000'
  const isTest = process.env.NODE_ENV !== 'production'

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

  // Must have a connected Shopify store to bill through
  const { data: connection } = await admin
    .from('shopify_connections')
    .select('shop_domain, access_token_encrypted')
    .eq('organization_id', membership.organization_id)
    .single()

  if (!connection) {
    return NextResponse.json(
      { error: 'Connect your Shopify store before upgrading.' },
      { status: 400 }
    )
  }

  const { data: org } = await admin
    .from('organizations')
    .select('plan')
    .eq('id', membership.organization_id)
    .single()

  if (org?.plan === 'pro') {
    return NextResponse.json({ error: 'Already on Pro plan' }, { status: 400 })
  }

  try {
    const accessToken = decryptToken(connection.access_token_encrypted)
    const returnUrl = `${appUrl}/api/billing/confirm`

    const { confirmationUrl } = await createSubscription({
      shopDomain: connection.shop_domain,
      accessToken,
      returnUrl,
      test: isTest,
    })

    return NextResponse.json({ url: confirmationUrl })
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Unknown error'
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
