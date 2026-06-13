# Responsive UI/UX Polish Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make every OneTapZ surface comfortable and unbroken from 360px phones to desktop, keeping the Acid Pop identity unchanged.

**Architecture:** CSS-led. Almost all changes are appended to a single new "RESPONSIVE POLISH" section at the end of `src/index.css` (later rules win on equal specificity, so they cleanly override earlier ones). The only component edits are `DashboardLayout.tsx` (mobile nav strip) and swapping six admin text-buttons from `.btn-icon` to a new `.btn-text` class.

**Tech Stack:** React 19 + TypeScript, plain CSS in `src/index.css` (no Tailwind config changes, no new deps). Verified via `tsc -b` + `eslint src` + `npm run build` (no test runner in this repo).

**Spec:** `docs/superpowers/specs/2026-06-13-responsive-ui-polish-design.md`

**Deviations from spec (found during planning, all reduce scope/risk):**
- `.btn-primary`/`.btn-ghost`/`.btn-icon` **already** have `min-height: 48px` (shared rule at `src/index.css:196`), so no button min-height work is needed.
- The auth card is already `width: min(440px, 100%)` inside a padded grid; the KHQR payment card is already `max-width: 340px` with a 220px QR — both already fit ≥320px. These become **verify-only**, not edits.
- The raw `@media (max-width: 900px)` block controls the **top navbar + marketing grids**, not the dashboard sidebar (which uses the Tailwind `lg:` grid = 1024px). Realigning it would change navbar behavior on tablets for no dashboard benefit, so we **leave it alone** and implement the dashboard strip at `lg` to match its existing grid.

---

### Task 1: Dashboard mobile nav strip

