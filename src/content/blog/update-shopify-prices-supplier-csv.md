---
title: "How to Update Shopify Prices From a Supplier CSV (2026 Guide)"
slug: "update-shopify-prices-supplier-csv"
description: "How to update Shopify prices from a supplier CSV: the manual export and import method, the mistakes that cause wrong prices, and a faster way to do it."
date: "2026-06-14"
---

# How to Update Shopify Prices From a Supplier CSV

Every few weeks your supplier emails over a spreadsheet with new costs. So you open Shopify, find each product, type in the new price, and then do it again a few hundred more times. It's slow work, and it only takes one fat-fingered number to quietly wreck your margin on a product for a month before you catch it.

So let's go through how to actually update Shopify prices from a supplier CSV. I'll start with the manual way, because it's free and it does work. Then I'll cover the parts that trip people up, and a quicker option for when the manual route stops being worth it.

## The manual way: export, edit, re-import

Shopify has a built-in CSV workflow. The catch is that it wants *your* product CSV, not the one your supplier sent. Here's how it actually goes.

### 1. Export your products

Open **Products** in your admin, click **Export**, and pick **All products** as CSV. You get one row per variant, with columns like `Variant SKU`, `Variant Price`, and `Variant Compare At Price`.

### 2. Line up the SKUs

This is the step nobody warns you about. Your supplier's file has their SKUs and their costs. Your Shopify export has your SKUs and your retail prices. Before you can change a thing, you have to match the two, usually with a VLOOKUP or INDEX/MATCH in Excel or Google Sheets, keyed on the SKU column both files share.

And if the SKUs don't match exactly? A stray space, a different capitalisation, a supplier prefix tacked on the front? The lookup just fails on those rows without telling you, and they end up skipped or filled with the wrong number.

### 3. Add your markup

A supplier file gives you cost, not retail. So you write a formula, something like `cost * 1.6` for a 60% markup, to fill in the new `Variant Price`. This is also where you decide whether to touch `Compare At Price` for your sale displays.

### 4. Re-import

Back in **Products > Import**, upload the edited file and tick **Overwrite existing products**. Shopify matches on the handle and updates your prices.

## Where it goes wrong

A few problems show up over and over:

- The import goes live the second you confirm it. No preview. So if a formula pointed at the wrong column, you find out once the bad prices are already public.
- There's no undo button. To roll back you need the old CSV saved somewhere, and that's exactly the file everyone forgets to keep.
- Unmatched SKUs fail silently. Twenty bad rows hiding in a 500-row file are easy to miss.
- It's still an hour or two of spreadsheet wrangling every time a new list lands.

For a quick change across a dozen products, just use the bulk editor instead (**Products**, select your items, **Edit prices**). It beats the whole CSV routine. But for a supplier feed you're handling on repeat, neither native tool does the SKU matching or gives you any kind of safety net.

## A faster option: MarginSync

[MarginSync](https://marginsync-wheat.vercel.app) is a Shopify app I built for this exact job. You upload the supplier's CSV or Excel file the way it arrived, no VLOOKUPs required. It works out which columns are your SKU and your cost, matches them to your live catalogue, and shows you every price change before any of it goes live. If a number looks off, applying or rolling back is one click either way, and it logs everything.

It's meant for merchants who price from real supplier files rather than dropshippers, and it's free while we're in beta.

If you're losing an afternoon a month to this, it's worth a look: **[try MarginSync free](https://marginsync-wheat.vercel.app)**.
