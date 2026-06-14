---
title: "Bulk Price Update in Shopify: Every Method (and Their Limits)"
slug: "bulk-price-update-shopify"
description: "A practical guide to bulk price updates in Shopify — the native bulk editor, CSV import, their real limitations, and how to preview and roll back changes safely."
date: "2026-06-14"
---

# Bulk Price Update in Shopify: Every Method (and Their Limits)

A supplier raises costs across a category. A season ends and you want to mark down 200 items. A bulk price update in Shopify *should* be a two-minute job — but the native tools each have a catch that can turn it into an afternoon of cleanup.

Here's an honest rundown of every built-in way to change prices in bulk, what each one is actually good at, and where they leave you exposed.

## Method 1: The bulk editor

Shopify's bulk editor is the fastest native option for a handful of products.

Go to **Products**, tick the items you want, then click **Edit products**. Add the **Price** column (and **Compare-at price** if you run sales), and you get a spreadsheet-style grid you can type straight into.

**Good for:** quick, eyes-on changes to 5–50 products.

**The limits:**
- You're still typing each price by hand — there's no "increase everything by 8%" button.
- It caps out at a few hundred items before it becomes unwieldy.
- No record of what the prices *were* before you changed them.

## Method 2: CSV export and import

For larger catalogues, the CSV route scales further.

Export via **Products → Export**, open the file, and edit the `Variant Price` column — often with a formula like `=old_price*1.08` for an across-the-board 8% rise. Then re-import under **Products → Import** with **Overwrite** enabled.

**Good for:** large, formula-driven changes (percentage rises, rounding rules).

**The limits:**
- **No preview.** The import applies instantly. A formula error means wrong prices go live before you can check them.
- **No rollback.** Unless you saved the pre-change CSV, there's no one-click undo.
- **No cost awareness.** The export has your *retail* prices, not supplier *costs*, so margin-based repricing means importing supplier data separately and matching SKUs yourself.

## Method 3: Third-party apps

Once you need previews, scheduling, cost-based logic, or supplier-file matching, you're into app territory. This is where the native tools genuinely run out of road — not because Shopify is bad, but because bulk repricing safely is a different job from editing a few products.

## The two things native tools don't give you

Across all the built-in methods, two gaps cause the most pain:

1. **A preview before you commit.** Seeing exactly which products change, and by how much, *before* it's live.
2. **A clean rollback.** Undoing a bad batch in one click instead of restoring from a backup you hopefully remembered to make.

## How MarginSync handles it

[MarginSync](https://marginsync-wheat.vercel.app) is a Shopify app focused on safe bulk repricing from supplier files. You upload a supplier CSV or Excel file, it **auto-detects the SKU and cost columns**, matches them to your live catalogue, and shows a **full preview of every change before anything is applied**. Then it's **one click to apply and one click to roll back**, with every change logged.

It's built for merchants pricing from real supplier lists, and it's **currently free during beta**.

If your last bulk update involved a held breath and a prayer, the preview-and-rollback approach is worth trying: **[see how MarginSync works](https://marginsync-wheat.vercel.app)**.
