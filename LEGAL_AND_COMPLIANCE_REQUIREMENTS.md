# MarginSync v1.0.0 — Legal & Compliance Requirements

> **Audit basis:** Full codebase review of `src/` conducted 2026-06-09.  
> **Status:** Living document — update before each major release or Partner Program agreement revision.  
> **Not legal advice.** Have a qualified attorney review the final ToS and Privacy Policy before publishing.

---

## Table of Contents

1. [Shopify Platform Compliance](#1-shopify-platform-compliance)
2. [Global Data Privacy — GDPR & CCPA](#2-global-data-privacy--gdpr--ccpa)
3. [App Liability & Financial Safeguards](#3-app-liability--financial-safeguards)
4. [Required Storefront Artifacts](#4-required-storefront-artifacts)
5. [Open Action Items](#5-open-action-items)

---

## 1. Shopify Platform Compliance

### 1.1 Partner Program Agreement — Merchant Data Handling

The [Shopify Partner Program Agreement](https://www.shopify.com/partners/terms) imposes the following binding obligations on all app developers. Every point below has been mapped to the MarginSync codebase.

#### Core Data-Use Mandates

| Obligation | Shopify Requirement | MarginSync Status |
|---|---|---|
| **Purpose limitation** | Use merchant data only for the stated purpose of your app. | ✅ Data is used solely for price repricing. No third-party sharing. |
| **No data selling** | You may not sell, rent, or transfer merchant data to any third party. | ✅ No external data export other than back to the merchant's own Shopify store. |
| **Minimum scope** | Request only the API access scopes necessary for app functionality. | ✅ `read_products` + `write_products` only. See §1.2. |
| **Secure storage** | Protect merchant credentials (access tokens) with industry-standard encryption. | ✅ AES-256-GCM via `src/lib/crypto/token.ts`. |
| **Deletion on uninstall** | Purge all merchant data within 48 hours of app uninstallation. | ✅ `shop/redact` webhook implemented. See §2.1. |
| **Mandatory GDPR webhooks** | Register and respond correctly to all three mandatory webhooks. | ✅ All three registered. See §2.1. |
| **Hosted legal documents** | A publicly accessible Privacy Policy and Terms of Service must exist. | ⚠️ **ACTION REQUIRED** — draft templates in §4. |
| **No circumventing reviews** | Do not collect payment outside the Shopify review process (subject to Billing API mandate below). | ✅ Primary billing via Shopify Billing API. See §1.3. |

#### What "Merchant Data" Includes for MarginSync

MarginSync touches two categories of Shopify data:

1. **Product/variant catalog data** (`read_products`): product titles, variant SKUs, current prices, variant IDs. This data is cached in `sku_mappings.catalog_cache` (JSONB column) to avoid repeated API calls.
2. **Access tokens**: OAuth tokens stored encrypted in `shopify_connections.access_token_encrypted` using AES-256-GCM.

**End-customer personal data (names, emails, addresses, order history) is never stored, fetched, or processed by MarginSync.**

---

### 1.2 API Scope Requirements

MarginSync requests exactly two scopes during OAuth:

```
read_products   — Fetch product/variant catalog for SKU matching
write_products  — Update variant prices after repricing runs
```

#### Scope Justification (for App Review submission)

| Scope | Why it is required | Minimum? |
|---|---|---|
| `read_products` | `src/lib/shopify/fetch-inventory.ts` fetches all variants to build the SKU-match catalog in `sku_mappings`. Without this, the core matching feature cannot function. | Yes — narrower scopes (e.g., `read_inventory`) do not include variant price data. |
| `write_products` | `src/lib/shopify/write-prices.ts` sends `PUT /admin/api/2024-01/variants/{id}` to update the `price` field. This is the primary value delivered by the app. | Yes — no narrower write scope covers variant price updates. |

**Do not add scopes** for customers, orders, or financials without a new App Review submission.

---

### 1.3 Billing API — Shopify vs. External Gateways

#### Mandate

Shopify's Partner Program Agreement **requires** that subscription charges for Shopify-embedded apps use the [Shopify Billing API](https://shopify.dev/docs/apps/build/billing). Apps that bypass the Billing API to collect recurring payments through an external gateway (e.g., Stripe, PayPal) risk removal from the Partner Program.

#### Current Implementation ✅

```typescript
// src/lib/shopify/billing.ts
mutation appSubscriptionCreate(
  name: "MarginSync Pro"
  lineItems: [{ plan: { appRecurringPricingDetails: {
    price: { amount: "19.00", currencyCode: "USD" },
    interval: "EVERY_30_DAYS"
  }}}]
)
```

MarginSync Pro ($19/month) is charged via `appSubscriptionCreate` — correct.

#### ⚠️ Compliance Flag: `stripe_customer_id` Column

The `organizations` table contains a `stripe_customer_id` column. This suggests Stripe integration was planned or partially built.

**Rules:**
- ✅ **Stripe IS allowed** for: one-time add-ons, metered usage billing that Shopify Billing API does not support, non-embedded web-app billing (i.e., if you sell MarginSync outside the Shopify ecosystem).
- ❌ **Stripe IS NOT allowed** as a substitute for Shopify Billing API recurring subscription charges for Shopify merchants.

**Action required:** Before enabling Stripe, consult Shopify's [billing guidance for apps](https://shopify.dev/docs/apps/build/billing/billing-app-installations). If Stripe is used only for future non-Shopify customers, document that clearly in your Partner Dashboard and in the Privacy Policy.

---

## 2. Global Data Privacy — GDPR & CCPA

### 2.1 Mandatory GDPR Webhooks

Shopify mandates three webhooks for GDPR compliance. All three are implemented and verified via HMAC-SHA256 with constant-time comparison.

#### Verification Layer (all three webhooks)

```typescript
// src/lib/shopify/verify-webhook.ts
export function verifyShopifyWebhook(rawBody: string, hmacHeader: string): boolean {
  const computed = createHmac('sha256', secret).update(rawBody, 'utf8').digest('base64')
  if (computedBuf.length !== headerBuf.length) return false
  return timingSafeEqual(computedBuf, headerBuf)  // constant-time — prevents timing attacks
}
```

#### Webhook 1: `customers/data_request` ✅

**What Shopify sends:** A request for a copy of personal data held about a specific end-customer of a merchant.

**MarginSync response:** HTTP 200 with empty body. No customer PII is ever stored.

**GDPR basis:** Article 15 (Right of Access). Because no data is held, there is nothing to return. The 200 response acknowledges receipt and confirms zero data held.

```
Route: POST /api/shopify/webhooks/customers-data-request
File:  src/app/api/shopify/webhooks/customers-data-request/route.ts
```

#### Webhook 2: `customers/redact` ✅

**What Shopify sends:** A deletion request for personal data held about a specific end-customer.

**MarginSync response:** HTTP 200. No customer PII is ever stored, so no deletion is required.

**GDPR basis:** Article 17 (Right to Erasure / "Right to be Forgotten"). Compliant because nothing was retained.

```
Route: POST /api/shopify/webhooks/customers-redact
File:  src/app/api/shopify/webhooks/customers-redact/route.ts
```

#### Webhook 3: `shop/redact` ✅

**What Shopify sends:** Fired 48 hours after a merchant uninstalls the app. Authoritative deletion trigger.

**MarginSync response:** Deletes all merchant data in FK-safe order, then purges Storage asynchronously.

**GDPR basis:** Article 17 + Shopify Partner Program Agreement §Data Deletion. This is the highest-risk webhook — a failure here constitutes a data breach under GDPR.

```
Route: POST /api/shopify/webhooks/shop-redact
File:  src/app/api/shopify/webhooks/shop-redact/route.ts

Deletion order (respects FK constraints):
  1. reprice_runs         → CASCADE deletes reprice_run_items
  2. sku_mappings         → deleted by org_id
  3. shopify_connections  → deleted by shop_domain
  4. Storage files        → async purge of supplier-files/{org_id}/**
```

**⚠️ Gap:** The `shop/redact` handler does NOT delete the `organizations` or `profiles` records for the merchant. If the merchant is a Supabase Auth user who only ever connected one Shopify store, deleting the `shopify_connections` row while leaving `profiles` (which contains email) is technically a GDPR violation for EU merchants.

**Recommended fix:**

```typescript
// After deleting shopify_connections, check if org has no remaining connections
// If none, soft-delete or anonymise the organization and profile rows:
await admin.from('organizations').update({ name: '[redacted]', plan: 'free' }).eq('id', orgId)
await admin.from('profiles').update({ email: null, full_name: null }).eq('id', /* user_id */)
```

---

### 2.2 Data Inventory & Classification

The following table maps every table/storage bucket to its data classification, legal basis for processing, and required retention limit.

| Data Asset | Classification | Legal Basis | Retention Limit |
|---|---|---|---|
| `profiles.email` | Merchant PII | Contractual (account management) | Delete on account closure or `shop/redact` |
| `profiles.full_name` | Merchant PII | Contractual | Delete on account closure or `shop/redact` |
| `shopify_connections.access_token_encrypted` | Merchant credential (encrypted) | Contractual (app functionality) | Delete immediately on `shop/redact` ✅ |
| `shopify_connections.shop_domain` | Merchant identifier | Contractual | Delete on `shop/redact` ✅ |
| `organizations.*` | Business config | Contractual | Delete on account closure |
| `reprice_runs.*` | Operational history | Legitimate interest (audit trail) | **90 days** recommended; delete on `shop/redact` ✅ |
| `reprice_run_items.*` | Product + pricing data (no PII) | Contractual | 90 days; cascades from `reprice_runs` ✅ |
| `sku_mappings.*` | Product catalog cache (no PII) | Contractual | Delete on `shop/redact` ✅ |
| `supplier-files` (Storage) | Merchant-uploaded business data | Contractual | Delete on `shop/redact` ✅; auto-expire after 90 days recommended |

#### Implementing the 90-Day Auto-Expiry (Recommended)

Add a Supabase scheduled function or `pg_cron` job:

```sql
-- Run daily: delete reprice runs older than 90 days
DELETE FROM reprice_runs
WHERE created_at < NOW() - INTERVAL '90 days'
  AND status IN ('completed', 'failed');
```

For Supabase Storage, enable object lifecycle policies via the Dashboard (Storage → Policies → Lifecycle).

---

### 2.3 CCPA Compliance (California)

The California Consumer Privacy Act applies if MarginSync has California-based merchant users and meets the revenue/data-volume thresholds ($25M revenue OR 100K+ consumers OR 50%+ revenue from selling data).

Even below threshold, proactive CCPA compliance builds trust.

| CCPA Requirement | MarginSync Status |
|---|---|
| **Right to Know** what data is collected | ✅ Covered in the Privacy Policy template (§4) |
| **Right to Delete** | ✅ `shop/redact` webhook purges all data ⚠️ gap with `profiles` noted above |
| **Right to Opt-Out of Sale** | ✅ MarginSync does not sell data |
| **No discrimination** for exercising rights | ✅ N/A — no tiered access based on rights exercise |
| **Privacy Policy disclosure** | ⚠️ **ACTION REQUIRED** — template in §4 |

---

### 2.4 Access Token Security Requirements

The Shopify Partner Program Agreement requires tokens to be protected at rest and in transit.

| Requirement | Implementation |
|---|---|
| **Encrypted at rest** | AES-256-GCM (`src/lib/crypto/token.ts`) — IV + Auth Tag + Ciphertext, Base64-encoded |
| **Never logged** | `TOKEN_ENCRYPTION_KEY` not logged; token decoded only at point of use in `write-prices.ts` |
| **Transmitted over TLS** | All Shopify API calls use `https://` (`write-prices.ts`, `billing.ts`, `client.ts`) |
| **Rotated on re-install** | New OAuth flow overwrites `access_token_encrypted` — ✅ |
| **Deletion on uninstall** | `shop/redact` webhook deletes the row — ✅ |

**Action required:** Rotate `TOKEN_ENCRYPTION_KEY` in Vercel env vars at least annually or immediately upon suspected compromise. Document this in your runbook.

---

## 3. App Liability & Financial Safeguards

### 3.1 Limitation of Liability Clause

The following clause is specifically tailored for pricing-automation software. Embed it verbatim (or with attorney review) in your Terms of Service.

---

> **LIMITATION OF LIABILITY**
>
> TO THE MAXIMUM EXTENT PERMITTED BY APPLICABLE LAW, IN NO EVENT SHALL MARGINSYNC, ITS AFFILIATES, OFFICERS, EMPLOYEES, AGENTS, PARTNERS, OR LICENSORS BE LIABLE FOR:
>
> (a) **INDIRECT, INCIDENTAL, SPECIAL, OR CONSEQUENTIAL DAMAGES**, including without limitation lost profits, lost revenue, loss of data, business interruption, or loss of goodwill, arising out of or in connection with your use of MarginSync, even if MarginSync has been advised of the possibility of such damages;
>
> (b) **PRICING ERRORS, MISCALCULATIONS, OR SYNCHRONISATION FAILURES**, including but not limited to: (i) prices computed by MarginSync that result in below-cost sales, (ii) prices not written to Shopify due to API rate-limiting, network failure, or Shopify platform outages, (iii) delays between a supplier cost change and price synchronisation in your Shopify store;
>
> (c) **REVENUE LOSS** resulting from prices that are computed as higher or lower than a merchant's intended selling price, whether caused by incorrect margin-target configuration, misconfigured pricing rules, incorrect data in the uploaded supplier price list, or errors in MarginSync's price computation algorithm;
>
> (d) **THIRD-PARTY ACTIONS**, including Shopify's suspension, modification, or termination of the Shopify platform or Admin API.
>
> IN JURISDICTIONS WHERE THE EXCLUSION OF CERTAIN WARRANTIES OR LIABILITY IS NOT PERMITTED, MARGINSYNC'S LIABILITY SHALL BE LIMITED TO THE GREATER OF: (i) THE AMOUNT PAID BY MERCHANT TO MARGINSYNC IN THE 12 MONTHS PRECEDING THE CLAIM, OR (ii) US$50.00.

---

### 3.2 "As-Is" and "No Warranty" Clause

> **DISCLAIMER OF WARRANTIES**
>
> MARGINSYNC IS PROVIDED "AS IS" AND "AS AVAILABLE" WITHOUT WARRANTY OF ANY KIND, EXPRESS OR IMPLIED. MARGINSYNC EXPRESSLY DISCLAIMS ALL WARRANTIES, INCLUDING WITHOUT LIMITATION:
>
> - Any implied warranty of **merchantability** or **fitness for a particular purpose**;
> - Any warranty that MarginSync will be **error-free, uninterrupted, or free of harmful components**;
> - Any warranty regarding the **accuracy of pricing calculations**, the correctness of SKU-matching results, or the completeness of supplier-file parsing;
> - Any warranty that prices written to Shopify will be **accurate, timely, or compliant** with any marketplace, regulatory, or contractual pricing obligation the merchant may have.
>
> THE MERCHANT IS SOLELY RESPONSIBLE FOR REVIEWING COMPUTED PRICES BEFORE CONFIRMING ANY SYNC TO SHOPIFY. MARGINSYNC'S PREVIEW AND CONFIRMATION STEP IS PROVIDED AS A CONVENIENCE, NOT A GUARANTEE OF ACCURACY.

---

### 3.3 Pricing-Automation-Specific Safeguards

Beyond standard boilerplate, pricing automation requires additional protections.

#### 3.3.1 Explicit Confirmation Step (Already Implemented ✅)

MarginSync already implements a confirmation gate before any prices are written to Shopify:

```
Upload → Map Columns → Review Matches → Preview Prices → [CONFIRM] → Push to Shopify
```

The `/dashboard/runs/[runId]/sync` page presents a explicit "Yes, push prices" button with the warning: *"This action cannot be undone automatically — a new run will be needed to revert."*

**Document this in your ToS** as a key protection: the merchant is required to review and confirm before any prices are modified.

#### 3.3.2 Below-Margin Flag (Already Implemented ✅)

Items where the computed new price falls below the merchant's configured margin threshold are flagged `below_margin` and highlighted with a warning on the preview page. This is a material safeguard against accidental below-cost sales.

**Document the flag behaviour in your ToS** so merchants cannot claim they were not warned.

#### 3.3.3 Rollback Route (Already Implemented ✅)

```
POST /api/runs/[runId]/rollback
File: src/app/api/runs/[runId]/rollback/route.ts
```

This route allows reverting prices to their pre-sync values. **Document** that rollback is available but requires a separate action, and that MarginSync does not guarantee Shopify's API will accept all rollback updates (Shopify may be unavailable, rate-limited, etc.).

#### 3.3.4 Rate-Limiter Acknowledgment

```typescript
// src/lib/shopify/rate-limiter.ts — leaky-bucket implementation
```

If Shopify returns HTTP 429, MarginSync retries with backoff. However, if a sync partially completes before a terminal failure (e.g., Shopify platform outage), **some prices will have been updated and others will not**. Your ToS should state:

> *"In the event of a partial synchronisation failure, the merchant should verify the sync status report and either re-run the sync for remaining items or use the rollback function."*

---

### 3.4 Indemnification Clause

> **INDEMNIFICATION**
>
> Merchant agrees to defend, indemnify, and hold harmless MarginSync and its officers, directors, employees, and agents from and against any claims, liabilities, damages, judgments, awards, losses, costs, expenses, or fees (including reasonable attorneys' fees) arising out of or relating to:
>
> (a) Merchant's use of MarginSync in violation of these Terms;
> (b) Any prices written to Merchant's Shopify store via MarginSync that result in regulatory non-compliance, consumer claims, marketplace violations, or contractual breaches with Merchant's suppliers or distribution partners;
> (c) Merchant's failure to review computed prices before confirming a sync.

---

## 4. Required Storefront Artifacts

Both documents must be hosted at publicly accessible URLs and registered in the Shopify Partner Dashboard under App Setup → URLs → Privacy Policy URL / Terms of Service URL.

**Recommended routes to add to Next.js:**
```
/legal/privacy-policy
/legal/terms-of-service
```

---

### 4.1 Privacy Policy — Structural Checklist

Every item marked **[REQUIRED]** is mandatory for Shopify App Review. Items marked **[RECOMMENDED]** are best practice.

```markdown
# MarginSync Privacy Policy

Last updated: [DATE]

## 1. Introduction [REQUIRED]
  - [ ] Who we are: legal entity name, contact email
  - [ ] What this policy covers (MarginSync app for Shopify merchants)
  - [ ] That this policy does NOT cover end-customers of Shopify stores

## 2. Information We Collect [REQUIRED]
  - [ ] Merchant account data: email address, full name (via Supabase Auth)
  - [ ] Shopify store domain name
  - [ ] Shopify OAuth access token (stored encrypted, never transmitted to third parties)
  - [ ] Product catalog data: product titles, variant SKUs, current prices (no end-customer PII)
  - [ ] Uploaded supplier price lists (CSV/XLSX files) — treated as merchant business data
  - [ ] Pricing configuration: margin targets, pricing rules
  - [ ] Run history: timestamps, item counts, pricing outcomes (no customer names or orders)
  - [ ] Usage analytics (if any — describe specifically)

## 3. Information We Do NOT Collect [REQUIRED for Shopify Review]
  - [ ] End-customer names, email addresses, shipping addresses, or order data
  - [ ] Payment card numbers or financial account data
  - [ ] Shopify store revenue, order volume, or financial performance data

## 4. How We Use Your Information [REQUIRED]
  - [ ] To provide the repricing automation service
  - [ ] To authenticate your Shopify store and write prices on your behalf
  - [ ] To send run-completion notifications (if notifications enabled)
  - [ ] We do NOT sell, rent, or share your data with third parties
  - [ ] We do NOT use your data to train AI models

## 5. Data Retention [REQUIRED — ties to GDPR §2]
  - [ ] Access tokens: retained while app is installed; deleted on uninstall
  - [ ] Run history: retained for 90 days after run completion
  - [ ] Uploaded files: retained for 90 days; deleted on uninstall
  - [ ] Account data: retained while account is active; deleted on request

## 6. Data Deletion [REQUIRED]
  - [ ] Uninstalling the app triggers automatic deletion of all store data within 48 hours
  - [ ] Merchants can request manual deletion by emailing [support@yourdomain.com]
  - [ ] GDPR/CCPA deletion requests are processed within 30 days

## 7. Data Security [REQUIRED]
  - [ ] Access tokens are encrypted at rest using AES-256-GCM
  - [ ] All data is transmitted over TLS 1.2+
  - [ ] We use Supabase (hosted on AWS) for database storage — link to Supabase's security page
  - [ ] We use Vercel for application hosting — link to Vercel's security page

## 8. Third-Party Services [REQUIRED — list all processors]
  - [ ] Supabase (Supabase Inc.) — database and file storage
  - [ ] Vercel (Vercel Inc.) — application hosting
  - [ ] Shopify (Shopify Inc.) — platform integration
  - [ ] [Stripe (Stripe Inc.) — if/when payment processing is added]

## 9. Your Rights [REQUIRED for GDPR / CCPA]
  - [ ] Right to access: request a copy of your data
  - [ ] Right to deletion: request erasure of your data
  - [ ] Right to portability: export your run history
  - [ ] GDPR (EU/UK merchants): Articles 15–22 rights
  - [ ] CCPA (California merchants): rights to know, delete, opt out of sale
  - [ ] How to exercise: email [privacy@yourdomain.com]

## 10. Cookies [REQUIRED]
  - [ ] Strictly necessary session cookies (Supabase Auth)
  - [ ] No advertising or tracking cookies
  - [ ] No third-party analytics unless added (describe if added)

## 11. Changes to This Policy [REQUIRED]
  - [ ] How we notify merchants of material changes (email and/or in-app banner)
  - [ ] Continued use after notice constitutes acceptance

## 12. Contact [REQUIRED]
  - [ ] Legal entity name and address
  - [ ] Privacy contact email
  - [ ] For EU merchants: Data Protection Officer contact (if required)
```

---

### 4.2 Terms of Service — Structural Checklist

```markdown
# MarginSync Terms of Service

Last updated: [DATE]

## 1. Acceptance of Terms [REQUIRED]
  - [ ] Using MarginSync constitutes acceptance of these Terms
  - [ ] Minimum age requirement (18+ or legal age in jurisdiction)
  - [ ] That merchant agrees on behalf of their business entity

## 2. Description of Service [REQUIRED]
  - [ ] MarginSync automates repricing of Shopify product variants based on
        supplier cost data uploaded by the merchant
  - [ ] MarginSync requires a connected Shopify store and the merchant's
        explicit confirmation before any prices are modified
  - [ ] Free plan: 3 repricing runs/month. Pro plan: unlimited runs at $19/month

## 3. Merchant Responsibilities [REQUIRED for liability protection]
  - [ ] Merchant is solely responsible for reviewing computed prices before
        confirming a sync (explicit confirmation step exists — reference it)
  - [ ] Merchant is responsible for ensuring uploaded supplier files contain
        accurate cost data
  - [ ] Merchant is responsible for setting appropriate margin targets
  - [ ] Merchant must comply with Shopify's Terms of Service and any
        applicable pricing regulations in their jurisdiction
  - [ ] Merchant is responsible for any pricing that violates MAP (Minimum
        Advertised Price) agreements with their suppliers

## 4. Pricing and Billing [REQUIRED]
  - [ ] Pro plan billed monthly via Shopify Billing API ($19/month USD)
  - [ ] Charges appear on merchant's Shopify bill
  - [ ] Downgrade to Free on cancellation; existing run history retained for 90 days
  - [ ] No refunds for partial months (per Shopify Billing API norms)

## 5. Disclaimer of Warranties [REQUIRED — see §3.2 above]
  - [ ] "As-Is" clause (full text from §3.2)
  - [ ] No guarantee of pricing accuracy or sync completeness
  - [ ] Specific disclaimer for partial sync failures due to Shopify API outages

## 6. Limitation of Liability [REQUIRED — see §3.1 above]
  - [ ] Full limitation clause from §3.1
  - [ ] Explicit list: pricing errors, revenue loss, sync delays, API failures

## 7. Indemnification [REQUIRED — see §3.4 above]
  - [ ] Full indemnification clause from §3.4

## 8. Intellectual Property [REQUIRED]
  - [ ] MarginSync (code, UI, documentation) is owned by [Legal Entity Name]
  - [ ] Merchant retains ownership of their data (supplier files, run history)
  - [ ] License to merchant: limited, non-transferable right to use the service

## 9. Prohibited Uses [REQUIRED]
  - [ ] Do not reverse-engineer or scrape the service
  - [ ] Do not use to violate Shopify's policies or applicable law
  - [ ] Do not upload files containing third-party confidential data without rights

## 10. Termination [REQUIRED]
  - [ ] MarginSync may suspend or terminate access for Terms violations
  - [ ] Merchant may uninstall at any time; data deleted per Privacy Policy
  - [ ] Survival clause: §5, §6, §7, §8 survive termination

## 11. Governing Law & Dispute Resolution [REQUIRED]
  - [ ] Governing law: [Your jurisdiction — e.g., State of Delaware, USA]
  - [ ] Dispute resolution: [Arbitration / Courts of [jurisdiction]]
  - [ ] Class action waiver (recommended for US-based operators)

## 12. Changes to Terms [REQUIRED]
  - [ ] 30-day notice for material changes
  - [ ] Continued use after notice constitutes acceptance

## 13. Contact [REQUIRED]
  - [ ] Legal entity name, address, email
```

---

### 4.3 In-App Consent & Acknowledgement (Recommended UX)

Add a one-time acknowledgement modal on first login:

```tsx
// components/LegalAcknowledgementModal.tsx
<Modal>
  <p>By using MarginSync, you agree to our{' '}
    <a href="/legal/terms-of-service">Terms of Service</a> and{' '}
    <a href="/legal/privacy-policy">Privacy Policy</a>.
  </p>
  <p className="text-amber-700 text-sm">
    ⚠️ MarginSync writes prices directly to your live Shopify store.
    Always review the preview before confirming a sync.
  </p>
  <Button onClick={handleAccept}>I understand — continue</Button>
</Modal>
```

Store the acceptance timestamp in `organizations.terms_accepted_at` for audit purposes.

---

## 5. Open Action Items

Prioritised list of compliance gaps identified in this audit:

| Priority | Item | Owner | Due |
|---|---|---|---|
| 🔴 **Critical** | Publish Privacy Policy at `/legal/privacy-policy` and register URL in Partner Dashboard | Dev | Before public launch |
| 🔴 **Critical** | Publish Terms of Service at `/legal/terms-of-service` and register URL in Partner Dashboard | Dev | Before public launch |
| 🔴 **Critical** | Fix `shop/redact` webhook to also anonymise `profiles` + `organizations` records for GDPR completeness | Dev | Before EU merchants |
| 🟠 **High** | Clarify `stripe_customer_id` intent: document whether Stripe is planned, and confirm it will not bypass Shopify Billing API for Shopify merchants | Dev | Before Pro billing launch |
| 🟠 **High** | Implement 90-day auto-expiry for `reprice_runs` and supplier-file Storage objects | Dev | Within 30 days |
| 🟡 **Medium** | Add `terms_accepted_at` column to `organizations` and first-login consent modal | Dev | Before beta users grow |
| 🟡 **Medium** | Document `TOKEN_ENCRYPTION_KEY` rotation procedure in ops runbook | Dev | Within 60 days |
| 🟡 **Medium** | Register all three GDPR webhooks in Partner Dashboard under App Setup → Webhooks (verify they point to production URL) | Dev | Verify now |
| 🟢 **Low** | Add `PRIVACY_POLICY_URL` and `TERMS_URL` env vars and link them in app footer | Dev | Before public launch |
| 🟢 **Low** | Add Supabase lifecycle policy to auto-expire `supplier-files` objects after 90 days | Dev | Within 60 days |

---

*Document authored: 2026-06-09 | Based on Shopify Partner Program Agreement (2024), GDPR (EU 2016/679), CCPA (Cal. Civ. Code §1798.100 et seq.)*  
*Review this document with a qualified attorney before publishing the Privacy Policy and Terms of Service.*
