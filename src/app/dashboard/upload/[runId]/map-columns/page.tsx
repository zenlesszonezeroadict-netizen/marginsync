'use client'

import { useState, useEffect } from 'react'
import { useRouter, useParams } from 'next/navigation'
import { detectColumns } from '@/lib/parser/detect-columns'

interface RunData {
  id: string
  status: string
  sourceFilename: string | null
  headers: string[]
  columnConfig: { skuCol: string; costCol: string } | null
  itemsTotal: number
}

export default function MapColumnsPage() {
  const router = useRouter()
  const params = useParams<{ runId: string }>()
  const runId = params.runId

  const [run, setRun] = useState<RunData | null>(null)
  const [loadError, setLoadError] = useState<string | null>(null)
  const [skuCol, setSkuCol] = useState('')
  const [costCol, setCostCol] = useState('')
  const [isSaving, setIsSaving] = useState(false)
  const [saveError, setSaveError] = useState<string | null>(null)

  useEffect(() => {
    void (async () => {
      const res = await fetch(`/api/runs/${runId}`)
      const data = (await res.json()) as RunData & { error?: string }
      if (!res.ok) {
        setLoadError(data.error ?? 'Failed to load run')
        return
      }
      setRun(data)

      // Apply saved config, or auto-detect from headers
      if (data.columnConfig?.skuCol && data.columnConfig?.costCol) {
        setSkuCol(data.columnConfig.skuCol)
        setCostCol(data.columnConfig.costCol)
      } else if (data.headers.length > 0) {
        const detected = detectColumns(data.headers)
        setSkuCol(detected.skuCol)
        setCostCol(detected.costCol)
      }
    })()
  }, [runId])

  const handleConfirm = async () => {
    if (!skuCol || !costCol) {
      setSaveError('Please select both a SKU column and a cost column.')
      return
    }
    if (skuCol === costCol) {
      setSaveError('SKU column and cost column must be different.')
      return
    }

    setIsSaving(true)
    setSaveError(null)

    try {
      // Save column config
      const patchRes = await fetch(`/api/runs/${runId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ skuCol, costCol }),
      })
      if (!patchRes.ok) {
        const d = (await patchRes.json()) as { error?: string }
        setSaveError(d.error ?? 'Failed to save column mapping.')
        return
      }

      // Trigger matching
      const matchRes = await fetch(`/api/runs/${runId}/match`, { method: 'POST' })
      if (!matchRes.ok) {
        const d = (await matchRes.json()) as { error?: string }
        setSaveError(d.error ?? 'Matching failed.')
        return
      }

      router.push(`/dashboard/upload/${runId}/match`)
    } finally {
      setIsSaving(false)
    }
  }

  if (loadError) {
    return (
      <div className="p-8 max-w-2xl">
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

  const detected = detectColumns(run.headers)

  return (
    <div className="p-8 max-w-2xl">
      <div className="mb-2">
        <WizardSteps current={1} />
      </div>

      <div className="mb-8">
        <h1 className="text-2xl font-bold text-gray-900">Map Columns</h1>
        <p className="text-sm text-gray-500 mt-1">
          Confirm which columns contain the SKU and cost in{' '}
          <span className="font-medium text-gray-700">{run.sourceFilename ?? 'your file'}</span>
          {' '}({run.itemsTotal.toLocaleString()} rows).
        </p>
      </div>

      <div className="space-y-5">
        <ColumnSelect
          label="SKU column"
          description="The column that uniquely identifies each product (e.g. Part #, Item Code, SKU)."
          headers={run.headers}
          value={skuCol}
          onChange={setSkuCol}
          detectedCol={detected.skuCol}
          detectedConfidence={detected.skuConfidence}
          otherSelected={costCol}
        />

        <ColumnSelect
          label="Cost column"
          description="The column that contains your wholesale / supplier cost."
          headers={run.headers}
          value={costCol}
          onChange={setCostCol}
          detectedCol={detected.costCol}
          detectedConfidence={detected.costConfidence}
          otherSelected={skuCol}
        />
      </div>

      {saveError && (
        <div className="mt-4 rounded-lg bg-red-50 border border-red-200 px-4 py-3 text-sm text-red-700">
          {saveError}
        </div>
      )}

      <div className="mt-8 flex items-center justify-between">
        <button
          onClick={() => router.push('/dashboard/upload')}
          className="text-sm text-gray-500 hover:text-gray-700"
          disabled={isSaving}
        >
          ← Start over
        </button>
        <button
          onClick={() => void handleConfirm()}
          disabled={isSaving || !skuCol || !costCol}
          className="inline-flex items-center gap-2 bg-indigo-600 text-white text-sm font-medium px-5 py-2.5 rounded-lg hover:bg-indigo-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
        >
          {isSaving ? (
            <>
              <div className="h-4 w-4 rounded-full border-2 border-white/40 border-t-white animate-spin" />
              Matching SKUs…
            </>
          ) : (
            'Confirm & Match SKUs →'
          )}
        </button>
      </div>
    </div>
  )
}

function ColumnSelect({
  label,
  description,
  headers,
  value,
  onChange,
  detectedCol,
  detectedConfidence,
  otherSelected,
}: {
  label: string
  description: string
  headers: string[]
  value: string
  onChange: (v: string) => void
  detectedCol: string
  detectedConfidence: number
  otherSelected: string
}) {
  const confidencePct = Math.round(detectedConfidence * 100)

  return (
    <div className="rounded-xl border border-gray-200 bg-white p-5">
      <div className="flex items-start justify-between gap-4 mb-3">
        <div>
          <p className="text-sm font-semibold text-gray-800">{label}</p>
          <p className="text-xs text-gray-500 mt-0.5">{description}</p>
        </div>
        {detectedConfidence > 0 && (
          <span className="shrink-0 text-xs text-emerald-700 bg-emerald-50 border border-emerald-200 rounded-full px-2 py-0.5">
            {confidencePct}% confident
          </span>
        )}
      </div>

      <div className="flex flex-wrap gap-2">
        {headers.map((h) => {
          const isSelected = value === h
          const isOther = otherSelected === h
          const isDetected = detectedCol === h
          return (
            <button
              key={h}
              onClick={() => !isOther && onChange(h)}
              disabled={isOther}
              className={[
                'rounded-lg border px-3 py-1.5 text-xs font-medium transition-colors',
                isSelected
                  ? 'border-indigo-600 bg-indigo-600 text-white'
                  : isOther
                  ? 'border-gray-100 bg-gray-50 text-gray-300 cursor-not-allowed'
                  : isDetected
                  ? 'border-indigo-200 bg-indigo-50 text-indigo-700 hover:border-indigo-400'
                  : 'border-gray-200 bg-white text-gray-600 hover:border-gray-400',
              ].join(' ')}
            >
              {h}
              {isDetected && !isSelected && (
                <span className="ml-1.5 text-indigo-400">✦</span>
              )}
            </button>
          )
        })}
      </div>
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
