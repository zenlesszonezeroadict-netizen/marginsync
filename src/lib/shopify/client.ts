import { decryptToken } from '@/lib/crypto/token'

export interface ShopifyVariant {
  id: number
  sku: string
  title: string
  price: string
  compare_at_price: string | null
  product_id: number
}

export interface ShopifyProduct {
  id: number
  title: string
  variants: ShopifyVariant[]
}

interface ProductsPage {
  products: ShopifyProduct[]
  nextPageUrl: string | null
}

/**
 * Fetch one page of products from the Shopify REST Admin API.
 * Returns products and a link to the next page (if any).
 */
async function fetchProductsPage(
  shopDomain: string,
  accessToken: string,
  pageUrl?: string
): Promise<ProductsPage> {
  const url =
    pageUrl ??
    `https://${shopDomain}/admin/api/2024-01/products.json?` +
      new URLSearchParams({
        limit: '250',
        fields: 'id,title,variants',
        status: 'active',
      }).toString()

  const res = await fetch(url, {
    headers: {
      'X-Shopify-Access-Token': accessToken,
      'Content-Type': 'application/json',
    },
  })

  if (!res.ok) {
    const text = await res.text()
    throw new Error(`Shopify API error ${res.status}: ${text}`)
  }

  const data = (await res.json()) as { products: ShopifyProduct[] }

  // Parse Link header for cursor pagination
  const linkHeader = res.headers.get('link') ?? ''
  const nextMatch = linkHeader.match(/<([^>]+)>;\s*rel="next"/)
  const nextPageUrl = nextMatch?.[1] ?? null

  return { products: data.products, nextPageUrl }
}

/**
 * Fetch all active product variants from a Shopify store.
 * Paginates automatically through all pages.
 * Max 5000 products to prevent runaway API usage.
 */
export async function fetchAllVariants(
  shopDomain: string,
  encryptedToken: string
): Promise<{ product: ShopifyProduct; variant: ShopifyVariant }[]> {
  const accessToken = decryptToken(encryptedToken)
  const results: { product: ShopifyProduct; variant: ShopifyVariant }[] = []
  let nextPageUrl: string | undefined

  for (let page = 0; page < 20; page++) {
    const { products, nextPageUrl: next } = await fetchProductsPage(
      shopDomain,
      accessToken,
      nextPageUrl
    )

    for (const product of products) {
      for (const variant of product.variants) {
        results.push({ product, variant })
      }
    }

    if (!next) break
    nextPageUrl = next
  }

  return results
}
