import ExcelJS from 'exceljs'
import type { ParsedRow } from './types'

export async function parseXlsx(buffer: Buffer): Promise<ParsedRow[]> {
  const workbook = new ExcelJS.Workbook()
  await workbook.xlsx.load(buffer.buffer as ArrayBuffer)

  const sheet = workbook.worksheets[0]
  if (!sheet) return []

  const rows: ParsedRow[] = []
  let headers: string[] = []

  sheet.eachRow((row, rowNumber) => {
    const values = (row.values as (ExcelJS.CellValue | null)[]).slice(1) // index 0 is unused

    if (rowNumber === 1) {
      headers = values.map((v) => String(v ?? '').trim())
      return
    }

    const parsed: ParsedRow = {}
    headers.forEach((header, i) => {
      if (header) parsed[header] = String(values[i] ?? '').trim()
    })
    rows.push(parsed)
  })

  return rows
}
