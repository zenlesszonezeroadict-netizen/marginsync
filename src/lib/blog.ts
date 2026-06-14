import fs from 'fs'
import path from 'path'

const BLOG_DIR = path.join(process.cwd(), 'src', 'content', 'blog')

export interface PostMeta {
  slug: string
  title: string
  description: string
  date: string
}

export interface Post extends PostMeta {
  html: string
}

// ── Frontmatter parser ────────────────────────────────────────────────────────
// We author these files ourselves, so the frontmatter is a simple block of
// `key: "value"` pairs fenced by `---`. No external dependency needed.

function parseFrontmatter(raw: string): { data: Record<string, string>; body: string } {
  const match = raw.match(/^---\s*\r?\n([\s\S]*?)\r?\n---\s*\r?\n([\s\S]*)$/)
  if (!match) return { data: {}, body: raw }

  const data: Record<string, string> = {}
  for (const line of match[1].split(/\r?\n/)) {
    const kv = line.match(/^(\w+):\s*(.*)$/)
    if (!kv) continue
    let value = kv[2].trim()
    if (
      (value.startsWith('"') && value.endsWith('"')) ||
      (value.startsWith("'") && value.endsWith("'"))
    ) {
      value = value.slice(1, -1)
    }
    data[kv[1]] = value
  }
  return { data, body: match[2] }
}

// ── Minimal markdown → HTML ───────────────────────────────────────────────────
// Handles only the subset used in our articles (h2/h3, paragraphs, bold, links,
// ordered/unordered lists). Safe because the input is content we control.

function escapeHtml(s: string): string {
  return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
}

function inline(text: string): string {
  let out = escapeHtml(text)
  // links: [text](url) — external, open in new tab
  out = out.replace(
    /\[([^\]]+)\]\(([^)]+)\)/g,
    (_m, label, url) =>
      `<a href="${url}" class="text-indigo-600 underline hover:text-indigo-700" target="_blank" rel="noopener noreferrer">${label}</a>`,
  )
  // bold: **text**
  out = out.replace(/\*\*([^*]+)\*\*/g, '<strong class="font-semibold text-gray-900">$1</strong>')
  return out
}

function renderMarkdown(body: string): string {
  const blocks = body.trim().split(/\r?\n\r?\n+/)
  const html: string[] = []

  for (const block of blocks) {
    const lines = block.split(/\r?\n/)

    // Skip a leading H1 — the page renders the title from frontmatter instead.
    if (/^#\s+/.test(block)) continue

    if (/^##\s+/.test(block)) {
      html.push(`<h2 class="text-2xl font-bold text-gray-900 mt-10 mb-4">${inline(block.replace(/^##\s+/, ''))}</h2>`)
      continue
    }
    if (/^###\s+/.test(block)) {
      html.push(`<h3 class="text-lg font-semibold text-gray-900 mt-8 mb-3">${inline(block.replace(/^###\s+/, ''))}</h3>`)
      continue
    }
    if (lines.every(l => /^-\s+/.test(l))) {
      const items = lines.map(l => `<li class="mb-1.5">${inline(l.replace(/^-\s+/, ''))}</li>`).join('')
      html.push(`<ul class="list-disc pl-6 mb-5 text-gray-700 leading-relaxed">${items}</ul>`)
      continue
    }
    if (lines.every(l => /^\d+\.\s+/.test(l))) {
      const items = lines.map(l => `<li class="mb-1.5">${inline(l.replace(/^\d+\.\s+/, ''))}</li>`).join('')
      html.push(`<ol class="list-decimal pl-6 mb-5 text-gray-700 leading-relaxed">${items}</ol>`)
      continue
    }
    html.push(`<p class="mb-5 text-gray-700 leading-relaxed">${inline(lines.join(' '))}</p>`)
  }

  return html.join('\n')
}

// ── Public API ────────────────────────────────────────────────────────────────

export function getAllPostMeta(): PostMeta[] {
  const files = fs.readdirSync(BLOG_DIR).filter(f => f.endsWith('.md'))
  const posts = files.map(file => {
    const raw = fs.readFileSync(path.join(BLOG_DIR, file), 'utf8')
    const { data } = parseFrontmatter(raw)
    return {
      slug: data.slug || file.replace(/\.md$/, ''),
      title: data.title || data.slug || file,
      description: data.description || '',
      date: data.date || '',
    }
  })
  // Newest first
  return posts.sort((a, b) => (a.date < b.date ? 1 : -1))
}

export function getPost(slug: string): Post | null {
  const file = path.join(BLOG_DIR, `${slug}.md`)
  if (!fs.existsSync(file)) {
    // Fall back to matching on the frontmatter slug if the filename differs
    const match = getAllPostMeta().find(p => p.slug === slug)
    if (!match) return null
    return getPost(match.slug === slug ? slug : match.slug)
  }
  const raw = fs.readFileSync(file, 'utf8')
  const { data, body } = parseFrontmatter(raw)
  return {
    slug: data.slug || slug,
    title: data.title || slug,
    description: data.description || '',
    date: data.date || '',
    html: renderMarkdown(body),
  }
}
