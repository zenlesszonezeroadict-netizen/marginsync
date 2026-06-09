import { decryptToken } from '@/lib/crypto/token'
import { withShopifyRateLimit } from '@/lib/shopify/rate-limiter'

interface PriceUpdate {
  variantId: string
  price: number
}

interface WriteResult {
  variantId: string
  success: boolean
  error?: string
}

/**
 * Write updated prices to Shopify using the REST Admin API.
 * Sends individual variant update requests.
 * Returns per-variant results.
 */
export async function writePricesToShopify(
  shopDomain: string,
  encryptedToken: string,
  updates: PriceUpdate[]
): Promise<WriteResult[]> {
  const accessToken = decryptToken(encryptedToken)
  const results: WriteResult[] = []

  for (const { variantId, price } of updates) {
    try {
      const res = await withShopifyRateLimit(() =>
        fetch(
          `https://${shopDomain}/admin/api/2024-01/variants/${variantId}.json`,
          {
            method: 'PUT',
            headers: {
              'X-Shopify-Access-Token': accessToken,
              'Content-Type': 'application/json',
            },
            body: JSON.stringify({ variant: { id: variantId, price: price.toFixed(2) } }),
          }
        )
      )
      if (res.ok) {
        results.push({ variantId, success: true })
      } else {
        const text = await res.text()
        results.push({ variantId, success: false, error: `${res.status}: ${text.slice(0, 200)}` })
      }
    } catch (err) {
      results.push({ variantId, success: false, error: err instanceof Error ? err.message : 'Network error' })
    }
  }

  return results
}
