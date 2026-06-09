'use client'

import { useState, useEffect } from 'react'
import type { PricingRule, RoundingMode, ScarcityRule } from '@/lib/pricing/types'
import { InfoTooltip } from '@/components/InfoTooltip'

interface SettingsData {
  pricingRule: PricingRule
  marginTargetPct: number
}

export default function PricingSettingsPage() {
  const [settings, setSettings] = useState<SettingsData | null>(null)
  const [loadError, setLoadError] = useState<string | null>(null)

  const [markupValue, setMarkupValue] = useState('1.40')
  const [rounding, setRounding] = useState<RoundingMode>('0.99')
  const [marginTarget, setMarginTarget] = useState('30')
  const [scarcityRules, setScarcityRules] = useState<ScarcityRule[]>([])

  const [isSaving, setIsSaving] = useState(false)
  const [saveSuccess, setSaveSuccess] = useState(false)
  const [saveError, setSaveError] = useState<string | null>(null)

  useEffect(() => {
    void (async () => {
      const res = await fetch('/api/settings/pricing')
      const data = (await res.json()) as SettingsData & { error?: string }
      if (!res.ok) { setLoadError(data.error ?? 'Failed to load settings'); return }
      setSettings(data)
      setMarkupValue(String(data.pricingRule.value))
      setRounding(data.pricingRule.rounding)
      setMarginTarget(String(data.marginTargetPct))
      setScarcityRules(data.pricingRule.scarcityRules ?? [])
    })()
  }, [])

  const addScarcityRule = () =>
    setScarcityRules((prev) => [...prev, { inventoryThreshold: 5, extraMarkupPct: 10 }])

  const removeScarcityRule = (idx: number) =>
    setScarcityRules((prev) => prev.filter((_, i) => i !== idx))

  const updateScarcityRule = (idx: number, patch: Partial<ScarcityRule>) =>
    setScarcityRules((prev) => prev.map((r, i) => (i === idx ? { ...r, ...patch } : r)))

  const handleSave = async () => {
    const value = parseFloat(markupValue)
    if (isNaN(value) || value <= 0) {
      setSaveError('Markup multiplier must be a positive number (e.g. 1.4 = 40% markup).')
      return
    }
    const marginPct = parseFloat(marginTarget)
    if (isNaN(marginPct) || marginPct < 0 || marginPct > 100) {
      setSaveError('Minimum margin must be between 0 and 100.')
      return
    }
    for (const sr of scarcityRules) {
      if (sr.inventoryThreshold <= 0 || sr.extraMarkupPct < 0) {
        setSaveError('Each scarcity rule needs a stock threshold > 0 and a non-negative extra markup.')
        return
      }
    }

    setIsSaving(true)
    setSaveError(null)
    setSaveSuccess(false)

    try {
      const res = await fetch('/api/settings/pricing', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          pricingRule: { type: 'markup', value, rounding, scarcityRules },
          marginTargetPct: marginPct,
        }),
      })
      const data = (await res.json()) as { error?: string }
      if (!res.ok) { setSaveError(data.error ?? 'Failed to save settings.'); return }
      setSaveSuccess(true)
      setTimeout(() => setSaveSuccess(false), 3000)
    } finally {
      setIsSaving(false)
    }
  }

  // Live preview
  const exampleCost = 10
  const markupNum = parseFloat(markupValue) || 0
  const rawPrice = exampleCost * markupNum
  const roundedPrice = applyRoundingPreview(rawPrice, rounding)
  const marginPct = roundedPrice > 0 ? ((roundedPrice - exampleCost) / roundedPrice) * 100 : 0
  const belowTarget = parseFloat(marginTarget) > 0 && marginPct < parseFloat(marginTarget)

  if (loadError) {
    return (
      <div className="p-8 max-w-2xl">
        <div className="rounded-lg bg-red-50 border border-red-200 px-4 py-3 text-sm text-red-700">{loadError}</div>
      </div>
    )
  }
  if (!settings) {
    return (
      <div className="p-8 flex items-center gap-3 text-sm text-gray-500">
        <div className="h-4 w-4 rounded-full border-2 border-gray-300 border-t-gray-600 animate-spin" />
        Loading…
      </div>
    )
  }

  return (
    <div className="p-8 max-w-2xl">
      <div className="mb-8">
        <h1 className="text-2xl font-bold text-gray-900">Pricing Rules</h1>
        <p className="text-sm text-gray-500 mt-1">
          Configure how MarginSync computes your retail prices from supplier costs.
        </p>
      </div>

      <div className="space-y-6">
        {/* Markup multiplier */}
        <div className="rounded-xl border border-gray-200 bg-white p-6">
          <div className="flex items-center gap-2 mb-1">
            <label className="text-sm font-semibold text-gray-800">Markup multiplier</label>
            <InfoTooltip text="Multiplies your supplier cost to get the retail price. 1.4 = cost × 1.4. Higher values increase margin but may reduce competitiveness." />
          </div>
          <p className="text-xs text-gray-500 mb-3">
            Retail price = cost × multiplier. A value of 1.4 gives a 40% markup (28.6% gross margin).
          </p>
          <div className="flex items-center gap-3">
            <input
              type="number" step="0.01" min="1" max="10" value={markupValue}
              onChange={(e) => setMarkupValue(e.target.value)}
              className="w-32 rounded-lg border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-300 focus:border-indigo-400"
            />
            <span className="text-sm text-gray-500">×  cost  →  retail price</span>
          </div>
        </div>

        {/* Rounding mode */}
        <div className="rounded-xl border border-gray-200 bg-white p-6">
          <p className="text-sm font-semibold text-gray-800 mb-1">Price rounding</p>
          <p className="text-xs text-gray-500 mb-4">Applied after the markup to produce a clean retail price.</p>
          <div className="space-y-2">
            {(
              [
                { value: '0.99', label: 'Round up to nearest .99', example: '$12.50 → $12.99' },
                { value: '0.00', label: 'Round to nearest cent', example: '$12.50 → $12.50' },
                { value: 'none', label: 'No rounding', example: '$12.4950 → $12.50' },
              ] satisfies { value: RoundingMode; label: string; example: string }[]
            ).map(({ value, label, example }) => (
              <label
                key={value}
                className={[
                  'flex items-center justify-between gap-4 rounded-lg border px-4 py-3 cursor-pointer transition-colors',
                  rounding === value ? 'border-indigo-400 bg-indigo-50' : 'border-gray-200 hover:border-gray-300',
                ].join(' ')}
              >
                <div className="flex items-center gap-3">
                  <input type="radio" name="rounding" value={value} checked={rounding === value}
                    onChange={() => setRounding(value)} className="accent-indigo-600" />
                  <span className="text-sm font-medium text-gray-700">{label}</span>
                </div>
                <span className="text-xs text-gray-400 font-mono">{example}</span>
              </label>
            ))}
          </div>
        </div>

        {/* Margin target */}
        <div className="rounded-xl border border-gray-200 bg-white p-6">
          <div className="flex items-center gap-2 mb-1">
            <label className="text-sm font-semibold text-gray-800">Minimum margin target</label>
            <InfoTooltip text="Gross margin = (retail − cost) ÷ retail. Items below this threshold are flagged in the preview so you can review before pushing to Shopify." />
          </div>
          <p className="text-xs text-gray-500 mb-3">
            Items with computed margin below this threshold are flagged{' '}
            <span className="font-medium text-amber-700">below_margin</span> in the preview.
          </p>
          <div className="flex items-center gap-2">
            <input
              type="number" step="1" min="0" max="100" value={marginTarget}
              onChange={(e) => setMarginTarget(e.target.value)}
              className="w-24 rounded-lg border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-300 focus:border-indigo-400"
            />
            <span className="text-sm text-gray-500">%</span>
          </div>
        </div>

        {/* Step 3: Scarcity / Dynamic Inventory Markup */}
        <div className="rounded-xl border border-gray-200 bg-white p-6">
          <div className="flex items-center justify-between mb-1">
            <div className="flex items-center gap-2">
              <p className="text-sm font-semibold text-gray-800">Inventory-based scarcity pricing</p>
              <InfoTooltip text="Fetches live Shopify stock counts before pricing. When stock falls below your threshold, an extra markup is added automatically — no action needed." />
            </div>
            <button
              type="button"
              onClick={addScarcityRule}
              className="text-xs font-medium text-indigo-600 hover:text-indigo-700 border border-indigo-200 bg-indigo-50 hover:bg-indigo-100 rounded-lg px-3 py-1 transition-colors"
            >
              + Add rule
            </button>
          </div>
          <p className="text-xs text-gray-500 mb-4">
            Apply an extra markup percentage when Shopify stock falls below a threshold — charge a
            scarcity premium automatically.
          </p>

          {scarcityRules.length === 0 ? (
            <p className="text-xs text-gray-400 italic">No rules configured. Add one above.</p>
          ) : (
            <div className="space-y-3">
              {scarcityRules.map((rule, idx) => (
                <div key={idx} className="flex items-center gap-3 flex-wrap">
                  <span className="text-xs text-gray-500 whitespace-nowrap">If stock &lt;</span>
                  <input
                    type="number" min="1" step="1"
                    value={rule.inventoryThreshold}
                    onChange={(e) => updateScarcityRule(idx, { inventoryThreshold: Number(e.target.value) })}
                    className="w-20 rounded-lg border border-gray-300 px-2 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-300 focus:border-indigo-400"
                  />
                  <span className="text-xs text-gray-500 whitespace-nowrap">units, add</span>
                  <input
                    type="number" min="0" max="500" step="0.5"
                    value={rule.extraMarkupPct}
                    onChange={(e) => updateScarcityRule(idx, { extraMarkupPct: Number(e.target.value) })}
                    className="w-20 rounded-lg border border-gray-300 px-2 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-300 focus:border-indigo-400"
                  />
                  <span className="text-xs text-gray-500 whitespace-nowrap">% extra markup</span>
                  <button
                    type="button"
                    onClick={() => removeScarcityRule(idx)}
                    className="text-xs text-red-500 hover:text-red-700 font-medium ml-auto"
                  >
                    Remove
                  </button>
                </div>
              ))}
              <p className="text-xs text-gray-400 mt-2">
                Rules are checked in order — first matching threshold applies. Inventory is fetched
                live from Shopify when prices are calculated.
              </p>
            </div>
          )}
        </div>

        {/* Live preview */}
        <div className="rounded-xl border border-gray-100 bg-gray-50 p-5">
          <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-3">
            Live preview — example cost $10.00
          </p>
          <div className="grid grid-cols-3 gap-4">
            <div>
              <p className="text-xs text-gray-400">Retail price</p>
              <p className="text-lg font-bold text-gray-800 mt-0.5">${roundedPrice.toFixed(2)}</p>
            </div>
            <div>
              <p className="text-xs text-gray-400">Gross margin</p>
              <p className={`text-lg font-bold mt-0.5 ${belowTarget ? 'text-amber-600' : 'text-emerald-700'}`}>
                {marginPct.toFixed(1)}%
              </p>
            </div>
            <div>
              <p className="text-xs text-gray-400">Flag</p>
              <p className="mt-0.5">
                {belowTarget ? (
                  <span className="text-xs font-medium text-amber-700 bg-amber-50 border border-amber-200 rounded-full px-2 py-0.5">below_margin</span>
                ) : (
                  <span className="text-xs font-medium text-emerald-700 bg-emerald-50 border border-emerald-200 rounded-full px-2 py-0.5">ok</span>
                )}
              </p>
            </div>
          </div>
        </div>
      </div>

      {saveError && (
        <div className="mt-4 rounded-lg bg-red-50 border border-red-200 px-4 py-3 text-sm text-red-700">
          {saveError}
        </div>
      )}

      <div className="mt-6 flex items-center gap-3">
        <button
          onClick={() => void handleSave()}
          disabled={isSaving}
          className="inline-flex items-center gap-2 bg-indigo-600 text-white text-sm font-medium px-5 py-2.5 rounded-lg hover:bg-indigo-700 disabled:opacity-50 transition-colors"
        >
          {isSaving ? (
            <><div className="h-4 w-4 rounded-full border-2 border-white/40 border-t-white animate-spin" />Saving…</>
          ) : 'Save pricing rules'}
        </button>
        {saveSuccess && <span className="text-sm text-emerald-600 font-medium">✓ Saved</span>}
      </div>
    </div>
  )
}

function applyRoundingPreview(price: number, mode: RoundingMode): number {
  if (mode === '0.99') return Math.ceil(price) - 0.01
  if (mode === '0.00') return Math.round(price * 100) / 100
  return Math.round(price * 100) / 100
}
