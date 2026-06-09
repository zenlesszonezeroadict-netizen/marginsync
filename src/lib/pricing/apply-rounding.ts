import type { RoundingMode } from './types'

/**
 * Apply a rounding rule to a calculated price.
 * '0.99' → round up to next dollar then subtract 0.01 (e.g. 13.2 → 13.99)
 * '0.00' → round to nearest cent (standard two-decimal rounding)
 * 'none' → return as-is, clamped to 2 decimal places
 */
export function applyRounding(price: number, mode: RoundingMode): number {
  if (price <= 0) return 0

  switch (mode) {
    case '0.99': {
      const ceiling = Math.ceil(price)
      return ceiling - 0.01
    }
    case '0.00':
      return Math.round(price * 100) / 100
    case 'none':
    default:
      return Math.round(price * 100) / 100
  }
}
