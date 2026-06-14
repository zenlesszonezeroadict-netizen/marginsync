---
title: "Shopify Product CSV Import Errors and How to Fix Them"
slug: "shopify-csv-import-errors"
description: "The most common Shopify product CSV import errors, what actually causes them, and how to fix each one so your price and product updates go through cleanly."
date: "2026-06-14"
---

# Shopify Product CSV Import Errors and How to Fix Them

CSV import is how a lot of stores update products and prices in bulk. It's also where a lot of afternoons go to die, because one malformed column can make the whole file fail or, worse, half-import and leave your catalogue in a strange state.

Here are the import errors that come up most often and how to fix each one.

## "Handle is required" or rows silently skipped

Shopify matches rows to existing products by the `Handle` column. If a handle is blank, misspelled, or doesn't match an existing product, that row either errors or quietly creates a duplicate instead of updating.

Fix: make sure every row has the correct handle, exactly as it appears in your store. If you're updating existing products, export them first and edit that file rather than building one from scratch.

## Prices not updating

You imported the file, it said success, but the prices didn't change. Usually one of these:

- The price column wasn't named exactly `Variant Price`.
- You didn't tick "Overwrite existing products."
- The handle didn't match, so Shopify treated the row as a new product instead of an update.

Fix: use the exact column names from a fresh export, enable overwrite, and double-check the handles line up.

## Encoding and special characters look broken

Product names with accents, currency symbols, or emoji come through as garbled text. This is almost always a file-encoding problem.

Fix: save the file as CSV UTF-8. In Excel, use "CSV UTF-8 (Comma delimited)" rather than the plain CSV option.

## Extra columns or shifted data

If your costs or prices land in the wrong field, a stray comma inside a value (like a price written as `1,299`) has probably shifted the whole row over by one column.

Fix: remove thousands separators from number fields, and wrap any text that contains commas in quotes. Re-export and compare a couple of rows against the original to confirm nothing shifted.

## The deeper problem with CSV imports

Even when the file is perfect, the native import has no preview and no undo. You only find out whether it worked after it's already live, and rolling back means importing your old file (if you saved one). For a routine product edit that's annoying. For a bulk price change driven by supplier costs, it's risky.

## A safer way to do price updates

If the reason you're wrestling with CSVs is to push supplier prices into Shopify, [MarginSync](https://marginsync-wheat.vercel.app) skips the whole import dance. You upload the supplier file as it arrived, it works out the SKU and cost columns for you, matches them to your catalogue, and shows you every price change before anything goes live. One click to apply, one click to roll back, all logged. It's free while we're in beta.

No column-naming, no encoding headaches, no held breath on import: **[try MarginSync free](https://marginsync-wheat.vercel.app)**.
