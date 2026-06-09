'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'

interface Props {
  runId: string
  syncedCount: number
  hasNewerCompletedRun: boolean
}

export function RollbackButton({ runId, syncedCount, hasNewerCompletedRun }: Props) {
  const router = useRouter()
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const handleRollback = async () => {
    const msg = hasNewerCompletedRun
      ? `This will revert ${syncedCount} price(s) to their pre-run values. A newer run has since updated some of these products — those changes will be overwritten. Continue?`
      : `This will revert ${syncedCount} price(s) to their previous values on Shopify. Continue?`

    if (!window.confirm(msg)) return

    setLoading(true)
    setError(null)
    try {
      const res = await fetch(`/api/runs/${runId}/rollback`, { method: 'POST' })
      const data = (await res.json()) as { error?: string; rolledBack?: number }
      if (!res.ok) {
        setError(data.error ?? 'Rollback failed')
        return
      }
      router.refresh()
    } catch {
      setError('Network error')
    } finally {
      setLoading(false)
    }
  }

  if (error) {
    return <span className="text-xs text-red-600 font-medium">{error}</span>
  }

  return (
    <button
      onClick={() => void handleRollback()}
      disabled={loading}
      title={hasNewerCompletedRun ? 'A newer run may have overwritten these prices' : 'Revert prices to pre-run values'}
      className={[
        'text-xs font-medium px-2.5 py-1 rounded-full border transition-colors disabled:opacity-50 whitespace-nowrap',
        hasNewerCompletedRun
          ? 'text-amber-700 border-amber-300 bg-amber-50 hover:bg-amber-100'
          : 'text-rose-700 border-rose-300 bg-rose-50 hover:bg-rose-100',
      ].join(' ')}
    >
      {loading ? 'Reverting…' : hasNewerCompletedRun ? '⚠ Rollback' : 'Rollback'}
    </button>
  )
}
