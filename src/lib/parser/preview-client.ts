import Papa from 'papaparse'
import { validateHeaders, type HeaderValidationResult } from './validate-headers'

export interface FilePreview {
  headers: string[]
  rows: Record<string, string>[]
  validation: HeaderValidationResult
}

export async function previewFile(file: File): Promise<FilePreview> {
  const ext = file.name.toLowerCase().split('.').pop() ?? ''
  if (ext === 'csv') return previewCsv(file)
  if (ext === 'xlsx' || ext === 'xls') return previewXlsx(file)
  throw new Error('Unsupported file type. Please upload a CSV or XLSX file.')
}

async function previewCsv(file: File): Promise<FilePreview> {
  const text = await file.text()
  const result = Papa.parse<Record<string, string>>(text, {
    header: true,
    skipEmptyLines: true,
    preview: 4,
  })
  const headers = result.meta.fields ?? []
  const rows = result.data.slice(0, 3)
  return { headers, rows, validation: validateHeaders(headers) }
}

async function previewXlsx(file: File): Promise<FilePreview> {
  const XLSX = await import('xlsx')
  const buffer = await file.arrayBuffer()
  const workbook = XLSX.read(buffer, { type: 'array', sheetRows: 4 })
  const sheetName = workbook.SheetNames[0]
  if (!sheetName) throw new Error('XLSX file has no sheets.')
  const sheet = workbook.Sheets[sheetName]
  const raw = XLSX.utils.sheet_to_json<unknown[]>(sheet, { header: 1 }) as unknown[][]
  if (raw.length === 0) throw new Error('Sheet appears to be empty.')
  const headers = (raw[0] ?? []).map(String)
  const dataRows = raw.slice(1, 4)
  const rows = dataRows.map((row) => {
    const obj: Record<string, string> = {}
    headers.forEach((h, i) => { obj[h] = String(row[i] ?? '') })
    return obj
  })
  return { headers, rows, validation: validateHeaders(headers) }
}
