import { useState } from 'react';
import type { FormEvent } from 'react';
import { DashboardLayout } from '../components/DashboardLayout';
import { PhonePreview } from '../components/PhonePreview';
import { useAuth } from '../context/AuthContext';
import { demoLinks } from '../data/demo';
import { api } from '../lib/api';
import type { ButtonStyle, ThemeName, User } from '../lib/types';

const themes: ThemeName[] = ['dark', 'light', 'blue', 'purple', 'minimal', 'gradient'];
const buttonStyles: ButtonStyle[] = ['pill', 'rounded', 'square', 'glass'];

export function EditProfile() {
  const { user, setUser } = useAuth();
  const [saved, setSaved] = useState(false);
  const [form, setForm] = useState({
    name: user?.name || '',
    username: user?.username || '',
    bio: user?.bio || '',
    profileImage: user?.profileImage || '',
    theme: user?.theme || 'gradient',
    buttonStyle: user?.buttonStyle || 'pill',
    buttonBackground: user?.buttonBackground || '#2563eb',
    pageBackground: user?.pageBackground || '#0f172a',
  });

  const previewUser = user ? ({ ...user, ...form, theme: form.theme as ThemeName, buttonStyle: form.buttonStyle as ButtonStyle } as User) : null;

  async function onSubmit(event: FormEvent) {
    event.preventDefault();
    setSaved(false);

    const jwt = localStorage.getItem('onetapz_token');

    if (jwt && jwt !== 'demo-token' && !jwt.startsWith('local:')) {
      const { data } = await api.put('/users/me', form);
      setUser(data.user);
    } else if (user) {
      setUser({ ...user, ...form, theme: form.theme as ThemeName, buttonStyle: form.buttonStyle as ButtonStyle });
    }

    setSaved(true);
  }

  return (
    <DashboardLayout title="Edit profile">
      <div className="editor-grid">
        <form className="panel space-y-5 p-6" onSubmit={onSubmit}>
          {saved && <p className="success">Profile saved.</p>}
          <div className="grid gap-4 sm:grid-cols-2">
            <label className="field-label">
              Name
              <input className="input" value={form.name} onChange={(event) => setForm({ ...form, name: event.target.value })} />
            </label>
            <label className="field-label">
              Username
              <input
                className="input"
                value={form.username}
                onChange={(event) => setForm({ ...form, username: event.target.value.toLowerCase().replace(/[^a-z0-9_-]/g, '') })}
              />
            </label>
          </div>
          <label className="field-label">
            Bio
            <textarea className="input min-h-28" value={form.bio} onChange={(event) => setForm({ ...form, bio: event.target.value })} />
          </label>
          <label className="field-label">
            Profile image URL
            <input
              className="input"
              value={form.profileImage}
              onChange={(event) => setForm({ ...form, profileImage: event.target.value })}
            />
          </label>
          <div className="grid gap-4 sm:grid-cols-2">
            <label className="field-label">
              Theme
              <select
                className="input"
                value={form.theme}
                onChange={(event) => setForm({ ...form, theme: event.target.value as ThemeName })}
              >
                {themes.map((theme) => (
                  <option key={theme} value={theme}>
                    {theme}
                  </option>
                ))}
              </select>
            </label>
            <label className="field-label">
              Button style
              <select
                className="input"
                value={form.buttonStyle}
                onChange={(event) => setForm({ ...form, buttonStyle: event.target.value as ButtonStyle })}
              >
                {buttonStyles.map((style) => (
                  <option key={style} value={style}>
                    {style}
                  </option>
                ))}
              </select>
            </label>
            <label className="field-label">
              Button background
              <input
                className="input"
                type="color"
                value={form.buttonBackground}
                onChange={(event) => setForm({ ...form, buttonBackground: event.target.value })}
              />
            </label>
            <label className="field-label">
              Page background
              <input
                className="input"
                type="color"
                value={form.pageBackground}
                onChange={(event) => setForm({ ...form, pageBackground: event.target.value })}
              />
            </label>
          </div>
          <button className="btn-primary" type="submit">
            Save profile
          </button>
        </form>
        {previewUser && (
          <div>
            <div className="mb-3 text-sm font-bold text-slate-400">Live preview</div>
            <PhonePreview user={previewUser} links={demoLinks} />
          </div>
        )}
      </div>
    </DashboardLayout>
  );
}
