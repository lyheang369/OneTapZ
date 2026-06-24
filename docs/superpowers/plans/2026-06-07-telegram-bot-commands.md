# Telegram Bot Commands Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Let OneTapZ users send commands to `@onetapzbot` (`/start`, `/help`, `/myprofile`, `/stats`, `/addlink`) and get replies, via a Telegram webhook.

**Architecture:** A new stateless Express router (`server/routes/telegramRoutes.js`) mounted at `/api/telegram` receives Telegram updates at `POST /webhook`. It authenticates each request with a shared secret-token header, matches the Telegram user to a `User` by `telegramId`, dispatches on the command, and replies via the bot API. A one-time setup script registers the webhook + command menu.

**Tech Stack:** Express 5, Mongoose, native `fetch`/`FormData`/`Blob` (Node 18+ on Vercel), `qrcode` (already a dependency), `crypto` for constant-time secret compare.

> **Note on verification:** This repo has **no test runner** (see CLAUDE.md — the verify loop is `node --check` + `npm run build`, then manual). The webhook depends on the live Telegram API and MongoDB, with no existing mocking infrastructure. So tasks verify with `node --check <file>` (syntax/import correctness) and a final `npm run build`, then a documented manual smoke test against the deployed bot. Do **not** invent a test framework — follow the repo's established pattern.

---

## File Structure

- **Create** `server/routes/telegramRoutes.js` — the webhook router + command handlers (one responsibility: handle inbound bot messages).
- **Create** `server/scripts/setTelegramWebhook.js` — one-time setup: `setWebhook` + `setMyCommands`.
- **Modify** `server/utils/telegram.js` — add `htmlEscape()` and `sendTelegramPhoto()` (the QR for `/myprofile`).
- **Modify** `server/app.js` — import + mount the new router.
- **Modify** `package.json` — add `"bot:setup"` script.
- **Modify** `.env.example` — document `TELEGRAM_WEBHOOK_SECRET`.
- **Modify** `CLAUDE.md` — document the new inbound-command path.

---

### Task 1: Add `htmlEscape` + `sendTelegramPhoto` to the telegram util

**Files:**
- Modify: `server/utils/telegram.js`

- [ ] **Step 1: Append the two helpers to `server/utils/telegram.js`**

Add at the end of the file (after `sendTelegramMessage`):

```javascript
// HTML-escape user-controlled text before interpolating into a parse_mode:'HTML'
// message. Mirrors the esc() guard used for order-notification DMs.
export function htmlEscape(value) {
  return String(value ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

// Send a photo (e.g. a QR PNG buffer) to a Telegram chat. Best-effort, mirrors
// sendTelegramMessage's error handling. Uses multipart upload via global
// FormData/Blob (native on Node 18+).
export async function sendTelegramPhoto(chatId, photoBuffer, caption) {
  const botToken = process.env.TELEGRAM_BOT_TOKEN;
  if (!botToken || !chatId) return;
  try {
    const form = new FormData();
    form.append('chat_id', String(chatId));
    if (caption) {
      form.append('caption', caption);
      form.append('parse_mode', 'HTML');
    }
    form.append('photo', new Blob([photoBuffer], { type: 'image/png' }), 'profile-qr.png');
    const res = await fetch(`https://api.telegram.org/bot${botToken}/sendPhoto`, {
      method: 'POST',
      body: form,
    });
    if (!res.ok) {
      const body = await res.text().catch(() => '');
      console.error('Telegram sendPhoto failed', res.status, body);
    }
  } catch (err) {
    console.error('Telegram sendPhoto error', err?.message);
  }
}
```

- [ ] **Step 2: Syntax-check**

Run: `node --check server/utils/telegram.js`
Expected: no output (exit 0).

- [ ] **Step 3: Commit**

```bash
git add server/utils/telegram.js
git commit -m "feat(telegram): add htmlEscape and sendTelegramPhoto helpers"
```

---

### Task 2: Create the webhook router with all commands

**Files:**
- Create: `server/routes/telegramRoutes.js`

- [ ] **Step 1: Create `server/routes/telegramRoutes.js` with this exact content**

```javascript
import express from 'express';
import crypto from 'crypto';
import QRCode from 'qrcode';
import User from '../models/User.js';
import Link from '../models/Link.js';
import Analytics from '../models/Analytics.js';
import { sendTelegramMessage, sendTelegramPhoto, htmlEscape as esc } from '../utils/telegram.js';
import { checkUrl } from '../utils/urlFilter.js';

