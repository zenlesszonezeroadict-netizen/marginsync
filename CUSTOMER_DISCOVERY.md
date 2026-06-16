# MarginSync — Customer Discovery: Finding Manual-CSV Wholesalers

> Working doc for the "talk to people first" phase. The goal is **conversations, not
> sales**. We are looking for one specific person: someone who updates supplier prices
> into Shopify by hand and hates it. Until we've talked to ~20 of them, we don't have a
> product problem, we have a research problem.

---

## 1. Where the manual-CSV people actually are

The key insight: **wholesale sellers** (people who resell from real supplier price lists)
are far more likely to maintain manual CSVs than **dropshippers** (who use auto-sync apps
like DSers/AutoDS). So we hunt where wholesalers gather, not where dropshippers do.

### 1.1 Facebook — wholesale & B2B groups (not dropshipping groups)

Search Facebook Groups for these terms and sort by members/activity:

- `wholesale sellers`, `wholesale resellers`, `B2B wholesale`
- `Shopify wholesale`, `Shopify B2B`
- `[your niche] wholesale` — e.g. `apparel wholesale`, `beauty wholesale`, `gadget wholesale`
- Regional: `grosir`, `wholesale Indonesia`, `wholesale Batam`, `SE Asia wholesale`

What to do inside: don't pitch. Post the question in §2, or DM active members who
mention "updating prices", "supplier increased prices", "price list", "spreadsheet".

### 1.2 LinkedIn — search strings

Use LinkedIn search (People + Posts) with:

- `"Shopify" AND "wholesale"`
- `"Shopify" AND ("supplier management" OR "supplier pricing")`
- `"wholesale" AND "Shopify" AND ("operations" OR "ecommerce manager")`
- Job titles to target in DMs: *Ecommerce Manager, Operations Manager, Merchandising,
  Purchasing/Buyer* at small/mid wholesale brands.

LinkedIn is the best channel for a calm, professional version of the §2 question because
the people running pricing ops have titles you can search for directly.

### 1.3 Shopify agencies — the shortcut to the pain

Agencies that build B2B/wholesale stores **already know exactly which clients have
supplier-sync problems.** One agency intro can be worth 50 cold DMs. Approach them as a
partner ("I'm researching supplier-price pain — which of your clients deals with this?"),
not as a vendor.

Agencies/partners that focus on Shopify B2B & wholesale (starting points to reach out to):

- Charle Agency — Shopify B2B/wholesale specialist
- Eastside Co — Shopify B2B development
- Bluedge USA — Shopify Plus B2B for wholesalers/manufacturers
- The Genie Lab — publishes on Shopify wholesale/B2B portals
- SparkLayer — Shopify B2B app with a partner network of agencies

(Also browse the Shopify Partner directory filtered to "B2B/Wholesale".)

### 1.4 Telegram / WhatsApp — Indonesia & SE Asia wholesale trade

These are dense with people who pass supplier price lists around manually — exactly our
user. Search Telegram for `grosir`, `supplier`, `reseller`, `dropship`, plus city names
(`Batam`, `Jakarta`, `Bandung`). Public Indonesian directories aggregate hundreds of these
groups (search "kumpulan grup telegram supplier grosir reseller"). WhatsApp equivalents
exist for grosir/supplier databases.

Caution: these groups are noisy and reseller-heavy. Lurk first, find the *admins* who
collect and re-share supplier price lists — they feel the manual-update pain most.

### 1.5 Reddit & forums (English-speaking long tail)

- r/shopify, r/ecommerce, r/smallbusiness — search "supplier price", "update prices",
  "price list spreadsheet". Reply helpfully; DM people describing the manual grind.

---

## 2. The first email / DM — just a question

Do **not** pitch. Do **not** list features. The entire first message is one question
designed to start a conversation:

> **Subject:** quick question about supplier prices
>
> Do you update supplier prices manually into Shopify? How long does it take you per week?

That's it. If they reply, *then* you ask follow-ups and eventually pitch:

- "What does your current process look like — spreadsheet, copy-paste, an app?"
- "What's the worst part — the matching, the margin math, or the time?"
- "Has a price ever gone live wrong because of a manual update?"

Only after 2–3 exchanges, if there's genuine pain, mention MarginSync: *"I'm building a
tool that does exactly this — want to try it free and tell me if it actually helps?"*

**Channel-specific openers** (same question, adjusted tone):
- LinkedIn DM: add one line of context — "Saw you run ecom for a wholesale brand —"
- Facebook group post: ask it openly to the group, no link.
- Telegram/WhatsApp: ask an admin directly, in their language if possible.

---

## 3. The "I don't want to waste the code" problem

The MarginSync codebase is **not wasted** even if the "manual-CSV wholesaler on Shopify"
angle dies. The core engine — file parsing, fuzzy column detection, SKU matching, a
margin-safe pricing pass, and an audited write-back — is platform-agnostic plumbing.
Adjacent repositionings that reuse most of it:

| Reposition | Who it's for | What changes |
|---|---|---|
| General supplier price-sync | Any retailer with multiple supplier price lists | Generalise the "supplier → my catalog" mapping beyond Shopify |
| Wholesale inventory management | Wholesalers managing stock + price together | Add quantity/stock columns alongside cost |
| Tokopedia / Shopee price sync | Indonesian / SE Asia marketplace sellers | Swap the Shopify write-back adapter for marketplace APIs |

The point: **don't pre-commit to a pivot.** New ideas come from the conversations in §1–2,
not from speculating here. Talk to 20 people first; the strongest repositioning will name
itself.

---

## 4. Next actions

- [ ] Pick **one** channel from §1 to start (recommend: LinkedIn search + 1–2 agency intros).
- [ ] Send the §2 question to 20 people this week. Track replies in a simple sheet.
- [ ] Log every reply verbatim — exact words are the raw material for positioning.
- [ ] After 10 conversations, review: is the pain real, urgent, and Shopify-specific?

---

## Sources / starting points

- [How To Find Wholesale Suppliers — Shopify](https://www.shopify.com/blog/wholesale-suppliers)
- [Shopify Wholesale Guide (B2B setup)](https://wholesalehelper.io/blog/shopify-wholesale/)
- [Best Shopify Agencies for Wholesale B2B Portals — The Genie Lab](https://www.thegenielab.com/blogs/articles/best-shopify-agencies-for-wholesale-b2b-portals-revealed)
- [Charle Agency — Shopify B2B/Wholesale](https://www.charleagency.com/services/shopify-b2b-wholesale/)
- [Eastside Co — Shopify B2B development](https://eastsideco.com/shopify-b2b-development)
- [SparkLayer — Shopify B2B partners](https://www.sparklayer.io/partners-shopify/)
- [Indonesian supplier/reseller Telegram group directory](https://www.masbejo.com/kumpulan-grup-telegram-untuk-reseller-dan-dropshipper/)
</content>
</invoke>
