import { useState } from 'react';
import type { FormEvent } from 'react';
import { DashboardLayout } from '../components/DashboardLayout';
import { useAuth } from '../context/AuthContext';
import { api } from '../lib/api';
import type { ThemeName } from '../lib/types';

const themes: ThemeName[] = ['dark', 'light', 'blue', 'purple', 'minimal', 'gradient'];

export function EditProfile() {
  const { user, setUser } = useAuth();
  const [saved, setSaved] = useState(false);
  const [form, setForm] = useState({
    name: user?.name || '',
    username: user?.username || '',
    bio: user?.bio || '',
    profileImage: user?.profileImage || '',
    theme: user?.theme || 'gradient',
  });

  async function onSubmit(event: FormEvent) {
    event.preventDefault();
    setSaved(false);

    if (localStorage.getItem('onetapz_token') !== 'demo-token') {
      const { data } = await api.put('/users/me', form);
      setUser(data.user);
    } else if (user) {
      setUser({ ...user, ...form, theme: form.theme as ThemeName });
    }

    setSaved(true);
  }

  return (
    <DashboardLayout title="Edit profile">
      <form className="panel max-w-3xl space-y-5 p-6" onSubmit={onSubmit}>
        {saved && <p className="success">Profile saved.</p>}
        <label className="field-label">
          Name
          <input className="input" value={form.name} onChange={(event) => setForm({ ...form, name: event.target.value })} />
        </label>
        <label className="field-label">
          Username
          <input
            className="input"
            value={form.username}
            onChange={(event) => setForm({ ...form, username: event.target.value.toLowerCase() })}
          />
        </label>
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
        <button className="btn-primary" type="submit">
          Save profile
        </button>
      </form>
    </DashboardLayout>
  );
}
