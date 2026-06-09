import { createHmac, timingSafeEqual } from 'crypto'

/**
 * Verifies the X-Shopify-Hmac-Sha256 signature on an incoming webhook request.
 *
 * Shopify computes: base64( HMAC-SHA256(CLIENT_SECRET, rawBody) )
 * and sends it in the X-Shopify-Hmac-Sha256 header.
 *
 * Returns true only if the computed signature matches the header value,
 * using a constant-time comparison to prevent timing attacks.
 */
export function verifyShopifyWebhook(rawBody: string, hmacHeader: string): boolean {
  const secret = process.env.SHOPIFY_CLIENT_SECRET ?? process.env.SHOPIFY_API_SECRET ?? ''
  if (!secret || !hmacHeader) return false

  const computed = createHmac('sha256', secret).update(rawBody, 'utf8').digest('base64')

  const computedBuf = Buffer.from(computed)
  const headerBuf = Buffer.from(hmacHeader)

  // timingSafeEqual requires equal-length buffers; length mismatch is itself a rejection
  if (computedBuf.length !== headerBuf.length) return false

  return timingSafeEqual(computedBuf, headerBuf)
}
