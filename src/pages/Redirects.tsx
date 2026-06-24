import { useEffect, useState } from 'react';
import type { FormEvent } from 'react';
import { Check, Copy, Pencil, Plus, Trash2, X } from 'lucide-react';
import { DashboardLayout } from '../components/DashboardLayout';
import { useAuth } from '../context/AuthContext';
import { api, hasApiSession } from '../lib/api';
import { checkUrl } from '../lib/urlFilter';
import type { RedirectLink } from '../lib/types';

const SLUG_RE = /^[a-z0-9_-]+$/;
const emptyForm = { slug: '', url: '', title: '' };

const shortUrl = (slug: string) => `${window.location.origin}/link/${slug}`;

export function Redirects() {
  const { user } = useAuth();
  const [redirects, setRedirects] = useState<RedirectLink[]>([]);
  const [form, setForm] = useState(emptyForm);
  const [error, setError] = useState('');
  const [editError, setEditError] = useState('');
  const [editing, setEditing] = useState<RedirectLink | null>(null);
  const [editForm, setEditForm] = useState(emptyForm);
  const [copied, setCopied] = useState('');

  useEffect(() => {
    if (!user || !hasApiSession()) return;
    api.get('/redirects').then(({ data }) => setRedirects(data.redirects ?? [])).catch(() => {});
  }, [user]);

  useEffect(() => {
    if (!editing) return;
    const onKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape') setEditing(null);
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [editing]);

  // Validate slug + url the same way the server does, returning an error string
  // (or '' when valid) so add and edit share one rule set.
  function validate(slug: string, url: string) {
    if (!SLUG_RE.test(slug.trim().toLowerCase())) {
      return 'Slug may only contain lowercase letters, numbers, hyphens and underscores.';
    }
    const check = checkUrl(url);
    if (!check.ok) return check.reason ?? 'Invalid URL.';
    return '';
  }

  async function addRedirect(event: FormEvent) {
    event.preventDefault();
    const slug = form.slug.trim().toLowerCase();
    const problem = validate(slug, form.url);
    if (problem) {
      setError(problem);
      return;
    }
    setError('');
    try {
      const { data } = await api.post('/redirects', { ...form, slug });
      setRedirects((prev) => [data.redirect, ...prev]);
      setForm(emptyForm);
    } catch (err: unknown) {
      setError(messageFrom(err));
    }
  }

  function openEdit(redirect: RedirectLink) {
    setEditing(redirect);
    setEditForm({ slug: redirect.slug, url: redirect.url, title: redirect.title ?? '' });
    setEditError('');
  }

  async function saveEdit(event: FormEvent) {
    event.preventDefault();
    if (!editing) return;
    const slug = editForm.slug.trim().toLowerCase();
    const problem = validate(slug, editForm.url);
    if (problem) {
      setEditError(problem);
      return;
    }
    try {
      const { data } = await api.put(`/redirects/${editing._id}`, { ...editForm, slug });
      setRedirects((prev) => prev.map((r) => (r._id === editing._id ? data.redirect : r)));
      setEditing(null);
    } catch (err: unknown) {
      setEditError(messageFrom(err));
    }
  }

  async function toggleRedirect(redirect: RedirectLink) {
    const next = { ...redirect, isActive: !redirect.isActive };
    setRedirects((prev) => prev.map((r) => (r._id === redirect._id ? next : r)));
    await api.put(`/redirects/${redirect._id}`, { isActive: next.isActive }).catch(() => {});
  }

  async function deleteRedirect(id: string) {
    setRedirects((prev) => prev.filter((r) => r._id !== id));
    await api.delete(`/redirects/${id}`).catch(() => {});
  }

  function copy(slug: string) {
    navigator.clipboard?.writeText(shortUrl(slug)).then(() => {
      setCopied(slug);
      setTimeout(() => setCopied(''), 1500);
    });
  }

  if (user && !hasApiSession()) {
    return (
      <DashboardLayout title="Redirect links">
        <p className="text-sm text-slate-400">
          Redirect links need an online account. Sign in to create your own onetapz.me/link shortcuts.
        </p>
      </DashboardLayout>
    );
  }

  return (
    <DashboardLayout title="Redirect links">
      <div className="grid gap-6 lg:grid-cols-[360px_1fr]">
        <form className="panel h-fit space-y-4 p-6" onSubmit={addRedirect}>
          <h2 className="text-xl font-bold text-white">Create redirect</h2>
          <label className="field-label">
            Short link
            <div className="flex items-center gap-1">
              <span className="text-sm text-slate-400">/link/</span>
              <input
                className="input"
                value={form.slug}
                onChange={(event) => setForm({ ...form, slug: event.target.value })}
                placeholder="my-promo"
                required
              />
            </div>
          </label>
          <label className="field-label">
            Destination URL
            <input
              className="input"
              value={form.url}
              onChange={(event) => setForm({ ...form, url: event.target.value })}
              placeholder="https://example.com/page"
              required
            />
          </label>
          <label className="field-label">
            Label (optional)
            <input className="input" value={form.title} onChange={(event) => setForm({ ...form, title: event.target.value })} />
          </label>
          {error && <p className="alert">{error}</p>}
          <button className="btn-primary w-full justify-center" type="submit">
            <Plus size={17} />
            Create redirect
          </button>
        </form>

        <div className="space-y-3">
          {redirects.length === 0 && <p className="text-sm text-slate-400">No redirect links yet. Create your first one on the left.</p>}
          {redirects.map((redirect) => (
            <div key={redirect._id} className="panel flex flex-col gap-4 p-4 sm:flex-row sm:items-center">
              <div className="min-w-0 flex-1">
                <p className="font-bold text-white">{redirect.title || redirect.slug}</p>
                <p className="truncate text-sm text-acid">/link/{redirect.slug}</p>
                <p className="truncate text-sm text-slate-400">{redirect.url}</p>
              </div>
              <span className="text-sm text-slate-400" title="Clicks">{redirect.clickCount} clicks</span>
              <label className="flex items-center gap-2 text-sm text-slate-300">
                <input type="checkbox" checked={redirect.isActive} onChange={() => toggleRedirect(redirect)} />
                Active
              </label>
              <button className="btn-icon" type="button" onClick={() => copy(redirect.slug)} aria-label="Copy short link">
                {copied === redirect.slug ? <Check size={17} /> : <Copy size={17} />}
              </button>
              <button className="btn-icon" type="button" onClick={() => openEdit(redirect)} aria-label="Edit redirect">
                <Pencil size={17} />
              </button>
              <button className="btn-icon" type="button" onClick={() => deleteRedirect(redirect._id)} aria-label="Delete redirect">
                <Trash2 size={17} />
              </button>
            </div>
          ))}
        </div>
      </div>

      {editing && (
        <div className="icon-modal-overlay" role="dialog" aria-modal="true" aria-label="Edit redirect" onClick={() => setEditing(null)}>
          <form className="panel edit-modal" onClick={(event) => event.stopPropagation()} onSubmit={saveEdit}>
            <div className="flex items-center justify-between">
              <h2 className="text-xl font-bold text-white">Edit redirect</h2>
              <button className="btn-icon" type="button" aria-label="Close" onClick={() => setEditing(null)}>
                <X size={18} />
              </button>
            </div>
            <label className="field-label">
              Short link
              <div className="flex items-center gap-1">
                <span className="text-sm text-slate-400">/link/</span>
                <input className="input" value={editForm.slug} onChange={(event) => setEditForm({ ...editForm, slug: event.target.value })} required />
              </div>
            </label>
            <label className="field-label">
              Destination URL
              <input className="input" value={editForm.url} onChange={(event) => setEditForm({ ...editForm, url: event.target.value })} required />
            </label>
            <label className="field-label">
              Label (optional)
              <input className="input" value={editForm.title} onChange={(event) => setEditForm({ ...editForm, title: event.target.value })} />
            </label>
            {editError && <p className="alert">{editError}</p>}
            <button className="btn-primary w-full justify-center" type="submit">
              Save changes
            </button>
          </form>
        </div>
      )}
    </DashboardLayout>
  );
}

function messageFrom(err: unknown): string {
  if (typeof err === 'object' && err && 'response' in err) {
    const res = (err as { response?: { data?: { message?: string } } }).response;
    if (res?.data?.message) return res.data.message;
  }
  return 'Something went wrong. Please try again.';
}
