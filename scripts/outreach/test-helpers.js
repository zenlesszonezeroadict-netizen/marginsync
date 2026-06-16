#!/usr/bin/env node
/* Unit tests for the pure helper functions in bot.js. Run: node test-helpers.js
 * No network, no SMTP/IMAP — just logic. Exits non-zero on any failure. */
'use strict';

const h = require('./bot.js');
const i18n = require('./i18n.js');

let pass = 0, fail = 0;
function eq(actual, expected, msg) {
  const a = JSON.stringify(actual), e = JSON.stringify(expected);
  if (a === e) { pass++; }
  else { fail++; console.error(`FAIL: ${msg}\n   expected ${e}\n   got      ${a}`); }
}
function ok(cond, msg) { if (cond) pass++; else { fail++; console.error(`FAIL: ${msg}`); } }

// ── classifyReply ─────────────────────────────────────────────────────────────
eq(h.classifyReply('yes please send the link'), 'interested', 'interested: yes please');
eq(h.classifyReply('Sure, sounds good — set up'), 'interested', 'interested: sure');
eq(h.classifyReply('STOP'), 'optout', 'optout: STOP');
eq(h.classifyReply('please unsubscribe me'), 'optout', 'optout: unsubscribe');
eq(h.classifyReply('remove me from your list'), 'optout', 'optout: remove me');
eq(h.classifyReply('do not email me again'), 'optout', 'optout: do not email');
eq(h.classifyReply('unsubscribe '), 'optout', 'optout: subject-only unsubscribe');
eq(h.classifyReply('Not interested, thanks'), 'notinterested', 'notinterested: not interested');
eq(h.classifyReply('we already use another tool'), 'notinterested', 'notinterested: already use');
eq(h.classifyReply('no thanks'), 'notinterested', 'notinterested: no thanks');
eq(h.classifyReply('who is this?'), 'neutral', 'neutral: who is this');
eq(h.classifyReply(''), 'neutral', 'neutral: empty');
// opt-out must win even if "yes" appears
eq(h.classifyReply('yes but please unsubscribe me'), 'optout', 'optout beats interested');

// ── topOfReply (strip quoted original) ────────────────────────────────────────
eq(h.topOfReply('Yes sounds great!\n\nOn Mon, Hughez wrote:\n> hello\n> world'),
   'Yes sounds great!', 'topOfReply: cut "On ... wrote:"');
eq(h.topOfReply('No thanks.\n> previous message\n> more'),
   'No thanks.', 'topOfReply: cut > quote');
eq(h.topOfReply('Just a plain reply with no quote'),
   'Just a plain reply with no quote', 'topOfReply: no quote untouched');

// ── rawToText (quoted-printable + html strip) ─────────────────────────────────
const rawQP = [
  'From: a@b.com', 'Content-Type: text/plain; charset=utf-8',
  'Content-Transfer-Encoding: quoted-printable', '', 'Hello =E2=80=94 world=', 'next line', ''
].join('\r\n');
ok(h.rawToText(rawQP).includes('Hello'), 'rawToText: extracts text/plain body');
const rawHtml = ['Content-Type: text/plain', '', '<b>Bold</b> text', ''].join('\r\n');
ok(!/[<>]/.test(h.rawToText(rawHtml)), 'rawToText: strips HTML tags');

// ── isBounceMessage ───────────────────────────────────────────────────────────
ok(h.isBounceMessage('mailer-daemon@googlemail.com', 'Delivery Status Notification (Failure)'), 'bounce: mailer-daemon');
ok(h.isBounceMessage('postmaster@example.com', 'whatever'), 'bounce: postmaster');
ok(h.isBounceMessage('x@y.com', 'Undelivered Mail Returned to Sender'), 'bounce: subject pattern');
ok(!h.isBounceMessage('john@store.com', 'Re: your review'), 'not bounce: normal reply');

// ── findBouncedRecipient ──────────────────────────────────────────────────────
const byEmail = new Map([['alice@store.com', 0]]);
const bounceRaw = Buffer.from('Your message to alice@store.com could not be delivered');
eq(h.findBouncedRecipient(bounceRaw, byEmail), 'alice@store.com', 'findBounced: locates recipient');
eq(h.findBouncedRecipient(Buffer.from('no known address here bob@other.com'), byEmail), null, 'findBounced: none');

