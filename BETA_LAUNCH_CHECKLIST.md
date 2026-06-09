# MarginSync v1.0.0 — Private Beta Launch Checklist

Live app: https://marginsync-wheat.vercel.app  
Dev store: marginsync-test-shop.myshopify.com  
Shopify Partner org: 4973291  
App ID: 378958282753

---

## Phase 1 — Populate the Dev Store

Before running a real sync you need Shopify products whose SKUs match the
supplier CSV. The quickest path is Shopify's bulk product importer.

### 1.1 Open the product import tool

1. Go to **https://admin.shopify.com/store/marginsync-test-shop/products**
2. Click **Import** (top-right, next to "Add product")
3. Click **Add file** and upload `mock_shopify_inventory.csv`

> **Note:** `mock_shopify_inventory.csv` is NOT in Shopify's standard
> product import format. Shopify's importer needs a specific CSV schema
> (Handle, Title, Variant SKU, Variant Price, Cost per item, …).
>
> The `mock_shopify_inventory.csv` file in this repo is the **supplier
> price-list format** that you upload to MarginSync — not to Shopify.
>
> To populate the dev store quickly, do one of these:
>
> **Option A (fastest):** Use Shopify's "Add product" UI to manually
> create 5–10 products with SKUs that match items in the mock CSV
> (e.g. `BTH-WH-BLK`, `WATCH-SMRT-BLK`, `SNGL-POL-BLK`). Set any price.
>
> **Option B (bulk):** Convert `mock_shopify_inventory.csv` to Shopify's
> import format. The minimum required columns are:
>
> ```
> Handle,Title,Variant SKU,Variant Price,Cost per item,Status
> bth-wh-blk,Bluetooth Headphones Black,BTH-WH-BLK,79.99,28.50,active
> watch-smrt-blk,Smart Watch Black,WATCH-SMRT-BLK,199.99,45.00,active
> ```
>
> Shopify's full import spec: https://help.shopify.com/en/manual/products/import-export/using-csv

---

## Phase 2 — Switch to Custom Distribution & Generate Install Link

Shopify's "Custom distribution" lets you share a direct install link
without listing the app publicly in the App Store. This is the correct
mode for private beta installs.

### 2.1 Navigate to Distribution settings

**Old Partners Dashboard** (if you still see it):
```
https://partners.shopify.com/4973291/apps/378958282753/distribution
```

**New Dev Dashboard** (current default):
```
https://dev.shopify.com/dashboard/221749008/apps/378958282753
```

