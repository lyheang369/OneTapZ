# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

OneTapZ is a digital-profile / NFC-card / link-in-bio app: a Vite + React 19 frontend and an Express 5 + MongoDB (Mongoose) API in a single repo, deployed as a Vite static build plus one Vercel serverless function. Live at **onetapz.me** (Vercel project `onetapz`).

## Commands

- `npm run dev` — Vite client (`:5173`) + Express server (`:5001`) together via `concurrently`.
- `npm run client` / `npm run server` — run one side only (`server` uses nodemon).
- `npm run build` — `tsc -b && vite build` (type-check is part of the build; this is the closest thing to CI).
- `npm run lint` — ESLint (flat config). **Frontend only**: the config matches `**/*.{ts,tsx}`, so `server/*.js` is never linted — `tsc -b` also only covers the TS frontend, so the Express server has no automated static check at all.
- `npm run start` — Express server standalone (production entry).
- `npm run seed` — seed/refresh the demo profile in MongoDB (needs `MONGO_URI`); see "Demo profile" below.
- `npm run bot:setup` — **one-time** Telegram setup: registers the `/api/telegram/webhook` URL (+ secret) and the `/`-menu with Telegram. Needs `TELEGRAM_BOT_TOKEN`, `TELEGRAM_WEBHOOK_SECRET`, and a **production HTTPS** `PUBLIC_BASE_URL` (can't point at localhost). Re-run after the webhook URL or secret changes.
- `vercel --prod --yes` — **deploy.** Production ships straight from the **working tree** via the Vercel CLI (project `onetapz`), **not** from git pushes — so the GitHub repo routinely drifts behind production; commit/push separately. `.github/workflows/keep-warm.yml` (pings `/api/health` to cut cold starts) only runs once on GitHub's `main`, so it needs a push to take effect.
- `vercel env add <NAME> production` — add a secret via the secure prompt (don't paste secrets into committed files); `vercel env pull <file> --environment=production` to fetch non-sensitive vars locally for a one-off script.

There is **no test runner** — the verify loop is `tsc -b` + `eslint src` + `npm run build`, then `vercel --prod`. All cover only the frontend; verify server (`server/*.js`) changes by running the app or `node --check`. Copy `.env.example` to `.env` before running.

## Environment

Required for the API to function: `MONGO_URI`, `JWT_SECRET`. For Telegram login + Mini App + order DMs: `VITE_TELEGRAM_BOT_NAME` (public, build-time inlined) + `TELEGRAM_BOT_TOKEN` (server). `CLIENT_URL`/`PUBLIC_BASE_URL` set CORS origin and the public profile / webhook URL base.

- **`CAM_RAPID_PAY_API_KEY`** — CamRapidPay (KHQR) key for the shop; without it `/api/shop/checkout` returns "Payments are not configured." Marked **Sensitive** in Vercel (can't be `vercel env pull`-ed).
- **`ADMIN_TELEGRAM_USERNAMES`** — optional comma-separated Telegram usernames granted the `admin` role on Telegram login (defaults to `lyheangleng`).
- **`BLOB_READ_WRITE_TOKEN`** — required in production for image uploads (Vercel Blob); **not** in `.env.example`. Local dev falls back to disk when absent.

`VITE_*` vars are **build-time inlined** by Vite — changing them in Vercel requires a **redeploy** (a common "I set it but it doesn't work" trap, e.g. `VITE_TELEGRAM_BOT_NAME`).

Atlas note: MongoDB Atlas Network Access must allow `0.0.0.0/0` for Vercel's serverless functions to connect (their egress IPs rotate). A single-IP allowlist will silently fail with a 30s connection timeout.

The Vercel function is pinned to **`sin1`** (Singapore) in `vercel.json` `regions` to sit next to the Atlas cluster — co-location is what keeps DB round-trips fast. Vercel Analytics + Speed Insights are mounted in `App.tsx` (`@vercel/analytics/react`, `@vercel/speed-insights/react`).

## Architecture

### Dual-mode auth and data (read this first)
The frontend keeps working **even when the API is unreachable**, falling back to `localStorage`. This pervades `src/context/AuthContext.tsx` and `src/lib/localStore.ts`:
- `login`/`register` hit `/api/auth/*` first; on **any** failure they catch and create/read a **local account** in `localStorage` instead.
- A real API session stores the JWT under `onetapz_token`. A local-fallback session uses a token **prefixed `local:`** (`local:<id>`). On load, `AuthContext` branches on the prefix: `local:` resolves the user from `localStorage`; real tokens call `GET /api/auth/me`. The `hasApiSession()` helper (`src/lib/api.ts`) is the canonical "is this a real API user?" check used across pages to decide API-vs-localStorage reads.
- **For API users the server is authoritative.** `loadMe`/`login`/`loginWithTelegram` set the user from the server response directly (`normalizeUser(data.user)`) — they do **not** merge `localStorage` over it. (That merge used to exist and caused a cross-surface desync: the Telegram Mini App updated the server photo while the web session kept a stale empty `profileImage` from localStorage.) Only the offline/`local:` path reads from localStorage.

`normalizeUser` must leave `buttonBackground`/`pageBackground` **empty when unset** (empty = "use the theme's tokens") — do not backfill a default color or the theme palette is permanently overridden (see Theming).

### Telegram login + Mini App
`server/routes/authRoutes.js` handles two **different** verification schemes (mixing them up = "works on web, fails in Telegram"):
- **Login Widget** (`POST /api/auth/telegram`): `secret = SHA256(botToken)`, then HMAC over the sorted payload.
- **Mini App** (`POST /api/auth/telegram/webapp`): verifies `WebApp.initData` with `secret = HMAC_SHA256("WebAppData", botToken)`. Telegram clients disagree on whether the newer `signature` field is part of the HMAC, so the verifier accepts **either** variant (with/without `signature`) — both still require the bot token.

`provisionTelegramUser()` is shared by both; it grants `role: 'admin'` when the Telegram username is in `ADMIN_TELEGRAM_USERNAMES`, and **promotes existing users on login** (so admin status applies after a re-login, not retroactively). The Mini App auto-logs-in inside `AuthContext.loadMe` from `window.Telegram.WebApp.initData` (typed in `src/telegram.d.ts`, SDK loaded via `<script>` in `index.html`); brand-new Mini App users set `pendingOnboard`, and `App.tsx` routes them to `/edit-profile` to pick a username. **Telegram bots can only DM users who have started the bot** — order/notify DMs to anyone who only used the Login Widget will 403 (logged via `sendTelegramMessage`).

**Inbound bot commands** (`server/routes/telegramRoutes.js`, mounted `/api/telegram`): `POST /webhook` receives Telegram updates. It authenticates via the `X-Telegram-Bot-Api-Secret-Token` header (constant-time compare against `TELEGRAM_WEBHOOK_SECRET`), matches the sender by `User.telegramId`, and dispatches commands (`/start`, `/help`, `/myprofile` → link + QR, `/stats`, `/addlink <url> [title]`). It **processes before responding 200** (serverless drops work after `res.end()`) and **always returns 200** past the auth check so Telegram doesn't retry-storm. Register the webhook + `/`-menu once with `npm run bot:setup` (needs production `PUBLIC_BASE_URL` over HTTPS). This is the bot's only *inbound* path — `sendTelegramMessage`/`sendTelegramPhoto` remain the *outbound* side.

### Serverless wrapper + lazy DB connect
`api/index.js` re-exports `server/app.js` as the Vercel function; `server/index.js` is the standalone listener. Because the same `app.js` runs serverless, the DB connection is **lazy and per-request**: a middleware memoizes `connectDB()` into `dbReady` and awaits it on the first request. On failure it **resets `dbReady` so the next request retries** — do not revert this to caching the promise (`dbReady ||= connectDB()`), or one cold-start blip permanently wedges a warm instance. Don't move the connect to module top-level.

### Routing
- `vercel.json` rewrites `/api/*` and `/uploads/*` to the function, everything else to `index.html` (SPA). In dev, `vite.config.ts` proxies those prefixes to `:5001`.
- All page components are **lazy-loaded** (`React.lazy` + `Suspense`) in `App.tsx` so the public profile (NFC target) doesn't ship the dashboard. A top-level **`ErrorBoundary`** (`main.tsx`) catches the stale-chunk error that occurs when a tab on an old build hits a renamed chunk after a redeploy, and **reloads once** to fetch the fresh build.
- `src/App.tsx` treats **any single-segment lowercase path** (`/^\/[a-z0-9_-]+$/i`) not in the `appRoutes` set as a `:username` public profile. **When adding a single-segment top-level route, add it to that `appRoutes` set** or `PublicProfile` swallows it. Multi-segment routes (`/order/:reference`) are safe without it. Current non-profile routes: `/`, `/shop`, `/order/:reference`, `/login`, `/register`, `/dashboard`, `/edit-profile`, `/links`, `/nfc`, `/analytics`, `/admin`.
- `ProtectedRoute` gates app pages; `adminOnly` redirects non-admins to `/dashboard`.

### Public profile is edge-cached
`GET /api/profile/:username` (`profileRoutes.js`, **not** the dead duplicate in `userRoutes.js`) sets `Cache-Control: public, s-maxage=30, stale-while-revalidate=60` so Vercel's edge serves repeat NFC/QR opens without hitting the function or DB. For this to work the client fetches it via **`publicApi`** (an axios instance with **no** `Authorization` interceptor) — an auth header would make the response uncacheable. Because cached hits skip the handler, **view counting is done by the client** (`POST /api/analytics/view`), not in the GET. Profile edits propagate within the TTL; the owner viewing their own page bypasses the cache with a unique query param.

### Backend layering (`server/`)
Feature routers mount under `/api/{auth,profile,users,links,nfc,analytics,admin,shop,telegram}` in `app.js`.
- Routes use the `asyncHandler` wrapper so thrown errors reach the single error middleware in `app.js`; throw an `Error` with a `.status` to control the code.
- `protect` (JWT bearer) + `adminOnly` live in `middleware/auth.js`; `adminRoutes` applies both via `router.use(...)`. JWTs signed in `utils/token.js` (7-day, payload `{ id, role }`).
- Auth/user routes return a hand-built `publicUser(...)` projection (duplicated in `authRoutes.js` **and** `userRoutes.js` — keep both in sync with the `User` type in `src/lib/types.ts`). `password` is `select: false`. The public profile route instead returns the raw doc via `.select('-password -email')`, so new public fields appear automatically there but must be added to both `publicUser` projections to reach the dashboard.
- `server/utils/telegram.js`: `verifyTelegramLoginPayload`, `sendTelegramMessage` + `sendTelegramPhoto` (best-effort, log failures), and `htmlEscape`. Anything sent with `parse_mode: 'HTML'` **must HTML-escape user-controlled fields** (injection vector). Two escape helpers exist — the shared `htmlEscape` (used by the inbound bot router) and a local `esc()` in `shopRoutes.js` (guards order notifications: buyer name/phone/handle).

### Shop + KHQR payments
The store at `/shop` sells fixed NFC-card products and accepts **KHQR (Bakong)** via **CamRapidPay** (`server/utils/camrapidpay.js`, docs in `.claude/skills/camrapidpay`).
- **Prices are an authoritative server catalog** in `shopRoutes.js` (`PRODUCTS`) — never trust amounts from the client.
- Checkout resolves the buyer's Telegram from either a logged-in session (JWT → `req.user.telegramId`) or a verified Login-Widget payload, creates an `Order` (`models/Order.js`, `pending`), then a KHQR via `createKhqrPayment` (returns the `qr_code` string the client renders).
- **"Paid" is only set after a server-to-server status check** (`checkKhqrStatus`), via an **atomic** `findOneAndUpdate({status:{$ne:'paid'}})` so the buyer/admin Telegram notifications fire exactly once even when the status-poll and the webhook race. The webhook re-verifies rather than trusting its body.
- `GET /api/shop/order/:reference` is the public **invoice** (`/order/:reference` page) — returns invoice-safe fields only and settles status on view.

### Image uploads → Vercel Blob
`middleware/upload.js` uses multer **memoryStorage** + a strict raster allowlist (png/jpeg/webp/gif; SVG rejected). `utils/storeImage.js` then **sniffs magic bytes** to derive the real type and stores the file: **Vercel Blob** when `BLOB_READ_WRITE_TOKEN` is set (returns an absolute `https` URL), else local `server/uploads` in dev (relative `/uploads/...`). Never trust the client `Content-Type` for stored objects — that was a stored-XSS vector.

### Two design systems in one `src/index.css`
All pages share stable CSS class names (`.btn-primary`, `.panel`, `.profile-link`, …), so re-skinning a selector propagates everywhere.
- **Acid Pop / Y2K** (acid lime `#ccff00` + magenta `#ff1f9c` on near-black) — site-wide chrome (marketing, auth, dashboard, shop, invoice). Brand colors are in `:root` (`--acid`, `--magenta`, `--bg`, `--ink`).
- **Public profile** (`PublicProfile.tsx`) — everything under `.public-page` is **token-driven**, not hardcoded. Each theme is a full set of CSS custom properties (`--page-bg`, `--surface`, `--surface-solid`, `--text`, `--muted`, `--border`, `--primary`, `--on-primary`, `--ring`) declared as `.theme-X, .public-page.theme-X { … }`. Every element paints from those tokens, so adding a theme = one token block; **never hardcode a color under `.public-page`**. Free-style overrides: the user's `buttonBackground`→`--primary` and `pageBackground`→`--page-bg` are applied **inline only when non-empty** (`profileStyleVars` in `src/lib/profileStyle.ts`); empty means "use the theme." Theme/style enums live in `src/lib/types.ts` **and** the `User` model's Mongoose `enum` — extend both or saves fail validation.

### Shared profile card (WYSIWYG)
`src/components/ProfileCard.tsx` renders the public-profile body and is used by **both** `PublicProfile.tsx` (live) and `PhonePreview.tsx` (the edit-page preview, which wraps it in `.public-page.phone-frame` so the preview is pixel-identical to the real page). Edit profile rendering in one place, not two.

### Icon system
`src/lib/icons.ts` is the single source: `lucideIcons` (name→lucide component), `brandIcons` (name→`simple-icons` path, with LinkedIn inlined since it was removed from the package), `iconOptions` (the ordered picker list), and `iconForUrl()` (auto-detects an icon from a link's domain). `IconBadge` renders brand marks as **filled** SVG (`.brand-svg { fill: currentColor }`) and lucide as **stroked** — the fill must be scoped to `.brand-svg`; a blanket `svg { fill }` fills lucide outlines solid and destroys their detail. `IconPicker.tsx` is the searchable popup. `LinkItem.display` (`'button' | 'icon'`) splits links into full buttons vs the compact social-icon row.

## Gotchas
- **Mongoose async hooks must not call `next()`.** An `async function(next)` pre-save hook throws `"next is not a function"` (modern Mongoose doesn't pass `next` to async hooks) — return/throw instead.
- **Two `publicUser()` projections** (`authRoutes.js`, `userRoutes.js`) + the theme/style **Mongoose `enum`s** must stay in sync with `src/lib/types.ts` when adding user fields/themes, or fields silently drop / saves fail validation.
- **Brand vs lucide icon fill**: scope `fill: currentColor` to `.brand-svg` only; filling lucide (stroke) icons solid hides their detail.
- **`react-hooks/set-state-in-effect`** (eslint-plugin-react-hooks 7) errors on synchronous `setState` in an effect body — use a lazy `useState` initializer or set state from async callbacks/event handlers instead.
- `npm run lint` (`eslint .`) can trip on stray files outside `src/` (e.g. `.remember/`); lint `src` specifically when verifying.
- Frontend demo data was removed — pages fetch real API data with empty states; the **server seed** (`server/scripts/seed.js`, the `zara` profile) still exists for `npm run seed` but nothing in the UI falls back to it.
- README has stale `onetapz.link` references; the live domain is **onetapz.me**.

## Demo profile
`npm run seed` (with `MONGO_URI`) seeds the `zara` demo profile from **`server/scripts/seed.js`** (`demoUser` + `Link.insertMany([...])`). This is server-only seed data; the frontend no longer references it.

## Conventions
TypeScript + ES modules throughout. Two-space indent, single quotes, semicolons. Components `PascalCase`, hooks/helpers `camelCase`, route files by feature. Shared frontend types in `src/lib/types.ts`; reuse the shared CSS classes / theme tokens rather than introducing new ad-hoc styling. Prefer `lucide-react` icons (brand marks via `src/lib/icons.ts`).
