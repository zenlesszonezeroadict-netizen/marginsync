import * as XLSX from 'xlsx'
import type { ParsedRow } from './types'

/**
 * Parse an XLSX (or XLS) buffer into ParsedRow[].
 * Reads the first non-empty sheet.
 * All cell values are coerced to strings.
 */
export function parseXlsx(buffer: Buffer): ParsedRow[] {
  const workbook = XLSX.read(buffer, { type: 'buffer', cellDates: false })

  const sheetName = workbook.SheetNames[0]
  if (!sheetName) return []

  const sheet = workbook.Sheets[sheetName]
  if (!sheet) return []

  const rows = XLSX.utils.sheet_to_json<Record<string, unknown>>(sheet, {
    defval: '',
    raw: false,
  })

  return rows.map((row) => {
    const normalized: ParsedRow = {}
    for (const [key, val] of Object.entries(row)) {
      normalized[key.trim()] = String(val ?? '').trim()
    }
    return normalized
  })
}
