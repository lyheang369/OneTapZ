import { useEffect, useState } from 'react';
import type { FormEvent } from 'react';
import { ChevronDown, ChevronUp, Pencil, Plus, Trash2, X } from 'lucide-react';
import { DashboardLayout } from '../components/DashboardLayout';
import { IconBadge } from '../components/IconBadge';
import { IconPicker } from '../components/IconPicker';
import { useAuth } from '../context/AuthContext';
import { api, hasApiSession } from '../lib/api';
import { iconForUrl } from '../lib/icons';
import { readLocalLinks, saveLocalLinks } from '../lib/localStore';
import { checkUrl } from '../lib/urlFilter';
import type { LinkDisplay, LinkItem } from '../lib/types';

const emptyForm: { title: string; url: string; icon: string; display: LinkDisplay } = {
  title: '',
  url: '',
  icon: 'link',
  display: 'button',
};

export function ManageLinks() {
  const { user } = useAuth();
  const [links, setLinks] = useState<LinkItem[]>(() => (user && !hasApiSession() ? readLocalLinks(user.id) : []));
  const [form, setForm] = useState(emptyForm);
  const [error, setError] = useState('');
  const [editError, setEditError] = useState('');
  // Once the user picks an icon by hand we stop auto-detecting from the URL.
  const [iconTouched, setIconTouched] = useState(false);
  const [editIconTouched, setEditIconTouched] = useState(false);
  // The link currently being edited in the popup (null = popup closed).
  const [editing, setEditing] = useState<LinkItem | null>(null);
  const [editForm, setEditForm] = useState(emptyForm);

  // Update the URL and, unless the icon was hand-picked, auto-select an icon
  // matching the link's domain (e.g. instagram.com → instagram).
  function setUrl(url: string, edit = false) {
    const detected = iconForUrl(url);
    if (edit) {
      setEditForm((prev) => ({ ...prev, url, icon: editIconTouched ? prev.icon : detected ?? prev.icon }));
    } else {
      setForm((prev) => ({ ...prev, url, icon: iconTouched ? prev.icon : detected ?? prev.icon }));
    }
  }

  useEffect(() => {
    if (!user || !hasApiSession()) return;
    api.get('/links').then(({ data }) => setLinks(data.links ?? [])).catch(() => {});
  }, [user]);

  // Close the edit popup on Escape.
  useEffect(() => {
    if (!editing) return;
    const onKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape') setEditing(null);
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [editing]);

  function updateLinks(next: LinkItem[]) {
    const ordered = next.map((link, index) => ({ ...link, order: index }));
    setLinks(ordered);
    if (user) saveLocalLinks(user.id, ordered);
  }

  async function addLink(event: FormEvent) {
    event.preventDefault();
    const check = checkUrl(form.url);
    if (!check.ok) {
      setError(check.reason ?? 'Invalid URL.');
      return;
    }
    setError('');
    const optimistic = { _id: crypto.randomUUID(), ...form, order: links.length, isActive: true, clickCount: 0 };
    const nextLinks = [...links, optimistic];
    updateLinks(nextLinks);
    setForm(emptyForm);
    setIconTouched(false);

    if (hasApiSession()) {
      const { data } = await api.post('/links', optimistic);
      updateLinks(nextLinks.map((link) => (link._id === optimistic._id ? data.link : link)));
    }
  }

  function openEdit(link: LinkItem) {
    setEditing(link);
    setEditForm({ title: link.title, url: link.url, icon: link.icon, display: link.display ?? 'button' });
    setEditError('');
    setEditIconTouched(true); // preserve the link's existing icon; auto-detect is for adding
  }

  async function saveEdit(event: FormEvent) {
    event.preventDefault();
    if (!editing) return;
    const check = checkUrl(editForm.url);
    if (!check.ok) {
      setEditError(check.reason ?? 'Invalid URL.');
      return;
    }
    setEditError('');
    const next = { ...editing, ...editForm };
    updateLinks(links.map((link) => (link._id === editing._id ? next : link)));
    setEditing(null);
    if (hasApiSession()) await api.put(`/links/${editing._id}`, next);
  }

  async function toggleLink(link: LinkItem) {
    const next = { ...link, isActive: !link.isActive };
    updateLinks(links.map((item) => (item._id === link._id ? next : item)));
    if (hasApiSession()) await api.put(`/links/${link._id}`, next);
  }

  async function deleteLink(id: string) {
    updateLinks(links.filter((link) => link._id !== id));
    if (hasApiSession()) await api.delete(`/links/${id}`);
  }

  function moveLink(id: string, direction: -1 | 1) {
    const index = links.findIndex((link) => link._id === id);
    const target = index + direction;
    if (index < 0 || target < 0 || target >= links.length) return;
    const next = [...links];
    [next[index], next[target]] = [next[target], next[index]];
    updateLinks(next);
  }

  return (
    <DashboardLayout title="Manage links">
      <div className="grid gap-6 lg:grid-cols-[360px_1fr]">
        <form className="panel h-fit space-y-4 p-6" onSubmit={addLink}>
          <h2 className="text-xl font-bold text-white">Add link</h2>
          <label className="field-label">
            Title
            <input className="input" value={form.title} onChange={(event) => setForm({ ...form, title: event.target.value })} required />
          </label>
          <label className="field-label">
            URL
            <input className="input" value={form.url} onChange={(event) => setUrl(event.target.value)} required />
          </label>
          <div className="field-label">
            Icon
            <IconPicker
              value={form.icon}
              onChange={(icon) => {
                setIconTouched(true);
                setForm((prev) => ({ ...prev, icon }));
              }}
            />
          </div>
          <div className="field-label">
            Display as
            <div className="chip-row">
              <button
                type="button"
                className={`style-chip ${form.display === 'button' ? 'active' : ''}`}
                onClick={() => setForm({ ...form, display: 'button' })}
              >
                Button
              </button>
              <button
                type="button"
                className={`style-chip ${form.display === 'icon' ? 'active' : ''}`}
                onClick={() => setForm({ ...form, display: 'icon' })}
              >
                Icon only
              </button>
            </div>
          </div>
          {error && <p className="alert">{error}</p>}
          <button className="btn-primary w-full justify-center" type="submit">
            <Plus size={17} />
            Add link
          </button>
        </form>

        <div className="space-y-3">
          {links.length === 0 && <p className="text-sm text-slate-400">No links yet. Add your first one on the left.</p>}
          {links.map((link) => (
            <div key={link._id} className="panel flex flex-col gap-4 p-4 sm:flex-row sm:items-center">
              <div className="flex flex-col gap-1">
                <button className="mini-control" type="button" onClick={() => moveLink(link._id, -1)} aria-label="Move link up">
                  <ChevronUp size={16} />
                </button>
                <button className="mini-control" type="button" onClick={() => moveLink(link._id, 1)} aria-label="Move link down">
                  <ChevronDown size={16} />
                </button>
              </div>
              <IconBadge name={link.icon} />
              <div className="min-w-0 flex-1">
                <p className="font-bold text-white">{link.title}</p>
                <p className="truncate text-sm text-slate-400">{link.url}</p>
              </div>
              <label className="flex items-center gap-2 text-sm text-slate-300">
                <input type="checkbox" checked={link.isActive} onChange={() => toggleLink(link)} />
                Active
              </label>
              <button className="btn-icon" type="button" onClick={() => openEdit(link)} aria-label="Edit link">
                <Pencil size={17} />
              </button>
              <button className="btn-icon" type="button" onClick={() => deleteLink(link._id)} aria-label="Delete link">
                <Trash2 size={17} />
              </button>
            </div>
          ))}
        </div>
      </div>

      {editing && (
        <div className="icon-modal-overlay" role="dialog" aria-modal="true" aria-label="Edit link" onClick={() => setEditing(null)}>
          <form className="panel edit-modal" onClick={(event) => event.stopPropagation()} onSubmit={saveEdit}>
            <div className="flex items-center justify-between">
              <h2 className="text-xl font-bold text-white">Edit link</h2>
              <button className="btn-icon" type="button" aria-label="Close" onClick={() => setEditing(null)}>
                <X size={18} />
              </button>
            </div>
            <label className="field-label">
              Title
              <input className="input" value={editForm.title} onChange={(event) => setEditForm({ ...editForm, title: event.target.value })} required />
            </label>
            <label className="field-label">
              URL
              <input className="input" value={editForm.url} onChange={(event) => setUrl(event.target.value, true)} required />
            </label>
            <div className="field-label">
              Icon
              <IconPicker
                value={editForm.icon}
                onChange={(icon) => {
                  setEditIconTouched(true);
                  setEditForm((prev) => ({ ...prev, icon }));
                }}
              />
            </div>
            <div className="field-label">
              Display as
              <div className="chip-row">
                <button
                  type="button"
                  className={`style-chip ${editForm.display === 'button' ? 'active' : ''}`}
                  onClick={() => setEditForm({ ...editForm, display: 'button' })}
                >
                  Button
                </button>
                <button
                  type="button"
                  className={`style-chip ${editForm.display === 'icon' ? 'active' : ''}`}
                  onClick={() => setEditForm({ ...editForm, display: 'icon' })}
                >
                  Icon only
                </button>
              </div>
            </div>
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
