'use client'

import { Suspense, useState } from 'react'
import { useSearchParams } from 'next/navigation'
import Link from 'next/link'
import { createClient } from '@/lib/supabase/client'

function LoginContent() {
  const searchParams = useSearchParams()
  const shop = searchParams.get('shop')
  const host = searchParams.get('host')
  const isShopifyEmbed = !!(shop && host)

  const [email, setEmail] = useState('')
  const [loading, setLoading] = useState(false)
  const [sent, setSent] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault()
    setLoading(true)
    setError(null)

    const supabase = createClient()

    // After clicking the magic link, redirect to Shopify connect page
    // if we arrived from an App Bridge session, so the install completes seamlessly.
    const nextPath = isShopifyEmbed
      ? `/dashboard/shopify?shop=${encodeURIComponent(shop!)}`
      : undefined

    const { error: otpError } = await supabase.auth.signInWithOtp({
      email,
      options: {
        emailRedirectTo: nextPath
          ? `${window.location.origin}/auth/callback?next=${encodeURIComponent(nextPath)}`
          : `${window.location.origin}/auth/callback`,
      },
    })

    if (otpError) {
      setError(otpError.message)
    } else {
      setSent(true)
    }
    setLoading(false)
  }

  if (sent) {
    return (
      <main className="min-h-screen flex items-center justify-center bg-gray-50 px-4">
        <div className="w-full max-w-sm bg-white rounded-2xl shadow-sm border border-gray-100 p-8 text-center">
          <div className="w-12 h-12 bg-indigo-50 rounded-full flex items-center justify-center mx-auto mb-4">
            <svg className="w-6 h-6 text-indigo-600" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" d="M21.75 6.75v10.5a2.25 2.25 0 0 1-2.25 2.25h-15a2.25 2.25 0 0 1-2.25-2.25V6.75m19.5 0A2.25 2.25 0 0 0 19.5 4.5h-15a2.25 2.25 0 0 0-2.25 2.25m19.5 0v.243a2.25 2.25 0 0 1-1.07 1.916l-7.5 4.615a2.25 2.25 0 0 1-2.36 0L3.32 8.91a2.25 2.25 0 0 1-1.07-1.916V6.75" />
            </svg>
          </div>
          <h1 className="text-xl font-semibold text-gray-900 mb-1">Check your inbox</h1>
          <p className="text-sm text-gray-500">
            We sent a magic link to{' '}
            <span className="font-medium text-gray-700">{email}</span>.
            Click it to sign in — no password needed.
          </p>
          {isShopifyEmbed && (
            <p className="text-xs text-indigo-600 bg-indigo-50 border border-indigo-100 rounded-lg px-3 py-2 mt-4">
              After signing in you&apos;ll be taken directly to connect{' '}
              <span className="font-medium">{shop}</span>.
            </p>
          )}
          <button
            onClick={() => { setSent(false); setEmail('') }}
            className="mt-6 text-sm text-indigo-600 hover:text-indigo-700"
          >
            Use a different email
          </button>
        </div>
      </main>
    )
  }

  return (
    <main className="min-h-screen flex items-center justify-center bg-gray-50 px-4">
      <div className="w-full max-w-sm">
        <div className="mb-8 text-center">
          <h1 className="text-2xl font-bold text-gray-900">MarginSync</h1>
          <p className="text-sm text-gray-500 mt-1">Margin-safe Shopify repricing</p>
        </div>

        {/* Shopify embed context banner */}
        {isShopifyEmbed && (
          <div className="mb-4 rounded-xl border border-indigo-200 bg-indigo-50 px-4 py-3">
            <p className="text-sm font-semibold text-indigo-800 mb-0.5">Installing for Shopify</p>
            <p className="text-xs text-indigo-700">
              Sign in with your work email to connect{' '}
              <span className="font-medium">{shop}</span> to MarginSync.
            </p>
          </div>
        )}

        <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-8">
          <h2 className="text-base font-semibold text-gray-900 mb-6">Sign in to your account</h2>

          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label htmlFor="email" className="block text-sm font-medium text-gray-700 mb-1.5">
                Email address
              </label>
              <input
                id="email"
                type="email"
                required
                autoComplete="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="you@yourstore.com"
                className="w-full border border-gray-300 rounded-lg px-3.5 py-2.5 text-sm placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 transition-colors"
              />
            </div>

            {error && (
              <p className="text-sm text-red-600 bg-red-50 border border-red-100 rounded-lg px-3 py-2">
                {error}
              </p>
            )}

            <button
              type="submit"
              disabled={loading || email.trim() === ''}
              className="w-full bg-indigo-600 text-white rounded-lg px-4 py-2.5 text-sm font-medium hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:ring-offset-2 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
            >
              {loading ? 'Sending…' : 'Send magic link'}
            </button>
          </form>
        </div>

        <p className="mt-6 text-center text-xs text-gray-400">
          By signing in you agree to our{' '}
          <Link href="/terms" className="underline hover:text-gray-600">Terms of Service</Link>
          {' '}and{' '}
          <Link href="/privacy" className="underline hover:text-gray-600">Privacy Policy</Link>.
        </p>
      </div>
    </main>
  )
}

export default function LoginPage() {
  return (
    <Suspense>
      <LoginContent />
    </Suspense>
  )
}
