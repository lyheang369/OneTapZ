# Admin Panel v2 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Expand `/admin` into a tabbed control panel (Overview / Users / Orders / NFC Cards) with platform stats, searchable user management + moderation, cascade delete, and filterable orders.

**Architecture:** Extend `server/routes/adminRoutes.js` with a dedicated admin API (aggregated stats, server-side search/pagination, whitelisted user edits with a self-lockout guard, cascade delete, link moderation, order filters). The frontend `AdminDashboard.tsx` becomes a thin tab shell over four components in `src/components/admin/`.

**Tech Stack:** Express 5 + Mongoose (server, plain JS), React 19 + TypeScript + axios (client), existing Acid Pop CSS classes in `src/index.css`. **No new dependencies.**

**Spec:** `docs/superpowers/specs/2026-06-11-admin-panel-v2-design.md`

**Verification model:** This repo has **no test runner** (per CLAUDE.md). Server changes are verified with `node --check`; frontend with `tsc -b`, `eslint src`, `npm run build`. Manual smoke test via `npm run dev` at the end.

---

### Task 1: Backend admin API

**Files:**
- Modify: `server/routes/adminRoutes.js` (full rewrite, currently 73 lines)

- [ ] **Step 1: Rewrite `server/routes/adminRoutes.js`**

Replace the entire file with:

