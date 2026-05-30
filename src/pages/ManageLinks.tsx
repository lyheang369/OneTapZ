import { useState } from 'react';
import type { FormEvent } from 'react';
import { GripVertical, Pencil, Plus, Trash2 } from 'lucide-react';
import { DashboardLayout } from '../components/DashboardLayout';
import { IconBadge } from '../components/IconBadge';
import { useAuth } from '../context/AuthContext';
import { demoLinks } from '../data/demo';
import { api } from '../lib/api';
import { readLocalLinks, saveLocalLinks } from '../lib/localStore';
import type { LinkItem } from '../lib/types';

const iconChoices = ['link', 'portfolio', 'instagram', 'github', 'tiktok', 'mail', 'music'];

export function ManageLinks() {
  const { user } = useAuth();
  const [links, setLinks] = useState<LinkItem[]>(() => (user ? readLocalLinks(user.id) : demoLinks));
  const [form, setForm] = useState({ title: '', url: '', icon: 'link' });
  const [editingId, setEditingId] = useState<string | null>(null);

  function updateLinks(next: LinkItem[]) {
    const ordered = next.map((link, index) => ({ ...link, order: index }));
    setLinks(ordered);
    if (user) saveLocalLinks(user.id, ordered);
  }

  async function addLink(event: FormEvent) {
    event.preventDefault();
    if (editingId) {
      const next = links.map((link) => (link._id === editingId ? { ...link, ...form } : link));
      updateLinks(next);
      setEditingId(null);
      setForm({ title: '', url: '', icon: 'link' });
      const jwt = localStorage.getItem('onetapz_token');
      if (jwt && jwt !== 'demo-token') await api.put(`/links/${editingId}`, next.find((link) => link._id === editingId));
      return;
    }

    const optimistic = {
      _id: crypto.randomUUID(),
      ...form,
      order: links.length,
      isActive: true,
      clickCount: 0,
    };
    const nextLinks = [...links, optimistic];
    updateLinks(nextLinks);
    setForm({ title: '', url: '', icon: 'link' });

    const jwt = localStorage.getItem('onetapz_token');

    if (jwt && jwt !== 'demo-token') {
      const { data } = await api.post('/links', optimistic);
      updateLinks(nextLinks.map((link) => (link._id === optimistic._id ? data.link : link)));
    }
  }

  async function toggleLink(link: LinkItem) {
    const next = { ...link, isActive: !link.isActive };
    updateLinks(links.map((item) => (item._id === link._id ? next : item)));
    const jwt = localStorage.getItem('onetapz_token');
    if (jwt && jwt !== 'demo-token') await api.put(`/links/${link._id}`, next);
  }

  async function deleteLink(id: string) {
    updateLinks(links.filter((link) => link._id !== id));
    const jwt = localStorage.getItem('onetapz_token');
    if (jwt && jwt !== 'demo-token') await api.delete(`/links/${id}`);
  }

  function editLink(link: LinkItem) {
    setEditingId(link._id);
    setForm({ title: link.title, url: link.url, icon: link.icon });
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
          <h2 className="text-xl font-bold text-white">{editingId ? 'Edit link' : 'Add link'}</h2>
          <label className="field-label">
            Title
            <input className="input" value={form.title} onChange={(event) => setForm({ ...form, title: event.target.value })} required />
          </label>
          <label className="field-label">
            URL
            <input className="input" value={form.url} onChange={(event) => setForm({ ...form, url: event.target.value })} required />
          </label>
          <label className="field-label">
            Icon
            <select className="input" value={form.icon} onChange={(event) => setForm({ ...form, icon: event.target.value })}>
              {iconChoices.map((icon) => (
                <option key={icon}>{icon}</option>
              ))}
            </select>
          </label>
          <button className="btn-primary w-full justify-center" type="submit">
            <Plus size={17} />
            {editingId ? 'Save link' : 'Add link'}
          </button>
          {editingId && (
            <button
              className="btn-ghost w-full justify-center"
              type="button"
              onClick={() => {
                setEditingId(null);
                setForm({ title: '', url: '', icon: 'link' });
              }}
            >
              Cancel
            </button>
          )}
        </form>

        <div className="space-y-3">
          {links.map((link) => (
            <div key={link._id} className="panel flex flex-col gap-4 p-4 sm:flex-row sm:items-center">
              <div className="flex gap-1">
                <button className="mini-control" type="button" onClick={() => moveLink(link._id, -1)} aria-label="Move link up">
                  <GripVertical size={16} />
                </button>
                <button className="mini-control" type="button" onClick={() => moveLink(link._id, 1)} aria-label="Move link down">
                  <GripVertical size={16} />
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
              <button className="btn-icon" type="button" onClick={() => editLink(link)}>
                <Pencil size={17} />
              </button>
              <button className="btn-icon" type="button" onClick={() => deleteLink(link._id)}>
                <Trash2 size={17} />
              </button>
            </div>
          ))}
        </div>
      </div>
    </DashboardLayout>
  );
}
