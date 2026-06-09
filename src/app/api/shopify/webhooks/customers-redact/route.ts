import { NextResponse } from 'next/server'
import type { NextRequest } from 'next/server'
import { verifyShopifyWebhook } from '@/lib/shopify/verify-webhook'

/**
 * customers/redact
 * Mandatory GDPR webhook — a merchant's customer has requested deletion of
 * their personal data. MarginSync operates on product catalogue and pricing
 * data only; no end-customer PII is ever collected or stored.
 */
export async function POST(request: NextRequest) {
  const rawBody = await request.text()
  const hmac = request.headers.get('x-shopify-hmac-sha256') ?? ''

  if (!verifyShopifyWebhook(rawBody, hmac)) {
    return new NextResponse('Unauthorized', { status: 401 })
  }

  // MarginSync stores no end-customer personal data.
  // Compliance obligation satisfied: nothing to redact.
  console.log('[GDPR] customers/redact verified. No customer PII retained by MarginSync.')

  return new NextResponse(null, { status: 200 })
}