```js
import express from 'express';
import User from '../models/User.js';
import Link from '../models/Link.js';
import Analytics from '../models/Analytics.js';
import NfcCard from '../models/NfcCard.js';
import Order from '../models/Order.js';
import { adminOnly, protect } from '../middleware/auth.js';
import { asyncHandler } from '../utils/asyncHandler.js';

const router = express.Router();

router.use(protect, adminOnly);

const httpError = (status, message) => {
  const err = new Error(message);
  err.status = status;
  return err;
};

const escapeRegex = (value) => value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

const USERNAME_RE = /^[a-z0-9_-]+$/;
const USERS_PER_PAGE = 20;

// ---- Overview stats -------------------------------------------------------

router.get(
  '/stats',
  asyncHandler(async (_req, res) => {
    const weekAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);
    const [totalUsers, newUsers7d, totalLinks, analyticsTotals, orderTotals] = await Promise.all([
      User.countDocuments(),
      User.countDocuments({ createdAt: { $gte: weekAgo } }),
      Link.countDocuments(),
      Analytics.aggregate([
        {
          $group: {
            _id: null,
            profileViews: { $sum: '$profileViews' },
            linkClicks: { $sum: '$linkClicks' },
            tapCount: { $sum: '$tapCount' },
          },
        },
      ]),
      Order.aggregate([{ $group: { _id: '$status', count: { $sum: 1 }, revenue: { $sum: '$amount' } } }]),
    ]);

    const totals = analyticsTotals[0] ?? { profileViews: 0, linkClicks: 0, tapCount: 0 };
    const orders = { pending: 0, paid: 0, expired: 0 };
    let revenue = 0;
    for (const row of orderTotals) {
      if (row._id in orders) orders[row._id] = row.count;
      if (row._id === 'paid') revenue = row.revenue;
    }

    res.json({
      stats: {
        totalUsers,
        newUsers7d,
        totalLinks,
        profileViews: totals.profileViews,
        linkClicks: totals.linkClicks,
        tapCount: totals.tapCount,
        orders,
        revenue,
      },
    });
  }),
);

// ---- Users ----------------------------------------------------------------

router.get(
  '/users',
  asyncHandler(async (req, res) => {
    const page = Math.max(1, parseInt(req.query.page, 10) || 1);
    const filter = {};

    const search = String(req.query.search ?? '').trim();
    if (search) {
      const rx = new RegExp(escapeRegex(search), 'i');
      filter.$or = [{ name: rx }, { username: rx }, { email: rx }];
    }
    if (req.query.status === 'active') filter.isActive = true;
    if (req.query.status === 'inactive') filter.isActive = false;

    const [users, total] = await Promise.all([
      User.find(filter)
        .select('-password')
        .sort('-createdAt')
        .skip((page - 1) * USERS_PER_PAGE)
        .limit(USERS_PER_PAGE),
      User.countDocuments(filter),
    ]);

    res.json({ users, total, page, pages: Math.max(1, Math.ceil(total / USERS_PER_PAGE)) });
  }),
);

router.put(
  '/users/:id',
  asyncHandler(async (req, res) => {
    const isSelf = req.user.id === req.params.id;
    const updates = {};

    for (const field of ['name', 'bio', 'profileImage']) {
      if (typeof req.body[field] === 'string') updates[field] = req.body[field].trim();
    }

    if (typeof req.body.email === 'string') {
      const email = req.body.email.trim().toLowerCase();
      const taken = await User.findOne({ email, _id: { $ne: req.params.id } });
      if (taken) throw httpError(400, 'Email is already in use.');
      updates.email = email;
    }

    if (typeof req.body.username === 'string') {
      const username = req.body.username.trim().toLowerCase();
      if (!USERNAME_RE.test(username)) {
        throw httpError(400, 'Username may only contain letters, numbers, hyphens and underscores.');
      }
      const taken = await User.findOne({ username, _id: { $ne: req.params.id } });
      if (taken) throw httpError(400, 'Username is already taken.');
      updates.username = username;
    }

    if (req.body.role === 'user' || req.body.role === 'admin') {
      if (isSelf && req.body.role !== req.user.role) throw httpError(400, 'You cannot change your own role.');
      updates.role = req.body.role;
    }

    if (typeof req.body.isActive === 'boolean') {
      if (isSelf && !req.body.isActive) throw httpError(400, 'You cannot deactivate your own account.');
      updates.isActive = req.body.isActive;
    }

    const user = await User.findByIdAndUpdate(req.params.id, updates, { new: true, runValidators: true }).select(
      '-password',
    );
    if (!user) return res.status(404).json({ message: 'User not found.' });
    res.json({ user });
  }),
);

router.delete(
  '/users/:id',
  asyncHandler(async (req, res) => {
    if (req.user.id === req.params.id) throw httpError(400, 'You cannot delete your own account.');

    const user = await User.findByIdAndDelete(req.params.id);
    if (!user) return res.status(404).json({ message: 'User not found.' });

    // Cascade: profile data goes with the account. Orders are kept for accounting.
    await Promise.all([
      Link.deleteMany({ userId: user._id }),
      Analytics.deleteOne({ userId: user._id }),
      NfcCard.deleteMany({ userId: user._id }),
    ]);

    res.json({ message: 'User and related data deleted.' });
  }),
);

// ---- Link moderation --------------------------------------------------------

router.get(
  '/users/:id/links',
  asyncHandler(async (req, res) => {
    const links = await Link.find({ userId: req.params.id }).sort('order');
    res.json({ links });
  }),
);

router.put(
  '/links/:id/status',
  asyncHandler(async (req, res) => {
    const link = await Link.findByIdAndUpdate(req.params.id, { isActive: !!req.body.isActive }, { new: true });
    if (!link) return res.status(404).json({ message: 'Link not found.' });
    res.json({ link });
  }),
);

router.delete(
  '/links/:id',
  asyncHandler(async (req, res) => {
    const link = await Link.findByIdAndDelete(req.params.id);
    if (!link) return res.status(404).json({ message: 'Link not found.' });
    res.json({ message: 'Link deleted.' });
  }),
);

// ---- Orders -----------------------------------------------------------------

router.get(
  '/orders',
  asyncHandler(async (req, res) => {
    const filter = {};
    if (['pending', 'paid', 'expired'].includes(req.query.status)) filter.status = req.query.status;
    if (req.query.fulfilled === 'true') filter.fulfilled = true;
    if (req.query.fulfilled === 'false') filter.fulfilled = false;

    const orders = await Order.find(filter).sort('-createdAt').limit(200);
    res.json({ orders });
  }),
);

router.put(
  '/orders/:id/fulfill',
  asyncHandler(async (req, res) => {
    const order = await Order.findByIdAndUpdate(req.params.id, { fulfilled: !!req.body.fulfilled }, { new: true });
    if (!order) {
      return res.status(404).json({ message: 'Order not found.' });
    }
    res.json({ order });
  }),
);

// ---- NFC cards ----------------------------------------------------------------

router.get(
  '/nfc-cards',
  asyncHandler(async (_req, res) => {
    const cards = await NfcCard.find().populate('userId', 'name username email').sort('-createdAt');
    res.json({ cards });
  }),
);

export default router;
```