1. In the left nav click **Settings**
2. Scroll down to **Distribution**  
   *(if you don't see it, look under App Setup or the Versions submenu)*
3. Select **Custom distribution** (not "Shopify App Store")
4. Click **Save**

> If you see a warning that switching distribution type is irreversible,
> confirm. Custom distribution does NOT prevent future App Store listing
> — you can always upgrade to Unlisted or Public later.

### 2.2 Generate the direct install link

Once Custom distribution is enabled, Shopify shows a field like:

```
https://apps.shopify.com/marginsync?hmac=...
```

OR use the manual format:

```
https://MERCHANT-MYSHOPIFY-DOMAIN.myshopify.com/admin/oauth/authorize
  ?client_id=YOUR_SHOPIFY_CLIENT_ID
  &scope=read_products,write_products
  &redirect_uri=https://marginsync-wheat.vercel.app/api/shopify/callback
  &state=RANDOM_NONCE
```

**Faster approach — Shareable install URL:**

```
https://marginsync-wheat.vercel.app/api/shopify/install?shop=MERCHANT-DOMAIN.myshopify.com
```

Replace `MERCHANT-DOMAIN` with the merchant's actual `.myshopify.com` subdomain.  
This hits our `/api/shopify/install` route which builds the OAuth URL and
redirects the merchant automatically.

### 2.3 Test the install flow on your own dev store

```
https://marginsync-wheat.vercel.app/api/shopify/install?shop=marginsync-test-shop.myshopify.com
```

Expected flow:
1. Browser redirects to Shopify OAuth consent screen
2. You click "Install app"
3. Shopify redirects back to `/api/shopify/callback`
4. App stores encrypted token in `shopify_connections` table
5. Browser lands on `/dashboard`

---

## Phase 3 — Monitor the Install Callback

### 3.1 Watch the install in real time

Run in a terminal (keep it open during beta install):

```bash
vercel logs https://marginsync-wheat.vercel.app --follow
```

Or filter to just the Shopify routes:

```bash
vercel logs https://marginsync-wheat.vercel.app --follow 2>&1 | grep -E "shopify/install|shopify/callback|shopify_connections|ERROR|status"
```

### 3.2 Confirm the DB row was created

After install, run in Supabase SQL Editor
(https://supabase.com/dashboard/project/tazrkzwebsihsvtnwraj/sql):

```sql
SELECT id, shop_domain, created_at,
       LEFT(encrypted_token, 20) || '…' AS token_preview
FROM shopify_connections
ORDER BY created_at DESC
LIMIT 5;
```

---

## Phase 4 — Upload Mock Supplier CSV to MarginSync

1. Log in at https://marginsync-wheat.vercel.app
2. Click **New Run** → upload `mock_shopify_inventory.csv`
3. MarginSync auto-detects:
   - **SKU column** → `Item Code` (confidence 1.00)
   - **Cost column** → `Wholesale Price` (confidence 1.00)
4. Click **Match & Price** — watch the progress

Expected match result on a fresh dev store with ~10 manually created products:
- **Matched**: however many SKUs you added in Phase 1
- **Unmatched**: 112 minus matched (expected — no products for those SKUs)
- **Missing SKU (no match)**: 6 rows with empty `Item Code`
- **Below margin**: items where new computed price < margin threshold

---

## Phase 5 — Run the Chunked Sync (Stress Test)

1. On the run preview page click **Push to Shopify**
2. Watch the progress bar — each chunk = 50 items
3. With 112 items: expect **3 chunks** (50 + 50 + 12)

To watch the sync in real time during the push:

```bash
vercel logs https://marginsync-wheat.vercel.app --follow 2>&1 | grep -E "chunk|sync|offset|rate.limit|429|Retry"
```

### Expected log lines (healthy run)

```
POST /api/runs/{id}/sync  200  offset=0   synced=50  total=N
POST /api/runs/{id}/sync  200  offset=50  synced=50
POST /api/runs/{id}/sync  200  offset=100 synced=12  status=completed
```

### Rate-limit hit (normal — will auto-retry)

```
429 received for variant {id} — waiting Xms (Retry-After header)
Retrying chunk 2 (attempt 1/2)
```

---

## Phase 6 — Post-Sync Verification

### 6.1 Run the environment health check

```bash
INTERNAL_HEALTH_SECRET="Ux4Vl9dKpbcb9YEestknIvFeMAsk1B3O8yHcucohCWg" npm run deploy:verify:env
```

All four checks should print ✅.

### 6.2 Verify prices changed in Shopify

In Shopify admin → Products → pick any matched product → confirm the
"Price" field reflects MarginSync's computed new price.

### 6.3 Check the run history in Supabase

```sql
SELECT id, status, items_total, items_changed, items_below_margin,
       source_filename, created_at
FROM reprice_runs
ORDER BY created_at DESC
LIMIT 10;
```

---

## Anomaly Items in mock_shopify_inventory.csv

These rows are intentional stress-test entries. They should all match
successfully but surface in the "flags" column of the preview table:

| SKU | Anomaly | Expected Flag |
|-----|---------|---------------|
| `WEBCAM-4K` | Cost ($52) > MSRP ($49.99) | `below_margin` |
| `SPKR-BT-L` | Cost = MSRP ($35.00) | `below_margin` |
| `ANML-NEGMRG-A` | Cost $45 vs price $39.99 | `below_margin` |
| `ANML-NEGMRG-B` | Cost $99.99 vs price $49.99 | `below_margin` |
| `ANML-ZEROCST-A` | Cost = 0 | `cost_up` or `ok` (Δ=0) |
| `ANML-IDENTCOST` | Cost = price ($19.99) | `below_margin` |
| `ANML-DUP-SKU-1` | Duplicate SKU in CSV | Parser takes first hit |
| 6 empty `Item Code` rows | No SKU | `unmatched` |
| `ANML-LONGSKU-…` | 35-char SKU | Should still match |

---

## Quick-Reference Commands

```bash
# Stream all production logs
vercel logs https://marginsync-wheat.vercel.app --follow

# Stream only sync + rate-limiter lines
vercel logs https://marginsync-wheat.vercel.app --follow 2>&1 | grep -E "sync|chunk|429|Retry|rate"

# Stream only errors
vercel logs https://marginsync-wheat.vercel.app --follow 2>&1 | grep -iE "error|fail|500|unhandled"

# Run full env health check
INTERNAL_HEALTH_SECRET="Ux4Vl9dKpbcb9YEestknIvFeMAsk1B3O8yHcucohCWg" npm run deploy:verify:env

# List all env vars in production
vercel env ls production

# Trigger a fresh redeploy
vercel --prod

# Check GitHub Actions CI status
curl -s https://api.github.com/repos/zenlesszonezeroadict-netizen/marginsync/actions/runs?per_page=3 | grep -E '"status"|"conclusion"'
```
