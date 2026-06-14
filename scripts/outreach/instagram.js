'use strict';

/**
 * MarginSync — Instagram DM module
 *
 * Handles:
 *   - Finding a store's Instagram handle from their website
 *   - Sending personalised opening DMs
 *   - Polling for replies and responding through a natural conversation
 *     that eventually introduces MarginSync
 *
 * Requires env vars:  IG_USERNAME  and  IG_PASSWORD
 */

// NOTE: instagram-private-api is required lazily inside getClient() so that
// importing this module does not crash the whole bot when the package is absent
// or Instagram credentials are not configured.
const fs   = require('fs');
const path = require('path');

const CONVO_FILE    = path.join(__dirname, 'ig-conversations.json');
const SESSION_FILE  = path.join(__dirname, 'ig-session.json');
const BETA_FORM_URL = 'https://docs.google.com/forms/d/1vJNJcFMkTVeIvewsNI63bp466745sFsGbRh524JtzVo/viewform';

// How long to wait before giving up on a thread with no reply (3 days)
const DEAD_THREAD_HOURS = 72;
// Max DMs to send per bot run (the bot now runs 4x per day, so keep this
// low — 4 per run = 16/day, safely under Instagram's limits for new accounts)
const MAX_DMS_PER_RUN   = 4;
// Seconds to wait between DMs
const DM_DELAY_MS       = 45_000;

// ── Conversation stages ───────────────────────────────────────────────────────

const STAGE = {
  OPENER_SENT : 1,  // We said hello, waiting for their reply
  ENGAGED     : 2,  // They replied — we asked a follow-up question
  PITCHED     : 3,  // We introduced MarginSync
  LINK_SENT   : 4,  // We sent the beta link
  DONE        : 5,  // Conversation complete
  COLD        : -1, // No reply after 72 h
  DECLINED    : -2, // They said no / negative
};

// ── Persistence ───────────────────────────────────────────────────────────────

function loadConvos() {
  try { return JSON.parse(fs.readFileSync(CONVO_FILE, 'utf8')); }
  catch { return {}; }
}

function saveConvos(data) {
  fs.writeFileSync(CONVO_FILE, JSON.stringify(data, null, 2));
}

// ── Instagram client ──────────────────────────────────────────────────────────

let _igClient = null;

async function getClient() {
  if (_igClient) return _igClient;

  const username = process.env.IG_USERNAME;
  const password = process.env.IG_PASSWORD;

  if (!username || !password) {
    console.error('[IG] IG_USERNAME or IG_PASSWORD not set — skipping Instagram module.');
    return null;
  }

  // Deferred require so the module can be imported safely without the package installed.
  let IgApiClient;
  try {
    ({ IgApiClient } = require('instagram-private-api'));
  } catch {
    console.error('[IG] instagram-private-api is not installed. Run: npm install instagram-private-api');
    return null;
  }

  const ig = new IgApiClient();
  ig.state.generateDevice(username);

  // Restore saved session to avoid re-logging in every run.
  // instagram-private-api uses ig.state.serialize() / ig.state.deserialize(),
  // NOT serializeCookieJar / deserializeCookieJar.
  if (fs.existsSync(SESSION_FILE)) {
    try {
      const saved = JSON.parse(fs.readFileSync(SESSION_FILE, 'utf8'));
      await ig.state.deserialize(saved);
      _igClient = ig;
      return ig;
    } catch { /* session stale — fall through to re-login */ }
  }

  try {
    await ig.simulate.preLoginFlow();
    await ig.account.login(username, password);
    await ig.simulate.postLoginFlow();

    // Persist session for future runs
    const sessionData = await ig.state.serialize();
    // Remove device string to avoid it being stale on restore
    delete sessionData.constants;
    fs.writeFileSync(SESSION_FILE, JSON.stringify(sessionData));

    _igClient = ig;
    console.log('[IG] Logged in successfully.');
    return ig;
  } catch (err) {
    console.error('[IG] Login failed:', err.message);
    if (err.message?.includes('challenge')) {
      console.error('[IG] Instagram requires email/SMS verification.');
      console.error('[IG] Log in to instagram.com manually once to clear the challenge, then try again.');
    }
    return null;
  }
}

// ── Find Instagram handle on a store website ──────────────────────────────────