Notes for the implementer:
- The old `PUT /users/:id/status` route is **removed** — `PUT /users/:id` covers `isActive` with the self-guard. The only consumer is `AdminDashboard.tsx`, rewritten in Task 6.
- `req.user.id` is the Mongoose virtual string id (set by `protect` in `server/middleware/auth.js`); comparing against `req.params.id` (string) is correct.
- Mongoose async hooks/gotcha does not apply here (no hooks added).

- [ ] **Step 2: Syntax-check the server file**

Run: `node --check server/routes/adminRoutes.js`
Expected: no output (exit 0).

- [ ] **Step 3: Commit**

```bash
git add server/routes/adminRoutes.js
git commit -m "feat(admin): stats, user search/edit/cascade-delete, link moderation, order filters"
```

---

### Task 2: Frontend types

**Files:**
- Modify: `src/lib/types.ts`

- [ ] **Step 1: Add `AdminStats`, extend `User` and `Order`**

In `src/lib/types.ts`:

1. Add `createdAt?: string;` to the `User` type (after `saveContactDisplay?: LinkDisplay;`).
2. Add to the `Order` type (after `fulfilled: boolean;`):

```ts
  telegramUsername?: string;
```

3. Append at the end of the file:

```ts
export type AdminStats = {
  totalUsers: number;
  newUsers7d: number;
  totalLinks: number;
  profileViews: number;
  linkClicks: number;
  tapCount: number;
  orders: { pending: number; paid: number; expired: number };
  revenue: number;
};
```

- [ ] **Step 2: Type-check**

Run: `npx tsc -b`
Expected: exit 0, no errors.

- [ ] **Step 3: Commit**

```bash
git add src/lib/types.ts
git commit -m "feat(admin): AdminStats type, User.createdAt, Order.telegramUsername"
```

---

### Task 3: Overview tab — `AdminStats` component + metric-card CSS

**Files:**
- Create: `src/components/admin/AdminStats.tsx`
- Modify: `src/index.css` (append metric-card styles near the admin section, after the `.status-off` block ~line 1896)

- [ ] **Step 1: Create `src/components/admin/AdminStats.tsx`**

```tsx
import { useEffect, useState } from 'react';
import { api } from '../../lib/api';
import type { AdminStats as AdminStatsData } from '../../lib/types';

export function AdminStats() {
  const [stats, setStats] = useState<AdminStatsData | null>(null);
  const [error, setError] = useState('');

  useEffect(() => {
    api
      .get('/admin/stats')
      .then(({ data }) => setStats(data.stats))
      .catch(() => setError('Could not load stats.'));
  }, []);

  if (error) return <p className="text-sm text-slate-400">{error}</p>;
  if (!stats) return <p className="text-sm text-slate-400">Loading…</p>;

  const cards: { label: string; value: string | number; hint?: string }[] = [
    { label: 'Users', value: stats.totalUsers, hint: `+${stats.newUsers7d} this week` },
    { label: 'Links', value: stats.totalLinks },
    { label: 'Profile views', value: stats.profileViews },
    { label: 'Link clicks', value: stats.linkClicks },
    { label: 'NFC taps', value: stats.tapCount },
    { label: 'Paid orders', value: stats.orders.paid, hint: `${stats.orders.pending} pending` },
    { label: 'Revenue', value: `$${stats.revenue.toFixed(2)}` },
  ];

  return (
    <section className="panel p-6">
      <div className="metric-grid">
        {cards.map((card) => (
          <div key={card.label} className="metric-card">
            <p className="metric-value">{card.value}</p>
            <p className="metric-label">{card.label}</p>
            {card.hint && <p className="metric-hint">{card.hint}</p>}
          </div>
        ))}
      </div>
    </section>
  );
}
```

- [ ] **Step 2: Append metric-card styles to `src/index.css`**

Insert after the `.status-off { … }` rule (before the `/* PUBLIC PROFILE / PHONE PREVIEW */` banner):

```css
/* Admin overview metric cards. */
.metric-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(160px, 1fr));
  gap: 12px;
}
.metric-card {
  border: 1px solid var(--line-soft);
  border-radius: 12px;
  background: rgba(255, 255, 255, 0.03);
  padding: 16px;
}
.metric-value {
  color: var(--acid);
  font-family: var(--font-mono);
  font-size: 1.6rem;
  font-weight: 700;
}
.metric-label {
  color: var(--ink-dim);
  font-family: var(--font-mono);
  font-size: 0.75rem;
  text-transform: uppercase;
}
.metric-hint {
  margin-top: 4px;
  color: var(--ink-dim);
  font-size: 0.75rem;
}
```

