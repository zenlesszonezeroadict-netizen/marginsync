/**
 * Calculate margin percentage given a price and cost.
 * Returns null if price is zero or negative (prevents division by zero).
 * Formula: (price - cost) / price * 100
 */
export function recalculateMargin(price: number, cost: number): number | null {
  if (price <= 0) return null
  return Math.round(((price - cost) / price) * 10000) / 100
}
