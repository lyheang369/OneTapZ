# OneTapZ

OneTapZ is a Vite React and Express/MongoDB MVP for digital profiles, NFC card sharing, QR codes, links, themes, analytics, and admin management.

## Stack

- React, React Router, Tailwind CSS, Axios
- Lucide React, Simple Icons, Bootstrap Icons
- Node.js, Express, MongoDB, Mongoose
- JWT auth with bcrypt password hashing
- Clerk React authentication controls

## Quick Start

```bash
npm install
cp .env.example .env
npm run dev
```

The app runs at `http://localhost:5173` and the API runs at `http://localhost:5001`.

## Clerk

Clerk CLI has been initialized for the Clerk app `app_3ER88ZTIgC7J3EQfwLAMWCT4JNr`. The generated Clerk values are in `.env.local`.

Run diagnostics:

```bash
clerk doctor
```

The navigation includes Clerk sign-in, sign-up, and signed-in user controls. The app also includes local JWT login/register pages for the Express API MVP.

## MongoDB

Set `MONGO_URI` in `.env` using your MongoDB Atlas host and credentials. Keep real credentials out of committed files.

## Demo profile (class demo)

The public profile page — the page the NFC card opens — lives at `/<username>`
and is what to show in the live demo. A polished demo profile is seeded for you:

- **Live:** https://onetapz.me/zara

### Edit the demo content (no dashboard needed)

All demo content is in one config-style file: **`server/scripts/seed.js`**.
Edit the `demoUser` fields (name, bio, `profileImage`, `pageBackground`,
`buttonBackground`) and the `Link.insertMany([...])` array (each link's `title`,
`url`, and `icon`), then run:

```bash
npm run seed
```

Supported link `icon` values: `instagram`, `tiktok`, `linkedin`, `youtube`,
`twitter`/`x`, `github`, `mail`, `portfolio`, `music`, `link`.

> Prefer a UI? Log in at `/login` as the demo account (`demo@onetapz.link` /
> `Demo1234!`) and edit everything from the dashboard instead.

### NFC + QR

The NFC card just stores the deployed URL (`https://onetapz.me/zara`) — write it
with a phone app like **NFC Tools**; no card programming needed. The profile page
also renders a **QR code** (with a Download button) pointing to the same URL for
the "scan to view" fallback.

## API Routes

- `POST /api/auth/register`
- `POST /api/auth/login`
- `GET /api/auth/me`
- `GET /api/users/me`
- `PUT /api/users/me`
- `GET /api/users/profile/:username`
- `POST /api/links`
- `GET /api/links`
- `PUT /api/links/:id`
- `DELETE /api/links/:id`
- `PUT /api/links/reorder`
- `POST /api/links/:id/click`
- `POST /api/nfc/assign`
- `GET /api/nfc/me`
- `PUT /api/nfc/:id/status`
- `GET /api/analytics/me`
- `POST /api/analytics/view`
- `GET /api/admin/users`
- `GET /api/admin/nfc-cards`
- `PUT /api/admin/users/:id/status`

## Build

```bash
npm run build
```

For deployment, build the React app with Vite and deploy the Express server with `MONGO_URI`, `JWT_SECRET`, Clerk variables, `CLIENT_URL`, and `PUBLIC_BASE_URL` configured.