- [ ] **Step 3: Type-check**

Run: `npx tsc -b`
Expected: exit 0. (The component isn't wired into a page yet; that happens in Task 6.)

- [ ] **Step 4: Commit**

```bash
git add src/components/admin/AdminStats.tsx src/index.css
git commit -m "feat(admin): overview stats tab with metric cards"
```

---

### Task 4: Users tab — `AdminUsers` component (search, pagination, edit, moderation, cascade delete)

**Files:**
- Create: `src/components/admin/AdminUsers.tsx`

- [ ] **Step 1: Create `src/components/admin/AdminUsers.tsx`**

```tsx
import { useEffect, useState } from 'react';
import { isAxiosError } from 'axios';
import { ChevronDown, ChevronUp, EyeOff, Search, Trash2 } from 'lucide-react';
import { api } from '../../lib/api';
import { useAuth } from '../../context/AuthContext';
import type { LinkItem, User } from '../../lib/types';

const userId = (user: User) => user._id ?? user.id;

const errorMessage = (err: unknown, fallback: string) =>
  isAxiosError(err) ? ((err.response?.data as { message?: string } | undefined)?.message ?? fallback) : fallback;

type StatusFilter = 'all' | 'active' | 'inactive';

export function AdminUsers() {
  const { user: me } = useAuth();
  const [users, setUsers] = useState<User[]>([]);
  const [total, setTotal] = useState(0);
  const [pages, setPages] = useState(1);
  const [page, setPage] = useState(1);
  const [search, setSearch] = useState('');
  const [debounced, setDebounced] = useState('');
  const [status, setStatus] = useState<StatusFilter>('all');
  const [expanded, setExpanded] = useState<string | null>(null);
  const [error, setError] = useState('');

  useEffect(() => {
    const timer = setTimeout(() => setDebounced(search), 300);
    return () => clearTimeout(timer);
  }, [search]);

  useEffect(() => {
    const params = new URLSearchParams({ page: String(page) });
    if (debounced) params.set('search', debounced);
    if (status !== 'all') params.set('status', status);
    api
      .get(`/admin/users?${params}`)
      .then(({ data }) => {
        setUsers(data.users ?? []);
        setTotal(data.total ?? 0);
        setPages(data.pages ?? 1);
        setError('');
      })
      .catch(() => setError('Could not load users.'));
  }, [page, debounced, status]);

  function onUpdated(updated: User) {
    setUsers((prev) => prev.map((item) => (userId(item) === userId(updated) ? updated : item)));
  }

  function onDeleted(id: string) {
    setUsers((prev) => prev.filter((item) => userId(item) !== id));
    setExpanded(null);
    setTotal((prev) => Math.max(0, prev - 1));
  }

  return (
    <section className="panel p-6">
      <div className="mb-4 flex flex-wrap items-center gap-3">
        <label className="flex flex-1 items-center gap-2 text-slate-400" style={{ minWidth: 220 }}>
          <Search size={16} />
          <input
            className="input"
            placeholder="Search name, username or email"
            value={search}
            onChange={(event) => {
              setSearch(event.target.value);
              setPage(1);
            }}
          />
        </label>
        <select
          className="input"
          style={{ maxWidth: 140 }}
          value={status}
          aria-label="Filter by status"
          onChange={(event) => {
            setStatus(event.target.value as StatusFilter);
            setPage(1);
          }}
        >
          <option value="all">All</option>
          <option value="active">Active</option>
          <option value="inactive">Inactive</option>
        </select>
      </div>

      {error && <p className="text-sm text-slate-400">{error}</p>}
      {!error && users.length === 0 && <p className="text-sm text-slate-400">No users found.</p>}

      <div className="space-y-1">
        {users.map((user) => {
          const id = userId(user);
          const isOpen = expanded === id;
          return (
            <div key={id}>
              <div className="admin-row">
                <div className="min-w-0">
                  <p className="font-bold text-white">
                    {user.name} {user.role === 'admin' && <span className="status-on">admin</span>}
                  </p>
                  <p className="text-sm text-slate-400">
                    @{user.username}
                    {user.createdAt ? ` · joined ${new Date(user.createdAt).toLocaleDateString()}` : ''}
                  </p>
                </div>
                <div className="flex items-center gap-2">
                  <span className={user.isActive ? 'status-on' : 'status-off'}>
                    {user.isActive ? 'active' : 'inactive'}
                  </span>
                  <button
                    className="btn-icon"
                    type="button"
                    aria-label={isOpen ? 'Collapse user' : 'Manage user'}
                    onClick={() => setExpanded(isOpen ? null : id)}
                  >
                    {isOpen ? <ChevronUp size={17} /> : <ChevronDown size={17} />}
                  </button>
                </div>
              </div>
              {isOpen && (
                <UserDetail user={user} isSelf={me ? userId(me) === id : false} onUpdated={onUpdated} onDeleted={() => onDeleted(id)} />
              )}
            </div>
          );
        })}
      </div>

      <div className="mt-4 flex items-center justify-between text-sm text-slate-400">
        <span>
          Page {page} of {pages} · {total} users
        </span>
        <div className="flex gap-2">
          <button className="btn-icon" type="button" disabled={page <= 1} onClick={() => setPage(page - 1)}>
            Prev
          </button>
          <button className="btn-icon" type="button" disabled={page >= pages} onClick={() => setPage(page + 1)}>
            Next
          </button>
        </div>
      </div>
    </section>
  );
}

function UserDetail({
  user,
  isSelf,
  onUpdated,
  onDeleted,
}: {
  user: User;
  isSelf: boolean;
  onUpdated: (user: User) => void;
  onDeleted: () => void;
}) {
  const id = userId(user);
  const [form, setForm] = useState({
    name: user.name,
    username: user.username,
    email: user.email ?? '',
    bio: user.bio ?? '',
    role: user.role,
    isActive: user.isActive ?? true,
  });
  const [links, setLinks] = useState<LinkItem[]>([]);
  const [message, setMessage] = useState('');
  const [saving, setSaving] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);

  useEffect(() => {
    api
      .get(`/admin/users/${id}/links`)
      .then(({ data }) => setLinks(data.links ?? []))
      .catch(() => {});
  }, [id]);

  const set = (field: keyof typeof form) => (value: string | boolean) =>
    setForm((prev) => ({ ...prev, [field]: value }));

  async function save() {
    setSaving(true);
    setMessage('');
    try {
      const { data } = await api.put(`/admin/users/${id}`, form);
      onUpdated(data.user);
      setMessage('Saved.');
    } catch (err) {
      setMessage(errorMessage(err, 'Save failed.'));
    } finally {
      setSaving(false);
    }
  }

  async function stripImage() {
    try {
      const { data } = await api.put(`/admin/users/${id}`, { profileImage: '' });
      onUpdated(data.user);
      setMessage('Profile image removed.');
    } catch (err) {
      setMessage(errorMessage(err, 'Could not remove image.'));
    }
  }

  async function toggleLink(link: LinkItem) {
    const { data } = await api.put(`/admin/links/${link._id}/status`, { isActive: !link.isActive });
    setLinks((prev) => prev.map((item) => (item._id === link._id ? data.link : item)));
  }

  async function deleteLink(link: LinkItem) {
    await api.delete(`/admin/links/${link._id}`);
    setLinks((prev) => prev.filter((item) => item._id !== link._id));
  }

  async function deleteUser() {
    if (!confirmDelete) {
      setConfirmDelete(true);
      return;
    }
    try {
      await api.delete(`/admin/users/${id}`);
      onDeleted();
    } catch (err) {
      setMessage(errorMessage(err, 'Delete failed.'));
      setConfirmDelete(false);
    }
  }

  return (
    <div className="mb-3 rounded-xl border border-white/10 bg-white/[0.03] p-4">
      <div className="grid gap-3 sm:grid-cols-2">
        <label className="text-sm text-slate-400">
          Name
          <input className="input" value={form.name} onChange={(e) => set('name')(e.target.value)} />
        </label>
        <label className="text-sm text-slate-400">
          Username
          <input className="input" value={form.username} onChange={(e) => set('username')(e.target.value)} />
        </label>
        <label className="text-sm text-slate-400">
          Email
          <input className="input" value={form.email} onChange={(e) => set('email')(e.target.value)} />
        </label>
        <label className="text-sm text-slate-400">
          Role
          <select
            className="input"
            value={form.role}
            disabled={isSelf}
            onChange={(e) => set('role')(e.target.value)}
          >
            <option value="user">user</option>
            <option value="admin">admin</option>
          </select>
        </label>
        <label className="text-sm text-slate-400 sm:col-span-2">
          Bio
          <textarea className="input" rows={2} value={form.bio} onChange={(e) => set('bio')(e.target.value)} />
        </label>
      </div>

      <div className="mt-3 flex flex-wrap items-center gap-3">
        <label className="flex items-center gap-2 text-sm text-slate-300">
          <input
            type="checkbox"
            checked={form.isActive}
            disabled={isSelf}
            onChange={(e) => set('isActive')(e.target.checked)}
          />
          Active
        </label>
        <button className="btn-primary" type="button" disabled={saving} onClick={save}>
          {saving ? 'Saving…' : 'Save changes'}
        </button>
        {user.profileImage && (
          <button className="btn-icon" type="button" onClick={stripImage}>
            <EyeOff size={15} /> Remove photo
          </button>
        )}
        {message && <span className="text-sm text-slate-400">{message}</span>}
      </div>

      <div className="mt-4">
        <p className="mb-2 text-sm font-bold text-slate-300">Links ({links.length})</p>
        {links.length === 0 && <p className="text-sm text-slate-500">No links.</p>}
        {links.map((link) => (
          <div key={link._id} className="admin-row">
            <div className="min-w-0">
              <p className="text-sm font-bold text-white">{link.title}</p>
              <p className="truncate text-xs text-slate-500">{link.url}</p>
            </div>
            <div className="flex items-center gap-2">
              <span className={link.isActive ? 'status-on' : 'status-off'}>{link.isActive ? 'live' : 'hidden'}</span>
              <button className="btn-icon" type="button" aria-label="Toggle link" onClick={() => toggleLink(link)}>
                <EyeOff size={15} />
              </button>
              <button className="btn-icon" type="button" aria-label="Delete link" onClick={() => deleteLink(link)}>
                <Trash2 size={15} />
              </button>
            </div>
          </div>
        ))}
      </div>

      {!isSelf && (
        <div className="mt-4 flex items-center gap-3 border-t border-white/10 pt-3">
          <button className="btn-icon" type="button" style={{ color: '#ff1f9c' }} onClick={deleteUser}>
            <Trash2 size={15} /> {confirmDelete ? 'Confirm delete? This removes their links and cards.' : 'Delete user'}
          </button>
          {confirmDelete && (
            <button className="btn-icon" type="button" onClick={() => setConfirmDelete(false)}>
              Cancel
            </button>
          )}
        </div>
      )}
    </div>
  );
}
```

Implementation notes:
- **`react-hooks/set-state-in-effect` gotcha:** all `setState` calls inside effects above happen in async callbacks (`setTimeout`, promise `.then`) — never synchronously in the effect body. Keep it that way.
- `input` is the repo's form-control class (verified: `EditProfile.tsx` uses `className="input"` on inputs, selects, and textareas).
- `useAuth()` returns `{ user, … }` from `src/context/AuthContext.tsx`; `me` can be `null`.

- [ ] **Step 2: Type-check + lint**

Run: `npx tsc -b && npx eslint src/components/admin`
Expected: exit 0.

- [ ] **Step 3: Commit**

```bash
git add src/components/admin/AdminUsers.tsx
git commit -m "feat(admin): users tab with search, pagination, editing, link moderation, cascade delete"
```

---

### Task 5: Orders tab — `AdminOrders` component

**Files:**
- Create: `src/components/admin/AdminOrders.tsx`

- [ ] **Step 1: Create `src/components/admin/AdminOrders.tsx`**

```tsx
import { useEffect, useState } from 'react';
import { Package } from 'lucide-react';
import { api } from '../../lib/api';
import type { Order } from '../../lib/types';

const STATUS_FILTERS = ['all', 'pending', 'paid', 'expired'] as const;
type StatusFilter = (typeof STATUS_FILTERS)[number];

export function AdminOrders() {
  const [orders, setOrders] = useState<Order[]>([]);
  const [status, setStatus] = useState<StatusFilter>('all');
  const [unshippedOnly, setUnshippedOnly] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    const params = new URLSearchParams();
    if (status !== 'all') params.set('status', status);
    if (unshippedOnly) params.set('fulfilled', 'false');
    api
      .get(`/admin/orders?${params}`)
      .then(({ data }) => {
        setOrders(data.orders ?? []);
        setError('');
      })
      .catch(() => setError('Could not load orders.'));
  }, [status, unshippedOnly]);

  async function toggleFulfilled(order: Order) {
    const { data } = await api.put(`/admin/orders/${order._id}/fulfill`, { fulfilled: !order.fulfilled });
    setOrders((prev) => prev.map((item) => (item._id === order._id ? data.order : item)));
  }

  return (
    <section className="panel p-6">
      <div className="mb-4 flex flex-wrap items-center gap-3">
        <div className="flex items-center gap-2 text-sky-300">
          <Package size={18} />
          Shop orders
        </div>
        <div className="profile-tabs" role="tablist" style={{ maxWidth: 360 }}>
          {STATUS_FILTERS.map((value) => (
            <button
              key={value}
              type="button"
              role="tab"
              className={`profile-tab ${status === value ? 'active' : ''}`}
              aria-selected={status === value}
              onClick={() => setStatus(value)}
            >
              {value}
            </button>
          ))}
        </div>
        <label className="flex items-center gap-2 text-sm text-slate-300">
          <input type="checkbox" checked={unshippedOnly} onChange={(e) => setUnshippedOnly(e.target.checked)} />
          Unshipped only
        </label>
      </div>

      {error && <p className="text-sm text-slate-400">{error}</p>}
      <div className="space-y-3">
        {!error && orders.length === 0 && <p className="text-sm text-slate-400">No orders found.</p>}
        {orders.map((order) => (
          <div key={order._id} className="admin-row" style={{ alignItems: 'flex-start' }}>
            <div className="min-w-0">
              <p className="font-bold text-white">
                {order.items.map((i) => `${i.name} ×${i.qty}`).join(', ')} · ${order.amount.toFixed(2)}
              </p>
              <p className="text-sm text-slate-400">
                {order.customer.name} · {order.customer.phone}
                {order.telegramUsername && (
                  <>
                    {' · '}
                    <a
                      className="text-sky-300"
                      href={`https://t.me/${order.telegramUsername}`}
                      target="_blank"
                      rel="noreferrer"
                    >
                      @{order.telegramUsername}
                    </a>
                  </>
                )}
              </p>
              <p className="text-sm text-slate-400">{order.customer.address}</p>
              <p className="text-xs text-slate-500">
                {order.reference} · {order.createdAt ? new Date(order.createdAt).toLocaleString() : ''}
              </p>
            </div>
            <div className="flex flex-col items-end gap-2">
              <span className={order.status === 'paid' ? 'status-on' : 'status-off'}>{order.status}</span>
              {order.status === 'paid' && (
                <label className="flex items-center gap-2 text-sm text-slate-300">
                  <input type="checkbox" checked={order.fulfilled} onChange={() => toggleFulfilled(order)} />
                  {order.fulfilled ? 'Shipped' : 'Mark shipped'}
                </label>
              )}
            </div>
          </div>
        ))}
      </div>
    </section>
  );
}
```

- [ ] **Step 2: Type-check + lint**

Run: `npx tsc -b && npx eslint src/components/admin`
Expected: exit 0.

- [ ] **Step 3: Commit**

```bash
git add src/components/admin/AdminOrders.tsx
git commit -m "feat(admin): orders tab with status/fulfilled filters and Telegram contact"
```

---

### Task 6: NFC cards tab + tab-shell rewrite of `AdminDashboard.tsx`

**Files:**
- Create: `src/components/admin/AdminCards.tsx`
- Modify: `src/pages/AdminDashboard.tsx` (full rewrite, currently 117 lines)

- [ ] **Step 1: Create `src/components/admin/AdminCards.tsx`** (extraction of the existing section, now self-fetching)

```tsx
import { useEffect, useState } from 'react';
import { api } from '../../lib/api';
import type { NfcCard } from '../../lib/types';

