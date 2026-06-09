import { NextResponse } from 'next/server'
import type { NextRequest } from 'next/server'
import { createHmac, timingSafeEqual } from 'crypto'
import { createAdminClient } from '@/lib/supabase/server'
import { statusToPlan, type AppSubscriptionStatus } from '@/lib/shopify/billing'

// Shopify sends APP_SUBSCRIPTIONS_UPDATE when a subscription is created,
// activated, cancelled, frozen, or expires. We use it to keep the
// organizations.plan column in sync without polling.

export async function POST(request: NextRequest) {
  const apiSecret = process.env.SHOPIFY_API_SECRET
  if (!apiSecret) {
    return NextResponse.json({ error: 'Webhook not configured' }, { status: 500 })
  }

  // Verify Shopify HMAC signature
  const rawBody = await request.text()
  const hmacHeader = request.headers.get('x-shopify-hmac-sha256') ?? ''
  const shopDomain = request.headers.get('x-shopify-shop-domain') ?? ''

  const expected = createHmac('sha256', apiSecret)
    .update(rawBody, 'utf8')
    .digest('base64')

  const headerBuf = Buffer.from(hmacHeader)
  const expectedBuf = Buffer.from(expected)

  const isValid =
    headerBuf.length === expectedBuf.length &&
    timingSafeEqual(headerBuf, expectedBuf)

  if (!isValid) {
    return NextResponse.json({ error: 'Invalid webhook signature' }, { status: 401 })
  }

  // Parse the payload
  let payload: {
    app_subscription?: {
      admin_graphql_api_id: string
      status: string
    }
  }

  try {
    payload = JSON.parse(rawBody) as typeof payload
  } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 })
  }

  const sub = payload.app_subscription
  if (!sub) return NextResponse.json({ received: true })

  const status = sub.status as AppSubscriptionStatus
  const { plan, subscription_status } = statusToPlan(status)

  const admin = createAdminClient()

  // Find the org by shop domain
  const { data: connection } = await admin
    .from('shopify_connections')
    .select('organization_id')
    .eq('shop_domain', shopDomain)
    .single()

  if (!connection) {
    // Store not connected to any org — log and ack
    console.warn('[billing/webhook] Unknown shop domain:', shopDomain)
    return NextResponse.json({ received: true })
  }

  await admin
    .from('organizations')
    .update({
      plan,
      subscription_status,
      shopify_subscription_id: sub.admin_graphql_api_id,
    })
    .eq('id', connection.organization_id)

  return NextResponse.json({ received: true })
}
