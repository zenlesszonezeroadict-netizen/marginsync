'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'

export function ConnectForm() {
  const router = useRouter()
  const [shop, setShop] = useState('')
  const [error, setError] = useState<string | null>(null)

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    setError(null)

    let shopDomain = shop.trim().toLowerCase()
    if (!shopDomain) {
      setError('Please enter your store URL.')
      return
    }
    // Normalize: strip protocol and trailing slash
    shopDomain = shopDomain.replace(/^https?:\/\//, '').replace(/\/$/, '')
    if (!shopDomain.includes('.')) {
      shopDomain = `${shopDomain}.myshopify.com`
    }

    const pattern = /^[a-zA-Z0-9][a-zA-Z0-9-]*\.myshopify\.com$/
    if (!pattern.test(shopDomain)) {
      setError('Must be a *.myshopify.com domain (e.g. your-store.myshopify.com).')
      return
    }

    router.push(`/api/shopify/install?shop=${encodeURIComponent(shopDomain)}`)
  }

  return (
    <form onSubmit={handleSubmit} className="flex items-start gap-3">
      <div className="flex-1">
        <input
          type="text"
          value={shop}
          onChange={(e) => setShop(e.target.value)}
          placeholder="your-store.myshopify.com"
          className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-300 focus:border-indigo-400"
        />
        {error && <p className="mt-1.5 text-xs text-red-600">{error}</p>}
      </div>
      <button
        type="submit"
        className="shrink-0 bg-indigo-600 text-white text-sm font-medium px-4 py-2 rounded-lg hover:bg-indigo-700 transition-colors"
      >
        Connect
      </button>
    </form>
  )
}