export function AdminCards() {
  const [cards, setCards] = useState<NfcCard[]>([]);
  const [error, setError] = useState('');

  useEffect(() => {
    api
      .get('/admin/nfc-cards')
      .then(({ data }) => setCards(data.cards ?? []))
      .catch(() => setError('Could not load cards.'));
  }, []);

  return (
    <section className="panel p-6">
      <h2 className="mb-4 text-xl font-bold text-white">NFC cards</h2>
      {error && <p className="text-sm text-slate-400">{error}</p>}
      <div className="space-y-3">
        {!error && cards.length === 0 && <p className="text-sm text-slate-400">No cards yet.</p>}
        {cards.map((card) => (
          <div key={card._id} className="admin-row">
            <div>
              <p className="font-bold text-white">{card.cardId}</p>
              <p className="text-sm text-slate-400">{card.profileUrl}</p>
            </div>
            <span className={card.isActive ? 'status-on' : 'status-off'}>{card.isActive ? 'active' : 'inactive'}</span>
          </div>
        ))}
      </div>
    </section>
  );
}
```

- [ ] **Step 2: Rewrite `src/pages/AdminDashboard.tsx` as the tab shell**

Replace the entire file with:

```tsx
import { useState } from 'react';
import { DashboardLayout } from '../components/DashboardLayout';
import { AdminStats } from '../components/admin/AdminStats';
import { AdminUsers } from '../components/admin/AdminUsers';
import { AdminOrders } from '../components/admin/AdminOrders';
import { AdminCards } from '../components/admin/AdminCards';

