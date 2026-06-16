#!/usr/bin/env node
/**
 * MarginSync Outreach Bot
 *
 * Runs fully autonomously — no Claude Code required.
 * Mines 1- and 2-star reviews from the Shopify App Store, discovers each
 * store's website via search, finds contact emails, validates them, and
 * sends high-quality personalised outreach. Loops every 6 hours, 24/7.
 *
 * SETUP (one time only):
 *   1. npm install nodemailer instagram-private-api   — already done
 *   2. myaccount.google.com/apppasswords → create App Password → copy code
 *   3. Open run.bat and paste the code where indicated
 *   4. Double-click run.bat — it loops forever. Schedule it with Task
 *      Scheduler (trigger: "At log on") so it survives reboots.
 *
 * FLAGS:
 *   --once       run a single pass then exit
 *   --mine-only  mine reviews and print what was found; send nothing
 *
 * ADD STORES MANUALLY (optional):
 *   Edit queue.json and add an entry with status "pending":
 *   { "name": "Store Name", "email": "hello@store.com",
 *     "sourceApp": "App Name", "country": "US",
 *     "painPoint": "brief note on their complaint", "status": "pending" }
 */

'use strict';

const nodemailer = require('nodemailer');
const { ImapFlow } = require('imapflow');
const https      = require('https');
const http       = require('http');
const net        = require('net');
const dns        = require('dns').promises;
const fs         = require('fs');
const path       = require('path');
const { runInstagramPass, findHandleInHtml } = require('./instagram');
const i18n = require('./i18n');

// ── Configuration ─────────────────────────────────────────────────────────────

const GMAIL_USER     = process.env.GMAIL_USER || 'zenlesszonezeroadict@gmail.com';
const GMAIL_PASSWORD = process.env.GMAIL_APP_PASSWORD;
const QUEUE_FILE     = path.join(__dirname, 'queue.json');
const SENT_FILE      = path.join(__dirname, 'sent.json');
const SKIPPED_FILE   = path.join(__dirname, 'skipped.json');
const OPTOUT_FILE    = path.join(__dirname, 'optout.json');      // suppression list — never email these
const DAILY_FILE     = path.join(__dirname, 'daily-state.json'); // per-day send counter

const FETCH_DELAY_MS        = 3_000;  // 3 s between page lookups
const LOOP_INTERVAL_MINUTES = 15;     // re-scan for new reviews this often (near-constant)
const MAX_EMAILS_PER_RUN    = 15;     // protects the Gmail account from spam flags
const MAX_EMAILS_PER_DAY    = 40;     // hard daily ceiling (well under Gmail's 100–500 limit, protects sender reputation)
const MAX_REVIEW_AGE_MONTHS = 36;     // ignore reviews older than this
const MAX_SEND_RETRIES      = 2;      // re-attempt failed sends on later runs
const LOCK_PORT             = 49321;  // single-instance guard

// Randomised delay between sends so the pattern looks human (90–180 s)
function sendDelayMs() { return 90_000 + Math.floor(Math.random() * 90_000); }

const BETA_FORM_URL   = 'https://docs.google.com/forms/d/1vJNJcFMkTVeIvewsNI63bp466745sFsGbRh524JtzVo/viewform';
const APP_URL         = 'https://marginsync-wheat.vercel.app';
const FOLLOW_UP_HOURS = 48;  // send follow-up this many hours after initial email if no reply
const FORM_SEEN_FILE  = path.join(__dirname, 'form-seen.json');  // tracks form respondents already emailed

// Apps to mine automatically (slugs from apps.shopify.com/SLUG)
const APPS_TO_MINE = [
  // Original 5
  { slug: 'easify-inventory-sync',       name: 'Easify Inventory Sync' },
  { slug: 'stock-sync',                  name: 'Stock Sync' },
  { slug: 'trunk-bundling',              name: 'Trunk' },
  { slug: 'syncio',                      name: 'Syncio' },
  { slug: 'lit-inventory-sync',          name: 'Lit Stock Sync' },
  // Inventory & price sync competitors
  { slug: 'skuiq',                       name: 'SKU IQ' },
  { slug: 'inventory-planner',           name: 'Inventory Planner' },
  { slug: 'stocky',                      name: 'Stocky' },
  { slug: 'sku-vault',                   name: 'SKU Vault' },
  { slug: 'multiorders',                 name: 'Multiorders' },
  { slug: 'veeqo',                       name: 'Veeqo' },
  { slug: 'shopventory',                 name: 'Shopventory' },
  { slug: 'linnworks-for-shopify',       name: 'Linnworks' },
  { slug: 'bright-pearl',                name: 'Brightpearl' },
  { slug: 'unleashed-software',          name: 'Unleashed' },
  // Feed / product sync apps
  { slug: 'data-feed-watch',             name: 'DataFeedWatch' },
  { slug: 'shopping-feeder',             name: 'Shopping Feeder' },
  { slug: 'simprosys-google-shopping-feed', name: 'Simprosys Feed' },
  // Order management / fulfilment (also sync unhappy users)
  { slug: 'shipbob',                     name: 'ShipBob' },
  { slug: 'shipstation',                 name: 'ShipStation' },
  { slug: 'easyship',                    name: 'Easyship' },
  // CSV / bulk import apps — their unhappy users are exactly the manual-CSV crowd
  { slug: 'excelify',                    name: 'Matrixify' },
  { slug: 'ez-importer',                 name: 'EZ Importer' },
  { slug: 'csv-importer',                name: 'CSV Importer' },
  // B2B / wholesale apps — merchants with real supplier price lists
  { slug: 'b2b-wholesale-solution',      name: 'BSS B2B Wholesale' },
  { slug: 'wholesale-pricing-discount-b2b', name: 'Wholesale Pricing Discount' },
  { slug: 'wholesale-gorilla',           name: 'Wholesale Gorilla' },
  { slug: 'wholesale-club',              name: 'Wholesale Club' },
  { slug: 'sparklayer-b2b-wholesale',    name: 'SparkLayer' },
];

// Mine 1-, 2-, and 3-star reviews — all represent friction with the current tool
const RATINGS_TO_MINE = [1, 2, 3];

// ── Utilities ─────────────────────────────────────────────────────────────────

const sleep = ms => new Promise(r => setTimeout(r, ms));

function log(msg) {
  const ts = new Date().toLocaleTimeString('en-GB', { hour12: false });
  console.log(`[${ts}] ${msg}`);
}

// Defense-in-depth: a stray error in a library (or a rejected promise we
// forgot to await) must never take down a 24/7 bot. Log and keep running.
process.on('uncaughtException',  err => log(`[uncaughtException] ${err && err.stack || err}`));
process.on('unhandledRejection', err => log(`[unhandledRejection] ${err && err.stack || err}`));

