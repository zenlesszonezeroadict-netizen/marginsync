#!/usr/bin/env node
'use strict'

/**
 * Post-deploy environment verification.
 * Pings the authenticated health endpoint on the live Vercel domain to confirm
 * that database connectivity, required secrets, and the encryption layer are
 * all correctly loaded in production.
 *
 * Usage:
 *   INTERNAL_HEALTH_SECRET=<secret> node scripts/verify-env.js
 *   INTERNAL_HEALTH_SECRET=<secret> TARGET_URL=https://marginsync-wheat.vercel.app node scripts/verify-env.js
 */

const https = require('https')
const http  = require('http')
const { URL } = require('url')

const TARGET = (process.env.TARGET_URL ?? 'https://marginsync-wheat.vercel.app').replace(/\/$/, '')
const SECRET = process.env.INTERNAL_HEALTH_SECRET ?? ''

// ── ANSI ──────────────────────────────────────────────────────────────────────
const G = s => `\x1b[32m${s}\x1b[0m`
const R = s => `\x1b[31m${s}\x1b[0m`
const Y = s => `\x1b[33m${s}\x1b[0m`
const B = s => `\x1b[1m${s}\x1b[0m`
const D = s => `\x1b[2m${s}\x1b[0m`

// ── HTTP helper ───────────────────────────────────────────────────────────────

function get(urlStr, headers = {}) {
  return new Promise((resolve, reject) => {
    const parsed = new URL(urlStr)
    const lib    = parsed.protocol === 'https:' ? https : http
    const req    = lib.get(
      { hostname: parsed.hostname, port: parsed.port || undefined, path: parsed.pathname + parsed.search, headers },
      (res) => {
        let body = ''
        res.on('data', chunk => { body += chunk })
        res.on('end', () => resolve({ status: res.statusCode, body }))
      }
    )
    req.on('error', reject)
    req.setTimeout(12_000, () => { req.destroy(); reject(new Error('Request timed out (12 s)')) })
  })
}

// ── Main ──────────────────────────────────────────────────────────────────────

async function main() {
  console.log(B('\n  MarginSync — Post-Deploy Environment Verification'))
  console.log('═'.repeat(54))
  console.log(D(`  Target : ${TARGET}`))
  console.log(D(`  Secret : ${SECRET ? '●'.repeat(8) + ' (set)' : '(not set)'}\n`))

  if (!SECRET) {
    console.log(R('  ✗  INTERNAL_HEALTH_SECRET is not set.\n'))
    console.log(Y('  Set it and re-run:'))
    console.log(Y('    INTERNAL_HEALTH_SECRET=<your-secret> node scripts/verify-env.js\n'))
    process.exit(1)
  }

  let exitCode = 0

  // ── Check 1: Auth firewall (no secret → 401) ─────────────────────────────
  process.stdout.write('  [1/3] Auth firewall  (unauthenticated)   … ')
  try {
    const res = await get(`${TARGET}/api/health`)
    if (res.status === 401) {
      console.log(G('✅  PASS — 401 Unauthorized'))
    } else {
      console.log(R(`✗  FAIL — expected 401, got ${res.status}`))
      exitCode = 1
    }
  } catch (err) {
    console.log(R(`✗  FAIL — ${err.message}`))
    exitCode = 1
  }

  // ── Check 2: Authenticated health (correct secret → 200) ─────────────────
  process.stdout.write('  [2/3] Authenticated health check          … ')
  let healthData = null
  try {
    const res = await get(`${TARGET}/api/health`, { 'x-health-secret': SECRET })
    if (res.status === 200) {
      try { healthData = JSON.parse(res.body) } catch { /* leave null */ }
      if (healthData?.status === 'healthy') {
        console.log(G('✅  PASS — status: healthy'))
      } else {
        console.log(R(`✗  FAIL — unhealthy: ${healthData?.error ?? res.body.slice(0, 120)}`))
        exitCode = 1
      }
    } else if (res.status === 401) {
      console.log(R('✗  FAIL — 401 (secret mismatch — check Vercel env var)'))
      exitCode = 1
    } else {
      console.log(R(`✗  FAIL — HTTP ${res.status}: ${res.body.slice(0, 120)}`))
      exitCode = 1
    }
  } catch (err) {
    console.log(R(`✗  FAIL — ${err.message}`))
    exitCode = 1
  }

  // ── Check 3: Individual health sub-checks (from response body) ───────────
  if (healthData?.checks) {
    const { database, environment } = healthData.checks
    process.stdout.write('  [3/3] Database ping                        … ')
    if (database === true || database === 'connected') {
      console.log(G('✅  PASS — Supabase connection pool responding'))
    } else {
      console.log(R(`✗  FAIL — ${database ?? 'no result'}`))
      exitCode = 1
    }

    process.stdout.write('       Environment flags                    … ')
    if (environment === true || environment === 'validated') {
      console.log(G('✅  PASS — all required secrets present'))
    } else {
      console.log(R(`✗  FAIL — ${environment ?? 'missing keys'}`))
      exitCode = 1
    }
  } else {
    process.stdout.write('  [3/3] Health sub-checks                    … ')
    console.log(Y('⏭  SKIP — no response body (check 2 failed)'))
  }

  // ── Summary ───────────────────────────────────────────────────────────────
  console.log('\n' + '═'.repeat(54))
  if (exitCode === 0) {
    console.log(G(B('  ✅  All production checks passed — environment is healthy\n')))
  } else {
    console.log(R(B('  ✗  One or more checks failed\n')))
    console.log(Y('  Verify the following Vercel project environment variables:'))
    console.log(Y('    INTERNAL_HEALTH_SECRET · TOKEN_ENCRYPTION_KEY'))
    console.log(Y('    NEXT_PUBLIC_SUPABASE_URL · SUPABASE_SERVICE_ROLE_KEY'))
    console.log(Y('    SHOPIFY_CLIENT_ID · SHOPIFY_CLIENT_SECRET\n'))
  }

  process.exit(exitCode)
}

main().catch(err => {
  console.error(R(`\n  ✗  Verifier crashed: ${err.message}\n`))
  process.exit(1)
})
