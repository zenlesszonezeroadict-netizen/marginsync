#!/usr/bin/env node
'use strict'

/**
 * Pre-Flight Deployment Validation Runner
 * Sequentially executes the full verification matrix and halts on first failure.
 *
 * Usage:
 *   npm run preflight
 *   INTERNAL_HEALTH_SECRET=<secret> npm run preflight
 */

const { execSync, spawn } = require('child_process')
const http = require('http')
const path = require('path')

const ROOT = path.resolve(__dirname, '..')

// ── ANSI ─────────────────────────────────────────────────────────────────────
const G  = s => `\x1b[32m${s}\x1b[0m`   // green
const R  = s => `\x1b[31m${s}\x1b[0m`   // red
const Y  = s => `\x1b[33m${s}\x1b[0m`   // yellow
const B  = s => `\x1b[1m${s}\x1b[0m`    // bold
const D  = s => `\x1b[2m${s}\x1b[0m`    // dim

// ── Server lifecycle ──────────────────────────────────────────────────────────

let serverProc = null

function stopServer() {
  if (!serverProc) return
  try { serverProc.kill('SIGTERM') } catch {}
  serverProc = null
}

process.on('exit', stopServer)
process.on('SIGINT',  () => { stopServer(); process.exit(130) })
process.on('SIGTERM', () => { stopServer(); process.exit(143) })

function pingLocalhost() {
  return new Promise(resolve => {
    const req = http.get('http://localhost:3000/', res => {
      res.resume()
      resolve(res.statusCode)
    })
    req.on('error', () => resolve(null))
    req.setTimeout(2000, () => { req.destroy(); resolve(null) })
  })
}

function waitForServer(maxMs = 35_000) {
  const deadline = Date.now() + maxMs
  return new Promise((resolve, reject) => {
    function attempt() {
      pingLocalhost().then(code => {
        if (code !== null) return resolve()
        if (Date.now() > deadline) {
          return reject(new Error('Server did not become ready within 35s'))
        }
        setTimeout(attempt, 1200)
      })
    }
    attempt()
  })
}

// ── Gate runner ───────────────────────────────────────────────────────────────

async function gate(num, title, fn) {
  const bar = '─'.repeat(52)
  console.log(`\n${bar}`)
  console.log(B(`  Gate ${num} / 3  ·  ${title}`))
  console.log(bar)
  const t0 = Date.now()
  try {
    await fn()
    const elapsed = D(`(${((Date.now() - t0) / 1000).toFixed(1)}s)`)
    console.log(`\n${G(`  ✅  Gate ${num} passed`)} ${elapsed}`)
  } catch (err) {
    console.log(`\n${R(`  ❌  Gate ${num} FAILED`)}  —  ${err.message}`)
    stopServer()
    console.log(R('\n  Pre-flight halted. Fix the issue above and re-run.\n'))
    process.exit(1)
  }
}

// ── Helpers ───────────────────────────────────────────────────────────────────

function exec(cmd, opts = {}) {
  return execSync(cmd, {
    cwd: ROOT,
    encoding: 'utf8',
    ...opts,
  })
}

// ── Pre-flight ────────────────────────────────────────────────────────────────

async function main() {
  console.log(B('\n  🚀  MarginSync Pre-Flight Deployment Validation'))
  console.log('═'.repeat(54))

  // ── Gate 1: Unit tests ───────────────────────────────────────────────────
  await gate(1, 'Unit Test Suite', () => {
    const out = exec('npm run test:local', { stdio: 'pipe' })
    // Print the captured output so it's visible
    process.stdout.write(out)

    // Verify explicit all-pass marker emitted by run-unit-tests.js
    if (!out.includes('17/17 passed')) {
      throw new Error(
        `Expected "17/17 passed" in output but did not find it.\n` +
        `Last 300 chars: ${out.slice(-300)}`
      )
    }
  })

  // ── Gate 2: Production build ─────────────────────────────────────────────
  await gate(2, 'Production Compilation  (npm run build)', () => {
    console.log(Y('  ⏳  This typically takes 20–30s …\n'))
    // Stream output live so TypeScript errors surface immediately
    exec('npm run build', { stdio: 'inherit' })
  })

  // ── Gate 3: Smoke tests ──────────────────────────────────────────────────
  await gate(3, 'Local Smoke Verification  (port 3000)', async () => {
    const already = await pingLocalhost()
    let managed = false

    if (already === null) {
      console.log('  Server not detected — spawning next start …')
      serverProc = spawn('npm', ['start'], {
        cwd: ROOT,
        stdio: 'ignore',
        shell: true,
        detached: false,
      })
      serverProc.on('error', err => { throw err })
      await waitForServer()
      managed = true
      console.log(G('  Server ready on http://localhost:3000\n'))
    } else {
      console.log(D(`  Server already up on http://localhost:3000 (HTTP ${already})\n`))
    }

    try {
      exec('npm run test:smoke', {
        stdio: 'inherit',
        env: { ...process.env, TARGET_URL: 'http://localhost:3000' },
      })
    } finally {
      if (managed) stopServer()
    }
  })

  // ── All green ─────────────────────────────────────────────────────────────
  console.log('\n' + '═'.repeat(54))
  console.log(G(B('  ✅  All gates green — codebase certified for deployment\n')))
}

main().catch(err => {
  console.error(R(`\n  ❌  Pre-flight runner crashed: ${err.message}\n`))
  stopServer()
  process.exit(1)
})
