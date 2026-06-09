# MarginSync — Distribution Spec

> Internal reference for Shopify App Store submission, pricing disclosure, and GDPR compliance.
> All copy is production-ready. Update URLs and contact details before submission.

---

## 1. Shopify App Store Listing Copy

### App Name
**MarginSync**

### Promotional Subtitle *(60 chars max — current: 56)*
> Automate supplier costs and protect your margins instantly.

### Short Description *(160 chars max)*
Upload any supplier price list, let MarginSync map the columns, match your SKUs, and push updated prices to Shopify — with margin guardrails that stop you selling at a loss.

### Core Value Proposition

Shopify resellers spend hours every week manually cross-referencing supplier invoices with their store prices. When supplier costs change, products go live at the wrong price — sometimes below cost — before anyone notices.

MarginSync eliminates that exposure:

**Intelligent column detection.** Drop in any CSV or XLSX from any supplier. MarginSync's fuzzy-matching engine reads the file headers, scores each column against a keyword library (e.g. "Unit Cost", "Wholesale", "Your Price"), and automatically identifies the SKU and cost columns at up to 100% confidence — no template required.

**SKU matching with fuzzy tolerance.** Supplier SKUs rarely match Shopify SKUs exactly. MarginSync normalises both sides (uppercase, strip punctuation, trim whitespace) and applies fuse.js fuzzy matching with a calibrated 0.3 threshold. Previously confirmed matches are remembered across runs, so your catalog gets smarter over time.

**Margin-safe pricing engine.** Every new price is calculated as `cost × markup`, rounded using your chosen rule (0.99 psychology pricing, standard rounding, or exact), then validated against your margin target before a single variant is touched. Items that fall below your threshold are flagged amber in the preview table and excluded from the sync unless you explicitly override them.

**One-click Shopify sync with full audit trail.** Confirmed prices are written directly to Shopify variant records via the Admin REST API. Every run — including which SKUs were matched, what prices changed, and which items were deselected — is stored permanently in your run history so you can audit or roll back at any time.

---

### Feature Bullets

- **Any supplier file, zero reformatting.** CSV and XLSX files accepted up to 20 MB. Automatic column detection means you never build a template or wrangle headers again.
- **Real-time margin alerts before you sync.** Items below your target gross margin are flagged in the preview table with an amber warning. Review, adjust, or deselect them before a single price goes live in your store.
- **Direct Shopify variant sync, no middleware.** Prices are written straight to your Shopify store via secure OAuth. No Zapier, no webhooks, no third-party queue — just a confirmed preview and a single button click.
- **Full run history and SKU memory.** Every repricing run is logged with a complete before/after price audit trail. SKU mappings you confirm are saved and reused automatically on every future upload.

---

## 2. App Pricing Disclosure

MarginSync uses **Shopify App Billing** for all subscription charges. No credit card data is handled by MarginSync directly.

### Free Tier — $0/month
| Feature | Limit |
|---------|-------|
| File processing runs | 3 per month |
| CSV / XLSX upload | ✓ |
| Column auto-detection | ✓ |
| SKU fuzzy matching | ✓ |
| Margin safety check | ✓ |
| Shopify variant sync | ✓ |
| Run history & audit log | Last 10 runs |
| Support | Community |

Quota resets on the first day of each calendar month. Runs with a `failed` status do not count against the quota.

### Pro Plan — $19/month
| Feature | Limit |
|---------|-------|
| File processing runs | Unlimited |
| CSV / XLSX upload | ✓ |
| Column auto-detection | ✓ |
| SKU fuzzy matching | ✓ |
| Margin safety check | ✓ |
| Shopify variant sync | ✓ |
| Run history & audit log | Full history |
| Webhook notifications | ✓ (POST to your endpoint) |
| Priority sync queue | ✓ |
| Support | Email, 48 h response |

Billing is managed entirely through the Shopify Partner billing system. Merchants can upgrade, downgrade, or cancel at any time from the Shopify App settings page without contacting support.

---

## 3. Shopify GDPR Webhooks & Privacy Compliance

### 3.1 Mandatory GDPR Webhook Endpoints