**Files:**
- Modify: `src/components/DashboardLayout.tsx` (whole file, currently 37 lines)
- Modify: `src/index.css` (append base `.dash-tabs` rules in Task 4's new section — but the class is introduced here)

- [ ] **Step 1: Rewrite `src/components/DashboardLayout.tsx`**

Replace the entire file with:

```tsx
import type { ReactNode } from 'react';
import { NavLink } from 'react-router-dom';
import { BarChart3, CreditCard, LayoutDashboard, Link2, UserPen } from 'lucide-react';

const items = [
  { to: '/dashboard', label: 'Overview', icon: LayoutDashboard },
  { to: '/edit-profile', label: 'Edit profile', icon: UserPen },
  { to: '/links', label: 'Manage links', icon: Link2 },
  { to: '/nfc', label: 'NFC card', icon: CreditCard },
  { to: '/analytics', label: 'Analytics', icon: BarChart3 },
];

export function DashboardLayout({ title, children }: { title: string; children: ReactNode }) {
  return (
    <main className="page-shell grid gap-6 py-8 lg:grid-cols-[240px_1fr]">
      <aside className="panel hidden h-fit p-3 lg:block">
        {items.map((item) => {
          const Icon = item.icon;
          return (
            <NavLink key={item.to} to={item.to} className="side-link">
              <Icon size={18} />
              {item.label}
            </NavLink>
          );
        })}
      </aside>
      <section>
        <nav className="dash-tabs lg:hidden" aria-label="Dashboard sections">
          {items.map((item) => {
            const Icon = item.icon;
            return (
              <NavLink key={item.to} to={item.to} className="side-link">
                <Icon size={16} />
                {item.label}
              </NavLink>
            );
          })}
        </nav>
        <div className="mb-6">
          <p className="eyebrow">Creator dashboard</p>
          <h1 className="section-title">{title}</h1>
        </div>
        {children}
      </section>
    </main>
  );
}
```

What changed: `<aside>` is now `hidden … lg:block` (takes no space below 1024px); a new `.dash-tabs` `<nav>` (shown only below `lg`) renders the same items as a horizontal strip above the title. `.dash-tabs` CSS is added in Task 4.

- [ ] **Step 2: Type-check**

Run: `npx tsc -b`
Expected: exit 0. (The strip is unstyled until Task 4 but valid.)

- [ ] **Step 3: Commit**

```bash
git add src/components/DashboardLayout.tsx
git commit -m "feat(ui): mobile horizontal nav strip for dashboard, hide sidebar below lg"
```

---

### Task 2: Add `.btn-text` and convert admin text-buttons

**Files:**
- Modify: `src/components/admin/AdminUsers.tsx` (lines 139, 142, 276, 307, 311)
- Modify: `src/components/admin/AdminOrders.tsx` (line 82)
- (The `.btn-text` CSS rule is added in Task 4.)

Context: `.btn-icon` is a fixed `48px` square with `padding: 0` (`src/index.css:235`). The admin Prev/Next/Remove-photo/Delete-user/Cancel/Export-CSV buttons put **text** inside it, so the text overflows the 48px box. Switch those to `.btn-text` (auto width, real padding). Keep true icon-only buttons (chevron, link toggle/delete) on `.btn-icon`.

- [ ] **Step 1: In `src/components/admin/AdminUsers.tsx`, convert the Prev button**

Replace:

```tsx
          <button className="btn-icon" type="button" disabled={page <= 1} onClick={() => setPage(page - 1)}>
            Prev
          </button>
```

with:

```tsx
          <button className="btn-text" type="button" disabled={page <= 1} onClick={() => setPage(page - 1)}>
            Prev
          </button>
```

- [ ] **Step 2: Convert the Next button**

Replace:

```tsx
          <button className="btn-icon" type="button" disabled={page >= pages} onClick={() => setPage(page + 1)}>
            Next
          </button>
```

with:

```tsx
          <button className="btn-text" type="button" disabled={page >= pages} onClick={() => setPage(page + 1)}>
            Next
          </button>
```

- [ ] **Step 3: Convert the "Remove photo" button**

Replace:

```tsx
          <button className="btn-icon" type="button" onClick={stripImage}>
            <EyeOff size={15} /> Remove photo
          </button>
```

with:

```tsx
          <button className="btn-text" type="button" onClick={stripImage}>
            <EyeOff size={15} /> Remove photo
          </button>
```

- [ ] **Step 4: Convert the "Delete user" button**

Replace:

```tsx
          <button className="btn-icon" type="button" style={{ color: '#ff1f9c' }} onClick={deleteUser}>
            <Trash2 size={15} /> {confirmDelete ? 'Confirm delete? This removes their links and cards.' : 'Delete user'}
          </button>
```

with:

```tsx
          <button className="btn-text" type="button" style={{ color: '#ff1f9c' }} onClick={deleteUser}>
            <Trash2 size={15} /> {confirmDelete ? 'Confirm delete? This removes their links and cards.' : 'Delete user'}
          </button>
```

- [ ] **Step 5: Convert the "Cancel" button**

Replace:

```tsx
            <button className="btn-icon" type="button" onClick={() => setConfirmDelete(false)}>
              Cancel
            </button>
```

with:

```tsx
            <button className="btn-text" type="button" onClick={() => setConfirmDelete(false)}>
              Cancel
            </button>
```

- [ ] **Step 6: In `src/components/admin/AdminOrders.tsx`, convert the Export CSV button**

Replace:

```tsx
        <button className="btn-icon" type="button" disabled={exporting} onClick={exportCsv}>
          <Download size={15} /> {exporting ? 'Exporting…' : 'Export CSV'}
        </button>
```

with:

```tsx
        <button className="btn-text" type="button" disabled={exporting} onClick={exportCsv}>
          <Download size={15} /> {exporting ? 'Exporting…' : 'Export CSV'}
        </button>
```

- [ ] **Step 7: Type-check + lint**

Run: `npx tsc -b && npx eslint src/components/admin`
Expected: exit 0. (Buttons are unstyled-as-`.btn-text` until Task 4, but valid.)

- [ ] **Step 8: Commit**

```bash
git add src/components/admin/AdminUsers.tsx src/components/admin/AdminOrders.tsx
git commit -m "feat(ui): use .btn-text for admin text actions instead of fixed-width .btn-icon"
```

---

### Task 3: EditProfile preview order on mobile

**Files:**
- Read first: `src/pages/EditProfile.tsx` (find the `editor-grid` container and its children order)

Context: the spec wants the live phone preview to sit **below** the form on mobile. The `editor-grid` collapses to one column at the breakpoint; whichever child is **first in source order** ends up on top. We want the form first, preview second.

- [ ] **Step 1: Inspect the editor grid order**

Run: `grep -n "editor-grid" src/pages/EditProfile.tsx`
Then read ~10 lines after that match to see whether the form or the `PhonePreview` is the first child.

- [ ] **Step 2: If the preview is the first child, move it after the form**

If (and only if) `PhonePreview`/the preview column appears **before** the form column inside `editor-grid`, reorder so the form column is first and the preview column is second. If the form is already first, make **no change** and note "already form-first" — skip to Step 3.

(No code block here because the exact JSX depends on what Step 1 reveals; the change is purely reordering the two existing children of `editor-grid`, not rewriting them.)

- [ ] **Step 3: Type-check**

Run: `npx tsc -b`
Expected: exit 0.

- [ ] **Step 4: Commit (only if a change was made)**

```bash
git add src/pages/EditProfile.tsx
git commit -m "fix(ui): show edit-profile form before live preview on mobile"
```

If no change was needed, skip this commit.

---

### Task 4: Responsive CSS section (the bulk of the work)

**Files:**
- Modify: `src/index.css` (append a new section at the very end of the file)

- [ ] **Step 1: Append the responsive-polish section to `src/index.css`**

Add this block at the **end** of the file (after the last existing rule):

```css
/* ============================================================
   RESPONSIVE POLISH
   Appended last so these overrides win on equal specificity.
   Keeps the Acid Pop look; fixes layout/touch ergonomics only.
   ============================================================ */

/* Dashboard mobile nav: horizontal, scrollable strip reusing .side-link.
   Shown only below lg (lg:hidden on the element). */
.dash-tabs {
  display: flex;
  gap: 8px;
  margin-bottom: 20px;
  padding-bottom: 4px;
  overflow-x: auto;
  -webkit-overflow-scrolling: touch;
  scrollbar-width: none;
}
.dash-tabs::-webkit-scrollbar {
  display: none;
}
.dash-tabs .side-link {
  flex: 0 0 auto;
  white-space: nowrap;
  padding: 0.6rem 0.85rem;
  font-size: 0.75rem;
}

/* Text action button: like .btn-icon's surface, but sized to its content.
   Used for admin Prev/Next/Export/Delete/Cancel/Remove-photo. */
.btn-text {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  gap: 0.4rem;
  min-height: 44px;
  padding: 0.5rem 0.9rem;
  border: 1px solid rgba(255, 255, 255, 0.22);
  border-radius: var(--radius);
  background: var(--bg-3);
  color: var(--ink);
  font-family: var(--font-mono);
  font-size: 0.8rem;
  font-weight: 700;
  cursor: pointer;
  transition: border-color 120ms ease, color 120ms ease;
}
.btn-text:hover:not(:disabled) {
  border-color: var(--acid);
  color: var(--acid);
}
.btn-text:disabled {
  opacity: 0.45;
  cursor: not-allowed;
}

/* Tab/filter chip rows scroll horizontally instead of wrapping raggedly. */
.profile-tab {
  white-space: nowrap;
}

/* Inputs: ensure a comfortable tap height everywhere. */
.input {
  min-height: 44px;
}

@media (max-width: 640px) {
  /* Stop iOS Safari from zooming when focusing a sub-16px input. */
  .input {
    font-size: 16px;
  }

  /* Admin/list rows: let the action cluster wrap below the label instead of
     crushing long names/URLs. */
  .admin-row {
    flex-wrap: wrap;
    row-gap: 10px;
  }

  /* The 4-tab admin bar and edit-profile tabs can exceed the viewport; scroll
     them instead of letting flex:1 squash labels. */
  .profile-tabs {
    overflow-x: auto;
    scrollbar-width: none;
  }
  .profile-tabs::-webkit-scrollbar {
    display: none;
  }
  .profile-tab {
    flex: 0 0 auto;
  }
}
```

- [ ] **Step 2: Build to confirm the CSS compiles and is bundled**

Run: `npm run build`
Expected: exit 0, Vite build completes (CSS is processed during build).

- [ ] **Step 3: Commit**

```bash
git add src/index.css
git commit -m "feat(ui): responsive CSS — dash strip, btn-text, mobile row-wrap, input touch sizing"
```

---

### Task 5: Cross-surface verification & targeted fixes

**Files:** none up front — this task **observes** each surface at multiple widths and only edits if a concrete break is found.

- [ ] **Step 1: Frontend verify loop**

Run: `npx tsc -b && npx eslint src && npm run build`
Expected: all exit 0.

- [ ] **Step 2: Start the app**

Run: `npm run dev`
Expected: Vite on `:5173`, Express on `:5001`.

- [ ] **Step 3: Responsive walkthrough with Chrome DevTools MCP**

For each width **375, 768, 1024, 1440** visit and visually check (use the chrome-devtools MCP `new_page`/`navigate_page`/`resize_page`/`take_screenshot`):
- `/` (Home), `/login`, `/register`
- `/dashboard`, `/edit-profile`, `/links`, `/nfc`, `/analytics`
- `/admin` (click through Overview / Users / Orders / NFC Cards)
- `/shop`, and a public profile (e.g. `/zara` if seeded)

For each, confirm: **no horizontal page scroll**, no clipped text, no crushed rows, the dashboard strip appears < 1024px and the sidebar appears ≥ 1024px, primary actions are tappable (≥44px). Capture a screenshot at 375px for the dashboard and admin Users tab as evidence.

- [ ] **Step 4: Fix only concrete breaks found**

If a specific element overflows or crushes, add a **targeted** rule to the RESPONSIVE POLISH section in `src/index.css` (same append-at-end pattern). Do not refactor unrelated styles. Re-run `npm run build` after any edit.

- [ ] **Step 5: Final verify + commit any fixes**

Run: `npx tsc -b && npx eslint src && npm run build`
Expected: exit 0.

```bash
git add -A src/index.css
git commit -m "fix(ui): targeted responsive fixes from cross-surface walkthrough"
```

(If Step 4 found nothing, skip this commit.)

- [ ] **Step 6: Check off this plan**

```bash
git add docs/superpowers/plans/2026-06-13-responsive-ui-polish.md
git commit -m "docs: check off responsive UI polish plan"
```

**Deploy (`vercel --prod --yes`) is a separate, user-approved step — not part of this plan.**
