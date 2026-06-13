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
                <UserDetail
                  user={user}
                  isSelf={me ? userId(me) === id : false}
                  onUpdated={onUpdated}
                  onDeleted={() => onDeleted(id)}
                />
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
          <button className="btn-text" type="button" disabled={page <= 1} onClick={() => setPage(page - 1)}>
            Prev
          </button>
          <button className="btn-text" type="button" disabled={page >= pages} onClick={() => setPage(page + 1)}>
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
          <select className="input" value={form.role} disabled={isSelf} onChange={(e) => set('role')(e.target.value)}>
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
          <button className="btn-text" type="button" onClick={stripImage}>
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
          <button className="btn-text" type="button" style={{ color: '#ff1f9c' }} onClick={deleteUser}>
            <Trash2 size={15} /> {confirmDelete ? 'Confirm delete? This removes their links and cards.' : 'Delete user'}
          </button>
          {confirmDelete && (
            <button className="btn-text" type="button" onClick={() => setConfirmDelete(false)}>
              Cancel
            </button>
          )}
        </div>
      )}
    </div>
  );
}
