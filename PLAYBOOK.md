# MarginSync — Pre-Launch Playbook

> Operational reference for production go-live, first merchant onboarding, and emergency procedures.
> All commands reference live infrastructure. Keep this document out of public repos.

---

## 1. The 5-Minute Production Sanity Run

Complete this checklist in order before inviting any beta users. Estimated time: 5 minutes.

### 1.1 Vercel Environment Variables

Open the Vercel dashboard → Project **marginsync** → Settings → Environment Variables.
Verify every variable below is set for the **Production** environment.

| Variable | Notes |
|----------|-------|
| `NEXT_PUBLIC_SUPABASE_URL` | `https://tazrkzwebsihsvtnwraj.supabase.co` |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Supabase project → Settings → API → anon key |
| `SUPABASE_SERVICE_ROLE_KEY` | Must be the `sb_secret_...` format (new key). Never the legacy JWT. |
| `SHOPIFY_CLIENT_ID` | Shopify Partner Dashboard → App → Client credentials |
| `SHOPIFY_CLIENT_SECRET` | Same location. Keep secret — used for HMAC verification on every webhook. |
| `SHOPIFY_API_KEY` | Same value as `SHOPIFY_CLIENT_ID` (legacy alias, keep both) |
| `SHOPIFY_API_SECRET` | Same value as `SHOPIFY_CLIENT_SECRET` (legacy alias, keep both) |
| `SHOPIFY_SCOPES` | `read_products,write_products,read_inventory` |
| `TOKEN_ENCRYPTION_KEY` | 64-char hex — **NEVER rotate after first install.** Rotating this key permanently breaks all existing encrypted Shopify access tokens in the database. |
| `NEXT_PUBLIC_APP_URL` | `https://marginsync-wheat.vercel.app` |

**Rotate only these variables if compromised:**
- `SHOPIFY_CLIENT_SECRET` — rotate in Partner Dashboard → update Vercel → re-register GDPR webhooks.
- `SUPABASE_SERVICE_ROLE_KEY` — rotate in Supabase → update Vercel → redeploy.
- `TOKEN_ENCRYPTION_KEY` — **do not rotate.** If compromised, you must re-run OAuth for every connected store to replace all encrypted tokens. Treat it like a master key.

After any Vercel env var change, trigger a **Redeploy** (Deployments → ⋯ → Redeploy with existing build) so the new values are picked up by the Edge runtime.

---

### 1.2 RLS Verification — Supabase SQL Editor

Open `https://supabase.com/dashboard/project/tazrkzwebsihsvtnwraj/sql/new` and run:

```sql
-- 1. Confirm RLS is enabled on every critical table
SELECT
  tablename,
  rowsecurity AS rls_enabled
FROM pg_tables
WHERE schemaname = 'public'
  AND tablename IN (
    'organizations',
    'profiles',
    'organization_members',
    'shopify_connections',
    'sku_mappings',
    'reprice_runs',
    'reprice_run_items'
  )
ORDER BY tablename;
```

Expected: `rls_enabled = true` for all 7 rows. If any row shows `false`, run:
```sql
ALTER TABLE <tablename> ENABLE ROW LEVEL SECURITY;
```

```sql
-- 2. Confirm no plaintext tokens were ever stored
SELECT COUNT(*) AS suspicious_tokens
FROM shopify_connections
WHERE access_token_encrypted NOT LIKE 'A%'   -- AES-256-GCM base64 always starts with A-Z
   OR length(access_token_encrypted) < 40;    -- minimum encrypted payload length
```

Expected: `suspicious_tokens = 0`. A non-zero count means a token was stored without encryption — treat as a security incident and re-run OAuth for the affected shop.

```sql
-- 3. Confirm the run quota counter is consistent
-- (non-failed runs should not exceed 3 per free org)
SELECT
  o.id          AS org_id,
  o.plan,
  COUNT(r.id)   AS non_failed_runs
FROM organizations o
JOIN reprice_runs r ON r.organization_id = o.id
WHERE r.status <> 'failed'
GROUP BY o.id, o.plan
HAVING o.plan = 'free' AND COUNT(r.id) > 3;
```

Expected: zero rows. Any result here means the quota gate has a gap.

---

### 1.3 Shopify App Configuration Check

In the Shopify Partner Dashboard → App → Configuration:

- **App URL:** `https://marginsync-wheat.vercel.app`
- **Allowed redirection URLs:** `https://marginsync-wheat.vercel.app/api/shopify/callback`
- **Privacy and compliance webhooks** (all three required for App Store approval):
  - `customers/data_request` → `https://marginsync-wheat.vercel.app/api/shopify/webhooks/customers-data-request`
  - `customers/redact` → `https://marginsync-wheat.vercel.app/api/shopify/webhooks/customers-redact`
  - `shop/redact` → `https://marginsync-wheat.vercel.app/api/shopify/webhooks/shop-redact`

---

## 2. First Merchant Onboarding

