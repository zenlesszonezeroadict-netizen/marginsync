'use client'

import { useState } from 'react'

export function UpgradeButton({ hasShopify }: { hasShopify: boolean }) {
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const handleUpgrade = async () => {
    if (!hasShopify) return
    setIsLoading(true)
    setError(null)
    try {
      const res = await fetch('/api/billing/subscribe', { method: 'POST' })
      const data = (await res.json()) as { url?: string; error?: string }
      if (!res.ok || !data.url) {
        setError(data.error ?? 'Could not start upgrade.')
        return
      }
      // Redirect to Shopify's hosted confirmation page
      window.location.href = data.url
    } finally {
      setIsLoading(false)
    }
  }

  if (!hasShopify) {
    return (
      <div className="rounded-lg bg-yellow-50 border border-yellow-200 px-4 py-3">
        <p className="text-sm text-yellow-800">
          You need to{' '}
          <a href="/dashboard/shopify" className="font-semibold underline">
            connect your Shopify store
          </a>{' '}
          before upgrading — MarginSync Pro billing runs through Shopify.
        </p>
      </div>
    )
  }

  return (
    <div>
      <button
        onClick={() => void handleUpgrade()}
        disabled={isLoading}
        className="inline-flex items-center gap-2 bg-indigo-600 text-white text-sm font-semibold px-5 py-2.5 rounded-lg hover:bg-indigo-700 disabled:opacity-50 transition-colors"
      >
        {isLoading ? (
          <>
            <div className="h-4 w-4 rounded-full border-2 border-white/40 border-t-white animate-spin" />
            Redirecting to Shopify…
          </>
        ) : (
          'Upgrade to Pro — $19/mo →'
        )}
      </button>
      {error && <p className="mt-2 text-xs text-red-600">{error}</p>}
    </div>
  )
}
