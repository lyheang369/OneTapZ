# Telegram Bot Commands — Design

**Date:** 2026-06-07
**Status:** Approved design, pending spec review

## Goal

Let OneTapZ users interact with the bot (`@onetapzbot`) by sending it commands in
Telegram chat. Today the bot is **send-only** (`sendTelegramMessage` for order /
notify DMs) and handles login verification — there is **no incoming-message
handler**. This feature adds the bot's "ears": a webhook that receives updates
and replies to commands.

## Why a webhook (not polling)

Telegram delivers user messages either via long-polling (`getUpdates`, needs an
always-on process) or via a **webhook** (Telegram POSTs each update to a URL).
OneTapZ deploys as a single ephemeral Vercel function pinned to `sin1` — there is
no always-on process, so **webhook is the only fit**. The webhook is registered
once with `setWebhook`.

## Architecture

- **New router:** `server/routes/telegramRoutes.js`, mounted at `/api/telegram`
  in `server/app.js` (alongside the other feature routers).
- **Endpoint:** `POST /api/telegram/webhook`.
- **Setup script:** `server/scripts/setTelegramWebhook.js`, run via
  `npm run bot:setup`. Calls `setWebhook` (URL + secret token) and `setMyCommands`
  (so commands show in Telegram's `/` menu).
- **Reuses:** `sendTelegramMessage` (`server/utils/telegram.js`), `checkUrl`
  (`server/utils/urlFilter.js`), `User.telegramId` matching, the `Link` and
  `Analytics` models.
- **No new runtime dependency.** `qrcode` is already in `package.json` and is used
  for the `/myprofile` QR.

### Request flow

```
Telegram → POST /api/telegram/webhook
  → verify X-Telegram-Bot-Api-Secret-Token header == TELEGRAM_WEBHOOK_SECRET
  → parse update.message { from.id, text }
  → User.findOne({ telegramId: String(from.id) })
      ├─ no match → reply "log in via OneTapZ in Telegram to link your account"
      └─ match → dispatch on command → reply via sendTelegramMessage / sendPhoto
  → respond 200 (always)
```

## Security

- **Webhook secret.** `setWebhook` is called with a `secret_token`. Telegram then
  sends that token in the `X-Telegram-Bot-Api-Secret-Token` header on every
  webhook request. The route rejects any request whose header does not match the
  new env var `TELEGRAM_WEBHOOK_SECRET` (constant-time compare). Without this,
  anyone who learns the URL could POST forged updates. Returns `401` on mismatch.
- **Always 200 on processed updates.** After the secret check passes, the handler
  returns `200` even if a command errors internally — otherwise Telegram retries
  the same update repeatedly. Errors are logged, not surfaced to Telegram.
- **HTML escaping.** All replies use `parse_mode: 'HTML'` (existing default in
  `sendTelegramMessage`). Any user-controlled field interpolated into a reply
  (username, link title, URL) is HTML-escaped with an `esc()` helper — same rule
  already applied to order-notification DMs.
- **Bot-can't-initiate caveat.** Because the *user* messages the bot first here,
  the 403 "bot can't initiate conversation" problem does not apply — the chat is
  already open.

## Environment

| Var | New? | Purpose |
|---|---|---|
| `TELEGRAM_BOT_TOKEN` | existing | Bot API auth (already required). |
| `PUBLIC_BASE_URL` | existing | Builds the webhook URL + the `onetapz.me/<username>` profile link. |
| `TELEGRAM_WEBHOOK_SECRET` | **new** | Shared secret to authenticate incoming webhook calls. Added via `vercel env add` (Sensitive) and to `.env.example`. |

## Commands

User identity for every command: `update.message.from.id` →
`User.findOne({ telegramId })`. If unmatched, reply with a link-your-account
prompt and stop.

### `/start`, `/help`
Welcome message listing the available commands. No account match required for the
text (but personalize if matched).

### `/myprofile`
Reply with the public profile URL `{(PUBLIC_BASE_URL or https://onetapz.me)}/<username>`
and a QR code. QR is generated with `qrcode` (`QRCode.toBuffer(url)`) and sent via
the bot `sendPhoto` API (multipart or `photo` URL). Caption contains the link.

### `/stats`
Read `Analytics.findOne({ userId })` (default zeros if none) and the most-clicked
link (`Link.findOne({ userId }).sort('-clickCount')`). Reply with `profileViews`,
`linkClicks`, and the top link's title + clicks. Mirrors `/api/analytics/me`.

### `/addlink <url> [title]`
1. Parse text after the command into `url` and optional `title` (rest of line).
2. Validate with `checkUrl(url)` — same blocklist/scheme filter as the web app.
   On failure, reply with the returned `reason`.
3. Title defaults to the URL hostname when omitted.
4. Create a `Link`: `{ userId, title, url, icon: 'link', order: <count>,
   isActive: true, display: 'button' }` — mirrors `POST /api/links`.
5. Reply confirming the link was added.

**Write-safety decision:** any linked user may `/addlink` directly (no confirm
step). `checkUrl` is the guard; users can delete unwanted links in the dashboard.

## Command dispatch

A small dispatcher in `telegramRoutes.js`: parse the leading token
(`/command`, stripping an optional `@onetapzbot` suffix), `switch` on it, default
to the `/help` text for unknown input. Each command is a small async function
that takes `(user, args)` and returns reply text (or sends a photo directly for
`/myprofile`).

## Out of scope (YAGNI)

- Inline buttons / `callback_query` handling (no confirm flow — write-safety
  decision was "allow directly").
- Editing or deleting links from chat.
- Group-chat support (commands assume a 1:1 user chat).
- Conversational / multi-step flows.

## Verification

No test runner exists. Verify by:
- `node --check server/routes/telegramRoutes.js` and the setup script.
- `npm run build` (frontend type-check unaffected, but confirms nothing broke).
- Manual: deploy, run `npm run bot:setup`, message `@onetapzbot` `/start`,
  `/myprofile`, `/stats`, `/addlink https://example.com Example` and confirm
  replies + that the link appears in the dashboard.
