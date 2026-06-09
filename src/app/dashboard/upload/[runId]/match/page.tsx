'use client'

import { useState, useEffect } from 'react'
import { useRouter, useParams } from 'next/navigation'

interface RunItem {
  id: string
  supplier_sku: string
  shopify_variant_id: string | null
  product_title: string | null
  variant_title: string | null
  flag: string | null
}

interface RunData {
  id: string
  status: string
  itemsTotal: number
}

export default function MatchReviewPage() {
  const router = useRouter()
  const params = useParams<{ runId: string }>()
  const runId = params.runId

  const [run, setRun] = useState<RunData | null>(null)
  const [unmatchedItems, setUnmatchedItems] = useState<RunItem[]>([])
  const [matchedCount, setMatchedCount] = useState(0)
  const [loadError, setLoadError] = useState<string | null>(null)
  const [isPricing, setIsPricing] = useState(false)
  const [pricingError, setPricingError] = useState<string | null>(null)

  useEffect(() => {
    void (async () => {
      const [runRes, itemsRes] = await Promise.all([
        fetch(`/api/runs/${runId}`),
        fetch(`/api/runs/${runId}/items?flag=unmatched&limit=50`),
      ])

      const runData = (await runRes.json()) as RunData & { error?: string }
      if (!runRes.ok) {
        setLoadError(runData.error ?? 'Failed to load run')
        return
      }
      setRun(runData)

      if (itemsRes.ok) {
        const itemsData = (await itemsRes.json()) as { items: RunItem[]; matchedCount: number }
        setUnmatchedItems(itemsData.items)
        setMatchedCount(itemsData.matchedCount)
      }
    })()
  }, [runId])

  const handleProceed = async () => {
    setIsPricing(true)
    setPricingError(null)

    try {
      const res = await fetch(`/api/runs/${runId}/price`, { method: 'POST' })
      if (!res.ok) {
        const d = (await res.json()) as { error?: string }
        setPricingError(d.error ?? 'Pricing failed.')
        return
      }
      router.push(`/dashboard/runs/${runId}`)
    } finally {
      setIsPricing(false)
    }
  }

  if (loadError) {
    return (
      <div className="p-8 max-w-3xl">
        <div className="rounded-lg bg-red-50 border border-red-200 px-4 py-3 text-sm text-red-700">
          {loadError}
        </div>
      </div>
    )
  }

  if (!run) {
    return (
      <div className="p-8 flex items-center gap-3 text-sm text-gray-500">
        <div className="h-4 w-4 rounded-full border-2 border-gray-300 border-t-gray-600 animate-spin" />
        Loading…
      </div>
    )
  }

  const unmatchedCount = run.itemsTotal - matchedCount

  return (
    <div className="p-8 max-w-3xl">
      <div className="mb-2">
        <WizardSteps current={2} />
      </div>

      <div className="mb-8">
        <h1 className="text-2xl font-bold text-gray-900">Review Matches</h1>
        <p className="text-sm text-gray-500 mt-1">
          MarginSync matched your supplier SKUs against your Shopify catalog.
        </p>
      </div>

      <div className="grid grid-cols-3 gap-4 mb-8">
        <StatCard
          label="Total rows"
          value={run.itemsTotal.toLocaleString()}
          color="gray"
        />
        <StatCard
          label="Matched"
          value={matchedCount.toLocaleString()}
          color="emerald"
        />
        <StatCard
          label="Unmatched"
          value={unmatchedCount.toLocaleString()}
          color={unmatchedCount > 0 ? 'amber' : 'emerald'}
        />
      </div>

      {unmatchedItems.length > 0 && (
        <div className="mb-8">
          <div className="flex items-center justify-between mb-3">
            <h2 className="text-sm font-semibold text-gray-700">
              Unmatched SKUs
              {unmatchedCount > 50 && (
                <span className="ml-1.5 text-gray-400 font-normal">
                  (showing first 50 of {unmatchedCount})
                </span>
              )}
            </h2>
            <span className="text-xs text-amber-700 bg-amber-50 border border-amber-200 rounded-full px-2 py-0.5">
              These rows will be skipped during sync
            </span>
          </div>

          <div className="rounded-xl border border-gray-200 overflow-hidden">
            <table className="w-full text-sm">
              <thead className="bg-gray-50 border-b border-gray-200">
                <tr>
                  <th className="text-left px-4 py-2.5 text-xs font-semibold text-gray-500">
                    Supplier SKU
                  </th>
                  <th className="text-left px-4 py-2.5 text-xs font-semibold text-gray-500">
                    Status
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {unmatchedItems.map((item) => (
                  <tr key={item.id} className="hover:bg-gray-50">
                    <td className="px-4 py-2.5 font-mono text-xs text-gray-700">
                      {item.supplier_sku}
                    </td>
                    <td className="px-4 py-2.5">
                      <span className="text-xs text-amber-700 bg-amber-50 border border-amber-100 rounded-full px-2 py-0.5">
                        No catalog match
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <p className="text-xs text-gray-400 mt-2">
            Connect your Shopify store to match these automatically. Unmatched SKUs are excluded from pricing but appear in your history for review.
          </p>
        </div>
      )}

      {pricingError && (
        <div className="mb-4 rounded-lg bg-red-50 border border-red-200 px-4 py-3 text-sm text-red-700">
          {pricingError}
        </div>
      )}

      <div className="flex items-center justify-between">
        <button
          onClick={() => router.push(`/dashboard/upload/${runId}/map-columns`)}
          className="text-sm text-gray-500 hover:text-gray-700"
          disabled={isPricing}
        >
          ← Back
        </button>
        <button
          onClick={() => void handleProceed()}
          disabled={isPricing || matchedCount === 0}
          className="inline-flex items-center gap-2 bg-indigo-600 text-white text-sm font-medium px-5 py-2.5 rounded-lg hover:bg-indigo-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
        >
          {isPricing ? (
            <>
              <div className="h-4 w-4 rounded-full border-2 border-white/40 border-t-white animate-spin" />
              Computing prices…
            </>
          ) : (
            `Compute prices for ${matchedCount.toLocaleString()} products →`
          )}
        </button>
      </div>
    </div>
  )
}

function StatCard({
  label,
  value,
  color,
}: {
  label: string
  value: string
  color: 'gray' | 'emerald' | 'amber'
}) {
  const cls = {
    gray: 'bg-white border-gray-200',
    emerald: 'bg-emerald-50 border-emerald-200',
    amber: 'bg-amber-50 border-amber-200',
  }[color]
  const textCls = {
    gray: 'text-gray-900',
    emerald: 'text-emerald-800',
    amber: 'text-amber-800',
  }[color]

  return (
    <div className={`rounded-xl border p-4 ${cls}`}>
      <p className="text-xs text-gray-500 font-medium uppercase tracking-wide">{label}</p>
      <p className={`text-2xl font-bold mt-1 ${textCls}`}>{value}</p>
    </div>
  )
}

function WizardSteps({ current }: { current: number }) {
  const steps = ['Upload', 'Map columns', 'Review matches', 'Preview prices']
  return (
    <div className="flex items-center gap-2 mb-6">
      {steps.map((step, i) => {
        const done = i < current
        const active = i === current
        return (
          <div key={step} className="flex items-center gap-2">
            {i > 0 && <div className="h-px w-6 bg-gray-200" />}
            <div className="flex items-center gap-1.5">
              <div
                className={[
                  'h-5 w-5 rounded-full flex items-center justify-center text-xs font-bold',
                  done
                    ? 'bg-indigo-600 text-white'
                    : active
                    ? 'bg-indigo-100 text-indigo-700 ring-2 ring-indigo-300'
                    : 'bg-gray-100 text-gray-400',
                ].join(' ')}
              >
                {done ? '✓' : i + 1}
              </div>
              <span
                className={[
                  'text-xs font-medium',
                  active ? 'text-gray-800' : done ? 'text-indigo-600' : 'text-gray-400',
                ].join(' ')}
              >
                {step}
              </span>
            </div>
          </div>
        )
      })}
    </div>
  )
}