function loadJSON(file, fallback = []) {
  try { return JSON.parse(fs.readFileSync(file, 'utf8')); }
  catch { return fallback; }
}

function saveJSON(file, data) {
  fs.writeFileSync(file, JSON.stringify(data, null, 2));
}

function slugify(name) {
  return name.toLowerCase().replace(/[^a-z0-9]+/g, '');
}

// ── Daily send governor ───────────────────────────────────────────────────────
// Gmail will flag an account that suddenly sends hundreds of cold emails. We cap
// NEW outreach at MAX_EMAILS_PER_DAY across all runs in a calendar day. Replies to
// real humans are never capped — responding is the lowest-risk, highest-value send.

function todayStr() { return new Date().toISOString().slice(0, 10); }  // YYYY-MM-DD

function getDailySent() {
  const s = loadJSON(DAILY_FILE, { date: todayStr(), sent: 0 });
  if (s.date !== todayStr()) return 0;  // new day → counter resets
  return s.sent || 0;
}

function incDailySent(n = 1) {
  const today = todayStr();
  const s = loadJSON(DAILY_FILE, { date: today, sent: 0 });
  const base = s.date === today ? (s.sent || 0) : 0;
  saveJSON(DAILY_FILE, { date: today, sent: base + n });
}

// ── Suppression list (opt-outs) ───────────────────────────────────────────────
// Anyone who replies STOP / unsubscribe / "remove me" is added here and never
// contacted again — legally required (CAN-SPAM/GDPR) and protects deliverability.

function loadSuppressed() {
  const arr = loadJSON(OPTOUT_FILE, []);
  return new Set(arr.map(e => (e.email || e).toLowerCase()));
}

function addSuppressed(email, name, reason) {
  if (!email) return;
  const arr = loadJSON(OPTOUT_FILE, []);
  if (arr.some(e => (e.email || '').toLowerCase() === email.toLowerCase())) return;
  arr.push({ email: email.toLowerCase(), name: name || '', reason: reason || 'optout', date: new Date().toISOString() });
  saveJSON(OPTOUT_FILE, arr);
}

function decodeEntities(s) {
  return (s || '')
    .replace(/&amp;/g, '&')
    .replace(/&#39;/g, "'").replace(/&#x27;/g, "'").replace(/&rsquo;/g, "'")
    .replace(/&quot;/g, '"').replace(/&ldquo;/g, '"').replace(/&rdquo;/g, '"')
    .replace(/&lt;/g, '<').replace(/&gt;/g, '>')
    .replace(/&nbsp;/g, ' ').replace(/&hellip;/g, '...');
}

// Single-instance lock: if another copy of the bot is already running,
// this listen() fails and we exit instead of double-sending.
function acquireLock() {
  return new Promise(resolve => {
    const srv = net.createServer();
    srv.once('error', () => resolve(false));
    srv.listen(LOCK_PORT, '127.0.0.1', () => {
      srv.unref(); // don't let the lock keep the process alive after main() finishes
      resolve(true);
    });
  });
}

// ── HTTP fetch ────────────────────────────────────────────────────────────────

const BROWSER_UA = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0.0.0 Safari/537.36';

function fetchUrl(rawUrl, redirects = 0) {
  return new Promise(resolve => {
    if (redirects > 5) return resolve('');
    let u;
    try { u = new URL(rawUrl); } catch { return resolve(''); }

    const lib = u.protocol === 'https:' ? https : http;

    // Some servers (e.g. certain Shopify storefronts behind strict WAFs) accept
    // the TCP/TLS connection and then close it WITHOUT ever emitting 'end',
    // 'error', or the socket-'timeout' event. The original code listened only
    // for those, so the promise never settled and — because no timer or live
    // socket remained — Node's event loop drained and the whole process exited
    // cleanly mid-run. The hard-guard timer below always settles the promise
    // AND keeps the loop alive while a fetch is pending, and the 'close'
    // handler catches the silent-close case directly. Either makes a single
    // bad URL survivable instead of fatal.
    let settled = false;
    const finish = v => {
      if (settled) return;
      settled = true;
      clearTimeout(guard);
      try { req.destroy(); } catch { /* ignore */ }
      resolve(v);
    };
    const guard = setTimeout(() => finish(''), 14000);

    const req = lib.request(
      { hostname: u.hostname, path: u.pathname + u.search, method: 'GET',
        timeout: 12000,
        headers: {
          'User-Agent': BROWSER_UA,
          'Accept': 'text/html,application/xhtml+xml,*/*',
          'Accept-Language': 'en-US,en;q=0.9',
        } },
      res => {
        if ([301, 302, 307, 308].includes(res.statusCode) && res.headers.location) {
          let next = res.headers.location;
          if (!next.startsWith('http')) next = `${u.protocol}//${u.hostname}${next}`;
          if (settled) return;
          settled = true;
          clearTimeout(guard);
          return resolve(fetchUrl(next, redirects + 1));
        }
        let body = '';
        res.setEncoding('utf8');
        res.on('data', c => { body += c; if (body.length > 600_000) res.destroy(); });
        res.on('end',  () => finish(body));
        res.on('error',() => finish(''));
      }
    );
    req.on('error',   () => finish(''));
    req.on('timeout', () => finish(''));
    req.on('close',   () => finish(''));  // socket closed with no other event
    req.end();
  });
}

// ── Type B store filter ───────────────────────────────────────────────────────
//
// Type A = dropshippers (Oberlo/Printful/etc.) — not our market.
// Type B = merchants with real supplier relationships and CSV price lists.
// We score signals found in HTML we already fetch — no extra requests.

const TYPE_A_SIGNALS = [
  'oberlo', 'spocket', 'dsers', 'printful', 'printify', 'modalyst',
  'zendrop', 'cjdropshipping', 'automizely', 'dropship', 'drop ship',
  'aliexpress', 'print on demand', 'print-on-demand',
];

const SUPPLIER_SIGNALS = [
  'supplier', 'suppliers', 'wholesale', 'wholesaler', 'distributor',
  'manufacturer', 'brand partner', 'authorised dealer', 'authorized dealer',
  'stockist', 'importer', 'direct from', 'official retailer',
  // Wholesale storefront tells — these pages/links signal real supplier buying
  'trade account', 'trade enquiries', 'trade enquiry', 'reseller', 'b2b',
  'bulk order', 'minimum order', 'price list', 'wholesale enquiries',
];

const LONG_SHIP_RE = /(?:ships?|deliver(?:y|ies)?)[^.]{0,40}(?:1[4-9]|[2-9]\d)\s*(?:business\s*)?days?/i;

function scoreTypeBHtml(htmlChunks) {
  const combined = htmlChunks.join(' ').toLowerCase();
  let score = 0;

  // Hard disqualifier — clear dropshipping signals
  for (const signal of TYPE_A_SIGNALS) {
    if (combined.includes(signal)) return -99;
  }

  // +2 supplier mentions in about/contact page text
  const supplierMatches = SUPPLIER_SIGNALS.filter(s => combined.includes(s));
  if (supplierMatches.length >= 2) score += 2;
  else if (supplierMatches.length === 1) score += 1;

  // +2 long shipping times mentioned (14+ days = holding real stock)
  if (LONG_SHIP_RE.test(combined)) score += 2;

  // +1 multiple currency / region references (sign of a real brand)
  if ((combined.match(/\b(?:gbp|eur|aud|cad|usd)\b/g) || []).length >= 2) score += 1;

  return score;
}

// ── Email finder ──────────────────────────────────────────────────────────────

function extractEmails(html) {
  const via = [...html.matchAll(/href="mailto:([^"?\s]{4,}@[^"?\s]+)"/gi)].map(m => m[1]);
  const raw = [...html.matchAll(/\b([a-zA-Z0-9._%+\-]{2,}@[a-zA-Z0-9.\-]+\.[a-zA-Z]{2,})\b/g)].map(m => m[1]);
  return [...new Set([...via, ...raw])].filter(e =>
    !/(example\.|sentry\.|wix\.|shopify\.com|\.png$|\.jpg$|\.gif$|\.webp$|noreply|no-reply|godaddy|domain|@[0-9]|sentry|cloudfront)/i.test(e)
  );
}

// Verify the email's domain can actually receive mail (kills bounces)
async function emailDomainHasMx(email) {
  const domain = (email.split('@')[1] || '').trim();
  if (!domain) return false;
  try {
    const records = await dns.resolveMx(domain);
    return records.length > 0;
  } catch {
    return false;
  }
}

function extractProductHint(html) {
  const meta = html.match(/<meta[^>]+(?:name="description"|property="og:description")[^>]+content="([^"]{10,160})"/i)
    || html.match(/content="([^"]{10,160})"[^>]+(?:name="description"|property="og:description")/i);
  if (!meta) return '';
  const desc = meta[1].toLowerCase();
  const categories = [
    'clothing', 'apparel', 'fashion', 'accessories', 'jewellery', 'jewelry',
    'electronics', 'gadgets', 'beauty', 'skincare', 'health', 'fitness',
    'furniture', 'home', 'decor', 'toys', 'kids', 'pet', 'food', 'supplements',
    'art', 'prints', 'books', 'sports', 'outdoor', 'tools', 'automotive',
  ];
  for (const cat of categories) {
    if (desc.includes(cat)) return cat;
  }
  return 'products';
}

