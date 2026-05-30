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

## Sample Profile

To seed a sample profile into MongoDB after configuring `MONGO_URI`:

```bash
npm run seed
```

Sample public profile:

```text
http://localhost:5173/zara
```

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
