import Link from 'next/link'
import type { Metadata } from 'next'
import { notFound } from 'next/navigation'
import { getAllPostMeta, getPost } from '@/lib/blog'

export function generateStaticParams() {
  return getAllPostMeta().map(post => ({ slug: post.slug }))
}

export async function generateMetadata(
  { params }: { params: Promise<{ slug: string }> },
): Promise<Metadata> {
  const { slug } = await params
  const post = getPost(slug)
  if (!post) return { title: 'Not found' }
  return {
    title: post.title,
    description: post.description,
    openGraph: {
      title: post.title,
      description: post.description,
      type: 'article',
    },
  }
}

function formatDate(d: string): string {
  if (!d) return ''
  const date = new Date(d)
  if (isNaN(date.getTime())) return d
  return date.toLocaleDateString('en-GB', { year: 'numeric', month: 'long', day: 'numeric' })
}

export default async function BlogPostPage(
  { params }: { params: Promise<{ slug: string }> },
) {
  const { slug } = await params
  const post = getPost(slug)
  if (!post) notFound()

  return (
    <main className="min-h-screen bg-gray-50">
      <article className="max-w-2xl mx-auto px-4 py-16">
        <Link href="/blog" className="text-sm text-indigo-600 hover:text-indigo-700">
          ← All articles
        </Link>

        <header className="mt-6 mb-8">
          <h1 className="text-3xl font-bold text-gray-900 leading-tight">{post.title}</h1>
          {post.date && <p className="text-sm text-gray-400 mt-3">{formatDate(post.date)}</p>}
        </header>

        <div dangerouslySetInnerHTML={{ __html: post.html }} />

        <footer className="mt-12 pt-8 border-t border-gray-200">
          <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-6">
            <p className="text-gray-700 leading-relaxed">
              <strong className="text-gray-900">MarginSync</strong> syncs supplier CSV prices into
              Shopify with a full preview and one-click rollback. It&apos;s currently free during beta.
            </p>
            <a
              href="https://marginsync-wheat.vercel.app"
              target="_blank"
              rel="noopener noreferrer"
              className="inline-block mt-4 bg-indigo-600 text-white rounded-lg px-5 py-2.5 text-sm font-medium hover:bg-indigo-700 transition-colors"
            >
              Try MarginSync free →
            </a>
          </div>
        </footer>
      </article>
    </main>
  )
}