const TABS = [
  { id: 'overview', label: 'Overview' },
  { id: 'users', label: 'Users' },
  { id: 'orders', label: 'Orders' },
  { id: 'cards', label: 'NFC Cards' },
] as const;

type TabId = (typeof TABS)[number]['id'];

export function AdminDashboard() {
  const [tab, setTab] = useState<TabId>('overview');

  return (
    <DashboardLayout title="Admin dashboard">
      <div className="profile-tabs mb-6" role="tablist">
        {TABS.map((item) => (
          <button
            key={item.id}
            type="button"
            role="tab"
            className={`profile-tab ${tab === item.id ? 'active' : ''}`}
            aria-selected={tab === item.id}
            onClick={() => setTab(item.id)}
          >
            {item.label}
          </button>
        ))}
      </div>
      {tab === 'overview' && <AdminStats />}
      {tab === 'users' && <AdminUsers />}
      {tab === 'orders' && <AdminOrders />}
      {tab === 'cards' && <AdminCards />}
    </DashboardLayout>
  );
}
```

Notes:
- Keep the named `AdminDashboard` export — `App.tsx` lazy-imports it by name (`m.AdminDashboard`); no `App.tsx` change is needed.
- Tabs mount on activation, so each tab fetches lazily. Switching away unmounts (state resets) — accepted in the spec.

- [ ] **Step 3: Type-check + lint**

Run: `npx tsc -b && npx eslint src`
Expected: exit 0.

- [ ] **Step 4: Commit**

```bash
git add src/components/admin/AdminCards.tsx src/pages/AdminDashboard.tsx
git commit -m "feat(admin): tabbed admin dashboard shell (overview/users/orders/cards)"
```

---

### Task 7: Full verification

- [ ] **Step 1: Frontend verify loop**

Run: `npx tsc -b && npx eslint src && npm run build`
Expected: all exit 0; Vite build completes.

- [ ] **Step 2: Server syntax check**

Run: `node --check server/routes/adminRoutes.js`
Expected: exit 0.

- [ ] **Step 3: Manual smoke test (requires `.env` with `MONGO_URI`, `JWT_SECRET`)**

Run: `npm run dev`, log in as an admin user, open `/admin`, and verify:
1. Overview shows metric cards with non-NaN values.
2. Users tab: search narrows the list; expanding a row shows the edit form + links; editing your **own** row hides the delete button and disables role/active controls.
3. Saving a username already in use shows "Username is already taken."
4. Orders tab: filter chips change the list; "Unshipped only" works.
5. NFC Cards tab renders.

- [ ] **Step 4: Commit any fixes, then update plan checkboxes**

```bash
git add -A docs/superpowers/plans/2026-06-11-admin-panel-v2.md
git commit -m "docs: check off admin panel v2 plan"
```

**Deploy (`vercel --prod --yes`) is a separate, user-approved step — do not run it as part of this plan.**
