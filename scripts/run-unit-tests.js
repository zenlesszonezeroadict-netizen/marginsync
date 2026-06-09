#!/usr/bin/env node
'use strict'

/**
 * Standalone unit test runner for MarginSync core engine.
 * Uses only Node.js built-ins (assert + crypto) — no test framework required.
 * Run: node scripts/run-unit-tests.js
 */

const assert = require('assert')
const { createCipheriv, createDecipheriv, createHmac, randomBytes, timingSafeEqual } = require('crypto')

// ── Test runner ───────────────────────────────────────────────────────────────

let passed = 0
let failed = 0

function test(name, fn) {
  try {
    fn()
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

// ── Token Crypto  (mirrors src/lib/crypto/token.ts) ──────────────────────────

const IV_BYTES = 12
const TAG_BYTES = 16

function encryptToken(plaintext, keyHex) {
  const key = Buffer.from(keyHex, 'hex')
  const iv = randomBytes(IV_BYTES)
  const cipher = createCipheriv('aes-256-gcm', key, iv)
  const ciphertext = Buffer.concat([cipher.update(plaintext, 'utf8'), cipher.final()])
  const authTag = cipher.getAuthTag()
  return Buffer.concat([iv, authTag, ciphertext]).toString('base64')
}

function decryptToken(payload, keyHex) {
  const key = Buffer.from(keyHex, 'hex')
  const buf = Buffer.from(payload, 'base64')
  if (buf.byteLength < IV_BYTES + TAG_BYTES + 1) throw new Error('Invalid encrypted token payload')
  const iv = buf.subarray(0, IV_BYTES)
  const authTag = buf.subarray(IV_BYTES, IV_BYTES + TAG_BYTES)
  const ciphertext = buf.subarray(IV_BYTES + TAG_BYTES)
  const decipher = createDecipheriv('aes-256-gcm', key, iv)
  decipher.setAuthTag(authTag)
  return decipher.update(ciphertext) + decipher.final('utf8')
}

// ── Pricing engine  (mirrors src/lib/pricing/) ───────────────────────────────

function applyRounding(price, mode) {
  if (price <= 0) return 0
  switch (mode) {
    case '0.99': return Math.ceil(price) - 0.01
    case '0.00': return Math.round(price * 100) / 100
    default:     return Math.round(price * 100) / 100
  }
}

function recalculateMargin(price, cost) {
  if (price <= 0) return null
  return Math.round(((price - cost) / price) * 10000) / 100
}

function computePrice(cost, rule, marginTarget) {
  const rawPrice = cost * rule.value
  const proposedPrice = applyRounding(rawPrice, rule.rounding)
  const marginPct = recalculateMargin(proposedPrice, cost)
  const belowMargin = marginPct !== null && marginPct < marginTarget
  const flag = belowMargin ? 'below_margin' : 'ok'
  return { proposedPrice, marginPct, flag }
}

// ── Webhook HMAC  (mirrors src/lib/shopify/verify-webhook.ts) ────────────────

function verifyShopifyWebhook(rawBody, hmacHeader, secret) {
  if (!secret || !hmacHeader) return false
  const computed = createHmac('sha256', secret).update(rawBody, 'utf8').digest('base64')
  const computedBuf = Buffer.from(computed)
  const headerBuf = Buffer.from(hmacHeader)
  if (computedBuf.length !== headerBuf.length) return false
  return timingSafeEqual(computedBuf, headerBuf)
}

// ── Tests ─────────────────────────────────────────────────────────────────────

console.log('\nMarginSync — Core Engine Unit Tests')
console.log('═'.repeat(52))

// --- Token Crypto ---
section('Token Crypto (AES-256-GCM)')

const TEST_KEY = randomBytes(32).toString('hex')

test('encrypt → decrypt round-trip restores original value', () => {
  const original = 'shpat_test_access_token_abc123'
  const decrypted = decryptToken(encryptToken(original, TEST_KEY), TEST_KEY)
  assert.strictEqual(decrypted, original)
})

test('ciphertext is base64 and differs from plaintext', () => {
  const original = 'shpat_test_access_token_abc123'
  const encrypted = encryptToken(original, TEST_KEY)
  assert.notStrictEqual(encrypted, original)
  assert.ok(Buffer.from(encrypted, 'base64').length > 0, 'should be valid base64')
})

test('two encryptions of same value produce different ciphertexts (random IV)', () => {
  const original = 'shpat_same_token'
  assert.notStrictEqual(encryptToken(original, TEST_KEY), encryptToken(original, TEST_KEY))
})

test('tampered ciphertext throws on decrypt (GCM auth tag check)', () => {
  const encrypted = encryptToken('secret', TEST_KEY)
  // Flip the last byte of the base64 payload to corrupt the ciphertext
  const buf = Buffer.from(encrypted, 'base64')
  buf[buf.length - 1] ^= 0xff
  const tampered = buf.toString('base64')
  assert.throws(() => decryptToken(tampered, TEST_KEY))
})

test('payload shorter than iv+tag+1 throws descriptive error', () => {
  // base64 of 10 bytes — less than the 29-byte minimum
  const tooShort = Buffer.alloc(10).toString('base64')
  assert.throws(() => decryptToken(tooShort, TEST_KEY), /Invalid encrypted token payload/)
})

// --- Pricing Engine ---
section('Pricing Engine (markup · rounding · margin flags)')

const RULE_099 = { type: 'markup', value: 1.4, rounding: '0.99' }
const RULE_000 = { type: 'markup', value: 1.4, rounding: '0.00' }
const RULE_150 = { type: 'markup', value: 1.5, rounding: '0.99' }

// $10 × 1.4 = $14.00 → ceil(14) - 0.01 = $13.99
test('0.99 rounding: $10 × 1.4 → $13.99', () => {
  assert.strictEqual(computePrice(10, RULE_099, 30).proposedPrice, 13.99)
})

// $25 × 1.4 = $35.00 → ceil(35) - 0.01 = $34.99
test('0.99 rounding: $25 × 1.4 → $34.99', () => {
  assert.strictEqual(computePrice(25, RULE_099, 30).proposedPrice, 34.99)
})

// $10 × 1.4 = $14.00 → round to 2dp = $14.00
test('0.00 rounding: $10 × 1.4 → $14.00', () => {
  assert.strictEqual(computePrice(10, RULE_000, 30).proposedPrice, 14.00)
})

// 1.4× gives ~28.5% margin — below the 30% target
test('below_margin flag fires when margin < target (1.4× / 30% target)', () => {
  const { flag, marginPct } = computePrice(10, RULE_099, 30)
  assert.strictEqual(flag, 'below_margin')
  assert.ok(marginPct !== null && marginPct < 30, `expected margin < 30, got ${marginPct}`)
})

// 1.5× gives ~33.3% margin — above the 30% target
// $10 × 1.5 = $15 → ceil(15) - 0.01 = $14.99
// margin = ((14.99 - 10) / 14.99) × 100 ≈ 33.29%
test('ok flag fires when margin >= target (1.5× / 30% target)', () => {
  const { flag, marginPct } = computePrice(10, RULE_150, 30)
  assert.strictEqual(flag, 'ok')
  assert.ok(marginPct !== null && marginPct >= 30, `expected margin >= 30, got ${marginPct}`)
})

test('zero cost returns $0 proposed price', () => {
  assert.strictEqual(computePrice(0, RULE_099, 30).proposedPrice, 0)
})

// --- Webhook HMAC ---
section('Webhook HMAC Verification (Shopify signature)')

const WEBHOOK_SECRET = 'test-webhook-secret-xyz'

test('valid signature is accepted', () => {
  const body = JSON.stringify({ shop_id: 1, shop_domain: 'test.myshopify.com' })
  const hmac = createHmac('sha256', WEBHOOK_SECRET).update(body, 'utf8').digest('base64')
  assert.strictEqual(verifyShopifyWebhook(body, hmac, WEBHOOK_SECRET), true)
})

test('tampered body is rejected', () => {
  const body = JSON.stringify({ shop_id: 1 })
  const hmac = createHmac('sha256', WEBHOOK_SECRET).update(body, 'utf8').digest('base64')
  assert.strictEqual(verifyShopifyWebhook('{"shop_id":2}', hmac, WEBHOOK_SECRET), false)
})

test('wrong secret is rejected', () => {
  const body = JSON.stringify({ shop_id: 1 })
  const hmac = createHmac('sha256', WEBHOOK_SECRET).update(body, 'utf8').digest('base64')
  assert.strictEqual(verifyShopifyWebhook(body, hmac, 'wrong-secret'), false)
})

test('empty HMAC header returns false without throwing', () => {
  assert.strictEqual(verifyShopifyWebhook('body', '', WEBHOOK_SECRET), false)
})

test('mismatched buffer lengths return false without throwing (no timingSafeEqual panic)', () => {
  // 'tooshort' is 8 chars — much shorter than a real base64 HMAC-SHA256 digest
  assert.strictEqual(verifyShopifyWebhook('body', 'tooshort', WEBHOOK_SECRET), false)
})

test('empty secret returns false without throwing', () => {
  assert.strictEqual(verifyShopifyWebhook('body', 'anything', ''), false)
})

// ── Summary ───────────────────────────────────────────────────────────────────

console.log('\n' + '═'.repeat(52))
const total = passed + failed
console.log(`Results: ${passed}/${total} passed${failed > 0 ? `, ${failed} failed` : ''}\n`)

if (failed > 0) process.exit(1)