### 2.1 Sign-Up and Authentication

1. Send the merchant the app URL: `https://marginsync-wheat.vercel.app`
2. They click **Get started** on the landing page, enter their email, and receive a magic link.
3. On first sign-in, the `handle_new_user()` database trigger fires automatically and creates:
   - A `profiles` row
   - An `organizations` row (plan = `free`)
   - An `organization_members` row linking the two

Verify in Supabase:
```sql
SELECT p.email, o.name, o.plan, om.role
FROM profiles p
JOIN organization_members om ON om.user_id = p.id
JOIN organizations o ON o.id = om.organization_id
ORDER BY p.created_at DESC
LIMIT 5;
```

---

### 2.2 Shopify Store Connection

**Important:** The merchant must be logged into MarginSync before the OAuth flow is initiated. The install route calls `supabase.auth.getUser()` and will return 401 if the session is missing.

**Install URL format:**
```
https://marginsync-wheat.vercel.app/api/shopify/install?shop=THEIR-STORE.myshopify.com
```

What happens under the hood:
1. `/api/shopify/install` validates the shop domain, sets a `shopify_oauth_state` CSRF cookie, then redirects to Shopify's OAuth consent screen.
2. Shopify redirects back to `/api/shopify/callback` with `code` + `hmac` + `state`.
3. The callback verifies the HMAC (timing-safe), exchanges the code for a permanent access token, encrypts it with AES-256-GCM, and upserts a row into `shopify_connections`.
4. The merchant lands at `/dashboard/shopify?connected=1`.

Verify the connection landed:
```sql
SELECT shop_domain, installed_at,
       left(access_token_encrypted, 20) || '…' AS token_preview
FROM shopify_connections
ORDER BY installed_at DESC
LIMIT 3;
```

Token preview should show a base64 string (never `shpat_` or `shpss_`).

---

### 2.3 Catalog Sync

Before the first run the merchant should sync their Shopify catalog so the fuzzy matcher has a baseline. Direct them to **Shopify** in the sidebar → **Sync Catalog** button, or trigger it programmatically:

```
POST https://marginsync-wheat.vercel.app/api/shopify/sync
```
(Requires an authenticated session cookie.)

Expected response: `{ "ok": true, "upserted": N, "skipped": M }`

This populates `sku_mappings` with `catalog_cache` entries. The matcher needs at least one sync to match against live variants; without it, all SKUs fall back to the dev mock catalog.

---

### 2.4 First Supplier CSV Upload — Step by Step

Walk the merchant through this flow and monitor Supabase in real time alongside them.

| Step | URL | What to watch in Supabase |
|------|-----|--------------------------|
| 1. Upload | `/dashboard/upload` | `reprice_runs` row appears with `status = pending`, then `parsed` within seconds |
| 2. Map columns | `/dashboard/upload/{runId}/map-columns` | `column_config` jsonb populates with `{ skuCol, costCol, headers }` |
| 3. Match SKUs | auto-triggers on confirm | `reprice_run_items` rows created; check `flag` distribution |
| 4. Price preview | `/dashboard/runs/{runId}` | `items_below_margin` counter populates; amber banner fires if > 0 |
| 5. Sync | `/dashboard/runs/{runId}/sync` | `status` advances: `previewed → syncing → completed` |

**Supabase monitoring queries to run live:**

```sql
-- Watch run status in real time (refresh every 10s)
SELECT id, source_filename, status, items_total,
       items_changed, items_below_margin, error, created_at
FROM reprice_runs
ORDER BY created_at DESC
LIMIT 5;
```

```sql
-- Inspect item-level flag distribution for the latest run
SELECT flag, COUNT(*) AS count, AVG(margin_pct) AS avg_margin_pct
FROM reprice_run_items
WHERE run_id = (SELECT id FROM reprice_runs ORDER BY created_at DESC LIMIT 1)
GROUP BY flag
ORDER BY flag;
```

```sql
-- Confirm below_margin items look correct
SELECT supplier_sku, product_title, old_price, new_price,
       margin_pct, flag, selected
FROM reprice_run_items
WHERE run_id = (SELECT id FROM reprice_runs ORDER BY created_at DESC LIMIT 1)
  AND flag = 'below_margin'
ORDER BY margin_pct ASC;
```

**Amber banner trigger check:** If `items_below_margin > 0` on the run record, the `PreviewTable` component renders the warning banner and the "Below Margin" stat card counts in amber. Verify the count in the query above matches what the merchant sees in their browser.

**Free-tier quota:** The merchant starts with 3 runs allowed. After their first completed run, run:
```sql
SELECT status, COUNT(*) FROM reprice_runs
WHERE organization_id = '<their-org-id>'
GROUP BY status;
```
`failed` runs do not count. Only `pending`, `parsed`, `previewed`, `syncing`, and `completed` rows consume quota.

---

## 3. Emergency Rollback Procedures

### 3.1 Single-Run Price Rollback (Standard)

