# MarginSync — Project Roadmap & Single Source of Truth

> **One sentence:** MarginSync turns any supplier price list into a one-click, margin-safe Shopify price update — flagging every product whose cost rose or whose margin slipped below your target — cutting a 3-hour weekly chore to under 5 minutes.

---

## Table of Contents

1. [Validated Problem & Market Research](#1-validated-problem--market-research)
2. [Micro-SaaS Filter Analysis](#2-micro-saas-filter-analysis)
3. [Product Blueprint](#3-product-blueprint)
4. [PRD — Full Specification](#4-prd--full-specification)
5. [Tech Stack Architecture](#5-tech-stack-architecture)
6. [Database Schema](#6-database-schema)
7. [Issue List — 15 Slices](#7-issue-list--15-slices)
8. [Progress Tracking](#8-progress-tracking)

---

## 1. Validated Problem & Market Research

**Research date:** June 2026  
**Communities mined:** r/shopify, r/ecommerce, Shopify community forums, QuickBooks Community, Shopify App Store review sections

### The Pain (with receipts)

Shopify resellers and distributors receive supplier price-list files (CSV, XLSX) whenever a supplier changes wholesale costs. Each update forces the store owner to:
1. Manually cross-reference the supplier's SKU format against their Shopify catalog
2. Calculate new retail prices that preserve their target margin
3. Import the result into Shopify

**Evidence:**
- A merchant on the Shopify forum: *"I was spending **3 hours** updating prices"* — reduced to 60 seconds only after building a custom n8n automation ([source](https://community.shopify.com/t/i-was-spending-3-hours-updating-prices-now-it-takes-60-seconds/630909))
- Another thread: *"How to ONLY update cost and prices according to supplier list?"* — merchants with **150 vendors / 3,000 products** asking for a solution ([source](https://community.shopify.com/c/shopify-discussions/how-to-only-update-cost-and-prices-according-to-supplier-list/m-p/2444646))
- Reported time wasted: **2–4 hrs/week** for resellers with frequent cost changes

### Why Existing Tools Don't Solve It

Existing Shopify bulk-edit apps (Matrixify, Hextom, BulkFlow, Stockeo) require the merchant to *deliver a clean, correctly-formatted CSV* — they do **not** solve:
- Parsing arbitrary supplier file formats
- Persistent SKU cross-referencing between supplier and Shopify catalog
- Margin-erosion detection and alerts

---

## 2. Micro-SaaS Filter Analysis

Three candidates evaluated:

| Criterion | 🅐 Repricing (WINNER) | 🅑 Profit Dashboard | 🅒 Reconciliation |
|---|---|---|---|
| **Painkiller** | ✅✅ Saves hours AND stops silent margin loss | ✅ Insight only | ✅ Pure cost-center |
| **2-Week Solo MVP** | ✅ CSV parse → SKU match → margin rule → Shopify write | ⚠️ Integration sprawl | ⚠️ Accounting correctness is trust-heavy |
| **$0 Feasibility** | ✅ Light data, batch jobs | ⚠️ Heavy polling | ✅ Feasible |
| **Competition gap** | ✅ Bulk-edit apps need a clean CSV already; none alert on margin erosion | ❌ Triple Whale, BeProfit, Lifetimely all fight here | ❌ A2X, MyWorks (free) block entry |

**Winner: 🅐 — Supplier price-list margin-aware repricing**

---

## 3. Product Blueprint

### Value Proposition
> MarginSync turns any supplier price list into a one-click, margin-safe Shopify price update — flagging every product whose cost rose or whose margin slipped below your target — cutting a 3-hour weekly chore to under 5 minutes.

**Time saved:** ~3 hrs/week → ~10 min/week (≈ 12 hrs/month)  
**ROI for user:** At $30/hr mental rate = ~$360/mo of time saved; tool priced at $19/mo

### Target Audience
Shopify store owners who **resell/distribute** (not manufacture). Auto parts, industrial/MRO, electronics, beauty wholesale, pet, B2B distributors.

**Free cold-email sources:**
- `myip.ms` Shopify store directories filtered by niche
- 1–3★ reviews on Matrixify / Hextom / Stockeo (warm leads complaining about this exact problem)
- r/shopify / r/ecommerce posters complaining about repricing
- Faire/Handshake retailer directories

### Pricing
- **Free:** 3 reprice runs/month
- **Pro:** $19/month, unlimited runs

---

## 4. PRD — Full Specification

### Problem Statement

Shopify resellers and distributors receive supplier price-list files (CSV, XLSX, or PDF) whenever a supplier changes wholesale costs. Each update forces the store owner to manually cross-reference the supplier's SKU format against their own Shopify catalog, calculate new retail prices that preserve their target margin, and import the result. Merchants with even 200–500 SKUs across several suppliers report spending 2–4 hours per update cycle on this work — and because the process is error-prone, they routinely discover weeks later that a cost increase silently eroded their margin on hundreds of live products. Existing Shopify bulk-edit apps (Matrixify, Hextom, BulkFlow, Stockeo) require the merchant to deliver a clean, correctly-formatted CSV — they do not solve the upstream problem of parsing arbitrary supplier formats, persistent SKU cross-referencing, or margin-erosion detection.

### Solution

MarginSync gives a Shopify store owner a single web app where they:
1. Upload any supplier price-list file (CSV or XLSX, arbitrary column layout).
2. See a clean diff table showing every product's old cost, new cost, old price, proposed new price, projected margin — with rows flagged in red when margin would fall below their target.
3. Accept or adjust the proposed prices, then push the update to Shopify in one click.
4. Over time, MarginSync remembers the supplier-SKU ↔ Shopify-variant mapping so subsequent uploads from the same supplier take seconds, not hours.

### User Stories

#### Onboarding & Auth
1. As a new user, I want to sign up with my email (magic-link), so that I don't need a password and can start immediately.
2. As a new user, I want an organization to be auto-created on first sign-in, so that my data is isolated from other tenants without extra setup.
3. As a returning user, I want to be redirected to my dashboard after magic-link sign-in, so that I don't land on a blank screen.

#### Shopify Connection
4. As a store owner, I want to connect my Shopify store via OAuth in a few clicks, so that MarginSync can read my product catalog and write prices without me manually exporting anything.
5. As a user, I want to see a clear confirmation screen after OAuth, so that I know the connection succeeded.
6. As a user, I want to disconnect my Shopify store from MarginSync, so that I can revoke access at any time.
7. As a user, I want MarginSync to store only the minimum Shopify permissions (read/write products), so that I don't need to grant access to orders, customers, or other sensitive data.

#### Supplier File Upload & Parsing
8. As a store owner, I want to drag-and-drop a supplier CSV or XLSX file, so that I don't have to navigate complex import menus.
9. As a store owner, I want MarginSync to detect which columns contain SKU and cost data automatically, so that I don't have to map columns manually every time.
10. As a store owner, I want to confirm or correct the detected column mapping the first time I upload from a new supplier, so that subsequent uploads from the same supplier need no manual intervention.
11. As a store owner, I want MarginSync to tolerate extra whitespace, mixed case, or minor formatting differences in SKU values, so that real-world supplier files don't require manual cleanup.
12. As a store owner, I want to see how many rows were parsed and how many were unmatched after upload, so that I can judge file quality before proceeding.
13. As a store owner, I want unmatched SKUs to be listed clearly with a reason (e.g. "not found in catalog", "ambiguous match"), so that I can investigate and manually link them.
14. As a store owner, I want to manually link an unmatched supplier SKU to a Shopify variant by typing or searching, so that the mapping is saved and used in all future uploads.

#### Margin Rules
15. As a store owner, I want to set a default markup rule (e.g. "cost × 1.4, rounded to nearest .99"), so that proposed prices are calculated consistently without manual formulas.
16. As a store owner, I want to set a global minimum margin percentage, so that any product below this threshold is flagged in the preview.
17. As a store owner, I want to override the margin rule for a specific SKU or product category, so that premium or clearance items can have different pricing logic.
18. As a store owner, I want my pricing rules to persist across runs, so that I don't have to re-enter them every upload cycle.

#### Preview Diff Table
19. As a store owner, I want to see a sortable table of every matched product showing: Supplier SKU, Product Name, Old Cost, New Cost, Old Price, Proposed Price, Margin %, and a change flag, so that I can review the entire impact before committing.
20. As a store owner, I want rows where cost increased to be highlighted visually, so that I can spot supplier price hikes instantly.
21. As a store owner, I want rows where proposed margin is below my target to be flagged in red, so that I can fix pricing errors before they go live.
22. As a store owner, I want to edit the proposed price for any individual row in the preview table, so that I can make exceptions without losing the overall batch.
23. As a store owner, I want to deselect specific rows from the sync, so that I can exclude products I want to handle separately.
24. As a store owner, I want to see a summary banner ("14 products below margin target, 3 unmatched") before I sync, so that I can make a go/no-go decision at a glance.
25. As a store owner, I want to download the diff table as a CSV, so that I can keep an offline record or share it with a business partner.

#### Sync to Shopify
26. As a store owner, I want a single "Sync to Shopify" button that pushes all selected price changes, so that I don't have to do anything in Shopify Admin.
27. As a store owner, I want to see a live progress indicator while the sync runs, so that I know it's working and haven't lost my session.
28. As a store owner, I want a confirmation screen after sync showing how many products were updated successfully, how many failed, and why, so that I know the run is complete.
29. As a store owner, I want failed items to be retryable individually, so that a single API error doesn't invalidate the whole batch.

#### Run History & Audit
30. As a store owner, I want to see a history of all past reprice runs with timestamps and summary stats, so that I can audit pricing changes.
31. As a store owner, I want to click into any past run and see the full item-level diff, so that I can answer "why did this product's price change on that date?"
32. As a store owner, I want the run history to be retained for at least 90 days, so that I have enough audit trail for supplier disputes or accounting reviews.

#### Billing
33. As a user on the free plan, I want to be able to run up to 3 reprice runs per month at no cost, so that I can evaluate the product before paying.
34. As a user, I want to upgrade to the Pro plan ($19/mo) via Stripe Checkout, so that I can run unlimited repricing.
35. As a user, I want to manage or cancel my subscription in a self-serve billing portal, so that I don't have to email support.
36. As a user, I want to see my current plan and remaining free-tier runs on my dashboard, so that I'm not surprised by a paywall mid-workflow.

### Implementation Decisions

- **Single deployable unit:** one Next.js App Router project on Vercel Hobby. No separate API service.
- **Multi-tenancy boundary:** `organizations` table. Every data-bearing table has `organization_id` protected by RLS via `auth_org_ids()` helper.
- **File parsing runs server-side only.** Files written to Supabase Storage (org-scoped, private) then parsed via Server Action.
- **SKU normalization:** `toUpperCase().trim().replace(/[^A-Z0-9-]/g, '')`, exact match first (Map), fuzzy fallback via `fuse.js` (threshold 0.3).
- **Pricing rule shape:** `{ type: 'markup', value: 1.4, rounding: '0.99' | '0.00' | 'none' }`.
- **Run state machine:** `pending → parsed → previewed → syncing → completed | failed`
- **Shopify OAuth:** Custom app (not App Store). Scopes: `read_products`, `write_products` only.
- **Token storage:** Supabase Vault (`vault.create_secret`). Never stored in plaintext.
- **Shopify bulk write:** `productVariantsBulkUpdate` GraphQL mutation, batched at 250 variants/call.
- **Stripe:** Hosted Checkout + Customer Portal. Webhook drives `organizations.plan` and `subscription_status`.
- **Free plan gate:** 3 runs/calendar month, checked server-side before creating a new run.

### Testing Decisions

| Seam | Test type |
|---|---|
| `parseSupplierFile(buffer, config)` | Unit — cover CSV, XLSX, BOM, CRLF, malformed |
| `matchSKUs(parsedRows, catalog, mappings)` | Unit — exact, fuzzy, unmatched, manual override |
| `computeProposedPrices(rows, rule, target)` | Unit — markup, fixed margin, rounding, below-target flag |
| Supabase RLS policies | Integration — `supabase test db`, org A cannot read org B's data |
| Shopify OAuth flow | E2E (Playwright, dev store) |
| Stripe webhook handler | Unit — signed events → org plan update |
| Run state machine | Integration — Route Handler state transitions |

### Out of Scope (v1 MVP)

- PDF supplier file parsing
- Multi-store support per organization
- Automatic/scheduled repricing without user review
- Shopify inventory/quantity sync
- Currency conversion
- Bulk image or description updates
- Public Shopify App Store listing
- Email / Slack notifications for margin alerts
- GDPR data-export / right-to-erasure tooling

---

## 5. Tech Stack Architecture

```
┌──────────────────────────────────────────────────────────────┐
│  BROWSER  →  Next.js 16 (App Router) on VERCEL (free Hobby)  │
│  • Upload supplier file  • Preview diff table  • "Sync" btn  │
└───────────────┬───────────────────────────────┬──────────────┘
                │ Supabase JS (RLS-scoped)       │ Server Actions / Route Handlers
                ▼                                ▼
        ┌───────────────┐              ┌────────────────────────┐
        │  SUPABASE     │              │  Next.js server (Vercel)│
        │  • Auth (JWT) │◀────RLS──────│  • parse CSV/XLSX        │
        │  • Postgres   │              │  • fuzzy SKU match       │
        │  • Storage    │              │  • apply margin rules    │
        │    (uploads)  │              │  • Shopify Admin API     │
        └───────────────┘              │    bulk price write      │
                ▲                      └───────────┬─────────────┘
                │ webhook (signed)                 │
        ┌───────┴────────┐               ┌─────────▼──────────┐
        │ STRIPE Checkout│               │ Shopify Admin API  │
        │ + Billing portal│              │ (merchant's store) │
        └────────────────┘               └────────────────────┘
```

| Layer | Tool | Free tier |
|---|---|---|
| Frontend + API | Next.js 16 App Router | Open source |
| Auth + Database + Storage | Supabase | 500MB DB, 1GB storage, 50K MAU |
| Hosting + Cron | Vercel Hobby | Free |
| Payments | Stripe Checkout | $0 until revenue (2.9% + 30¢ per charge) |
| Shopify | Custom App OAuth | Free to build; dev store free |

---

## 6. Database Schema

Six tables, all multi-tenant via `organization_id` + RLS:

```
organizations          ← tenant root, billing state
profiles               ← extends auth.users (created by trigger)
organization_members   ← membership + role (owner/member)
shopify_connections    ← one store per org; token encrypted via Vault
sku_mappings           ← supplier-SKU ↔ Shopify-variant cross-reference (the moat)
reprice_runs           ← one row per upload job + state machine
reprice_run_items      ← per-product audit trail for every run
```

See `supabase/migrations/0001_initial_schema.sql` for the full DDL.

---

## 7. Issue List — 15 Slices

### PHASE 1 — Foundation (Days 1–3)

---

#### Issue #1 — Project scaffold + Supabase schema + RLS
**Status:** ✅ COMPLETED  
**Type:** AFK | **Blocked by:** None

Bootstrap the repo, configure Supabase, apply full schema with all RLS policies.

**Acceptance criteria:**
- [x] `npm run dev` starts without errors
- [x] `supabase/migrations/0001_initial_schema.sql` created with all 6 tables + RLS
- [x] Supabase lib helpers created (`client.ts`, `server.ts`)
- [x] `ROADMAP.md` and `PROGRESS.json` created
- [ ] `supabase db push` applies migration cleanly (requires Supabase project setup)
- [ ] `supabase gen types typescript` produces `database.ts`

---

#### Issue #2 — Auth: magic-link sign-in + org auto-create
**Status:** 🔲 NOT STARTED  
**Type:** AFK | **Blocked by:** #1

Magic-link auth, auth callback, org auto-create trigger, middleware protecting `/dashboard/*`.

**Files:** `src/app/login/page.tsx`, `src/app/auth/callback/route.ts`, `src/app/dashboard/page.tsx`, `middleware.ts`, `supabase/migrations/0002_auth_trigger.sql`

**Acceptance criteria:**
- [ ] Unauthenticated `/dashboard` redirects to `/login`
- [ ] Magic-link email sends and signs user in
- [ ] `profiles`, `organizations`, `organization_members` rows auto-created on first sign-in
- [ ] No duplicate org rows on repeat sign-in

---

### PHASE 2 — Local Parsing Core (Days 4–7)

---

#### Issue #3 — File upload → server-side parse → ParsedRow[]
**Status:** 🔲 NOT STARTED  
**Type:** AFK | **Blocked by:** #2

Upload CSV/XLSX → Supabase Storage → server parse → `reprice_runs` row at `status='parsed'`.

**Files:** `src/app/dashboard/upload/page.tsx`, `src/lib/parser/parse-file.ts`, `src/lib/parser/parse-csv.ts`, `src/lib/parser/parse-xlsx.ts`, `src/lib/supabase/storage.ts`, `src/app/api/runs/route.ts`

---

#### Issue #4 — Column-detection UI
**Status:** 🔲 NOT STARTED  
**Type:** AFK | **Blocked by:** #3

Auto-detect SKU and cost columns, user confirms/overrides, mapping persisted to `reprice_runs.column_config`.

**Files:** `src/app/dashboard/upload/[runId]/map-columns/page.tsx`, `src/lib/parser/detect-columns.ts`, `supabase/migrations/0003_add_column_config.sql`

---

#### Issue #5 — SKU normalization + fuzzy-match (mock catalog)
**Status:** 🔲 NOT STARTED  
**Type:** AFK | **Blocked by:** #4

Normalize SKUs, exact-match then fuzzy fallback (fuse.js), insert `reprice_run_items`, manual link UI.

**Files:** `src/lib/matcher/normalize-sku.ts`, `src/lib/matcher/match-skus.ts`, `src/lib/matcher/mock-catalog.ts`, `src/app/dashboard/upload/[runId]/match/page.tsx`, `src/app/api/runs/[runId]/match/route.ts`

---

#### Issue #6 — Pricing rule engine
**Status:** 🔲 NOT STARTED  
**Type:** AFK | **Blocked by:** #5

Markup → `proposedPrice`, `marginPct`, flags. Pricing rule stored on org. Settings page.

**Files:** `src/lib/pricing/compute-prices.ts`, `src/lib/pricing/apply-rounding.ts`, `src/app/dashboard/settings/pricing/page.tsx`, `src/app/api/runs/[runId]/price/route.ts`, `supabase/migrations/0004_org_pricing_rule.sql`

---

### PHASE 3 — Preview UI (Days 7–9)

---

#### Issue #7 — Diff preview table
**Status:** 🔲 NOT STARTED  
**Type:** AFK | **Blocked by:** #6

Sortable table: old vs new cost/price, margin, flags, inline price edit, row deselect.

**Files:** `src/app/dashboard/upload/[runId]/preview/page.tsx`, `src/app/dashboard/upload/[runId]/preview/PreviewTable.tsx`, `src/app/dashboard/upload/[runId]/preview/actions.ts`

---

#### Issue #8 — Summary banner + CSV export
**Status:** 🔲 NOT STARTED  
**Type:** AFK | **Blocked by:** #7

Banner with aggregate counts, CSV download route.

**Files:** `src/app/dashboard/upload/[runId]/preview/RunSummary.tsx`, `src/app/api/runs/[runId]/export/route.ts`

---

### PHASE 4 — Live Shopify Connection (Days 9–11)

---

#### Issue #9 — Shopify OAuth + encrypted token
**Status:** 🔲 NOT STARTED  
**Type:** AFK | **Blocked by:** #2

OAuth install/callback, HMAC verification, Vault token storage, connect/disconnect UI.

**Files:** `src/app/api/shopify/install/route.ts`, `src/app/api/shopify/callback/route.ts`, `src/app/dashboard/settings/shopify/page.tsx`

---

#### Issue #10 — Variant catalog sync → sku_mappings
**Status:** 🔲 NOT STARTED  
**Type:** AFK | **Blocked by:** #9

Paginate Shopify GraphQL products, upsert `sku_mappings` with `catalog_cache`.

**Files:** `src/lib/shopify/client.ts`, `src/lib/shopify/sync-catalog.ts`, `supabase/migrations/0005_sku_mappings_catalog_cache.sql`

---

#### Issue #11 — Wire real catalog into matching
**Status:** 🔲 NOT STARTED  
**Type:** AFK | **Blocked by:** #10, #5

Swap mock catalog for live `sku_mappings` in match route. Add catalog search endpoint.

**Files:** `src/app/api/runs/[runId]/match/route.ts` (modify), `src/app/api/catalog/search/route.ts`, delete `src/lib/matcher/mock-catalog.ts`

---

### PHASE 5 — Sync + Audit (Days 12–13)

---

#### Issue #12 — Sync-to-Shopify + run state machine
**Status:** 🔲 NOT STARTED  
**Type:** AFK | **Blocked by:** #11, #8

Bulk price write via `productVariantsBulkUpdate`, state machine, progress polling, result screen.

**Files:** `src/lib/shopify/bulk-price-write.ts`, `src/app/api/runs/[runId]/sync/route.ts`, `src/app/api/runs/[runId]/status/route.ts`, `src/app/dashboard/upload/[runId]/preview/SyncButton.tsx`, `src/app/dashboard/upload/[runId]/preview/SyncResult.tsx`

---

#### Issue #13 — Run history + audit drill-down
**Status:** 🔲 NOT STARTED  
**Type:** AFK | **Blocked by:** #12

History list page + read-only item diff per run.

**Files:** `src/app/dashboard/history/page.tsx`, `src/app/dashboard/history/[runId]/page.tsx`

---

### PHASE 6 — Billing + Gates (Day 14)

---

#### Issue #14 — Stripe Checkout + webhook → plan update
**Status:** 🔲 NOT STARTED  
**Type:** AFK | **Blocked by:** #2

Checkout session, webhook handler, Customer Portal route.

**Files:** `src/app/api/billing/checkout/route.ts`, `src/app/api/billing/webhook/route.ts`, `src/app/api/billing/portal/route.ts`

---

#### Issue #15 — Free-tier gate + billing portal + plan badge
**Status:** 🔲 NOT STARTED  
**Type:** AFK | **Blocked by:** #14, #12

Run quota check, upgrade CTA, PlanBadge component, portal link on dashboard.

**Files:** `src/lib/billing/check-quota.ts`, `src/components/PlanBadge.tsx`, modify `src/app/dashboard/page.tsx` and `src/app/dashboard/upload/page.tsx`

---

## 8. Progress Tracking

See `PROGRESS.json` for the machine-readable status of all 15 issues, updated automatically after each issue is completed.

---

*Last updated: 2026-06-08 | Stack: Next.js 16.2.7 · Supabase · Vercel · Stripe · Shopify Admin API*
