# OneTapZ

OneTapZ is a digital-profile / NFC-card / link-in-bio app: tap a card (or scan a QR) to open someone's whole profile — links, socials, contact details — at `onetapz.me/<username>`. It pairs a **Vite + React 19 (TypeScript)** frontend with an **Express 5 + MongoDB (Mongoose)** API in a single repo, deployed as a Vite static build plus one Vercel serverless function.

**Live:** https://onetapz.me

## Features

- **Public profiles** — themeable link-in-bio page at `/<username>`, edge-cached for fast NFC/QR opens.
- **NFC + QR sharing** — the card stores the profile URL; the page renders a downloadable QR for the scan-to-view fallback.
- **Save contact (vCard)** — visitors download the profile as a `.vcf` straight into their address book.
- **Telegram auth** — Login Widget on web plus a Telegram **Mini App** (auto sign-in), with **inbound bot commands** (`/start`, `/myprofile`, `/stats`, `/addlink`).
- **Shop** — sells NFC cards and accepts **KHQR (Bakong)** payments via CamRapidPay, with a public invoice page.
- **Themes** — token-driven palettes plus free-style page/button colors, edited live (WYSIWYG preview).
- **Analytics & admin** — per-profile views/clicks and an admin dashboard for users and NFC cards.

## Stack

- **Frontend:** React 19, React Router, TypeScript, Tailwind CSS 4, Axios, Lucide / Simple Icons, `qrcode`, `html-to-image`
- **Backend:** Node.js, Express 5, MongoDB + Mongoose, JWT auth (`bcryptjs`), `multer` uploads
- **Platform:** Vercel (serverless function + static build), Vercel Blob (image storage), Vercel Analytics + Speed Insights
- **Integrations:** Telegram Bot API (login, Mini App, bot commands), CamRapidPay (KHQR / Bakong)

## Quick Start

```bash
npm install
cp .env.example .env   # then fill in MONGO_URI, JWT_SECRET, etc.
npm run dev
```

The client runs at `http://localhost:5173` and the API at `http://localhost:5001` (Vite proxies `/api` and `/uploads` to the server).

### Scripts

| Command | Description |
| --- | --- |
| `npm run dev` | Client + server together |
| `npm run client` / `npm run server` | Run one side only |
| `npm run build` | `tsc -b && vite build` (type-check + production build) |
| `npm run lint` | ESLint (frontend `*.ts`/`*.tsx`) |
| `npm run start` | Express server standalone (production entry) |
| `npm run seed` | Seed/refresh the `zara` demo profile (needs `MONGO_URI`) |
| `npm run bot:setup` | One-time: register the Telegram webhook + command menu |

## Environment

Set these in `.env` (copy from `.env.example`). Keep real credentials out of committed files.

| Variable | Purpose |
| --- | --- |
| `MONGO_URI` | MongoDB Atlas connection string (**required**) |
| `JWT_SECRET` | Signs 7-day auth tokens (**required**) |
| `VITE_TELEGRAM_BOT_NAME` | Public bot name for the Login Widget / Mini App (build-time inlined) |
| `TELEGRAM_BOT_TOKEN` | Server-side Telegram verification + DMs |
| `TELEGRAM_WEBHOOK_SECRET` | Authenticates inbound bot webhook calls |
| `CLIENT_URL` / `PUBLIC_BASE_URL` | CORS origin and the public profile / webhook base URL |
| `CAM_RAPID_PAY_API_KEY` | CamRapidPay (KHQR) key for the shop |
| `ADMIN_TELEGRAM_USERNAMES` | Comma-separated usernames granted the `admin` role on Telegram login |
| `BLOB_READ_WRITE_TOKEN` | Vercel Blob token for image uploads (prod); local dev falls back to disk |

> Atlas note: allow `0.0.0.0/0` in Network Access so Vercel's rotating serverless IPs can connect.

## API

Feature routers are mounted under `/api/{auth, profile, users, links, nfc, analytics, admin, shop, telegram}`. Highlights:

- `POST /api/auth/register` · `POST /api/auth/login` · `GET /api/auth/me`
- `POST /api/auth/telegram` (Login Widget) · `POST /api/auth/telegram/webapp` (Mini App)
- `GET /api/profile/:username` — public, edge-cached profile (the NFC/QR target)
- `GET|POST|PUT|DELETE /api/links` · `PUT /api/links/reorder` · `POST /api/links/:id/click`
- `POST /api/shop/checkout` · `GET /api/shop/order/:reference` (public invoice)
- `POST /api/telegram/webhook` — inbound bot commands
- `GET /api/analytics/me` · `POST /api/analytics/view`
- `GET /api/admin/users` · `GET /api/admin/nfc-cards`

## Demo profile

A polished demo profile is seeded for you at **https://onetapz.me/zara**. Its content lives in one config-style file, **`server/scripts/seed.js`** — edit `demoUser` and the `Link.insertMany([...])` array, then run `npm run seed`.

The NFC card simply stores the profile URL (`https://onetapz.me/zara`); write it with any phone app such as **NFC Tools** — no card programming required.

## Deployment

Production deploys to **Vercel** straight from the working tree:

```bash
vercel --prod --yes
```

`vercel.json` rewrites `/api/*` and `/uploads/*` to the serverless function (`api/index.js`, which re-exports `server/app.js`) and everything else to the SPA. The function is pinned to the `sin1` region to sit next to the Atlas cluster. `VITE_*` vars are build-time inlined, so changing them requires a redeploy.