const router = express.Router();

function profileBase() {
  return (process.env.PUBLIC_BASE_URL || 'https://onetapz.me').replace(/\/$/, '');
}

// Telegram echoes the secret_token set via setWebhook in this header on every
// call. Without a matching secret, anyone who learns the URL could POST forged
// updates — so reject mismatches with a constant-time compare.
function verifySecret(req) {
  const expected = process.env.TELEGRAM_WEBHOOK_SECRET || '';
  const got = req.get('X-Telegram-Bot-Api-Secret-Token') || '';
  if (!expected) return false;
  const a = Buffer.from(expected);
  const b = Buffer.from(got);
  return a.length === b.length && crypto.timingSafeEqual(a, b);
}

const HELP = [
  '<b>OneTapZ bot</b>',
  '',
  '/myprofile — your public link + QR',
  '/stats — your profile views &amp; link clicks',
  '/addlink &lt;url&gt; [title] — add a link to your profile',
  '/help — show this message',
].join('\n');

async function cmdMyProfile(user, chatId) {
  const url = `${profileBase()}/${user.username}`;
  const png = await QRCode.toBuffer(url, { width: 512, margin: 2 });
  await sendTelegramPhoto(chatId, png, `Your OneTapZ profile:\n${esc(url)}`);
}

async function cmdStats(user, chatId) {
  const analytics = await Analytics.findOne({ userId: user._id });
  const top = await Link.findOne({ userId: user._id }).sort('-clickCount');
  const lines = [
    `<b>Stats for @${esc(user.username)}</b>`,
    `👁 Profile views: ${analytics?.profileViews ?? 0}`,
    `🔗 Link clicks: ${analytics?.linkClicks ?? 0}`,
  ];
  if (top) lines.push(`⭐ Top link: ${esc(top.title)} (${top.clickCount} clicks)`);
  await sendTelegramMessage(chatId, lines.join('\n'));
}

async function cmdAddLink(user, args, chatId) {
  const text = args.trim();
  if (!text) {
    await sendTelegramMessage(chatId, 'Usage: /addlink &lt;url&gt; [title]');
    return;
  }
  const [rawUrl, ...rest] = text.split(/\s+/);
  const check = checkUrl(rawUrl);
  if (!check.ok) {
    await sendTelegramMessage(chatId, esc(check.reason));
    return;
  }
  // checkUrl accepts schemeless input; normalize the stored value the same way.
  const url = /^[a-z][a-z0-9+.-]*:/i.test(rawUrl) ? rawUrl : `https://${rawUrl}`;
  let title = rest.join(' ').trim();
  if (!title) {
    try {
      title = new URL(url).hostname.replace(/^www\./, '');
    } catch {
      title = url;
    }
  }
  const count = await Link.countDocuments({ userId: user._id });
  await Link.create({
    userId: user._id,
    title,
    url,
    icon: 'link',
    order: count,
    isActive: true,
    display: 'button',
  });
  await sendTelegramMessage(chatId, `✅ Added <b>${esc(title)}</b> to your profile.`);
}

async function handleUpdate(update) {
  const message = update?.message;
  const chatId = message?.chat?.id;
  const fromId = message?.from?.id;
  const text = (message?.text || '').trim();
  if (!chatId || !fromId || !text.startsWith('/')) return;

  const [token] = text.split(/\s+/);
  const command = token.replace(/@.*$/, '').toLowerCase(); // strip @botname suffix
  const args = text.slice(token.length); // everything after the command token

  const user = await User.findOne({ telegramId: String(fromId) });

  if (command === '/start' || command === '/help') {
    const greeting = user ? `Hi ${esc(user.name || user.username)}!\n\n` : '';
    await sendTelegramMessage(chatId, greeting + HELP);
    return;
  }

  if (!user) {
    await sendTelegramMessage(
      chatId,
      'Open OneTapZ inside Telegram (or log in with Telegram on onetapz.me) to link your account, then try again.',
    );
    return;
  }

  switch (command) {
    case '/myprofile':
      await cmdMyProfile(user, chatId);
      break;
    case '/stats':
      await cmdStats(user, chatId);
      break;
    case '/addlink':
      await cmdAddLink(user, args, chatId);
      break;
    default:
      await sendTelegramMessage(chatId, HELP);
  }
}

