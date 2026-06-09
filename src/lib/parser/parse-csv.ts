import Papa from 'papaparse'
import type { ParsedRow } from './types'

/** Strip a UTF-8 BOM character if present. */
function stripBom(str: string): string {
  return str.charCodeAt(0) === 0xfeff ? str.slice(1) : str
}

/**
 * Parse a CSV buffer into ParsedRow[].
 * Handles BOM, Windows CRLF line endings, and quoted fields.
 */
export function parseCsv(buffer: Buffer): ParsedRow[] {
  const raw = stripBom(buffer.toString('utf-8'))

  const result = Papa.parse<ParsedRow>(raw, {
    header: true,
    skipEmptyLines: true,
    transformHeader: (h) => h.trim(),
    transform: (v) => v.trim(),
  })

  return result.data
}