Shopify requires every app listed on the App Store to register three mandatory webhook topics and respond to them correctly. These protect merchant and customer data rights under GDPR and CCPA.

| Webhook Topic | Endpoint | Purpose |
|---------------|----------|---------|
| `customers/data_request` | `POST /api/shopify/webhooks/customers-data-request` | A merchant's customer has requested a copy of their personal data held by the app. Respond within 30 days with any stored customer data, or confirm that none exists. |
| `customers/redact` | `POST /api/shopify/webhooks/customers-redact` | A merchant's customer has requested deletion of their personal data. Purge all identifiable customer records associated with the shop. |
| `shop/redact` | `POST /api/shopify/webhooks/shop-redact` | The merchant has uninstalled MarginSync and 48 hours have elapsed. Permanently delete all data associated with the shop (connections, runs, SKU mappings, uploaded files). |

**Implementation notes:**
- All three endpoints must verify the `X-Shopify-Hmac-Sha256` header using `SHOPIFY_CLIENT_SECRET` before processing the payload.
- Verification uses a timing-safe HMAC-SHA256 comparison identical to the OAuth callback handler (`timingSafeEqual`).
- Endpoints must return HTTP 200 within 5 seconds even if the actual deletion is queued asynchronously.
- Failure to register these webhooks blocks App Store approval.

**Registration:** In the Shopify Partner Dashboard → App setup → Privacy and compliance → set each endpoint URL to `https://marginsync-wheat.vercel.app/api/shopify/webhooks/<topic>`.

---

### 3.2 B2B Data Privacy Statement

**Effective date:** 2026-06-09  
**App:** MarginSync  
**Developer:** [Your legal entity name]  
**Contact:** [privacy@yourdomain.com]

#### What data MarginSync collects

| Data type | Source | Purpose | Retention |
|-----------|--------|---------|-----------|
| Shopify shop domain | OAuth install flow | Identify the connected store | Until `shop/redact` webhook |
| Shopify OAuth access token | Shopify OAuth 2.0 | Read and write product variant prices | Until `shop/redact` webhook |
| Supplier CSV / XLSX files | Merchant upload | Parse supplier cost data | 90 days, then purged from Storage |
| Repricing run records | Generated by the app | Audit trail and run history | Until `shop/redact` webhook |
| SKU mapping confirmations | Generated by the app | Improve future matching accuracy | Until `shop/redact` webhook |
| Organization member email | Supabase Auth | Authentication and account management | Until account deletion |

MarginSync does **not** collect, store, or process any end-customer (shopper) personal data. The app operates exclusively on product catalogue and pricing data.

#### How access tokens are secured

Shopify OAuth access tokens are **never stored in plaintext.** Immediately after the OAuth callback, the token is encrypted using **AES-256-GCM** with a 96-bit random IV and a 256-bit encryption key held exclusively in the production server environment. The encrypted payload (IV + auth tag + ciphertext, base64-encoded) is what is persisted to the database. Decryption occurs only in server-side route handlers at the moment the token is needed; it is never logged, serialised to the client, or included in API responses.

#### How supplier files are secured

Uploaded CSV and XLSX files are stored in a **private Supabase Storage bucket** (`supplier-files`). The bucket is not publicly accessible. File access requires a valid server-side session using the Supabase service-role key, which is an environment variable never exposed to the browser. Files are retained for 90 days after upload and then automatically purged.

#### Data sub-processors

| Sub-processor | Role | Location |
|--------------|------|----------|
| Supabase (supabase.com) | Database, Auth, File Storage | US East (AWS us-east-1) |
| Vercel (vercel.com) | Serverless compute and CDN | Global edge network |
| Shopify (shopify.com) | Billing, OAuth identity provider | Global |

#### Merchant rights

- **Access:** You may request a copy of all data MarginSync holds for your shop by emailing [privacy@yourdomain.com].
- **Deletion:** Uninstalling MarginSync from your Shopify store triggers the `shop/redact` workflow. All associated data is permanently deleted within 48 hours of the webhook being received.
- **Portability:** Run history can be exported to CSV at any time from the run detail pages within the app.

#### Contact

For any privacy questions, data access requests, or security disclosures: **[privacy@yourdomain.com]**
