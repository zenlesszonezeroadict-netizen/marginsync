import { parseCsv } from './parse-csv'
import { parseXlsx } from './parse-xlsx'
import type { ParsedRow } from './types'

const XLSX_TYPES = new Set([
  'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  'application/vnd.ms-excel',
  'application/octet-stream',
])

const XLSX_EXTS = new Set(['.xlsx', '.xls'])

function isXlsx(filename: string, mimeType: string): boolean {
  const ext = filename.toLowerCase().slice(filename.lastIndexOf('.'))
  return XLSX_EXTS.has(ext) || XLSX_TYPES.has(mimeType)
}

export async function parseFile(
  buffer: Buffer,
  filename: string,
  mimeType: string
): Promise<ParsedRow[]> {
  if (isXlsx(filename, mimeType)) {
    return parseXlsx(buffer)
  }
  return parseCsv(buffer)
}
