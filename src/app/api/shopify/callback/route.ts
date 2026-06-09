import { NextResponse } from 'next/server'
import type { NextRequest } from 'next/server'
import { createClient, createAdminClient } from '@/lib/supabase/server'
import { cookies } from 'next/headers'
import { createHmac, timingSafeEqual } from 'crypto'
import { encryptToken } from '@/lib/crypto/token'

const SHOP_PATTERN = /^[a-zA-Z0-9][a-zA-Z0-9-]*\.myshopify\.com$/

export async function GET(request: NextRequest) {
  const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? 'http://localhost:3000'

  const { searchParams } = request.nextUrl
  const shop = searchParams.get('shop') ?? ''
  const code = searchParams.get('code') ?? ''
  const state = searchParams.get('state') ?? ''
  const hmac = searchParams.get('hmac') ?? ''

  // Validate shop domain
  if (!SHOP_PATTERN.test(shop)) {
    return NextResponse.redirect(`${appUrl}/dashboard/shopify?error=invalid_shop`)
  }

  // Verify state nonce (CSRF protection)
  const cookieStore = await cookies()
  const savedState = cookieStore.get('shopify_oauth_state')?.value
  if (!savedState || savedState !== state) {
    return NextResponse.redirect(`${appUrl}/dashboard/shopify?error=invalid_state`)
  }
  cookieStore.delete('shopify_oauth_state')

  // Verify Shopify HMAC signature
  const apiSecret = process.env.SHOPIFY_CLIENT_SECRET ?? process.env.SHOPIFY_API_SECRET
  if (!apiSecret) {
    return NextResponse.redirect(`${appUrl}/dashboard/shopify?error=config_error`)
  }

  const params = new URLSearchParams(searchParams.toString())
  params.delete('hmac')
  const message = Array.from(params.entries())
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([k, v]) => `${k}=${v}`)
    .join('&')

  const expectedHmac = createHmac('sha256', apiSecret).update(message).digest('hex')
  const hmacBuffer = Buffer.from(hmac)
  const expectedBuffer = Buffer.from(expectedHmac)
  const isValid =
    hmacBuffer.length === expectedBuffer.length &&
    timingSafeEqual(hmacBuffer, expectedBuffer)

  if (!isValid) {
    return NextResponse.redirect(`${appUrl}/dashboard/shopify?error=invalid_hmac`)
  }

  // Exchange code for permanent access token
  const apiKey = process.env.SHOPIFY_CLIENT_ID ?? process.env.SHOPIFY_API_KEY
  let accessToken: string

  try {
    const tokenRes = await fetch(`https://${shop}/admin/oauth/access_token`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ client_id: apiKey, client_secret: apiSecret, code }),
    })
    if (!tokenRes.ok) {
      return NextResponse.redirect(`${appUrl}/dashboard/shopify?error=token_exchange_failed`)
    }
    const tokenData = (await tokenRes.json()) as { access_token?: string }
    if (!tokenData.access_token) {
      return NextResponse.redirect(`${appUrl}/dashboard/shopify?error=no_token`)
    }
    accessToken = tokenData.access_token
  } catch {
    return NextResponse.redirect(`${appUrl}/dashboard/shopify?error=token_exchange_failed`)
  }

  // Verify the user is authenticated
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.redirect(`${appUrl}/login`)

  const { data: membership } = await supabase
    .from('organization_members')
    .select('organization_id')
    .eq('user_id', user.id)
    .single()

  if (!membership) return NextResponse.redirect(`${appUrl}/dashboard/shopify?error=no_org`)

  // Encrypt token before storage — never store plaintext
  const encryptedToken = encryptToken(accessToken)

  const admin = createAdminClient()
  const { error } = await admin
    .from('shopify_connections')
    .upsert(
      {
        organization_id: membership.organization_id,
        shop_domain: shop,
        access_token_encrypted: encryptedToken,
        installed_at: new Date().toISOString(),
      },
      { onConflict: 'organization_id,shop_domain' }
    )

  if (error) {
    return NextResponse.redirect(`${appUrl}/dashboard/shopify?error=db_error`)
  }

  // Register APP_SUBSCRIPTIONS_UPDATE webhook so billing status stays in sync
  try {
    await fetch(`https://${shop}/admin/api/2024-01/graphql.json`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-Shopify-Access-Token': accessToken,
      },
      body: JSON.stringify({
        query: `mutation {
          webhookSubscriptionCreate(
            topic: APP_SUBSCRIPTIONS_UPDATE
            webhookSubscription: {
              callbackUrl: "${appUrl}/api/billing/webhook"
              format: JSON
            }
          ) { userErrors { message } }
        }`,
      }),
    })
  } catch {
    // Non-fatal — billing webhook can be re-registered on next install
  }

  return NextResponse.redirect(`${appUrl}/dashboard/shopify?connected=1`)
}
