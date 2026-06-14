---
title: "Bulk Price Update in Shopify: Every Method (and Their Limits)"
slug: "bulk-price-update-shopify"
description: "A practical guide to bulk price updates in Shopify: the native bulk editor, CSV import, their real limits, and how to preview and roll back changes safely."
date: "2026-06-14"
---

# Bulk Price Update in Shopify: Every Method (and Their Limits)

A supplier bumps costs across a whole category. Or a season ends and you want 200 items marked down. A bulk price update in Shopify ought to be a two-minute job. The trouble is that each of the native tools has a catch, and any one of them can turn it into an afternoon of cleanup.

So here's a straight rundown of every built-in way to change prices in bulk, what each is genuinely good at, and where it leaves you exposed.

## Method 1: The bulk editor

For a handful of products, the bulk editor is the fastest thing Shopify gives you.

Open **Products**, tick the items you want, and click **Edit products**. Add the **Price** column (and **Compare-at price** too, if you run sales) and you get a spreadsheet-style grid you can type straight into.

Good for: quick, eyes-on changes to somewhere between 5 and 50 products.

Where it runs out:
- You're still typing every price by hand. There's no "raise everything 8%" button.
- Past a few hundred items it gets unwieldy fast.
- It keeps no record of what the prices were before you touched them.

## Method 2: CSV export and import

For bigger catalogues, CSV scales further.

Export through **Products > Export**, open the file, and edit the `Variant Price` column, usually with a formula like `=old_price*1.08` for a flat 8% rise. Then re-import under **Products > Import** with **Overwrite** turned on.

Good for: large, formula-driven changes like percentage rises or rounding rules.

Where it runs out:
- No preview. The import lands instantly, so a formula slip puts wrong prices live before you can check anything.
- No rollback. Unless you saved the file from before, there's no undo.
- No idea about cost. The export has your retail prices, not supplier costs, so anything margin-based means pulling in supplier data on the side and matching SKUs yourself.

## Method 3: Third-party apps

The moment you need previews, scheduling, cost-based logic, or supplier-file matching, you've left what the native tools can do. That's not a knock on Shopify. Repricing safely in bulk is just a different job from editing a few products, and at some point a purpose-built tool wins.

## The two things the native tools never give you

Across all of the above, two gaps cause most of the pain:

1. A preview before you commit, so you can see which products change and by how much while it's still safe to back out.
2. A clean rollback, so undoing a bad batch is one click instead of restoring from a backup you hopefully remembered to make.

## How MarginSync handles it

[MarginSync](https://marginsync-wheat.vercel.app) is a Shopify app built around safe bulk repricing from supplier files. You upload a supplier CSV or Excel file, it works out the SKU and cost columns, matches them to your live catalogue, and shows you every change before a single price moves. Applying is one click, rolling back is one click, and the whole thing is logged.

It's made for merchants pricing from real supplier lists, and it's free while we're in beta.

If your last bulk update involved holding your breath and hitting import, the preview-and-rollback approach is worth a try: **[see how MarginSync works](https://marginsync-wheat.vercel.app)**.
