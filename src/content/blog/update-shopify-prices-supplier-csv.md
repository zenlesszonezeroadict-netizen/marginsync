---
title: "How to Update Shopify Prices From a Supplier CSV (2026 Guide)"
slug: "update-shopify-prices-supplier-csv"
description: "Learn how to update Shopify prices from a supplier CSV — the manual export/import method, common pitfalls, and a faster way to match SKUs and preview changes."
date: "2026-06-14"
---

# How to Update Shopify Prices From a Supplier CSV

If your supplier sends you a spreadsheet of new costs every few weeks, you already know the drill: open the file, find the matching product in Shopify, type in the new price, repeat a few hundred times. It's slow, and one mistyped number can quietly eat your margin for a month.

This guide covers how to update Shopify prices from a supplier CSV properly — the genuine manual method first, the mistakes that cause incorrect prices, and a faster way to do it when the manual route stops scaling.

## The manual method: export, edit, re-import

Shopify has a built-in CSV workflow. It's free and it works, but it expects *your* product CSV — not your supplier's. Here's the honest process.

### 1. Export your product list

Go to **Products** in your Shopify admin, click **Export**, and choose **All products** as a CSV. You'll get a file with one row per variant and columns including `Variant SKU`, `Variant Price`, and `Variant Compare At Price`.

### 2. Match supplier SKUs to your SKUs

This is the part nobody warns you about. Your supplier's file has *their* SKUs and costs. Your Shopify export has *your* SKUs and retail prices. To update anything, you have to line the two up — usually with a VLOOKUP or an INDEX/MATCH in Excel or Google Sheets, keyed on the SKU column both files share.

If your SKUs don't match exactly (extra spaces, different capitalisation, a supplier prefix), the lookup silently fails and those rows get skipped or filled wrong.

### 3. Apply your markup

A supplier CSV gives you *cost*, not retail price. So you add a formula — say `cost × 1.6` for a 60% markup — to calculate the new `Variant Price`. Decide here whether you also want to update `Compare At Price` for sale displays.

### 4. Re-import the edited CSV

Back in **Products → Import**, upload your edited file and tick **Overwrite existing products**. Shopify matches rows by handle and updates the prices.

## Where this goes wrong

The manual method breaks down in predictable ways:

- **No preview.** Import overwrites immediately. If a formula referenced the wrong column, you find out *after* the wrong prices are live.
- **No undo.** Shopify doesn't keep a one-click rollback of a bulk import. To revert, you need a backup of the *old* CSV — which people forget to save.
- **SKU mismatches fail silently.** A handful of unmatched rows is easy to miss in a 500-row file.
- **It's still hours of work** every time the supplier sends a new list.

For a one-off change across a dozen products, the bulk editor (**Products → select items → Edit prices**) is faster than CSV gymnastics. But for a recurring supplier feed, neither native tool handles the SKU-matching or the safety net.

## A faster way: MarginSync

[MarginSync](https://marginsync-wheat.vercel.app) is a Shopify app built specifically for this recurring job. Instead of wrangling VLOOKUPs, you upload the supplier's CSV or Excel file as-is. It **auto-detects your SKU and cost columns**, matches them against your live Shopify catalogue, and shows you a **full preview of every price change before anything goes live**. If something looks wrong, it's **one click to apply and one click to roll back**, and every change is logged.

It's built for merchants who price from real supplier files — not dropshippers — and it's currently **free during beta**.

If you're spending an afternoon every month on supplier price updates, it's worth a look: **[try MarginSync free](https://marginsync-wheat.vercel.app)**.
