'use client'

import { useState } from 'react'

export function SyncButton() {
  const [state, setState] = useState<'idle' | 'syncing' | 'done' | 'error'>('idle')
  const [result, setResult] = useState<{ upserted?: number; skipped?: number; error?: string } | null>(null)

  const handleSync = async () => {
    setState('syncing')
    setResult(null)

    try {
      const res = await fetch('/api/shopify/sync', { method: 'POST' })
      const data = (await res.json()) as { upserted?: number; skipped?: number; error?: string }
      setResult(data)
      setState(res.ok ? 'done' : 'error')
    } catch {
      setResult({ error: 'Network error. Please try again.' })
      setState('error')
    }
  }

  return (
    <div>
      <button
        onClick={() => void handleSync()}
        disabled={state === 'syncing'}
        className="inline-flex items-center gap-2 bg-indigo-600 text-white text-sm font-medium px-4 py-2 rounded-lg hover:bg-indigo-700 disabled:opacity-50 transition-colors"
      >
        {state === 'syncing' ? (
          <>
            <div className="h-4 w-4 rounded-full border-2 border-white/40 border-t-white animate-spin" />
            Syncing…
          </>
        ) : (
          <>
            <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" d="M16.023 9.348h4.992v-.001M2.985 19.644v-4.992m0 0h4.992m-4.993 0 3.181 3.183a8.25 8.25 0 0 0 13.803-3.7M4.031 9.865a8.25 8.25 0 0 1 13.803-3.7l3.181 3.182m0-4.991v4.99" />
            </svg>
            Sync catalog now
          </>
        )}
      </button>

      {state === 'done' && result && (
        <p className="mt-2 text-xs text-emerald-700">
          ✓ Synced {result.upserted?.toLocaleString()} variants
          {(result.skipped ?? 0) > 0 && ` (${result.skipped} skipped — no SKU)`}
        </p>
      )}
      {state === 'error' && result?.error && (
        <p className="mt-2 text-xs text-red-600">{result.error}</p>
      )}
    </div>
  )
}
