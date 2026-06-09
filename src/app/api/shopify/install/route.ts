import { NextResponse } from 'next/server'
import type { NextRequest } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { cookies } from 'next/headers'
import { randomBytes } from 'crypto'

const SHOP_PATTERN = /^[a-zA-Z0-9][a-zA-Z0-9-]*\.myshopify\.com$/

export async function GET(request: NextRequest) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const shop = request.nextUrl.searchParams.get('shop')
  if (!shop || !SHOP_PATTERN.test(shop)) {
    return NextResponse.json({ error: 'Invalid shop domain. Must be a .myshopify.com domain.' }, { status: 400 })
  }

  const apiKey = process.env.SHOPIFY_CLIENT_ID ?? process.env.SHOPIFY_API_KEY
  const scopes = process.env.SHOPIFY_SCOPES ?? 'read_products,write_products,read_inventory'
  const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? 'http://localhost:3000'

  if (!apiKey) {
    return NextResponse.json({ error: 'Shopify API key not configured' }, { status: 500 })
  }

  // Generate nonce and store in cookie for CSRF verification in callback
  const state = randomBytes(16).toString('hex')
  const cookieStore = await cookies()
  cookieStore.set('shopify_oauth_state', state, {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    maxAge: 600, // 10 minutes
    path: '/',
  })

  const redirectUri = `${appUrl}/api/shopify/callback`
  const authUrl = `https://${shop}/admin/oauth/authorize?` + new URLSearchParams({
    client_id: apiKey,
    scope: scopes,
    redirect_uri: redirectUri,
    state,
    'grant_options[]': 'per-user',
  }).toString()

  return NextResponse.redirect(authUrl)
}
