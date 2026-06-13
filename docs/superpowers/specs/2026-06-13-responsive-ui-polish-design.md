# Responsive UI/UX Polish — Design

**Date:** 2026-06-13
**Status:** Approved

## Goal

Make OneTapZ comfortable and unbroken at every screen size (phone → desktop)
**without changing the Acid Pop / neon visual identity**. Pure responsive and
touch-ergonomic fixes: no visual refresh, no new dependencies, no new pages.

## Decisions

- **Keep the look.** Acid Pop chrome and token-driven public-profile themes stay
  exactly as-is. Changes are layout/spacing/touch only.
- **CSS-led.** Fix at the shared-class level in `src/index.css` so a selector
  change propagates everywhere, matching the repo's styling convention. The only
  structural component edit is `DashboardLayout.tsx` (mobile nav strip).
- **Dashboard mobile nav = horizontal-scroll tab strip** (not bottom bar / not
  collapsible menu).
- **Breakpoints:** standardize on Tailwind's stops — `sm = 640px`, `lg = 1024px`.
  Realign the existing raw CSS `@media (max-width: 900px)` block to `1024px` so the
  dashboard sidebar break agrees with the `lg:` utilities already in the markup.
  Keep the existing `640px` block.

## Changes by area

### 1. Dashboard shell — `src/components/DashboardLayout.tsx` + CSS

- Grid stays `lg:grid-cols-[240px_1fr]`. The `<aside>` becomes `hidden lg:block`
  so it occupies no space below 1024px.
- Add a `.dash-tabs` horizontal-scroll strip rendered at the top of the content
  `<section>`, shown only below `lg` (`lg:hidden`). It maps the **same** `items`
  array and reuses `.side-link` styling (active state via `NavLink`).
- New CSS: `.dash-tabs { display:flex; gap:8px; overflow-x:auto; scrollbar-width:none; }`
  `.dash-tabs::-webkit-scrollbar { display:none; }`, with `.dash-tabs .side-link`
  set to `white-space:nowrap; flex:0 0 auto;`.

### 2. Touch targets & form ergonomics (CSS)

- `.input`: add `min-height: 44px`. On `max-width: 640px` set `font-size: 16px`
  to stop iOS zoom-on-focus. (Color inputs keep their existing sizing.)
- `.btn-primary`, `.btn-ghost`: `min-height: 44px` at `max-width: 640px`.
- `.btn-icon` stays 48px square for true icon buttons. Add a `.btn-text` variant
  (auto width, horizontal padding, 44px min-height) for the admin **text** actions
  that currently borrow `.btn-icon` (Prev / Next / Export CSV / Delete user /
  Remove photo / Cancel). Update those call sites in `AdminUsers.tsx` and
  `AdminOrders.tsx` to use `.btn-text`.

### 3. Rows & bars that overflow (CSS)

- `.admin-row`: at `max-width: 640px` switch to `flex-wrap: wrap` with the action
  cluster dropping below the label (`row gap`), so long names/URLs aren't crushed.
  `min-width: 0` already present where needed; keep truncation.
- Tab/filter bars (`.profile-tabs`, admin Orders filter row): allow
  `overflow-x: auto` with hidden scrollbars so chips scroll instead of wrapping
  raggedly on narrow widths. `.profile-tab { white-space: nowrap; }`.

### 4. Per-surface sweep

- **Shop (`Shop.tsx` / CSS):** KHQR QR image `max-width: 260px; width: 100%;
  height:auto` centered; checkout form fields full-width; product grid already
  `sm:grid-cols-2` (keep).
- **Invoice (`Invoice.tsx`):** ensure the summary/line items stack cleanly under
  ~480px (full-width rows, no fixed widths).
- **EditProfile (`EditProfile.tsx`):** live phone preview sits **below** the form
  on mobile (the `editor-grid` already collapses at the breakpoint — verify it
  reads form-first, preview-second in source order; adjust order if not).
- **Auth (`Login.tsx` / `Register.tsx` / CSS):** auth card
  `width: min(420px, 100% - 32px)`; inputs inherit the §2 sizing.
- **Marketing (`Home.tsx`):** existing 900/640 blocks mostly cover it; verify hero
  title clamp and section grids at 360px; fix only what overflows.
- **Admin tab bar:** the 4-tab `.profile-tabs mb-6` strip uses the §3 scroll
  behavior; metric grid (`auto-fill minmax(160px,1fr)`) already responsive.

### 5. Global

- Keep `body { overflow-x: hidden }` as a safety net but fix the **actual**
  overflow sources found in the sweep (don't rely on it to hide breakage).

## Out of scope (YAGNI)

- Any color/typography/motion redesign.
- `useMediaQuery` hook or JS-driven layout switching.
- Bottom navigation bar; PWA/install; theme light/dark toggle.
- New components beyond the dashboard mobile strip.

## Verification

- `tsc -b`, `eslint src`, `npm run build`.
- Chrome DevTools responsive check at **375 / 768 / 1024 / 1440 px** on: Home,
  Login/Register, Dashboard, Edit Profile, Manage Links, NFC, Analytics, Admin
  (all tabs), Shop, Invoice, and a public profile. No horizontal scroll, no
  crushed rows, all primary actions reachable with a thumb.
- Deploy (`vercel --prod`) is a separate, explicit step.
