'use client'

import { useState, useEffect } from 'react'
import { useRouter, useParams } from 'next/navigation'
import Link from 'next/link'

const CHUNK_SIZE = 50
const CHUNK_MAX_RETRIES = 2
const CHUNK_RETRY_DELAY_MS = 2000

interface SyncResult {
  synced: number
  failed: number
  total: number
  status: string
  error?: string
}

interface ChunkResponse {
  synced: number
  failed: number
  total: number
  totalSelected: number
  status: string
}

interface Progress {
  processed: number
  total: number
  synced: number
  failed: number
}

export function SyncPageClient() {
  const router = useRouter()
  const params = useParams<{ runId: string }>()
  const runId = params.runId

  const [phase, setPhase] = useState<'confirm' | 'syncing' | 'done' | 'error'>('confirm')
  const [result, setResult] = useState<SyncResult | null>(null)
  const [progress, setProgress] = useState<Progress>({ processed: 0, total: 0, synced: 0, failed: 0 })

  // Redirect back if already done
  useEffect(() => {
    void (async () => {
      const res = await fetch(`/api/runs/${runId}`)
      if (res.ok) {
        const data = (await res.json()) as { status: string }
        if (data.status === 'completed' || data.status === 'failed') {
          router.replace(`/dashboard/runs/${runId}`)
        }
      }
    })()
  }, [runId, router])

  const handleSync = async () => {
    setPhase('syncing')
    setProgress({ processed: 0, total: 0, synced: 0, failed: 0 })

    let offset = 0
    let totalSelected = 0
    let totalSynced = 0
    let totalFailed = 0

    try {
      while (true) {
        // Determine isFinal: once we know totalSelected, flag the last chunk
        const isFinal = totalSelected > 0 && offset + CHUNK_SIZE >= totalSelected

        let chunkRes: ChunkResponse | null = null
        let lastErr: Error | null = null

        for (let attempt = 0; attempt <= CHUNK_MAX_RETRIES; attempt++) {
          try {
            const res = await fetch(`/api/runs/${runId}/sync`, {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ chunkSize: CHUNK_SIZE, offset, isFinal }),
            })
            const data = (await res.json()) as ChunkResponse & { error?: string }
            if (!res.ok) throw new Error(data.error ?? `HTTP ${res.status}`)
            chunkRes = data
            break
          } catch (err) {
            lastErr = err instanceof Error ? err : new Error('Network error')
            if (attempt < CHUNK_MAX_RETRIES) {
              await new Promise<void>(r => setTimeout(r, CHUNK_RETRY_DELAY_MS * (attempt + 1)))
            }
          }
        }

        if (!chunkRes) throw lastErr ?? new Error('Chunk failed after retries')

        // Update total from first response
        if (chunkRes.totalSelected > 0 && totalSelected === 0) {
          totalSelected = chunkRes.totalSelected
        }

        totalSynced += chunkRes.synced
        totalFailed += chunkRes.failed
        offset += chunkRes.total

        setProgress({
          processed: offset,
          total: totalSelected,
          synced: totalSynced,
          failed: totalFailed,
        })

        // Stop when server signals completion or we've processed all items
        if (chunkRes.status === 'completed' || chunkRes.status === 'failed') break
        if (offset >= totalSelected && totalSelected > 0) break
      }

      setResult({ synced: totalSynced, failed: totalFailed, total: offset, status: 'completed' })
      setPhase('done')
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'An unknown error occurred'
      setResult({ synced: totalSynced, failed: totalFailed, total: offset, status: 'failed', error: msg })
      setPhase('error')
    }
  }

  const progressPct =
    progress.total > 0 ? Math.min(100, Math.round((progress.processed / progress.total) * 100)) : 0

  return (
    <div className="p-8 max-w-xl">
      <div className="mb-2 flex items-center gap-2 text-xs text-gray-400">
        <Link href="/dashboard" className="hover:text-gray-600">Dashboard</Link>
        <span>/</span>
        <Link href={`/dashboard/runs/${runId}`} className="hover:text-gray-600">Preview</Link>
        <span>/</span>
        <span className="text-gray-600">Sync</span>
      </div>

      <h1 className="text-2xl font-bold text-gray-900 mb-8">Push to Shopify</h1>

      {phase === 'confirm' && (
        <div className="rounded-xl border border-gray-200 bg-white p-6">
          <div className="flex items-start gap-4 mb-6">
            <div className="h-10 w-10 rounded-full bg-amber-50 flex items-center justify-center shrink-0">
              <svg className="h-5 w-5 text-amber-500" viewBox="0 0 20 20" fill="currentColor">
                <path fillRule="evenodd" d="M8.485 2.495c.673-1.167 2.357-1.167 3.03 0l6.28 10.875c.673 1.167-.17 2.625-1.516 2.625H3.72c-1.347 0-2.189-1.458-1.515-2.625L8.485 2.495ZM10 5a.75.75 0 0 1 .75.75v3.5a.75.75 0 0 1-1.5 0v-3.5A.75.75 0 0 1 10 5Zm0 9a1 1 0 1 0 0-2 1 1 0 0 0 0 2Z" clipRule="evenodd" />
              </svg>
            </div>
            <div>
              <p className="text-sm font-semibold text-gray-800">Ready to update live prices</p>
              <p className="text-sm text-gray-500 mt-1">
                This will write the computed prices for all selected items to your Shopify store. This action cannot be undone automatically — a new run will be needed to revert.
              </p>
            </div>
          </div>

          <div className="flex gap-3">
            <Link
              href={`/dashboard/runs/${runId}`}
              className="flex-1 text-center border border-gray-200 bg-white text-sm font-medium text-gray-600 px-4 py-2.5 rounded-lg hover:bg-gray-50 transition-colors"
            >
              Cancel
            </Link>
            <button
              onClick={() => void handleSync()}
              className="flex-1 bg-indigo-600 text-white text-sm font-medium px-4 py-2.5 rounded-lg hover:bg-indigo-700 transition-colors"
            >
              Yes, push prices
            </button>
          </div>
        </div>
      )}

      {phase === 'syncing' && (
        <div className="rounded-xl border border-gray-200 bg-white p-8 flex flex-col gap-5">
          <div className="flex items-center gap-3">
            <div className="h-8 w-8 rounded-full border-4 border-indigo-200 border-t-indigo-600 animate-spin shrink-0" />
            <div>
              <p className="text-sm font-semibold text-gray-800">Writing prices to Shopify…</p>
              {progress.total > 0 ? (
                <p className="text-xs text-gray-500 mt-0.5">
                  {progress.processed} / {progress.total} items processed
                  {progress.failed > 0 && (
                    <span className="text-amber-600"> · {progress.failed} failed</span>
                  )}
                </p>
              ) : (
                <p className="text-xs text-gray-400 mt-0.5">Starting…</p>
              )}
            </div>
          </div>

          {/* Progress bar */}
          <div className="w-full">
            <div className="h-2 w-full rounded-full bg-gray-100 overflow-hidden">
              <div
                className="h-full rounded-full bg-indigo-500 transition-all duration-500 ease-out"
                style={{ width: progress.total > 0 ? `${progressPct}%` : '0%' }}
              />
            </div>
            {progress.total > 0 && (
              <p className="text-right text-xs text-gray-400 mt-1">{progressPct}%</p>
            )}
          </div>

          <p className="text-xs text-gray-400">Please don&apos;t close this page.</p>
        </div>
      )}

      {phase === 'done' && result && (
        <div className="rounded-xl border border-emerald-200 bg-emerald-50 p-6">
          <div className="flex items-center gap-3 mb-4">
            <svg className="h-6 w-6 text-emerald-500" viewBox="0 0 20 20" fill="currentColor">
              <path fillRule="evenodd" d="M10 18a8 8 0 1 0 0-16 8 8 0 0 0 0 16Zm3.857-9.809a.75.75 0 0 0-1.214-.882l-3.483 4.79-1.88-1.88a.75.75 0 1 0-1.06 1.061l2.5 2.5a.75.75 0 0 0 1.137-.089l4-5.5Z" clipRule="evenodd" />
            </svg>
            <p className="text-sm font-semibold text-emerald-800">
              {result.synced} {result.synced === 1 ? 'price' : 'prices'} updated in Shopify
            </p>
          </div>
          {result.failed > 0 && (
            <p className="text-xs text-amber-700 mb-4">
              {result.failed} items could not be updated. See run details for errors.
            </p>
          )}
          <Link
            href={`/dashboard/runs/${runId}`}
            className="text-sm font-medium text-emerald-700 hover:text-emerald-800 underline"
          >
            View run details →
          </Link>
        </div>
      )}

      {phase === 'error' && result && (
        <div className="rounded-xl border border-red-200 bg-red-50 p-6">
          <p className="text-sm font-semibold text-red-800 mb-2">Sync failed</p>
          <p className="text-xs text-red-700 mb-4">{result.error ?? 'An unknown error occurred.'}</p>
          {result.synced > 0 && (
            <p className="text-xs text-gray-600 mb-4">
              {result.synced} items were synced before the error.
            </p>
          )}
          <div className="flex gap-3">
            <Link
              href={`/dashboard/runs/${runId}`}
              className="text-sm text-red-700 hover:text-red-800 underline"
            >
              ← Back to preview
            </Link>
          </div>
        </div>
      )}
    </div>
  )
}