// ── scoreTypeBHtml ────────────────────────────────────────────────────────────
ok(h.scoreTypeBHtml(['we use printful for everything']) <= -99, 'typeB: printful disqualifies');
ok(h.scoreTypeBHtml(['order from aliexpress dropship']) <= -99, 'typeB: aliexpress disqualifies');
ok(h.scoreTypeBHtml(['our wholesale supplier and distributor relationships']) >= 2, 'typeB: supplier signals score');
eq(h.scoreTypeBHtml([]), 0, 'typeB: empty is neutral 0');

// ── reviewQuote ───────────────────────────────────────────────────────────────
ok(h.reviewQuote({ reviewText: 'short note' }) === 'short note', 'quote: short kept');
ok(h.reviewQuote({ reviewText: 'x'.repeat(200) }).endsWith('…'), 'quote: long truncated with ellipsis');
eq(h.reviewQuote({}), '', 'quote: empty when no text');

// ── detectLanguage ────────────────────────────────────────────────────────────
eq(i18n.detectLanguage('United States'), 'en', 'lang: US → en');
eq(i18n.detectLanguage('Indonesia'), 'id', 'lang: Indonesia → id');
eq(i18n.detectLanguage('Germany'), 'de', 'lang: Germany → de');
eq(i18n.detectLanguage('Mexico'), 'es', 'lang: Mexico → es');
eq(i18n.detectLanguage('Brazil'), 'pt', 'lang: Brazil → pt');
eq(i18n.detectLanguage(''), 'en', 'lang: empty → en');
eq(i18n.detectLanguage('Narnia'), 'en', 'lang: unknown → en');

// ── buildSubject / buildBody (English, question-first, no pitch) ───────────────
const store = { name: 'Acme Co', sourceApp: 'Stock Sync', country: 'United States', reviewText: 'It kept losing sync and support never replied for weeks' };
const subj = h.buildSubject(store);
ok(typeof subj === 'string' && subj.length > 0, 'subject: non-empty');
ok(/stock sync/i.test(subj), 'subject: references source app');
const body = h.buildBody(store);
ok(/Stock Sync/.test(body), 'body: references their app');
ok(/supplier prices into Shopify by hand/i.test(body), 'body: asks the one question');
ok(body.includes('reply STOP'), 'body: includes opt-out line');
ok(!/marginsync-wheat\.vercel\.app/.test(body), 'body: does NOT leak app link in first email');
ok(!/\bfree\b/i.test(body), 'body: avoids spam-trigger word "free"');
ok(!/no credit card/i.test(body), 'body: avoids "no credit card" trigger');
ok(body.includes('You wrote:'), 'body: quotes their review');

// ── buildBody localisation (whole email switches language by country) ──────────
const idBody = h.buildBody({ ...store, country: 'Indonesia' });
ok(/^Halo,/.test(idBody), 'body(id): Indonesian greeting');
ok(/harga supplier ke Shopify secara manual/.test(idBody), 'body(id): localised question');
ok(/Anda menulis:/.test(idBody), 'body(id): localised quote label');
ok(!/marginsync-wheat\.vercel\.app/.test(idBody), 'body(id): no link in first email');

const deBody = h.buildBody({ ...store, country: 'Germany' });
ok(/^Hallo,/.test(deBody), 'body(de): German greeting');
ok(/Lieferantenpreise von Hand/.test(deBody), 'body(de): localised question');

const esBody = h.buildBody({ ...store, country: 'Spain' });
ok(/^Hola,/.test(esBody), 'body(es): Spanish greeting');

// Localised reply / follow-up / onboarding must never be empty and stay link-correct
ok(i18n.forCountry('Indonesia').replyLink('https://x').includes('https://x'), 'replyLink(id): carries the link');
ok(i18n.forCountry('Germany').followUp().length > 0, 'followUp(de): non-empty');
ok(i18n.forCountry('Brazil').formOnboarding('Ana', 'https://x').includes('Ana'), 'onboarding(pt): uses name');

// ── todayStr ──────────────────────────────────────────────────────────────────
ok(/^\d{4}-\d{2}-\d{2}$/.test(h.todayStr()), 'todayStr: YYYY-MM-DD format');

console.log(`\n${pass} passed, ${fail} failed`);
process.exit(fail === 0 ? 0 : 1);