// ── Store website discovery via DuckDuckGo ────────────────────────────────────
//
// Domain guessing (storename.com) misses most stores. DuckDuckGo's HTML
// endpoint is server-rendered, so a plain fetch gets real search results.
// We verify the candidate site actually mentions the store name before
// trusting it — this prevents emailing the wrong business.

const SEARCH_BLOCKLIST = /facebook|instagram|twitter|x\.com|pinterest|linkedin|youtube|amazon|ebay|etsy|yelp|tripadvisor|trustpilot|apps\.shopify|reddit|wikipedia|tiktok|alibaba|aliexpress|walmart|duckduckgo/i;

async function searchStoreWebsite(name) {
  const q = encodeURIComponent(`"${name}" online store`);
  const html = await fetchUrl(`https://html.duckduckgo.com/html/?q=${q}`);
  await sleep(FETCH_DELAY_MS);
  if (!html) return null;

  const hrefs = [...html.matchAll(/result__a"[^>]*href="([^"]+)"/g)].map(m => m[1]);
  const candidates = [];
  for (let href of hrefs.slice(0, 8)) {
    const uddg = href.match(/[?&]uddg=([^&]+)/);
    if (uddg) { try { href = decodeURIComponent(uddg[1]); } catch { continue; } }
    if (!href.startsWith('http')) href = 'https:' + href;
    try {
      const u = new URL(href);
      if (!SEARCH_BLOCKLIST.test(u.hostname)) candidates.push(u.hostname);
    } catch { /* skip bad URLs */ }
  }

  // Verify: the site homepage must mention the store name
  const tokens = name.toLowerCase().split(/\s+/).filter(w => w.length >= 4);
  const needles = tokens.length ? tokens : [name.toLowerCase()];

  for (const domain of [...new Set(candidates)].slice(0, 3)) {
    const page = await fetchUrl(`https://${domain}/`);
    await sleep(FETCH_DELAY_MS);
    if (!page) continue;
    const lower = page.toLowerCase();
    if (needles.some(t => lower.includes(t))) {
      log(`  Search found verified site: ${domain}`);
      return domain;
    }
  }
  return null;
}

// ── Contact info finder ───────────────────────────────────────────────────────

async function findContactInfo(store) {
  const result = { email: store.email || null, instagram: store.instagramHandle || null, productHint: store.productHint || '', typeBScore: 0 };
  if (result.email && result.instagram) return result;
  const htmlChunks = [];

  const slug = slugify(store.name);
  let domains;
  if (store.domain) {
    domains = [store.domain];
  } else {
    domains = [];
    // Strategy 1: real search — far more accurate than guessing
    const searched = await searchStoreWebsite(store.name);
    if (searched) domains.push(searched);
    // Strategy 2: domain guesses as fallback
    domains.push(`${slug}.com`, `${slug}.myshopify.com`, `${slug}.co`, `${slug}.ca`, `${slug}.co.uk`, `${slug}.com.au`, `${slug}.de`);
  }

  const pages = [
    '/pages/contact',
    '/pages/contact-us',
    '/policies/contact-information',
    '/pages/about',
    '/pages/about-us',
    '/pages/impressum',
    '/',
  ];

  for (const domain of domains) {
    for (const page of pages) {
      const url = `https://${domain}${page}`;
      log(`  Checking ${url}`);
      const html = await fetchUrl(url);
      await sleep(FETCH_DELAY_MS);
      if (!html || html.includes('DNS_PROBE') || html.includes("can't be reached")) continue;

      htmlChunks.push(html.slice(0, 8000));  // keep a chunk for Type B scoring

      if (!result.email) {
        const emails = extractEmails(html);
        if (emails.length) result.email = emails[0];
      }

      if (!result.instagram) {
        result.instagram = findHandleInHtml(html);
      }

      if (!result.productHint) {
        result.productHint = extractProductHint(html);
      }

      // Stop early if we have everything
      if (result.email && result.instagram) break;
    }
    // If we found an email on this domain, don't keep guessing other domains
    if (result.email) break;
  }

  result.typeBScore = scoreTypeBHtml(htmlChunks);
  return result;
}

// Keep backward-compatible alias
async function findEmail(store) {
  const info = await findContactInfo(store);
  if (info.instagram)   store.instagramHandle = info.instagram;
  if (info.productHint) store.productHint     = info.productHint;
  return info.email;
}

// ── Review miner ──────────────────────────────────────────────────────────────
//
// Parser matched to the App Store markup as of June 2026:
//   store name : <div class="tw-text-heading-xs ..."><span ... title="NAME">
//   review text: <div data-truncate-content-copy ...><p class="tw-break-words">
//   country    : <div>United States</div>           (right after the name)
//   usage      : <div>5 months using the app</div>  (right after the country)
//   date       : "February 12, 2026" plain text before the review body
// Developer replies are also data-truncate-content-copy blocks but are
// preceded by an "<Developer> replied <date>" header, which we use to skip them.

const MONTHS_RE = '(?:January|February|March|April|May|June|July|August|September|October|November|December)';

function parseReviewPage(html, app) {
  const out = [];
  const nameRe = /tw-text-heading-xs[^"]*"[^>]*>\s*<span[^>]*title="([^"]{1,80})"/g;
  const matches = [...html.matchAll(nameRe)];

  let prevEnd = 0;
  for (const m of matches) {
    const name = decodeEntities(m[1]).trim();
    const nameIdx = m.index;
    const segment = html.slice(prevEnd, nameIdx);
    prevEnd = nameIdx;

    if (!name || name.length < 2) continue;

    // Review text: last content block in the segment that is NOT a developer reply
    let reviewText = '';
    const blocks = [...segment.matchAll(/data-truncate-content-copy[^>]*>([\s\S]*?)<\/div>/g)];
    if (blocks.length) {
      const last = blocks[blocks.length - 1];
      const headerZone = segment.slice(Math.max(0, last.index - 400), last.index);
      if (!/ replied /i.test(headerZone)) {
        reviewText = decodeEntities(last[1].replace(/<[^>]+>/g, ' ')).replace(/\s+/g, ' ').trim().slice(0, 300);
      }
    }

    // Review date: last "Month D, YYYY" before the store name
    const dateMatches = segment.match(new RegExp(`${MONTHS_RE}\\s+\\d{1,2},\\s+\\d{4}`, 'g'));
    const reviewDate = dateMatches ? dateMatches[dateMatches.length - 1] : '';

    // Country and usage duration directly after the name
    const after = html.slice(nameIdx, nameIdx + 1500);
    const countryMatch  = after.match(/<div>([^<>]{2,40})<\/div>/);
    const durationMatch = after.match(/<div>([^<>]{2,60}) using the app<\/div>/);

    out.push({
      name,
      country   : countryMatch ? decodeEntities(countryMatch[1]).trim() : '',
      usage     : durationMatch ? durationMatch[1].trim() : '',
      reviewDate,
      reviewText,
      sourceApp : app.name,
      status    : 'pending',
    });
  }
  return out;
}

function reviewTooOld(reviewDate) {
  if (!reviewDate) return false; // unknown date — keep it
  const d = new Date(reviewDate);
  if (isNaN(d.getTime())) return false;
  const ageMonths = (Date.now() - d.getTime()) / (30.44 * 24 * 3600 * 1000);
  return ageMonths > MAX_REVIEW_AGE_MONTHS;
}

async function mineReviews(app) {
  const found = [];
  log(`Mining reviews: ${app.name} (${app.slug})`);

  for (const rating of RATINGS_TO_MINE) {
    for (let page = 1; page <= 4; page++) {
      const url = `https://apps.shopify.com/${app.slug}/reviews?ratings%5B%5D=${rating}&page=${page}`;
      const html = await fetchUrl(url);
      await sleep(FETCH_DELAY_MS);
      if (!html) break;

      const reviews = parseReviewPage(html, app);
      if (reviews.length === 0) break; // ran out of pages for this rating

      for (const r of reviews) {
        if (reviewTooOld(r.reviewDate)) continue;
        found.push(r);
      }
    }
  }

  // Deduplicate by store name
  const unique = [];
  const seen = new Set();
  for (const s of found) {
    const key = s.name.toLowerCase();
    if (!seen.has(key)) { seen.add(key); unique.push(s); }
  }

  log(`  Found ${unique.length} unique reviewer stores`);
  return unique;
}

// ── Email templates ───────────────────────────────────────────────────────────

function buildSubject(store) {
  // Short, no spam triggers, references their specific app — localised to the
  // language inferred from the reviewer's country.
  return i18n.forCountry(store.country).subject(store.sourceApp);
}

// Pull a short, clean quote from their review to prove this is a real, read message.
function reviewQuote(store) {
  let q = (store.reviewText || store.painPoint || '').replace(/\s+/g, ' ').trim();
  if (!q) return '';
  // Trim to the first sentence-ish, max ~90 chars, no trailing fragments.
  if (q.length > 90) q = q.slice(0, 90).replace(/\s+\S*$/, '') + '…';
  return q;
}

function buildBody(store) {
  // Conversation-first: one personal line about THEIR review, then a single
  // question — no pitch, no link in the first touch. Fully localised to the
  // language inferred from the reviewer's country (English fallback). The link
  // and the pitch only go out once they reply (see checkRepliesAndFollowUp).
  // No spam-trigger words ("free", "guarantee", "no credit card") in this first
  // email — they hurt deliverability.
  return i18n.forCountry(store.country).coldEmail({
    app:   store.sourceApp,
    quote: reviewQuote(store),
  });
}

// ── Email sender ──────────────────────────────────────────────────────────────

function createTransporter() {
  if (!GMAIL_PASSWORD) {
    console.error('\nERROR: GMAIL_APP_PASSWORD is not set.');
    console.error('Open run.bat and add your Gmail App Password.');
    console.error('Get one at: myaccount.google.com/apppasswords\n');
    process.exit(1);
  }
  // Gmail's default SMTPS port (465) is blocked by many ISPs — notably most
  // Indonesian residential providers. Port 587 with STARTTLS is open, so we
  // pin it explicitly instead of using service:'gmail' (which defaults to 465).
  return nodemailer.createTransport({
    host: 'smtp.gmail.com',
    port: 587,
    secure: false,            // upgrade to TLS via STARTTLS after connecting
    requireTLS: true,
    auth: { user: GMAIL_USER, pass: GMAIL_PASSWORD },
    connectionTimeout: 15_000,
    greetingTimeout: 10_000,
  });
}

async function sendEmail(transporter, to, subject, body, opts = {}) {
  const headers = {};
  // List-Unsubscribe is a top deliverability signal — Gmail/Outlook reward it and
  // it gives recipients a one-click opt-out instead of hitting "report spam".
  if (opts.unsubscribe !== false) {
    // mailto-based unsubscribe — recipient's "unsubscribe" click emails us, which
    // the reply checker detects and suppresses. (One-Click POST needs an HTTPS
    // endpoint we don't run, so we deliberately omit List-Unsubscribe-Post.)
    headers['List-Unsubscribe'] = `<mailto:${GMAIL_USER}?subject=unsubscribe>`;
  }
  const info = await transporter.sendMail({
    from: `Hughez — MarginSync <${GMAIL_USER}>`,
    to,
    subject,
    text: body,
    headers,
  });
  return info.messageId || null;
}

// ── Reply intelligence ────────────────────────────────────────────────────────

// Crude-but-robust raw RFC822 → visible text (no extra deps). Grabs the
// text/plain part if present, decodes quoted-printable, strips HTML.
function rawToText(raw) {
  let s = raw.toString('utf8');
  const tp = s.match(/Content-Type:\s*text\/plain[\s\S]*?\r?\n\r?\n([\s\S]*?)(?:\r?\n--|\r?\n\.\r?\n|$)/i);
  let body = tp ? tp[1] : s.split(/\r?\n\r?\n/).slice(1).join('\n\n');
  if (/Content-Transfer-Encoding:\s*quoted-printable/i.test(s)) {
    body = body.replace(/=\r?\n/g, '').replace(/=([A-Fa-f0-9]{2})/g, (_, h) => String.fromCharCode(parseInt(h, 16)));
  }
  return body.replace(/<[^>]+>/g, ' ');
}

// Keep only the NEW text the person typed — drop the quoted original (which
// contains our own "reply yes / reply STOP" wording and would poison classification).
function topOfReply(text) {
  const idxs = [
    text.search(/^\s*On .+wrote:\s*$/m),
    text.search(/^\s*>/m),
    text.search(/-----\s*Original Message\s*-----/i),
    text.search(/^\s*From:\s.+$/m),
    text.search(/^_{5,}/m),
  ].filter(i => i >= 0);
  const cut = idxs.length ? Math.min(...idxs) : -1;
  return (cut > 0 ? text.slice(0, cut) : text).replace(/\s+/g, ' ').trim();
}

function classifyReply(text) {
  const t = (text || '').toLowerCase();
  if (/^\s*stop\s*$/i.test(text || '') ||
      /\b(unsubscribe|opt[\s-]?out|remove me|take me off|stop emailing|stop contacting|do not (contact|email)|don't (contact|email)|leave me alone|never email)\b/.test(t)) {
    return 'optout';
  }
  if (/\b(not interested|no thanks|no thank you|we'?re good|we are all set|not for us|not right now|already (have|use|using)|we use|no need|pass on this)\b/.test(t)) {
    return 'notinterested';
  }
  if (/\b(yes|yep|interested|sounds good|sure|please send|send me|send it|i'?d like|would like|the link|sign me up|tell me more|how (do|does|much)|let'?s|set ?up|keen|sign up)\b/.test(t)) {
    return 'interested';
  }
  return 'neutral';
}

function isBounceMessage(fromAddr, subject) {
  const from = (fromAddr || '').toLowerCase();
  if (/mailer-daemon|postmaster|mail.delivery|no-?reply@.*(mail|smtp)/i.test(from)) return true;
  return /\b(delivery status notification|undelivered mail|delivery (has )?failed|failure notice|returned mail|mail delivery (failed|subsystem)|could not be delivered|address not found)\b/i.test(subject || '');
}

// Find which of our recipients a bounce refers to (their address is quoted in the body).
function findBouncedRecipient(raw, byEmail) {
  const emails = raw.toString('utf8').match(/[a-zA-Z0-9._%+\-]+@[a-zA-Z0-9.\-]+\.[a-zA-Z]{2,}/g) || [];
  for (const e of emails) {
    const lc = e.toLowerCase();
    if (lc !== GMAIL_USER.toLowerCase() && byEmail.has(lc)) return lc;
  }
  return null;
}

// ── Google Form response checker ──────────────────────────────────────────────
// Google Forms emails the form owner a notification for every submission.
// These come from forms-receipts-noreply@google.com with each answer in the body.
// We scan Gmail for these, extract the respondent's email, and send them an
// onboarding email with the direct app link — no manual checking required.

async function checkFormResponses(transporter) {
  if (!GMAIL_PASSWORD) return;

  const seen    = new Set(loadJSON(FORM_SEEN_FILE, []));
  const suppressed = loadSuppressed();

  try {
    const client = new ImapFlow({
      host:   'imap.gmail.com',
      port:   993,
      secure: true,
      auth:   { user: GMAIL_USER, pass: GMAIL_PASSWORD },
      logger: false,
    });

    await client.connect();
    const lock = await client.getMailboxLock('INBOX');

    try {
      // Search last 30 days for Google Forms notifications
      const since = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
      const uids  = await client.search({ since, from: 'forms-receipts-noreply@google.com' }, { uid: true });
      if (!uids || !uids.length) return;

      // Phase 1: collect UIDs (no source yet — don't open source inside stream)
      const toFetch = [];
      const stream  = client.fetch(uids.join(','), { envelope: true }, { uid: true });
      for await (const msg of stream) {
        if (msg && msg.uid) toFetch.push(msg.uid);
      }

      // Phase 2: fetch source lazily for each notification email
      for (const uid of toFetch) {
        try {
          const full = await client.fetchOne(uid.toString(), { source: true }, { uid: true });
          if (!full || !full.source) continue;

          const text = rawToText(full.source);

          // Extract respondent email — Google Forms puts it as "Email address: foo@bar.com"
          // or just as a line matching an email pattern in the response body.
          const emailMatch = text.match(/(?:email[^:\n]*:[ \t]*)([a-zA-Z0-9._%+\-]+@[a-zA-Z0-9.\-]+\.[a-zA-Z]{2,})/i)
            || text.match(/\b([a-zA-Z0-9._%+\-]+@[a-zA-Z0-9.\-]+\.[a-zA-Z]{2,})\b/);
          const respondentEmail = emailMatch ? emailMatch[1].toLowerCase() : null;

          if (!respondentEmail || respondentEmail === GMAIL_USER.toLowerCase()) continue;
          if (seen.has(respondentEmail)) continue;
          if (suppressed.has(respondentEmail)) continue;

          // Extract their name if there's a "Name" field in the response
          const nameMatch = text.match(/(?:name|your name)[^:\n]*:[ \t]*([^\n]{2,60})/i);
          const respondentName = nameMatch ? nameMatch[1].trim() : 'there';

          // Extract store URL if present
          const storeMatch = text.match(/(?:store|shop|url|website)[^:\n]*:[ \t]*([^\n]{4,100})/i);
          const storeHint  = storeMatch ? ` (${storeMatch[1].trim()})` : '';

          log(`  Form response from ${respondentEmail}${storeHint} — sending onboarding email...`);

          // Form respondents don't carry a country, so this defaults to English.
          // It still routes through forCountry so adding a language field to the
          // form later (pass it here) is all it takes to localise onboarding too.
          const onboardingBody = i18n.forCountry(null).formOnboarding(respondentName, APP_URL);

          try {
            await sendEmail(transporter, respondentEmail,
              'Your MarginSync beta access',
              onboardingBody,
              { unsubscribe: false });
            seen.add(respondentEmail);
            saveJSON(FORM_SEEN_FILE, [...seen]);
            incDailySent(1);
            log(`  Onboarding email sent to ${respondentEmail}.`);
          } catch (err) {
            log(`  Failed to send onboarding to ${respondentEmail}: ${err.message}`);
          }
        } catch { /* skip bad messages */ }
      }
    } finally {
      lock.release();
      await client.logout();
    }
  } catch (err) {
    log(`[FormCheck] ${err.message}`);
  }
}

// ── Reply checker + follow-up sender ─────────────────────────────────────────

async function checkRepliesAndFollowUp(transporter) {
  if (!GMAIL_PASSWORD) return;

  const sent = loadJSON(SENT_FILE, []);
  // Only care about entries that were sent by the bot (have sentAt) and haven't replied yet
  const needsWatch = sent.filter(s => s.sentAt && !s.replied);
  if (!needsWatch.length) return;

  // Build lookup: lowercase sender email → sent entry index
  const byEmail = new Map();
  needsWatch.forEach((s, i) => {
    if (s.email) byEmail.set(s.email.toLowerCase(), i);
  });

  // Also build lookup by messageId for precise header matching
  const byMsgId = new Map();
  needsWatch.forEach((s, i) => {
    if (s.messageId) byMsgId.set(s.messageId, i);
  });

  let newReplies = 0;
  let newFollowUps = 0;

  try {
    const client = new ImapFlow({
      host:   'imap.gmail.com',
      port:   993,
      secure: true,
      auth:   { user: GMAIL_USER, pass: GMAIL_PASSWORD },
      logger: false,
    });

    await client.connect();
    const lock = await client.getMailboxLock('INBOX');

    try {
      // Search for messages received in the last 14 days. Streaming fetch pulls
      // all envelopes + headers in ONE pass (one fetchOne per message is far too
      // slow on a busy inbox). Full source is downloaded lazily only for the
      // handful of bounces / real replies below.
      const since = new Date(Date.now() - 14 * 24 * 60 * 60 * 1000);
      const uids = await client.search({ since }, { uid: true });

      const range = (uids && uids.length) ? uids.join(',') : null;
      const stream = range
        ? client.fetch(range, { envelope: true, headers: ['in-reply-to', 'references', 'auto-submitted', 'x-autoreply', 'x-autorespond', 'x-auto-response-suppress'] }, { uid: true })
        : [];

      // ── Phase 1: collect lightweight envelope data (drain the stream first) ──
      // We must NOT issue another fetch (getSource) while this stream is open on
      // the same connection, so we only gather metadata here and process after.
      const candidates = [];
      for await (const msg of stream) {
        if (!msg || !msg.envelope) continue;
        const headersStr = msg.headers ? msg.headers.toString() : '';
        candidates.push({
          uid:        msg.uid,
          fromAddr:   (msg.envelope.from?.[0]?.address || '').toLowerCase(),
          subjectRaw: msg.envelope.subject || '',
          headersStr,
        });
      }

      // ── Phase 2: process. Source is fetched lazily, one message at a time, now
      // that the streaming fetch has fully drained. ──────────────────────────────
      for (const c of candidates) {
        const { uid, fromAddr, subjectRaw, headersStr } = c;
        const inReplyTo  = (headersStr.match(/^in-reply-to:\s*(.+)$/im)?.[1] || '').trim();
        const references = (headersStr.match(/^references:\s*([\s\S]*?)(?=\n\S|\n\n|$)/im)?.[1] || '').replace(/\s+/g, ' ').trim();

        const getSource = async () => {
          try {
            const full = await client.fetchOne(uid.toString(), { source: true }, { uid: true });
            return full && full.source ? full.source : Buffer.alloc(0);
          } catch { return Buffer.alloc(0); }
        };

        // ── Bounce detection ──────────────────────────────────────────────────
        // A bounce means the address is dead. Mark it bad, suppress it, and do
        // NOT treat it as a reply — repeated bounces wreck sender reputation.
        if (isBounceMessage(fromAddr, subjectRaw)) {
          const bounced = findBouncedRecipient(await getSource(), byEmail);
          if (bounced) {
            const idx = sent.findIndex(s => (s.email || '').toLowerCase() === bounced);
            if (idx !== -1 && !sent[idx].bounced) {
              sent[idx].bounced = true;
              sent[idx].replied = true;  // stop follow-ups
              saveJSON(SENT_FILE, sent);
              addSuppressed(bounced, sent[idx].name, 'bounced');
              log(`  Bounce detected for ${bounced} — marked dead, will not retry.`);
            }
          }
          continue;
        }

        // ── Auto-reply detection ──────────────────────────────────────────────
        const autoSubmitted = (headersStr.match(/^auto-submitted:\s*(.+)$/im)?.[1] || '').trim().toLowerCase();
        const hasAutoHeader = autoSubmitted && autoSubmitted !== 'no'
          || /^x-autoreply:/im.test(headersStr)
          || /^x-autorespond:/im.test(headersStr);
        const isAutoSubject = /\b(out of office|auto.?reply|automatic.?reply|autoreply|vacation|away from|on leave|noreply|no.reply)\b/i.test(subjectRaw.toLowerCase());
        if (hasAutoHeader || isAutoSubject) continue;

        // Match by In-Reply-To / References header (precise) or by sender address (fuzzy)
        let matchIdx = -1;
        if (inReplyTo && byMsgId.has(inReplyTo)) {
          matchIdx = byMsgId.get(inReplyTo);
        } else {
          // Check if any message-id in References matches
          for (const ref of references.split(/\s+/)) {
            if (ref && byMsgId.has(ref)) { matchIdx = byMsgId.get(ref); break; }
          }
        }
        if (matchIdx === -1 && byEmail.has(fromAddr)) {
          matchIdx = byEmail.get(fromAddr);
        }
        if (matchIdx === -1) continue;

        const entry = needsWatch[matchIdx];
        const realIdx = sent.indexOf(entry);
        if (realIdx === -1 || sent[realIdx].replied) continue;

        // ── Classify what they actually said ──────────────────────────────────
        // Include the subject so a Gmail "unsubscribe" click (subject: unsubscribe,
        // empty body) is correctly caught as an opt-out.
        const replyText = topOfReply(rawToText(await getSource()));
        const intent    = classifyReply(`${subjectRaw} ${replyText}`);

        sent[realIdx].replied   = true;
        sent[realIdx].repliedAt = new Date().toISOString();
        sent[realIdx].intent    = intent;
        saveJSON(SENT_FILE, sent);
        newReplies++;

        const replySubject = subjectRaw.startsWith('Re:') ? subjectRaw : `Re: ${subjectRaw || entry.subject}`;

        // Localise every reply to the language we inferred from their country.
        const lang = i18n.forCountry(entry.country);

        // ── Opt-out: honor immediately, never contact again ───────────────────
        if (intent === 'optout') {
          addSuppressed(entry.email, entry.name, 'reply_optout');
          log(`  ${entry.email} asked to opt out — suppressed, no further contact.`);
          try {
            await sendEmail(transporter, entry.email,
              replySubject,
              lang.optoutAck(),
              { unsubscribe: false });
            incDailySent(1);
          } catch { /* non-fatal */ }
          continue;
        }

        // ── Not interested: thank them, suppress, no pitch ────────────────────
        if (intent === 'notinterested') {
          addSuppressed(entry.email, entry.name, 'not_interested');
          log(`  ${entry.email} not interested — thanked, no link sent.`);
          try {
            await sendEmail(transporter, entry.email,
              replySubject,
              lang.notInterestedAck(),
              { unsubscribe: false });
            incDailySent(1);
          } catch { /* non-fatal */ }
          continue;
        }

        // ── Interested / neutral: send the direct app link ────────────────────
        log(`  Reply from ${entry.email} (${entry.name}) [${intent}] — sending app link...`);
        const replyBody = lang.replyLink(APP_URL);

        try {
          await sendEmail(transporter, entry.email, replySubject, replyBody, { unsubscribe: false });
          incDailySent(1);
          log(`  App link sent to ${entry.email}.`);
        } catch (err) {
          log(`  Failed to send app link to ${entry.email}: ${err.message}`);
        }
      }
    } finally {
      lock.release();
      await client.logout();
    }
  } catch (err) {
    log(`[IMAP] ${err.message}`);
  }

  // ── Follow-up pass: send form link to non-responders after FOLLOW_UP_HOURS ──
  const freshSent  = loadJSON(SENT_FILE, []);
  const suppressed = loadSuppressed();
  const cutoff     = Date.now() - FOLLOW_UP_HOURS * 60 * 60 * 1000;
  const tooOld     = Date.now() - 7 * 24 * 60 * 60 * 1000;  // don't follow up after 7 days

  for (let i = 0; i < freshSent.length; i++) {
    const s = freshSent[i];
    if (!s.sentAt || s.replied || s.followUpSentAt || s.bounced) continue;
    if (!s.messageId) continue;                                       // skip manually-seeded entries
    if (s.email && suppressed.has(s.email.toLowerCase())) continue;   // opted out — never follow up
    const sentTime = new Date(s.sentAt).getTime();
    if (sentTime > cutoff) continue;   // too soon
    if (sentTime < tooOld) continue;   // too old — they're not interested

    const followUpBody = i18n.forCountry(s.country).followUp();

    try {
      await sendEmail(transporter, s.email, `Re: ${s.subject}`, followUpBody);
      freshSent[i].followUpSentAt = new Date().toISOString();
      saveJSON(SENT_FILE, freshSent);
      incDailySent(1);
      newFollowUps++;
      log(`  Follow-up sent to ${s.email} (${s.name}).`);
      await sleep(sendDelayMs());
    } catch (err) {
      log(`  Follow-up failed for ${s.email}: ${err.message}`);
    }
  }

  if (newReplies || newFollowUps) {
    log(`Reply check: ${newReplies} new repl${newReplies === 1 ? 'y' : 'ies'} handled, ${newFollowUps} follow-up${newFollowUps === 1 ? '' : 's'} sent.`);
  }
}

// ── Core loop ─────────────────────────────────────────────────────────────────

async function runOnce(mineOnly) {
  const transporter = mineOnly ? null : createTransporter();
  try {
    // Check inbox for replies, form signups, and send follow-ups
    if (!mineOnly) {
      log('Checking inbox for replies and pending follow-ups...');
      await checkRepliesAndFollowUp(transporter);
      log('Checking for new Google Form signups...');
      await checkFormResponses(transporter);
    }

    const sent     = loadJSON(SENT_FILE,    []);
    const skipped  = loadJSON(SKIPPED_FILE, []);
    const queue    = loadJSON(QUEUE_FILE,   []);

    const sentEmails    = new Set(sent.map(s => s.email?.toLowerCase()));
    const sentNames     = new Set(sent.map(s => s.name?.toLowerCase()).filter(n => n && !n.startsWith('(')));
    const skippedNames  = new Set(skipped.map(s => s.name?.toLowerCase()));

    // ── Step 1: Mine new reviews and add unseen stores to queue ──────────────
    log('Checking for new 1-, 2-, and 3-star reviews...');
    for (const app of APPS_TO_MINE) {
      const reviews = await mineReviews(app);
      for (const store of reviews) {
        const key = store.name.toLowerCase();
        const alreadyQueued = queue.some(q => q.name.toLowerCase() === key);
        const alreadySent   = sentEmails.has((store.email || '').toLowerCase()) || sentNames.has(key);
        const isSkipped     = skippedNames.has(key);
        if (!alreadyQueued && !alreadySent && !isSkipped) {
          queue.push(store);
          log(`  Added to queue: ${store.name} (${store.country || '?'}) — "${(store.reviewText || '').slice(0, 60)}"`);
        }
      }
      await sleep(FETCH_DELAY_MS * 2);
    }
    saveJSON(QUEUE_FILE, queue);

    // ── Step 2: Process pending stores ────────────────────────────────────────
    const pending = queue.filter(s =>
      s.status === 'pending' ||
      (s.status === 'failed' && (s.retries || 0) < MAX_SEND_RETRIES)
    );
    log(`\nQueue: ${pending.length} pending | ${sent.length} sent all-time`);

    if (mineOnly) {
      log('\n--mine-only: stopping here. Pending stores:');
      for (const s of pending) {
        log(`  ${s.name} | ${s.country || '?'} | ${s.sourceApp} | "${(s.reviewText || '').slice(0, 70)}"`);
      }
      return;
    }

    if (pending.length === 0) {
      log('Nothing to send right now.');
    }

    const suppressed   = loadSuppressed();
    const dailyAlready = getDailySent();
    if (dailyAlready >= MAX_EMAILS_PER_DAY) {
      log(`Daily cap reached (${dailyAlready}/${MAX_EMAILS_PER_DAY} new emails today) — pausing new outreach until tomorrow.`);
    }

    let sessionCount = 0;

    for (let i = 0; i < pending.length; i++) {
      if (sessionCount >= MAX_EMAILS_PER_RUN) {
        log(`\nReached per-run cap of ${MAX_EMAILS_PER_RUN} emails — the rest go out next run.`);
        break;
      }
      if (getDailySent() >= MAX_EMAILS_PER_DAY) {
        log(`\nReached daily cap of ${MAX_EMAILS_PER_DAY} emails — the rest go out tomorrow.`);
        break;
      }

      const store = pending[i];

      // Name-level dedup: catches stores contacted before the bot existed
      if (sentNames.has(store.name.toLowerCase()) || skippedNames.has(store.name.toLowerCase())) {
        store.status = 'skipped_duplicate';
        saveJSON(QUEUE_FILE, queue);
        continue;
      }

      log(`\nProcessing: ${store.name} (${store.country || 'unknown country'})`);

      const contactInfo = await findContactInfo(store);
      if (contactInfo.instagram) store.instagramHandle = contactInfo.instagram;
      if (contactInfo.productHint) store.productHint = contactInfo.productHint;
      const email = store.email || contactInfo.email || null;

      // Skip dropshippers — not our market
      if (contactInfo.typeBScore <= -99) {
        log(`  Dropshipping signals detected — skipping (Type A store)`);
        store.status = 'skipped_type_a';
        skipped.push({ name: store.name, reason: 'type_a_dropshipper', date: new Date().toISOString() });
        saveJSON(SKIPPED_FILE, skipped);
        saveJSON(QUEUE_FILE, queue);
        continue;
      }

      if (!email) {
        log(`  No email found — skipping`);
        store.status = 'skipped_no_email';
        skipped.push({ name: store.name, reason: 'no_email', date: new Date().toISOString() });
        saveJSON(SKIPPED_FILE, skipped);
        saveJSON(QUEUE_FILE, queue);
        continue;
      }

      if (sentEmails.has(email.toLowerCase())) {
        log(`  Already contacted ${email} — skipping`);
        store.status = 'skipped_duplicate';
        saveJSON(QUEUE_FILE, queue);
        continue;
      }

      // Honor the suppression list — opted-out / bounced addresses are never re-contacted
      if (suppressed.has(email.toLowerCase())) {
        log(`  ${email} is on the opt-out list — skipping`);
        store.status = 'skipped_suppressed';
        saveJSON(QUEUE_FILE, queue);
        continue;
      }

      // Validate the domain can receive mail before sending
      if (!(await emailDomainHasMx(email))) {
        log(`  ${email} has no mail server (would bounce) — skipping`);
        store.status = 'skipped_bad_email';
        skipped.push({ name: store.name, reason: 'no_mx', email, date: new Date().toISOString() });
        saveJSON(SKIPPED_FILE, skipped);
        saveJSON(QUEUE_FILE, queue);
        continue;
      }

      store.email = email;
      const subject = buildSubject(store);
      const body    = buildBody(store);

      log(`  Sending to ${email}...`);
      try {
        const messageId = await sendEmail(transporter, email, subject, body);
        incDailySent(1);
        log(`  Sent successfully. (${getDailySent()}/${MAX_EMAILS_PER_DAY} today)`);

        sent.push({
          name:      store.name,
          email,
          sourceApp: store.sourceApp,
          country:   store.country,
          subject,
          sentAt:    new Date().toISOString(),
          messageId: messageId || null,
          replied:   false,
          followUpSentAt: null,
        });
        sentEmails.add(email.toLowerCase());
        saveJSON(SENT_FILE, sent);

        store.status = 'sent';
        saveJSON(QUEUE_FILE, queue);
        sessionCount++;

        if (i < pending.length - 1 && sessionCount < MAX_EMAILS_PER_RUN) {
          const delay = sendDelayMs();
          log(`  Waiting ${Math.round(delay / 1000)}s before next email...`);
          await sleep(delay);
        }
      } catch (err) {
        log(`  Send failed: ${err.message}`);
        store.status  = 'failed';
        store.retries = (store.retries || 0) + 1;
        saveJSON(QUEUE_FILE, queue);
      }
    }

    log(`\nEmail session complete. Sent ${sessionCount} email(s) this run.`);
    log(`All-time email total: ${sent.length}.`);

    // ── Step 3: Instagram — reply to existing threads + DM new stores ─────────
    // OFF by default. Instagram automation uses an unofficial API and carries a
    // real risk of the account being locked or banned. To enable, set
    // IG_ENABLED=true in run.bat AND make sure IG_USERNAME is the real @handle.
    if (process.env.IG_ENABLED === 'true') {
      log('\nStarting Instagram pass...');
      const storesWithIg = queue.filter(s => s.instagramHandle && s.status !== 'declined');
      await runInstagramPass(storesWithIg);
    } else {
      log('\nInstagram pass disabled (set IG_ENABLED=true in run.bat to turn it on).');
    }

  } finally {
    transporter?.close();
  }
}

async function main() {
  const runOnce_ = process.argv.includes('--once');
  const mineOnly = process.argv.includes('--mine-only');

  if (!(await acquireLock())) {
    log('Another copy of the bot is already running — exiting.');
    return;
  }

  log('MarginSync Outreach Bot started.');

  while (true) {
    try {
      await runOnce(mineOnly);
    } catch (err) {
      log(`Unexpected error: ${err.message}`);
    }

    if (runOnce_ || mineOnly) break;

    const intervalMs = LOOP_INTERVAL_MINUTES * 60_000;
    const nextRun = new Date(Date.now() + intervalMs);
    log(`\nNext scan at ${nextRun.toLocaleTimeString('en-GB')} (${LOOP_INTERVAL_MINUTES} min from now). Sleeping...\n`);
    await sleep(intervalMs);
  }
}

// Only auto-run when invoked directly (`node bot.js`). When required by a test
// harness, export the pure helpers instead of launching the 24/7 loop.
if (require.main === module) {
  main().catch(err => { console.error(err); process.exit(1); });
} else {
  module.exports = {
    classifyReply, topOfReply, rawToText, isBounceMessage, findBouncedRecipient,
    scoreTypeBHtml, buildSubject, buildBody, reviewQuote, extractEmails,
    todayStr,
  };
}