// Telegram POSTs each update here. We authenticate, then process the update
// BEFORE responding 200 — on serverless, work after res.end() may not run. Any
// handler error is logged and swallowed so we still return 200 (a non-2xx makes
// Telegram redeliver the same update on a backoff).
router.post('/webhook', async (req, res) => {
  if (!verifySecret(req)) {
    return res.status(401).json({ ok: false });
  }
  try {
    await handleUpdate(req.body);
  } catch (err) {
    console.error('Telegram webhook handler error', err?.message);
  }
  res.json({ ok: true });
});

export default router;
```

- [ ] **Step 2: Syntax-check**

Run: `node --check server/routes/telegramRoutes.js`
Expected: no output (exit 0).

- [ ] **Step 3: Commit**

```bash
git add server/routes/telegramRoutes.js
git commit -m "feat(telegram): inbound webhook router with /start /help /myprofile /stats /addlink"
```

---

### Task 3: Mount the router in the app

**Files:**
- Modify: `server/app.js`

- [ ] **Step 1: Add the import**

In `server/app.js`, after the `import shopRoutes from './routes/shopRoutes.js';` line (line 15), add:

```javascript
import telegramRoutes from './routes/telegramRoutes.js';
```

- [ ] **Step 2: Mount the router**

After the `app.use('/api/shop', shopRoutes);` line (line 61), add:

```javascript
app.use('/api/telegram', telegramRoutes);
```

- [ ] **Step 3: Syntax-check the whole server entry**

Run: `node --check server/app.js`
Expected: no output (exit 0).

- [ ] **Step 4: Verify the server boots and the route is registered**

Run (requires `.env` with `MONGO_URI`):
```bash
node -e "import('./server/app.js').then(()=>console.log('app loaded OK')).catch(e=>{console.error(e);process.exit(1)})"
```
Expected: prints `app loaded OK` (Mongoose may log a connection attempt; the import itself must not throw).

- [ ] **Step 5: Commit**

```bash
git add server/app.js
git commit -m "feat(telegram): mount /api/telegram webhook router"
```

---

### Task 4: Setup script + npm script

**Files:**
- Create: `server/scripts/setTelegramWebhook.js`
- Modify: `package.json`

- [ ] **Step 1: Create `server/scripts/setTelegramWebhook.js`**

```javascript
import 'dotenv/config';

// One-time setup: register the webhook URL (+ secret) and the bot's command menu
// with Telegram. Telegram requires an HTTPS URL, so run this with the PRODUCTION
// env (PUBLIC_BASE_URL=https://onetapz.me) — it cannot point at localhost.
const token = process.env.TELEGRAM_BOT_TOKEN;
const base = (process.env.PUBLIC_BASE_URL || '').replace(/\/$/, '');
const secret = process.env.TELEGRAM_WEBHOOK_SECRET;

if (!token || !base || !secret) {
  console.error(
    'Missing env. Need TELEGRAM_BOT_TOKEN, PUBLIC_BASE_URL (https), TELEGRAM_WEBHOOK_SECRET.',
  );
  process.exit(1);
}
if (!base.startsWith('https://')) {
  console.error(`PUBLIC_BASE_URL must be https for a Telegram webhook (got: ${base}).`);
  process.exit(1);
}

const api = (method) => `https://api.telegram.org/bot${token}/${method}`;

async function main() {
  const webhookUrl = `${base}/api/telegram/webhook`;

  const setWebhook = await fetch(api('setWebhook'), {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      url: webhookUrl,
      secret_token: secret,
      allowed_updates: ['message'],
    }),
  }).then((r) => r.json());
  console.log('setWebhook →', setWebhook);

  const setMyCommands = await fetch(api('setMyCommands'), {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      commands: [
        { command: 'myprofile', description: 'Your public link + QR' },
        { command: 'stats', description: 'Your profile views & link clicks' },
        { command: 'addlink', description: 'Add a link: /addlink <url> [title]' },
        { command: 'help', description: 'Show available commands' },
      ],
    }),
  }).then((r) => r.json());
  console.log('setMyCommands →', setMyCommands);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
