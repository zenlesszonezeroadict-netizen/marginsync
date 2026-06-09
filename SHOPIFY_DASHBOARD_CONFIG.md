# MarginSync — Shopify Partner Dashboard Configuration

> Copy-paste reference for every field in the Shopify Partner Dashboard.
> All URLs are verified against the live codebase. Do not approximate.

---

## 1. Core App URLs & OAuth Whitelist

### App URL
```
https://marginsync-wheat.vercel.app
```

**Why this exact URL:** The root page (`/`) server-redirects authenticated users to `/dashboard` and unauthenticated users to `/login`. The middleware also reads Shopify App Bridge's `?shop=` and `?host=` query parameters on this URL for embedded-app launches — this is the correct entry point for both standalone and embedded contexts.

> ⚠️ Do **not** enter `/api/auth`, `/api/shopify/install`, or any sub-path here. Shopify appends `?shop=...&host=...` to whatever URL you set; only the root handles those parameters correctly.

---

### Allowed Redirection URL(s)
Enter this **single URL** in the whitelist field:

```
https://marginsync-wheat.vercel.app/api/shopify/callback
```

**Why only one URL:** The install route hard-codes `redirectUri = ${NEXT_PUBLIC_APP_URL}/api/shopify/callback`. The callback route verifies the `state` nonce and HMAC, then upserts the encrypted access token. No other path participates in OAuth. Adding extra URLs to the whitelist expands the attack surface without benefit.

> Shopify validates that the `redirect_uri` in the OAuth request exactly matches an entry in this whitelist. If they don't match character-for-character (including trailing slashes), the OAuth flow returns an `invalid_redirect_uri` error.

---

### App Proxy (if enabling embedded app)

| Field | Value |
|-------|-------|
| Subpath prefix | `apps` |
| Subpath | `marginsync` |
| Proxy URL | `https://marginsync-wheat.vercel.app` |

Leave this section empty if distributing as a standalone (non-embedded) app.

---

## 2. Mandatory GDPR Webhook Subscriptions

Enter these in **App setup → Privacy and compliance** in the Partner Dashboard.
All three are required before Shopify's automated review bot will approve the listing.

### Customers Data Request Endpoint
```
https://marginsync-wheat.vercel.app/api/shopify/webhooks/customers-data-request
```
**Behavior:** Verifies HMAC signature → returns `200 OK`. MarginSync stores no end-customer PII, so there is no data payload to return.

---

### Customers Redaction Endpoint
```
https://marginsync-wheat.vercel.app/api/shopify/webhooks/customers-redact
```
**Behavior:** Verifies HMAC signature → returns `200 OK`. No customer personal data is held; nothing to delete.

---

### Shop Redaction Endpoint
```
https://marginsync-wheat.vercel.app/api/shopify/webhooks/shop-redact
```
**Behavior:** Verifies HMAC signature → resolves `organization_id` from `shop_domain` → deletes all repricing runs (cascades to run items), SKU mappings, Shopify connection record, and uploaded supplier files from Storage → returns `200 OK`. Idempotent.

---

### Verifying Webhook Registration

After saving, Shopify sends a test event to each URL. You can also verify manually:

```bash
# Test that each endpoint rejects tampered payloads with 401
curl -s -o /dev/null -w "%{http_code}" \
  -X POST https://marginsync-wheat.vercel.app/api/shopify/webhooks/customers-redact \
  -H "Content-Type: application/json" \
  -H "X-Shopify-Hmac-Sha256: invalidsignature==" \
  -d '{"shop_id":1,"shop_domain":"test.myshopify.com"}'
# Expected: 401
```

```bash
# Generate a valid HMAC to test an accepted payload
node -e "
const { createHmac } = require('crypto')
const body = JSON.stringify({ shop_id: 1, shop_domain: 'test.myshopify.com' })
const hmac = createHmac('sha256', process.env.SHOPIFY_CLIENT_SECRET)
            .update(body, 'utf8').digest('base64')
console.log('X-Shopify-Hmac-Sha256:', hmac)
"
# Use the printed value in the header for a 200 response
```

---

## 3. Shopify Reviewer Screencast Script

Shopify requires an unlisted video (YouTube or Loom) demonstrating a full end-to-end walkthrough before approving an App Store listing. The video must show a real install from a clean state, not a pre-seeded environment.

**Target length:** 90–120 seconds  
**Recommended tool:** Loom (auto-uploads, easy unlisted sharing)  
**Test store to use:** `marginsync-test-shop.myshopify.com`  
**Test CSV to use:** `marginsync_e2e_test.csv` (SKUs: ABC-001, ABC-002, ABC-003)

---

### Full Recording Script

---

**[0:00–0:12] — Cold start: merchant discovers and installs**

Open a fresh browser tab in incognito. Navigate to:
```
https://marginsync-wheat.vercel.app
```

*Narrate:* "I'm starting from a completely clean browser session — no existing account, no pre-loaded data. I'll navigate to MarginSync and create a new account."

