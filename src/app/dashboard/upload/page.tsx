'use client'

import { useState, useCallback, useRef } from 'react'
import { useRouter } from 'next/navigation'
import { previewFile, type FilePreview } from '@/lib/parser/preview-client'
import { InfoTooltip } from '@/components/InfoTooltip'

const ACCEPTED_TYPES = [
  'text/csv',
  'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  'application/vnd.ms-excel',
]
const ACCEPTED_EXTS = ['.csv', '.xlsx', '.xls']

type Stage = 'idle' | 'parsing' | 'preview' | 'uploading'

function downloadTemplate() {
  const csv = 'sku,supplier_cost,variant_id\nABC-001,9.99,1234567890\nABC-002,14.50,2345678901\nABC-003,6.00,3456789012\n'
  const blob = new Blob([csv], { type: 'text/csv' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = 'marginsync_template.csv'
  a.click()
  URL.revokeObjectURL(url)
}

export default function UploadPage() {
  const router = useRouter()
  const inputRef = useRef<HTMLInputElement>(null)
  const [isDragOver, setIsDragOver] = useState(false)
  const [stage, setStage] = useState<Stage>('idle')
  const [preview, setPreview] = useState<FilePreview | null>(null)
  const [pendingFile, setPendingFile] = useState<File | null>(null)
  const [error, setError] = useState<string | null>(null)

  const checkFile = (file: File): string | null => {
    const ext = `.${file.name.split('.').pop()?.toLowerCase() ?? ''}`
    if (!ACCEPTED_EXTS.includes(ext) && !ACCEPTED_TYPES.includes(file.type) && file.type !== 'application/octet-stream') {
      return 'Only CSV and XLSX files are supported.'
    }
    if (file.size > 20 * 1024 * 1024) return 'File must be under 20 MB.'
    return null
  }

  const handleFile = useCallback(async (file: File) => {
    const fileError = checkFile(file)
    if (fileError) { setError(fileError); return }
    setError(null)
    setStage('parsing')
    setPendingFile(file)
    try {
      const result = await previewFile(file)
      setPreview(result)
      setStage('preview')
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to read file.')
      setStage('idle')
      setPendingFile(null)
    }
  }, [])

  const handleConfirmUpload = async () => {
    if (!pendingFile) return
    setStage('uploading')
    setError(null)
    try {
      const formData = new FormData()
      formData.append('file', pendingFile)
      const res = await fetch('/api/runs', { method: 'POST', body: formData })
      const data = (await res.json()) as { runId?: string; error?: string }
      if (!res.ok || !data.runId) {
        setError(data.error ?? 'Upload failed. Please try again.')
        setStage('preview')
        return
      }
      router.push(`/dashboard/upload/${data.runId}/map-columns`)
    } catch {
      setError('Network error. Please check your connection and try again.')
      setStage('preview')
    }
  }

  const resetToIdle = () => {
    setStage('idle')
    setPreview(null)
    setPendingFile(null)
    setError(null)
    if (inputRef.current) inputRef.current.value = ''
  }

  const onDragOver = (e: React.DragEvent) => { e.preventDefault(); setIsDragOver(true) }
  const onDragLeave = () => setIsDragOver(false)
  const onDrop = (e: React.DragEvent) => {
    e.preventDefault()
    setIsDragOver(false)
    const file = e.dataTransfer.files[0]
    if (file) void handleFile(file)
  }
  const onFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (file) void handleFile(file)
  }

  const isIdle = stage === 'idle'
  const isParsing = stage === 'parsing'

  return (
    <div className="p-8 max-w-2xl">
      <div className="mb-6 flex items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Upload Price List</h1>
          <p className="text-sm text-gray-500 mt-1">
            Upload your supplier&apos;s CSV or Excel file to start repricing.
          </p>
        </div>
        <button
          type="button"
          onClick={downloadTemplate}
          className="shrink-0 flex items-center gap-1.5 text-xs font-medium text-indigo-600 border border-indigo-200 bg-indigo-50 hover:bg-indigo-100 rounded-lg px-3 py-2 transition-colors"
        >
          <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" d="M3 16.5v2.25A2.25 2.25 0 005.25 21h13.5A2.25 2.25 0 0021 18.75V16.5M16.5 12L12 16.5m0 0L7.5 12m4.5 4.5V3" />
          </svg>
          Download template
        </button>
      </div>

      {(isIdle || isParsing) && (
        <div
          onDragOver={onDragOver}
          onDragLeave={onDragLeave}
          onDrop={onDrop}
          onClick={() => isIdle && inputRef.current?.click()}
          className={[
            'relative flex flex-col items-center justify-center gap-4 rounded-2xl border-2 border-dashed p-16 transition-colors',
            isIdle ? 'cursor-pointer' : 'pointer-events-none opacity-60',
            isDragOver
              ? 'border-indigo-400 bg-indigo-50'
              : 'border-gray-300 bg-white hover:border-indigo-300 hover:bg-gray-50',
          ].join(' ')}
        >
          <input
            ref={inputRef}
            type="file"
            accept=".csv,.xlsx,.xls"
            onChange={onFileChange}
            className="hidden"
            disabled={!isIdle}
          />
          {isParsing ? (
            <>
              <div className="h-10 w-10 rounded-full border-4 border-indigo-200 border-t-indigo-600 animate-spin" />
              <p className="text-sm font-medium text-gray-700">Reading file…</p>
            </>
          ) : (
            <>
              <div className="flex h-14 w-14 items-center justify-center rounded-full bg-indigo-50">
                <svg className="h-7 w-7 text-indigo-500" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M3 16.5v2.25A2.25 2.25 0 005.25 21h13.5A2.25 2.25 0 0021 18.75V16.5m-13.5-9L12 3m0 0l4.5 4.5M12 3v13.5" />
                </svg>
              </div>
              <div className="text-center">
                <p className="text-sm font-semibold text-gray-800">Drag and drop your file here</p>
                <p className="text-xs text-gray-500 mt-1">or click to browse — CSV, XLSX, or XLS up to 20 MB</p>
              </div>
            </>
          )}
        </div>
      )}

      {(stage === 'preview' || stage === 'uploading') && preview && (
        <PreviewPanel
          preview={preview}
          filename={pendingFile?.name ?? ''}
          isUploading={stage === 'uploading'}
          uploadError={error}
          onConfirm={() => void handleConfirmUpload()}
          onReset={resetToIdle}
        />
      )}

      {error && (isIdle || isParsing) && (
        <div className="mt-4 flex items-start gap-2 rounded-lg bg-red-50 border border-red-200 px-4 py-3">
          <svg className="mt-0.5 h-4 w-4 shrink-0 text-red-500" viewBox="0 0 20 20" fill="currentColor">
            <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16ZM8.28 7.22a.75.75 0 00-1.06 1.06L8.94 10l-1.72 1.72a.75.75 0 101.06 1.06L10 11.06l1.72 1.72a.75.75 0 101.06-1.06L11.06 10l1.72-1.72a.75.75 0 00-1.06-1.06L10 8.94 8.28 7.22Z" clipRule="evenodd" />
          </svg>
          <p className="text-sm text-red-700">{error}</p>
        </div>
      )}

      {isIdle && (
        <div className="mt-8 rounded-xl bg-gray-50 border border-gray-100 p-5">
          <div className="flex items-center gap-2 mb-3">
            <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide">Expected format</p>
            <InfoTooltip text="Column names are detected automatically by keyword matching — e.g. 'sku', 'item_code', 'part_number' for SKU; 'cost', 'supplier_cost', 'wholesale' for price. Download the template for a guaranteed-compatible layout." />
          </div>
          <div className="overflow-x-auto">
            <table className="text-xs text-gray-600 w-full">
              <thead>
                <tr className="text-gray-400 border-b border-gray-200">
                  <th className="text-left pb-2 pr-4 font-medium">Column</th>
                  <th className="text-left pb-2 font-medium">Example values</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                <tr>
                  <td className="py-1.5 pr-4 font-medium text-gray-700">SKU / Part #</td>
                  <td className="py-1.5 text-gray-500">ABC-1234, WIDGET-XL, 00123</td>
                </tr>
                <tr>
                  <td className="py-1.5 pr-4 font-medium text-gray-700">Cost / Wholesale</td>
                  <td className="py-1.5 text-gray-500">12.50, $24.99, 7</td>
                </tr>
              </tbody>
            </table>
          </div>
          <p className="text-xs text-gray-400 mt-3">
            Column names are auto-detected. You&apos;ll confirm them in the next step.
          </p>
        </div>
      )}
    </div>
  )
}

function PreviewPanel({
  preview,
  filename,
  isUploading,
  uploadError,
  onConfirm,
  onReset,
}: {
  preview: FilePreview
  filename: string
  isUploading: boolean
  uploadError: string | null
  onConfirm: () => void
  onReset: () => void
}) {
  const { headers, rows, validation } = preview
  const hasErrors = !validation.valid

  return (
    <div className="rounded-2xl border border-gray-200 bg-white overflow-hidden">
      {/* File header bar */}
      <div className="flex items-center justify-between gap-3 px-5 py-3 border-b border-gray-100 bg-gray-50">
        <div className="flex items-center gap-2 min-w-0">
          <svg className="h-4 w-4 shrink-0 text-gray-400" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" d="M19.5 14.25v-2.625a3.375 3.375 0 00-3.375-3.375h-1.5A1.125 1.125 0 0113.5 7.125v-1.5a3.375 3.375 0 00-3.375-3.375H8.25m0 12.75h7.5m-7.5 3H12M10.5 2.25H5.625c-.621 0-1.125.504-1.125 1.125v17.25c0 .621.504 1.125 1.125 1.125h12.75c.621 0 1.125-.504 1.125-1.125V11.25a9 9 0 00-9-9z" />
          </svg>
          <span className="text-sm font-medium text-gray-700 truncate">{filename}</span>
        </div>
        <button
          type="button"
          onClick={onReset}
          disabled={isUploading}
          className="shrink-0 text-xs text-gray-500 hover:text-gray-700 disabled:opacity-40 transition-colors"
        >
          Choose different file
        </button>
      </div>

      {/* Validation errors */}
      {hasErrors && (
        <div className="px-5 py-4 bg-red-50 border-b border-red-100">
          <p className="text-sm font-semibold text-red-800 mb-2">Column issues detected</p>
          <ul className="space-y-1.5">
            {validation.errors.map((err, i) => (
              <li key={i} className="flex items-start gap-2 text-sm text-red-700">
                <svg className="mt-0.5 h-4 w-4 shrink-0 text-red-400" viewBox="0 0 20 20" fill="currentColor">
                  <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16ZM8.28 7.22a.75.75 0 00-1.06 1.06L8.94 10l-1.72 1.72a.75.75 0 101.06 1.06L10 11.06l1.72 1.72a.75.75 0 101.06-1.06L11.06 10l1.72-1.72a.75.75 0 00-1.06-1.06L10 8.94 8.28 7.22Z" clipRule="evenodd" />
                </svg>
                {err}
              </li>
            ))}
          </ul>
          <p className="text-xs text-red-600 mt-3">
            Fix the column headers in your file and re-upload, or download the template above to see the correct format.
          </p>
        </div>
      )}

      {/* Preview table */}
      <div className="overflow-x-auto">
        <table className="w-full text-xs">
          <thead>
            <tr className="bg-gray-50 border-b border-gray-100">
              {headers.map((h) => {
                const isSkuCol = validation.skuColumn === h
                const isCostCol = validation.costColumn === h
                return (
                  <th key={h} className="text-left px-4 py-2.5 font-medium text-gray-500 whitespace-nowrap">
                    <div className="flex items-center gap-1.5">
                      {h}
                      {isSkuCol && (
                        <span className="text-indigo-600 bg-indigo-50 border border-indigo-200 rounded px-1 py-0.5 font-semibold text-[10px]">
                          SKU
                        </span>
                      )}
                      {isCostCol && (
                        <span className="text-emerald-700 bg-emerald-50 border border-emerald-200 rounded px-1 py-0.5 font-semibold text-[10px]">
                          COST
                        </span>
                      )}
                    </div>
                  </th>
                )
              })}
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-50">
            {rows.length > 0 ? (
              rows.map((row, i) => (
                <tr key={i} className="hover:bg-gray-50">
                  {headers.map((h) => (
                    <td key={h} className="px-4 py-2 text-gray-600 whitespace-nowrap max-w-[160px] truncate">
                      {row[h] ?? ''}
                    </td>
                  ))}
                </tr>
              ))
            ) : (
              <tr>
                <td colSpan={headers.length || 1} className="px-4 py-4 text-center text-gray-400">
                  No data rows found
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      {rows.length > 0 && (
        <p className="text-[11px] text-gray-400 px-5 pb-3">
          Showing first {rows.length} row{rows.length !== 1 ? 's' : ''} — full file will be processed on upload.
        </p>
      )}

      {/* Upload error */}
      {uploadError && (
        <div className="mx-5 mb-3 rounded-lg bg-red-50 border border-red-200 px-4 py-3">
          <p className="text-sm text-red-700">{uploadError}</p>
        </div>
      )}

      {/* Action footer */}
      <div className="px-5 py-4 border-t border-gray-100 flex items-center justify-between gap-3">
        <p className="text-xs text-gray-400">
          {hasErrors
            ? 'Fix the issues above before uploading.'
            : `${headers.length} column${headers.length !== 1 ? 's' : ''} detected — ready to upload.`}
        </p>
        <button
          type="button"
          onClick={onConfirm}
          disabled={hasErrors || isUploading}
          className="inline-flex items-center gap-2 bg-indigo-600 text-white text-sm font-medium px-5 py-2.5 rounded-lg hover:bg-indigo-700 disabled:opacity-50 transition-colors"
        >
          {isUploading ? (
            <>
              <div className="h-4 w-4 rounded-full border-2 border-white/40 border-t-white animate-spin" />
              Uploading…
            </>
          ) : (
            'Confirm & upload'
          )}
        </button>
      </div>
    </div>
  )
}
