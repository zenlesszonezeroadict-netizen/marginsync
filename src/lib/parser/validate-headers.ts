import { detectColumns } from './detect-columns'

export interface HeaderValidationResult {
  valid: boolean
  skuColumn: string | null    // null = not detected
  costColumn: string | null
  errors: string[]
}

/**
 * Validate that a set of spreadsheet headers contains at least one detectable
 * SKU column and one cost column. Uses the same keyword scoring as the
 * auto-detection engine so client and server always agree.
 *
 * Works in both browser and Node — no platform-specific imports.
 */
export function validateHeaders(headers: string[]): HeaderValidationResult {
  if (headers.length === 0) {
    return {
      valid: false,
      skuColumn: null,
      costColumn: null,
      errors: ['File appears to be empty or has no column headers.'],
    }
  }

  const guess = detectColumns(headers)
  const errors: string[] = []
  const listed = headers.map((h) => `"${h}"`).join(', ')

  if (guess.skuConfidence === 0) {
    errors.push(
      `Missing a SKU or item-code column. Expected a header like "sku", "item_code", or "part_number" — ` +
        `found: ${listed}.`
    )
  }

  if (guess.costConfidence === 0) {
    errors.push(
      `Missing a cost or price column. Expected a header like "supplier_cost", "cost", or "wholesale" — ` +
        `found: ${listed}.`
    )
  }

  return {
    valid: errors.length === 0,
    skuColumn: guess.skuConfidence > 0 ? guess.skuCol : null,
    costColumn: guess.costConfidence > 0 ? guess.costCol : null,
    errors,
  }
}
