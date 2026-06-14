import { decryptToken } from '@/lib/crypto/token'

/**
 * Step 3: Fetch current inventory quantities for a list of Shopify variant IDs.
 * Batches requests in groups of 50 via the GraphQL Admin API.
 * Returns a Map<variantId (numeric string), inventoryQuantity>.
 * Failures are best-effort — a failed batch is skipped silently.
 */
export async function fetchInventoryMap(
  shopDomain: string,
  encryptedToken: string,
  variantIds: string[]
): Promise<Map<string, number>> {
  if (variantIds.length === 0) return new Map()

  const accessToken = decryptToken(encryptedToken)
  const map = new Map<string, number>()
  const BATCH = 50

  const NUMERIC = /^\d+$/
  for (let i = 0; i < variantIds.length; i += BATCH) {
    const batch = variantIds.slice(i, i + BATCH).filter(id => NUMERIC.test(id))
    if (batch.length === 0) continue
    const ids = batch.map((id) => `"gid://shopify/ProductVariant/${id}"`).join(', ')
    const query = `{ nodes(ids: [${ids}]) { ... on ProductVariant { id inventoryQuantity } } }`

    try {
      const res = await fetch(`https://${shopDomain}/admin/api/2024-01/graphql.json`, {
        method: 'POST',
        headers: {
          'X-Shopify-Access-Token': accessToken,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ query }),
      })
      if (!res.ok) continue

      const json = (await res.json()) as {
        data?: { nodes?: Array<{ id?: string; inventoryQuantity?: number } | null> }
      }
      for (const node of json.data?.nodes ?? []) {
        if (!node?.id || node.inventoryQuantity === undefined) continue
        const numericId = node.id.split('/').pop()
        if (numericId) map.set(numericId, node.inventoryQuantity)
      }
    } catch {
      // best-effort — skip batch on network error
    }
  }

  return map
}
