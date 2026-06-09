/**
 * Normalize a raw SKU string for consistent comparison.
 * Rules: uppercase, trim whitespace, keep only A-Z 0-9 and hyphens.
 * BOM and zero-width chars are stripped implicitly by the replace.
 */
export function normalizeSKU(raw: string): string {
  return raw
    .replace(/^﻿/, '')           // strip BOM if present at start
    .toUpperCase()
    .trim()
    .replace(/[^A-Z0-9-]/g, '')
}