Enter your email address on the login page and click **Send magic link**. Open the inbox, click the link, and land on the dashboard. The trigger runs silently in the background: a new organization record and free-tier account are created automatically on first sign-in.

---

**[0:12–0:28] — Connect Shopify store**

Click **Shopify** in the left sidebar. The Shopify connection page shows "Not connected."

*Narrate:* "Now I'll connect my Shopify development store. I click the Connect button, enter my store domain, and I'm redirected to Shopify's OAuth consent screen."

Type `marginsync-test-shop.myshopify.com` into the store domain field and click **Connect**. Shopify's permission screen appears listing the `read_products` and `write_products` scopes. Click **Install app**.

You land back at the MarginSync Shopify page with a green **Connected** confirmation badge.

*Narrate:* "The access token is encrypted immediately using AES-256-GCM — it's never stored in plaintext."

---

**[0:28–0:42] — Sync catalog baseline**

Still on the Shopify page, click **Sync Catalog**.

*Narrate:* "Before I upload a supplier file, I'll pull the current product catalog into MarginSync so the SKU matcher has a baseline to work from."

The button shows a spinner for 2–3 seconds, then displays:
`Synced — N variants imported.`

---

**[0:42–1:00] — Upload supplier price file**

Click **New Run** in the sidebar. The upload page appears with a drag-and-drop zone.

*Narrate:* "Now I'll upload a real supplier price list. This is a plain CSV with supplier SKUs and wholesale costs — no special formatting required."

Drag `marginsync_e2e_test.csv` onto the drop zone. The file name and row count appear in a preview card. Click **Confirm & upload**.

The wizard advances automatically to the **Map Columns** step. Both columns are already highlighted:
- **SKU column:** `sku` — *100% confident*
- **Cost column:** `cost` — *100% confident*

*Narrate:* "MarginSync's column detection engine read the headers automatically — no manual mapping needed. I'll confirm and let it match SKUs."

Click **Confirm & Match SKUs →**

---

**[1:00–1:18] — Preview prices and margin warnings**

The run preview page loads. Draw attention to the stat cards at the top:

*Narrate:* "Here's the full picture before anything goes live. I can see three items were matched, all three prices will change, and one item is flagged below my margin target."

Point to the **amber warning banner:**
> "Warning: Some products fell below your target margin threshold during this run."

Click the **Below margin** tab to filter the table to only the flagged row. The row glows amber. Point to the margin percentage in red.

*Narrate:* "MarginSync flagged ABC-002 — the new price of $20.99 only yields a 28.5% margin, which is below my 30% target. I can deselect this row, or click through to adjust my pricing rules. For this demo I'll leave it selected and proceed."

---

**[1:18–1:40] — Live price sync**

Click **Push to Shopify** (top-right button).

The sync confirmation page appears with a warning:
> "This will write the computed prices for all selected items to your Shopify store. This action cannot be undone automatically."

*Narrate:* "MarginSync shows a final confirmation screen before touching any live prices. I'll click confirm."

Click **Yes, push prices**. A spinner appears for 2–3 seconds, then the success card:
> "3 prices updated in Shopify ✓"

---

**[1:40–1:55] — Verify in Shopify Admin**

Switch to the Shopify Admin tab (already open).

Navigate to **Products** and open one of the test products. Show the variant price has changed from its original value to the new MarginSync-calculated price.

*Narrate:* "The prices are live in Shopify. Every change is logged in MarginSync's run history — I can audit exactly what changed, or roll back with one API call if needed."

---

**[1:55–2:00] — Closing**

Return to the MarginSync **History** page in the sidebar to show the completed run entry with its status badge.

*Narrate:* "That's MarginSync — from supplier CSV to live Shopify prices in under two minutes, with margin protection built in."

End recording.

---

### Pre-Recording Checklist

Before hitting record, verify:

- [ ] Test store has ABC-001, ABC-002, ABC-003 products with their original prices ($15, $25, $10). Re-seed with `scripts/seed-test-products.js` if needed — but recreate the script from git history or PLAYBOOK.md; it was deleted post-testing.
- [ ] MarginSync account is logged out (incognito window ready)
- [ ] `marginsync_e2e_test.csv` is on the Desktop
- [ ] Shopify Admin tab is open alongside the MarginSync tab
- [ ] Loom is running and capturing both the browser window and microphone
- [ ] Run a silent dry-run once before the real recording to confirm timing

### Video Description (for Shopify submission)

```
MarginSync — Full walkthrough for Shopify App Store review

This video demonstrates:
- New account creation via magic-link authentication
- Shopify store connection via OAuth 2.0
- Catalog sync from Shopify Admin REST API
- Supplier CSV upload with automatic column detection
- SKU fuzzy-matching against live Shopify catalog
- Margin-safe price calculation with below-threshold alerts
- Live price sync to Shopify variants via Admin REST API
- Run history and audit log

App URL: https://marginsync-wheat.vercel.app
Shopify API scopes used: read_products, write_products, read_inventory
```