If a merchant wants to revert a completed run, MarginSync has a built-in rollback route that restores each variant to its recorded `old_price`:

```
POST /api/runs/{runId}/rollback
```

**Requirements:**
- Run must have `status = completed` (not `failed`, not `previewed`).
- Run must not have been rolled back before (`rolled_back_at IS NULL`). The route is one-shot by design — subsequent calls return 409.
- Each item must have `synced = true` and a non-null `old_price`.

**Response:**
```json
{ "rolledBack": 3, "failed": 0, "total": 3 }
```

The route writes `old_price` back to each Shopify variant via the Admin REST API and stamps `rolled_back_at` on the run record. Check via:

```sql
SELECT id, status, rolled_back_at
FROM reprice_runs
WHERE id = '<runId>';
```

**To trigger from the browser console on the preview page:**
```javascript
const res = await fetch('/api/runs/RUN_ID_HERE/rollback', { method: 'POST' })
const data = await res.json()
console.log(data)
```

---

### 3.2 Verify Shopify Prices Were Actually Reverted

After the rollback call, confirm the live Shopify prices using the Shopify Admin API directly:

```bash
node -e "
const https = require('https')
// Replace VARIANT_ID and ACCESS_TOKEN with actual values
const url = 'https://marginsync-test-shop.myshopify.com/admin/api/2024-01/variants/VARIANT_ID.json'
https.get(url, { headers: { 'X-Shopify-Access-Token': 'ACCESS_TOKEN' } }, r => {
  let b = ''; r.on('data', d => b += d)
  r.on('end', () => console.log(JSON.parse(b).variant?.price))
})
"
```

Or check the `reprice_run_items` table — after rollback, the `old_price` column is what is now live in Shopify.

---

### 3.3 Nuclear Option — Complete Merchant Data Wipe via `shop/redact`

If a merchant requests full data deletion (uninstall + GDPR erasure), trigger the `shop/redact` webhook manually. This permanently deletes:

- All `reprice_runs` and `reprice_run_items` for the org (cascaded)
- All `sku_mappings` for the org
- The `shopify_connections` row
- All uploaded supplier files in Supabase Storage under `supplier-files/{orgId}/`

**Simulate the webhook manually (requires valid HMAC):**

```bash
node -e "
const { createHmac } = require('crypto')
const https = require('https')

const SECRET = process.env.SHOPIFY_CLIENT_SECRET
const payload = JSON.stringify({ shop_id: 12345, shop_domain: 'STORE.myshopify.com' })
const hmac = createHmac('sha256', SECRET).update(payload, 'utf8').digest('base64')

const url = new URL('https://marginsync-wheat.vercel.app/api/shopify/webhooks/shop-redact')
const req = https.request(url, {
  method: 'POST',
  headers: {
    'Content-Type': 'application/json',
    'X-Shopify-Hmac-Sha256': hmac,
    'Content-Length': Buffer.byteLength(payload),
  }
}, res => console.log('Status:', res.statusCode))
req.write(payload)
req.end()
"
```

Expected: `Status: 200`. The route is idempotent — calling it twice returns 200 both times.

**Verify the wipe completed:**

```sql
-- Should return 0 rows if wipe succeeded
SELECT COUNT(*) AS remaining_runs
FROM reprice_runs
WHERE organization_id = (
  SELECT organization_id FROM shopify_connections
  WHERE shop_domain = 'STORE.myshopify.com'
);

-- shopify_connections row should be gone
SELECT * FROM shopify_connections WHERE shop_domain = 'STORE.myshopify.com';
```

> **Note:** `shop/redact` does NOT delete the merchant's MarginSync account (`organizations`, `profiles`, `organization_members`). It purges only the Shopify-related data. If the merchant re-installs, their account is intact and they can reconnect. To fully close an account, delete the `organizations` row — all other tables cascade automatically.

---

## Quick Reference

| Action | Endpoint | Method |
|--------|----------|--------|
| Install Shopify connection | `/api/shopify/install?shop=STORE.myshopify.com` | GET |
| Sync product catalog | `/api/shopify/sync` | POST |
| Upload supplier file | `/api/runs` | POST (multipart) |
| Get run details | `/api/runs/{runId}` | GET |
| Set column mapping | `/api/runs/{runId}` | PATCH |
| Run SKU matching | `/api/runs/{runId}/match` | POST |
| Run pricing engine | `/api/runs/{runId}/price` | POST |
| Push prices to Shopify | `/api/runs/{runId}/sync` | POST |
| Rollback a completed run | `/api/runs/{runId}/rollback` | POST |
| Export run as CSV | `/api/runs/{runId}/export` | GET |
| GDPR: customer data request | `/api/shopify/webhooks/customers-data-request` | POST |
| GDPR: customer redact | `/api/shopify/webhooks/customers-redact` | POST |
| GDPR: full shop wipe | `/api/shopify/webhooks/shop-redact` | POST |
