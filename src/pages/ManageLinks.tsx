import { useState } from 'react';
import type { FormEvent } from 'react';
import { GripVertical, Plus, Trash2 } from 'lucide-react';
import { DashboardLayout } from '../components/DashboardLayout';
import { IconBadge } from '../components/IconBadge';
import { demoLinks } from '../data/demo';
import { api } from '../lib/api';
import type { LinkItem } from '../lib/types';

const iconChoices = ['link', 'portfolio', 'instagram', 'github', 'tiktok', 'mail', 'music'];

export function ManageLinks() {
  const [links, setLinks] = useState<LinkItem[]>(demoLinks);
  const [form, setForm] = useState({ title: '', url: '', icon: 'link' });

  async function addLink(event: FormEvent) {
    event.preventDefault();
    const optimistic = {
      _id: crypto.randomUUID(),
      ...form,
      order: links.length,
      isActive: true,
      clickCount: 0,
    };
    setLinks((current) => [...current, optimistic]);
    setForm({ title: '', url: '', icon: 'link' });

    const jwt = localStorage.getItem('onetapz_token');

    if (jwt && jwt !== 'demo-token') {
      const { data } = await api.post('/links', optimistic);
      setLinks((current) => current.map((link) => (link._id === optimistic._id ? data.link : link)));
    }
  }

  async function toggleLink(link: LinkItem) {
    const next = { ...link, isActive: !link.isActive };
    setLinks((current) => current.map((item) => (item._id === link._id ? next : item)));
    const jwt = localStorage.getItem('onetapz_token');
    if (jwt && jwt !== 'demo-token') await api.put(`/links/${link._id}`, next);
  }

  async function deleteLink(id: string) {
    setLinks((current) => current.filter((link) => link._id !== id));
    const jwt = localStorage.getItem('onetapz_token');
    if (jwt && jwt !== 'demo-token') await api.delete(`/links/${id}`);
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
            Add link
          </button>
        </form>

        <div className="space-y-3">
          {links.map((link) => (
            <div key={link._id} className="panel flex flex-col gap-4 p-4 sm:flex-row sm:items-center">
              <GripVertical className="text-slate-500" size={18} />
              <IconBadge name={link.icon} />
              <div className="min-w-0 flex-1">
                <p className="font-bold text-white">{link.title}</p>
                <p className="truncate text-sm text-slate-400">{link.url}</p>
              </div>
              <label className="flex items-center gap-2 text-sm text-slate-300">
                <input type="checkbox" checked={link.isActive} onChange={() => toggleLink(link)} />
                Active
              </label>
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