function extractInstagramHandle(html) {
  // Match href="https://www.instagram.com/handle" or instagram.com/handle in text
  const patterns = [
    /instagram\.com\/([a-zA-Z0-9._]{2,30})(?:\/|\?|"|'|\s|$)/g,
  ];
  const found = new Set();
  for (const re of patterns) {
    for (const m of html.matchAll(re)) {
      const handle = m[1].replace(/\/$/, '');
      // Skip generic Instagram pages
      if (['p', 'reel', 'stories', 'explore', 'accounts', 'tv'].includes(handle)) continue;
      found.add(handle);
    }
  }
  return found.size > 0 ? [...found][0] : null;
}

// Call this from the main bot after fetching the store's website HTML
function findHandleInHtml(html) {
  return extractInstagramHandle(html);
}

// ── Opening DM builder ────────────────────────────────────────────────────────

function buildOpener(store) {
  const country = store.country || '';
  const name    = store.name   || 'there';

  // Infer product category from store name or sourceApp context
  // The bot will populate store.productHint when scraping the site description
  const product = store.productHint || 'products';

  const locationLine = country ? ` in ${country}` : '';

  // Rotate openers slightly so threads don't all read identically
  const templates = [
    `Hi ${name}! Love your ${product} store${locationLine} — the range you carry looks really solid.`,
    `Hi ${name}! Just came across your store${locationLine} — impressive selection of ${product}.`,
    `Hey ${name}! Your ${product} store${locationLine} caught my eye — great work on the catalogue.`,
  ];

  const idx = Math.abs(hashCode(name)) % templates.length;
  return templates[idx];
}

function hashCode(s) {
  let h = 0;
  for (let i = 0; i < s.length; i++) h = (Math.imul(31, h) + s.charCodeAt(i)) | 0;
  return h;
}

// ── Reply classifier ──────────────────────────────────────────────────────────

function classifyReply(text) {
  const t = (text || '').toLowerCase().trim();
  if (!t) return 'empty';
  if (/\b(no thanks|not interested|stop|leave me|go away|spam)\b/.test(t)) return 'negative';
  if (/\b(thank|thanks|ty|appreciated|great|cool|nice|awesome|perfect|sure)\b/.test(t)) return 'positive';
  if (/\?/.test(t) || /\b(what|how|who|when|where|tell me|more info)\b/.test(t)) return 'question';
  return 'neutral';
}

// ── Response generator (no AI needed — state machine) ────────────────────────

function buildResponse(stage, theirReply, store) {
  const sentiment = classifyReply(theirReply);
  const name = store.name || '';

  if (sentiment === 'negative') return null; // Stop the thread

  if (stage === STAGE.OPENER_SENT) {
    // They replied to our opener — ask a genuine question to keep it going
    const questions = [
      `Of course! Quick question — how do you currently handle pricing when your suppliers send updated price lists? I know a lot of Shopify store owners find that surprisingly time-consuming.`,
      `Appreciate it! How long have you been running the store? I'm always curious how independent shops manage stock and pricing updates across multiple suppliers.`,
      `Thanks for replying! Do you work with supplier CSVs for pricing, or do you update prices manually in Shopify? Just curious — it comes up a lot with store owners.`,
    ];
    return questions[Math.abs(hashCode(theirReply)) % questions.length];
  }

  if (stage === STAGE.ENGAGED) {
    // They answered our question — introduce MarginSync naturally
    return `That makes a lot of sense. We actually built a tool called MarginSync specifically for this — you upload your supplier's CSV and it maps the prices to your Shopify products automatically. It shows you a full preview before anything goes live, so there are no surprise changes. It's completely free right now while we're in beta. Worth trying?`;
  }

  if (stage === STAGE.PITCHED) {
    if (sentiment === 'positive' || sentiment === 'question') {
      return `Here's the link — it takes about five minutes to connect and the first sync is usually eye-opening:\n${BETA_FORM_URL}\n\nFeel free to message me if you run into anything.`;
    }
    // Neutral — give them one more nudge
    return `No pressure at all! If you ever deal with supplier price lists and want an easier way to push them to Shopify, the link is here whenever you want it: ${BETA_FORM_URL}`;
  }

  return null;
}

// ── Core DM functions ─────────────────────────────────────────────────────────

async function sendOpener(ig, store) {
  const convos = loadConvos();
  const key    = store.instagramHandle;

  if (convos[key]) {
    console.log(`[IG] Already have a thread with @${key} (stage ${convos[key].stage})`);
    return false;
  }

  const message = buildOpener(store);

  try {
    let userInfo;
    try {
      userInfo = await ig.user.searchExact(key);
    } catch {
      console.log(`[IG] @${key} not found or lookup failed`);
      return false;
    }
    if (!userInfo) { console.log(`[IG] @${key} not found`); return false; }

    // sendMessage expects an array of user-id strings, not a single string
    await ig.direct.sendMessage({ userIds: [`${userInfo.pk}`] }, message);

    convos[key] = {
      storeName      : store.name,
      handle         : key,
      userId         : `${userInfo.pk}`,
      stage          : STAGE.OPENER_SENT,
      openerSentAt   : new Date().toISOString(),
      lastActivityAt : new Date().toISOString(),
      messages       : [{ from: 'us', text: message, at: new Date().toISOString() }],
    };
    saveConvos(convos);

    console.log(`[IG] Opener sent to @${key}: "${message.slice(0, 60)}..."`);
    return true;
  } catch (err) {
    console.error(`[IG] Failed to DM @${key}: ${err.message}`);
    return false;
  }
}

async function checkAndRespond(ig) {
  const convos  = loadConvos();
  const nowMs   = Date.now();

  // Fetch inbox
  let inbox;
  try {
    const feed = ig.feed.directInbox();
    const page = await feed.items();
    inbox = page;
  } catch (err) {
    console.error('[IG] Could not fetch inbox:', err.message);
    return;
  }

  for (const thread of inbox) {
    const handle = thread.users?.[0]?.username;
    if (!handle) continue;

    const convo = convos[handle];
    if (!convo) continue;  // Not one of our threads — skip
    if (convo.stage <= 0 || convo.stage >= STAGE.DONE) continue;

    // Check for stale thread (no reply in 72 h)
    const lastActivity = new Date(convo.lastActivityAt).getTime();
    if (nowMs - lastActivity > DEAD_THREAD_HOURS * 3600_000) {
      console.log(`[IG] Thread with @${handle} is cold (${DEAD_THREAD_HOURS}h no reply) — marking done`);
      convo.stage = STAGE.COLD;
      saveConvos(convos);
      continue;
    }

    // Get their most recent message
    const items = thread.items || [];
    const theirMsgs = items.filter(i =>
      i.user_id?.toString() === convo.userId && i.item_type === 'text'
    );
    if (!theirMsgs.length) continue;

    const latest     = theirMsgs[0];
    const latestText = latest.text || '';
    const latestTs   = new Date(Number(latest.timestamp) / 1000).toISOString();

    // Skip if we've already logged this message
    const alreadySeen = convo.messages.some(m => m.from === 'them' && m.text === latestText);
    if (alreadySeen) continue;

    console.log(`[IG] New reply from @${handle}: "${latestText.slice(0, 80)}"`);

    // Log their message and persist immediately — this prevents re-processing
    // the same message on the next run regardless of whether our send succeeds.
    convo.messages.push({ from: 'them', text: latestText, at: latestTs });
    convo.lastActivityAt = latestTs;
    saveConvos(convos);

    // Build our response
    const sentiment = classifyReply(latestText);
    if (sentiment === 'negative') {
      console.log(`[IG] @${handle} declined — stopping thread`);
      convo.stage = STAGE.DECLINED;
      saveConvos(convos);
      continue;
    }

    const reply = buildResponse(convo.stage, latestText, { name: convo.storeName });
    if (!reply) continue;

    // Advance stage before sending
    convo.stage = Math.min(convo.stage + 1, STAGE.LINK_SENT);

    try {
      // sendMessage expects an array of user-id strings
      await ig.direct.sendMessage({ userIds: [convo.userId] }, reply);
      convo.messages.push({ from: 'us', text: reply, at: new Date().toISOString() });
      convo.lastActivityAt = new Date().toISOString();
      saveConvos(convos);
      console.log(`[IG] Replied to @${handle} (now stage ${convo.stage})`);
    } catch (err) {
      console.error(`[IG] Failed to reply to @${handle}: ${err.message}`);
      // Roll back the stage increment so we retry the send on the next run.
      // Their message is already saved above so we won't re-log it.
      convo.stage = Math.max(convo.stage - 1, STAGE.OPENER_SENT);
      saveConvos(convos);
    }

    await new Promise(r => setTimeout(r, 5000));
  }
}

// ── Public API ────────────────────────────────────────────────────────────────

async function runInstagramPass(newStores) {
  const ig = await getClient();
  if (!ig) return;

  console.log('\n[IG] Checking for replies and responding...');
  await checkAndRespond(ig);

  // Send openers to new stores that have an Instagram handle
  const eligible = (newStores || []).filter(s => s.instagramHandle);
  if (eligible.length === 0) {
    console.log('[IG] No new stores with Instagram handles to contact.');
    return;
  }

  console.log(`[IG] ${eligible.length} new store(s) to DM on Instagram.`);
  let sent = 0;

  for (const store of eligible) {
    if (sent >= MAX_DMS_PER_RUN) {
      console.log(`[IG] Hit daily DM limit (${MAX_DMS_PER_RUN}) — will continue next run.`);
      break;
    }
    const ok = await sendOpener(ig, store);
    if (ok) {
      sent++;
      if (sent < eligible.length) {
        console.log(`[IG] Waiting ${DM_DELAY_MS / 1000}s before next DM...`);
        await new Promise(r => setTimeout(r, DM_DELAY_MS));
      }
    }
  }

  console.log(`[IG] Session: ${sent} opener(s) sent.`);
}

module.exports = { runInstagramPass, findHandleInHtml };
