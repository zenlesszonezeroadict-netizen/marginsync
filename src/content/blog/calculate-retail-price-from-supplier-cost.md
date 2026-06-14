---
title: "How to Calculate Retail Price From Supplier Cost (Markup vs Margin)"
slug: "calculate-retail-price-from-supplier-cost"
description: "How to calculate a retail price from your supplier cost, the difference between markup and margin, and why mixing them up quietly eats your profit."
date: "2026-06-14"
---

# How to Calculate Retail Price From Supplier Cost

Your supplier charges you a cost. You need a retail price. Simple enough, until you realise that "add 50%" can mean two completely different prices depending on whether you meant 50% markup or 50% margin. People mix these up constantly, and it's one of the quietest ways to lose money on every sale.

Here's how to calculate a retail price from a supplier cost properly, and the one distinction that trips up most store owners.

## Markup and margin are not the same thing

Both describe the gap between cost and price. They just measure it against different things.

Markup is the gap as a percentage of your cost. Margin is the gap as a percentage of your selling price.

Say a product costs you $10.

- A 50% markup means you add 50% of the cost: `10 + (10 * 0.5) = $15`. Your margin on that is only 33%.
- A 50% margin means the cost is half the price: `10 / (1 - 0.5) = $20`. That's a 100% markup.

Same "50%", five dollars apart. If you price by margin but think in markup (or the reverse), every product is mispriced and you won't notice until the numbers feel off at the end of the month.

## The formulas

To price from a target markup:

`retail = cost * (1 + markup)`

So $10 at a 60% markup is `10 * 1.6 = $16`.

To price from a target margin:

`retail = cost / (1 - margin)`

So $10 at a 40% margin is `10 / 0.6 = $16.67`.

Most retailers think in margin, because margin is what actually shows up on your profit line. Pick one and stick with it across your whole catalogue.

## Don't forget what eats the margin

The cost from your supplier isn't your real cost. Before you set a target margin, account for the things that come out of every sale:

- payment processing fees (roughly 2-3%)
- shipping you don't fully recover
- returns and the occasional damaged item
- platform or app fees

If your "real" margin target is 40% but fees quietly take 5%, you're actually running at 35%. Build that in once so your pricing already accounts for it.

## Doing it across a whole catalogue

The maths above is easy for one product. It gets old fast across hundreds, especially when a supplier sends a new cost list and you have to recalculate everything and push the new prices into Shopify by hand.

That's the exact job [MarginSync](https://marginsync-wheat.vercel.app) handles. You upload the supplier's CSV, it matches the costs to your products, applies your margin rule, and shows you every new price before anything goes live. One click applies them, one click rolls back. It's free while we're in beta.

If you've ever second-guessed whether your prices are actually hitting your target margin, that's worth a look: **[try MarginSync free](https://marginsync-wheat.vercel.app)**.
