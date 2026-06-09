import { NextResponse } from 'next/server'
import type { NextRequest } from 'next/server'
import { createClient, createAdminClient } from '@/lib/supabase/server'
import { decryptToken } from '@/lib/crypto/token'
import { getSubscription, statusToPlan } from '@/lib/shopify/billing'

export async function GET(request: NextRequest) {
  const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? 'http://localhost:3000'
  const chargeId = request.nextUrl.searchParams.get('charge_id')

  if (!chargeId) {
    return NextResponse.redirect(`${appUrl}/dashboard/billing?error=missing_charge_id`)
  }

  // Require authenticated session — cookie survives the Shopify redirect
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) {
    return NextResponse.redirect(`${appUrl}/login?next=/dashboard/billing`)
  }

  const { data: membership } = await supabase
    .from('organization_members')
    .select('organization_id')
    .eq('user_id', user.id)
    .single()

  if (!membership) {
    return NextResponse.redirect(`${appUrl}/dashboard?error=no_org`)
  }

  const admin = createAdminClient()

  const { data: connection } = await admin
    .from('shopify_connections')
    .select('shop_domain, access_token_encrypted')
    .eq('organization_id', membership.organization_id)
    .single()

  if (!connection) {
    return NextResponse.redirect(`${appUrl}/dashboard/billing?error=no_shopify`)
  }

  try {
    const accessToken = decryptToken(connection.access_token_encrypted)
    const subscription = await getSubscription(
      connection.shop_domain,
      accessToken,
      chargeId
    )

    if (!subscription) {
      return NextResponse.redirect(`${appUrl}/dashboard/billing?error=subscription_not_found`)
    }

    const { plan, subscription_status } = statusToPlan(subscription.status)

    await admin
      .from('organizations')
      .update({
        plan,
        subscription_status,
        shopify_subscription_id: subscription.id,
      })
      .eq('id', membership.organization_id)

    if (plan === 'pro') {
      return NextResponse.redirect(`${appUrl}/dashboard?upgraded=1`)
    }

    // Merchant declined or subscription not active
    return NextResponse.redirect(
      `${appUrl}/dashboard/billing?error=subscription_${subscription.status.toLowerCase()}`
    )
  } catch (err) {
    const message = err instanceof Error ? err.message : 'unknown'
    console.error('[billing/confirm] error:', message)
    return NextResponse.redirect(`${appUrl}/dashboard/billing?error=confirm_failed`)
  }
}
