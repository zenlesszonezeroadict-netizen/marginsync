#!/usr/bin/env node
'use strict'

/**
 * Smoke test runner for MarginSync live endpoints.
 * Makes real HTTP(S) requests — requires the server to be running.
 *
 * Usage:
 *   TARGET_URL=https://marginsync-wheat.vercel.app \
 *   INTERNAL_HEALTH_SECRET=<secret> \
 *   node scripts/run-smoke-tests.js
 *
 * Defaults to http://localhost:3000 when TARGET_URL is not set.
 */

const http  = require('http')
const https = require('https')

const TARGET_URL = (process.env.TARGET_URL ?? 'http://localhost:3000').replace(/\/$/, '')
const HEALTH_SECRET = process.env.INTERNAL_HEALTH_SECRET ?? ''

// ── HTTP helper ───────────────────────────────────────────────────────────────

function request(path, { headers = {}, method = 'GET' } = {}) {
  return new Promise((resolve, reject) => {
    const url  = new URL(TARGET_URL + path)
    const mod  = url.protocol === 'https:' ? https : http
    const port = url.port || (url.protocol === 'https:' ? '443' : '80')

    const req = mod.request(
      { hostname: url.hostname, port, path: url.pathname + url.search, method, headers },
      (res) => {
        let body = ''
        res.on('data', chunk => { body += chunk })
        res.on('end', () => resolve({ status: res.statusCode, headers: res.headers, body }))
      }
    )
    req.on('error', reject)
    req.setTimeout(10_000, () => { req.destroy(new Error('Request timed out after 10s')) })
    req.end()
  })
}

// ── Test runner ───────────────────────────────────────────────────────────────

let passed = 0
let failed = 0

async function test(name, fn) {
  try {
    await fn()
    console.log(`  ✅ PASS  ${name}`)
    passed++
  } catch (err) {
    console.log(`  ❌ FAIL  ${name}`)
    console.log(`          ${err.message}`)
    failed++
  }
}

function section(title) {
  console.log(`\n── ${title} ${'─'.repeat(Math.max(0, 50 - title.length))}`)
}

// ── Smoke Tests ───────────────────────────────────────────────────────────────

async function run() {
  console.log('\nMarginSync — Smoke Tests')
  console.log('═'.repeat(52))
  console.log(`  Target: ${TARGET_URL}`)

  // ── Scenario 1: Unauthenticated health check gate ──────────────────────────
  section('Scenario 1: Auth Firewall (GET /api/health)')

  await test('Missing secret → 401 Unauthorized', async () => {
    const res = await request('/api/health')
    if (res.status !== 401) {
      throw new Error(`Expected 401, got ${res.status}. Body: ${res.body.slice(0, 120)}`)
    }
  })

  await test('Bogus secret → 401 Unauthorized', async () => {
    const res = await request('/api/health', {
      headers: { 'X-Health-Secret': 'totally-wrong-secret-00000' },
    })
    if (res.status !== 401) {
      throw new Error(`Expected 401, got ${res.status}. Body: ${res.body.slice(0, 120)}`)
    }
  })

  // ── Scenario 2: Authenticated health check ─────────────────────────────────
  section('Scenario 2: Authenticated Health Check (GET /api/health)')

  if (!HEALTH_SECRET) {
    console.log('  ⏭  SKIP  INTERNAL_HEALTH_SECRET not set — skipping authenticated check')
  } else {
    await test('Valid secret → 200 OK with { status: "healthy" }', async () => {
      const res = await request('/api/health', {
        headers: { 'X-Health-Secret': HEALTH_SECRET },
      })
      if (res.status !== 200) {
        throw new Error(`Expected 200, got ${res.status}. Body: ${res.body.slice(0, 200)}`)
      }
      let json
      try { json = JSON.parse(res.body) } catch {
        throw new Error(`Response is not valid JSON: ${res.body.slice(0, 120)}`)
      }
      if (json.status !== 'healthy') {
        throw new Error(`Expected status "healthy", got "${json.status}". Full: ${res.body.slice(0, 200)}`)
      }
    })

    await test('Health response contains checks.database and checks.environment fields', async () => {
      const res = await request('/api/health', {
        headers: { 'X-Health-Secret': HEALTH_SECRET },
      })
      const json = JSON.parse(res.body)
      if (!json.checks?.database) throw new Error(`Missing checks.database in: ${res.body.slice(0, 200)}`)
      if (!json.checks?.environment) throw new Error(`Missing checks.environment in: ${res.body.slice(0, 200)}`)
    })
  }

  // ── Scenario 3: App route accessibility ───────────────────────────────────
  // The root path (/) always server-redirects (→ /login or /dashboard depending
  // on auth state). We verify the redirect is present (3xx) — confirming the
  // Next.js routing table is serving. We also probe /login directly for a 200
  // so we know the static HTML pipeline compiled and is being served correctly.
  section('Scenario 3: Frontend Serving Pipeline')

  await test('GET / → server responds (2xx or 3xx, not 4xx/5xx)', async () => {
    const res = await request('/')
    if (res.status >= 400) {
      throw new Error(`Expected 2xx/3xx redirect from /, got ${res.status}`)
    }
  })

  await test('GET /login → 200 OK (HTML page compiles and serves)', async () => {
    const res = await request('/login')
    if (res.status !== 200) {
      throw new Error(`Expected 200 from /login, got ${res.status}. Body: ${res.body.slice(0, 120)}`)
    }
    if (!res.body.includes('<html') && !res.body.includes('<!DOCTYPE')) {
      throw new Error('Response does not appear to be HTML')
    }
  })

  // ── Summary ───────────────────────────────────────────────────────────────
  const skipped = HEALTH_SECRET ? 0 : 2
  console.log('\n' + '═'.repeat(52))
  console.log(`Results: ${passed} passed, ${failed} failed${skipped ? `, ${skipped} skipped` : ''}\n`)

  if (failed > 0) process.exit(1)
}

run().catch(err => {
  console.error(`\n❌ Smoke test runner crashed: ${err.message}`)
  console.error('   Is the server running? Check TARGET_URL and try again.')
  process.exit(1)
})
