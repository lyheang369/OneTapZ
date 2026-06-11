# Admin Panel v2 — Design

**Date:** 2026-06-11
**Status:** Approved

## Goal

Expand the existing `/admin` page (orders list, user toggle/delete, read-only NFC cards) into a
real control panel covering four areas: platform stats, full user management, content moderation,
and order/shop control.

## Decisions made

- **Layout:** single `/admin` route with tabs — `Overview | Users | Orders | NFC Cards`.
  Moderation lives inside the Users tab (expandable user detail), not a fifth tab.
- **Delete policy:** hard delete with cascade (links, analytics doc, NFC card bindings).
  Orders are kept for accounting. UI requires a two-step inline confirm (no `window.confirm`).
- **Approach:** dedicated admin API — server-side search/pagination/aggregation, per-tab
  frontend components. No new dependencies (no react-query / react-table).

## Backend — `server/routes/adminRoutes.js`

All endpoints remain behind the existing `router.use(protect, adminOnly)`. Routes use
`asyncHandler`; errors thrown with `.status` reach the shared error middleware.

### Endpoints

| Method & path | Behavior |
|---|---|
| `GET /admin/stats` | `Promise.all` of aggregates: total users, new users (last 7 days), total links, summed `Analytics` (`profileViews`, `linkClicks`, `tapCount`), order counts by status, paid revenue sum. Returns one flat `stats` object. |
| `GET /admin/users` | Query params: `search` (regex-escaped, matched against name/username/email), `status` (`active`/`inactive`), `page` (default 1), fixed limit 20. Sorted `-createdAt`, `-password` projection. Returns `{ users, total, page, pages }`. |
| `PUT /admin/users/:id` | Whitelisted fields only: `name, username, email, bio, role, isActive, profileImage` (empty string strips an offending image). Username: lowercase, `/^[a-z0-9_-]+$/`, uniqueness checked. Returns updated `-password` user. |
| `DELETE /admin/users/:id` | Cascade: `Link.deleteMany({ userId })`, `Analytics.deleteOne({ userId })`, `NfcCard.deleteMany({ userId })`. Orders kept. |
| `GET /admin/users/:id/links` | The user's links sorted by `order` — moderation view. |
| `PUT /admin/links/:id/status` | Toggle `isActive` from `req.body.isActive`. No URL writes, so the URL safety filter is not involved. |
| `DELETE /admin/links/:id` | Remove an offending link. |
| `GET /admin/orders` | Query params: `status` (`pending`/`paid`/`expired`), `fulfilled` (`true`/`false`). Keeps the existing 200 cap and `-createdAt` sort. Existing `PUT /admin/orders/:id/fulfill` unchanged. |

### Self-lockout guard

An admin cannot change their own `role`, set their own `isActive: false`, or delete their own
account (`req.user.id === req.params.id` → 400). Prevents a sole admin from locking everyone out.

### Cache note

Deactivating a user or removing links propagates to the public profile within the edge cache TTL
(`s-maxage=30, stale-while-revalidate=60`) — acceptable; no purge mechanism needed.

## Frontend

### Structure

- `src/pages/AdminDashboard.tsx` → thin tab shell holding `tab` state; renders one of four
  components from `src/components/admin/`:
  - `AdminStats.tsx` — Overview: metric cards (users, new-7d, views, clicks, taps, orders, revenue).
  - `AdminUsers.tsx` — search input, active/inactive filter, paginated list. Clicking a row
    expands a detail panel: (a) edit form for whitelisted fields + role select, (b) the user's
    links with disable/delete buttons, (c) danger zone with cascade delete behind a two-step
    inline confirm (button flips to "Confirm delete?", with cancel).
  - `AdminOrders.tsx` — status/fulfilled filter chips, current order cards, fulfill toggle,
    buyer Telegram handle linked (`https://t.me/<username>`) when present.
  - `AdminCards.tsx` — existing read-only NFC card list, extracted as-is.
- Each tab fetches lazily on first activation. No new top-level route (`/admin` already in
  `appRoutes`); the page stays one lazy chunk.

### Styling & types

- Reuse Acid Pop chrome: `.panel`, `.admin-row`, `.btn-primary`, `.btn-icon`, `status-on/off`.
  New small styles (tab bar, metric cards) added to `src/index.css` following existing class
  conventions — no new design system.
- Add `AdminStats` type to `src/lib/types.ts`. Admin routes return raw `-password` docs, so the
  two `publicUser()` projections are unaffected.

### Error handling

Per-tab `error`/`loading` string state, matching existing page patterns. Mutations update local
state from the server response (no refetch storms).

## Out of scope (YAGNI)

- Audit log of admin actions.
- Bulk operations (multi-select ban/delete).
- CSV export.
- Blob cleanup of orphaned profile images on delete (images are small; revisit if needed).

## Verification

`tsc -b`, `eslint src`, `npm run build` (frontend); `node --check server/routes/adminRoutes.js`
(server); manual run with `npm run dev`. Production deploy (`vercel --prod`) is a separate,
explicit step.