```

- [ ] **Step 2: Add the npm script**

In `package.json`, in the `"scripts"` block, after the `"seed"` line add:

```json
    "bot:setup": "node server/scripts/setTelegramWebhook.js"
```

(Ensure the preceding `"seed"` line ends with a comma.)

- [ ] **Step 3: Syntax-check**

Run: `node --check server/scripts/setTelegramWebhook.js`
Expected: no output (exit 0).

- [ ] **Step 4: Verify the guard fires without env**

Run: `env -u TELEGRAM_WEBHOOK_SECRET node server/scripts/setTelegramWebhook.js`
Expected: prints the "Missing env" message and exits non-zero (it must NOT call Telegram).

- [ ] **Step 5: Commit**

```bash
git add server/scripts/setTelegramWebhook.js package.json
git commit -m "feat(telegram): bot:setup script to register webhook + command menu"
```

---

### Task 5: Document the new env var and inbound path

**Files:**
- Modify: `.env.example`
- Modify: `CLAUDE.md`

- [ ] **Step 1: Add the secret to `.env.example`**

After the `TELEGRAM_BOT_TOKEN=replace_with_bot_token` line, add:

```
# Shared secret authenticating inbound Telegram webhook calls (POST /api/telegram/webhook).
# Use a long random string; the same value is passed to setWebhook via `npm run bot:setup`.
TELEGRAM_WEBHOOK_SECRET=replace_with_a_long_random_string
```

- [ ] **Step 2: Document the inbound command path in `CLAUDE.md`**

In the "### Telegram login + Mini App" section, after the paragraph that ends with the `sendTelegramMessage` 403 note, add:

```markdown

**Inbound bot commands** (`server/routes/telegramRoutes.js`, mounted `/api/telegram`): `POST /webhook` receives Telegram updates. It authenticates via the `X-Telegram-Bot-Api-Secret-Token` header (constant-time compare against `TELEGRAM_WEBHOOK_SECRET`), matches the sender by `User.telegramId`, and dispatches commands (`/start`, `/help`, `/myprofile` → link + QR, `/stats`, `/addlink <url> [title]`). It **processes before responding 200** (serverless drops work after `res.end()`) and **always returns 200** past the auth check so Telegram doesn't retry-storm. Register the webhook + `/`-menu once with `npm run bot:setup` (needs production `PUBLIC_BASE_URL` over HTTPS). This is the bot's only *inbound* path — `sendTelegramMessage`/`sendTelegramPhoto` remain the *outbound* side.
```

- [ ] **Step 3: Commit**

```bash
git add .env.example CLAUDE.md
git commit -m "docs(telegram): document inbound webhook commands + TELEGRAM_WEBHOOK_SECRET"
```

---

### Task 6: Final verification

- [ ] **Step 1: Frontend build still passes (nothing server-side broke the build)**

Run: `npm run build`
Expected: `tsc -b && vite build` completes with no errors.

- [ ] **Step 2: Lint the frontend (server isn't linted, but confirm no stray breakage)**

Run: `npx eslint src`
Expected: no errors.

- [ ] **Step 3: Deploy**

Run: `vercel --prod --yes`
Expected: deploy succeeds.

- [ ] **Step 4: Add the secret to Vercel and register the webhook**

```bash
vercel env add TELEGRAM_WEBHOOK_SECRET production   # paste a long random string at the prompt
vercel --prod --yes                                  # redeploy so the function sees the new env
PUBLIC_BASE_URL=https://onetapz.me \
TELEGRAM_BOT_TOKEN=<token> \
TELEGRAM_WEBHOOK_SECRET=<same string> \
  npm run bot:setup
```
Expected: `setWebhook → { ok: true, result: true, description: 'Webhook was set' }` and `setMyCommands → { ok: true, result: true }`.

- [ ] **Step 5: Manual smoke test in Telegram**

In a chat with `@onetapzbot` (with a Telegram-linked OneTapZ account), send and confirm:
- `/start` → welcome + command list.
- `/myprofile` → photo (QR) with caption `onetapz.me/<username>`.
- `/stats` → profile views + link clicks (+ top link if any).
- `/addlink https://example.com Example` → "✅ Added Example" and the link appears in the dashboard `/links`.
- `/addlink https://pornhub.com` → rejected with the adult-content reason (verifies `checkUrl`).

Expected: all replies render correctly; no duplicate replies (confirms the always-200 path).
