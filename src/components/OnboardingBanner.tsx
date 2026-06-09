'use client'

import { useState, useEffect } from 'react'
import Link from 'next/link'

export interface OnboardingStatus {
  shopifyConnected: boolean
  pricingConfigured: boolean
  hasRuns: boolean
}

const STORAGE_KEY = 'ms_onboarding_dismissed'

function CheckIcon({ done }: { done: boolean }) {
  if (done) {
    return (
      <div className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-emerald-100">
        <svg className="h-3.5 w-3.5 text-emerald-600" viewBox="0 0 20 20" fill="currentColor">
          <path fillRule="evenodd" d="M16.704 4.153a.75.75 0 0 1 .143 1.052l-8 10.5a.75.75 0 0 1-1.127.075l-4.5-4.5a.75.75 0 0 1 1.06-1.06l3.894 3.893 7.48-9.817a.75.75 0 0 1 1.05-.143Z" clipRule="evenodd" />
        </svg>
      </div>
    )
  }
  return (
    <div className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full border-2 border-gray-300 bg-white" />
  )
}

export function OnboardingBanner({ status }: { status: OnboardingStatus }) {
  const { shopifyConnected, pricingConfigured, hasRuns } = status
  const allDone = shopifyConnected && pricingConfigured && hasRuns

  const [dismissed, setDismissed] = useState(false)
  const [collapsed, setCollapsed] = useState(false)

  // Read dismissed state from localStorage after hydration
  useEffect(() => {
    if (localStorage.getItem(STORAGE_KEY) === '1') setDismissed(true)
  }, [])

  const handleDismiss = () => {
    localStorage.setItem(STORAGE_KEY, '1')
    setDismissed(true)
  }

  if (dismissed || allDone) return null

  const steps = [
    {
      label: 'Connect Shopify Store',
      done: shopifyConnected,
      href: '/dashboard/shopify',
      hint: 'Link your Shopify store so MarginSync can push updated prices automatically.',
    },
    {
      label: 'Set Pricing Rules',
      done: pricingConfigured,
      href: '/dashboard/settings/pricing',
      hint: 'Configure your markup multiplier and minimum margin target.',
    },
    {
      label: 'Upload Cost Spreadsheet',
      done: hasRuns,
      href: '/dashboard/upload',
      hint: 'Upload a supplier price list to run your first repricing.',
    },
  ]

  const completedCount = steps.filter((s) => s.done).length

  return (
    <div className="mb-8 rounded-xl border border-indigo-200 bg-indigo-50 overflow-hidden">
      {/* Header */}
      <div className="flex items-center justify-between gap-3 px-5 py-3.5">
        <div className="flex items-center gap-3">
          <button
            type="button"
            onClick={() => setCollapsed((v) => !v)}
            className="flex items-center gap-2 group"
          >
            <span className="text-sm font-semibold text-indigo-900">
              Getting Started with MarginSync
            </span>
            <svg
              className={`h-4 w-4 text-indigo-500 transition-transform ${collapsed ? '-rotate-90' : ''}`}
              fill="none"
              viewBox="0 0 24 24"
              strokeWidth={2}
              stroke="currentColor"
            >
              <path strokeLinecap="round" strokeLinejoin="round" d="m19.5 8.25-7.5 7.5-7.5-7.5" />
            </svg>
          </button>
          <span className="text-xs text-indigo-600 font-medium">
            {completedCount}/{steps.length} complete
          </span>
        </div>
        <button
          type="button"
          onClick={handleDismiss}
          className="text-xs text-indigo-400 hover:text-indigo-600 transition-colors"
        >
          Dismiss
        </button>
      </div>

      {/* Steps */}
      {!collapsed && (
        <div className="border-t border-indigo-100 divide-y divide-indigo-100">
          {steps.map((step) => (
            <div key={step.label} className="flex items-center gap-3 px-5 py-3 bg-white/60">
              <CheckIcon done={step.done} />
              <div className="flex-1 min-w-0">
                <p className={`text-sm font-medium ${step.done ? 'text-gray-400 line-through' : 'text-gray-800'}`}>
                  {step.label}
                </p>
                {!step.done && (
                  <p className="text-xs text-gray-500 mt-0.5">{step.hint}</p>
                )}
              </div>
              {!step.done && (
                <Link
                  href={step.href}
                  className="shrink-0 text-xs font-semibold text-indigo-600 hover:text-indigo-700 transition-colors"
                >
                  Set up →
                </Link>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
