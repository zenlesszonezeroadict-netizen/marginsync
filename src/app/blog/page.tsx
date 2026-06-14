import Link from 'next/link'
import type { Metadata } from 'next'
import { getAllPostMeta } from '@/lib/blog'

export const metadata: Metadata = {
  title: 'MarginSync Blog — Shopify pricing guides',
  description:
    'Practical guides for Shopify merchants on bulk price updates, supplier CSV pricing, and protecting your margins.',
}

function formatDate(d: string): string {
  if (!d) return ''
  const date = new Date(d)
  if (isNaN(date.getTime())) return d
  return date.toLocaleDateString('en-GB', { year: 'numeric', month: 'long', day: 'numeric' })
}

export default function BlogIndexPage() {
  const posts = getAllPostMeta()

  return (
    <main className="min-h-screen bg-gray-50">
      <div className="max-w-3xl mx-auto px-4 py-16">
        <header className="mb-12">
          <Link href="/" className="text-sm text-indigo-600 hover:text-indigo-700">
            ← MarginSync
          </Link>
          <h1 className="text-3xl font-bold text-gray-900 mt-4">The MarginSync Blog</h1>
          <p className="text-gray-500 mt-2">
            Practical guides on Shopify pricing, supplier CSVs, and keeping your margins safe.
          </p>
        </header>

        <ul className="space-y-6">
          {posts.map(post => (
            <li key={post.slug}>
              <Link
                href={`/blog/${post.slug}`}
                className="block bg-white rounded-2xl border border-gray-100 shadow-sm p-6 hover:border-indigo-200 hover:shadow-md transition-all"
              >
                <h2 className="text-xl font-semibold text-gray-900">{post.title}</h2>
                <p className="text-gray-600 mt-2 leading-relaxed">{post.description}</p>
                {post.date && (
                  <p className="text-xs text-gray-400 mt-3">{formatDate(post.date)}</p>
                )}
              </Link>
            </li>
          ))}
        </ul>
      </div>
    </main>
  )
}
