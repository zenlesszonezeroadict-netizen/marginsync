/**
 * Wraps a Shopify Admin API fetch call with leaky-bucket 429 handling.
 *
 * On HTTP 429 the wrapper reads the Retry-After header (seconds).
 * If the header is absent it falls back to exponential backoff:
 *   delay = baseDelayMs × 2^attempt  (1s, 2s, 4s for the defaults)
 *
 * After maxRetries exhausted it throws so the caller can record the failure
 * without aborting the rest of the sync loop.
 */
export async function withShopifyRateLimit(
  fn: () => Promise<Response>,
  { maxRetries = 3, baseDelayMs = 1000 }: { maxRetries?: number; baseDelayMs?: number } = {}
): Promise<Response> {
  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    const res = await fn()

    if (res.status !== 429) return res

    if (attempt === maxRetries) {
      throw new Error(`Shopify rate limit exceeded after ${maxRetries} retries (429)`)
    }

    const retryAfterHeader = res.headers.get('retry-after')
    const delayMs = retryAfterHeader
      ? Math.ceil(parseFloat(retryAfterHeader)) * 1000
      : baseDelayMs * Math.pow(2, attempt)

    console.log(
      `[Shopify Rate Limit] Hit 429. Retrying variant update after ${(delayMs / 1000).toFixed(1)} seconds...`
    )

    await new Promise<void>(resolve => setTimeout(resolve, delayMs))
  }

  // Unreachable — loop always returns or throws above. Satisfies TypeScript.
  throw new Error('withShopifyRateLimit: unexpected exit')
}
