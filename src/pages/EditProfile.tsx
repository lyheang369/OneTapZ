import { useEffect, useState } from 'react';
import type { ChangeEvent } from 'react';
import { Trash2 } from 'lucide-react';
import { DashboardLayout } from '../components/DashboardLayout';
import { PhonePreview } from '../components/PhonePreview';
import { useAuth } from '../context/AuthContext';
import { api, hasApiSession } from '../lib/api';
import { readLocalLinks } from '../lib/localStore';
import type { ButtonStyle, LinkItem, ThemeName, User } from '../lib/types';

const themes: ThemeName[] = [
  'acid',
  'dark',
  'gradient',
  'blue',
  'purple',
  'sunset',
  'forest',
  'ocean',
  'rose',
  'aurora',
  'mono',
  'light',
  'minimal',
];
const buttonStyles: ButtonStyle[] = ['pill', 'rounded', 'square', 'glass', 'outline', 'soft'];

// Each theme carries a primary/accent color. Picking a theme also sets the
// button background (and the public page colors the @username with it), so a
// theme is a one-tap coherent look. Colors are saturated enough for white
// button text while still reading well as accent text.
const themePrimary: Record<ThemeName, string> = {
  acid: '#ccff00',
  dark: '#38bdf8',
  gradient: '#ff1f9c',
  blue: '#38bdf8',
  purple: '#a855f7',
  sunset: '#fb923c',
  forest: '#10b981',
  ocean: '#22d3ee',
  rose: '#fb7185',
  aurora: '#8b5cf6',
  mono: '#fafafa',
  light: '#2563eb',
  minimal: '#18181b',
};

export function EditProfile() {
  const { user, setUser } = useAuth();
  const [saved, setSaved] = useState(false);
  const [tab, setTab] = useState<'profile' | 'contact' | 'appearance'>('profile');
  const [file, setFile] = useState<File | null>(null);
  // Local-fallback links are read synchronously on first render; API links are
  // fetched in the effect below. ProtectedRoute guarantees `user` is set here.
  const [links, setLinks] = useState<LinkItem[]>(() => (user && !hasApiSession() ? readLocalLinks(user.id) : []));

  useEffect(() => {
    if (!user || !hasApiSession()) return;
    api.get('/links').then(({ data }) => setLinks(data.links ?? [])).catch(() => {});
  }, [user]);
  const initialForm = {
    name: user?.name || '',
    username: user?.username || '',
    bio: user?.bio || '',
    profileImage: user?.profileImage || '',
    phone: user?.phone || '',
    contactEmail: user?.contactEmail || '',
    company: user?.company || '',
    jobTitle: user?.jobTitle || '',
    location: user?.location || '',
    saveContactEnabled: user?.saveContactEnabled ?? true,
    saveContactDisplay: user?.saveContactDisplay ?? 'button',
    theme: user?.theme || 'dark',
    buttonStyle: user?.buttonStyle || 'pill',
    buttonBackground: user?.buttonBackground || '',
    pageBackground: user?.pageBackground || '',
  };
  const [form, setForm] = useState(initialForm);
  // Snapshot of the last-saved form, to detect unsaved edits.
  const [savedForm, setSavedForm] = useState(initialForm);

  const previewUser = user ? ({ ...user, ...form, theme: form.theme as ThemeName, buttonStyle: form.buttonStyle as ButtonStyle } as User) : null;

  // There are unsaved changes if a new photo is staged or any field differs
  // from the last save.
  const dirty = file !== null || JSON.stringify(form) !== JSON.stringify(savedForm);

  // Hold the picked file for upload, and read it into form.profileImage as a
  // data URL so the live preview updates immediately and local-fallback users
  // (no API) still get a persistable value in localStorage.
  function onFileChange(event: ChangeEvent<HTMLInputElement>) {
    const picked = event.target.files?.[0];
    if (!picked) return;
    setFile(picked);
    const reader = new FileReader();
    reader.onload = () => setForm((prev) => ({ ...prev, profileImage: String(reader.result) }));
    reader.readAsDataURL(picked);
  }

  async function save() {
    setSaved(false);

    const jwt = localStorage.getItem('onetapz_token');

    if (jwt && jwt !== 'demo-token' && !jwt.startsWith('local:')) {
      // Send multipart so the backend's multer + magic-byte sniff + Vercel Blob
      // path handles the image. Append the file only when one was picked;
      // otherwise pass the existing URL so the server keeps the current image.
      const data = new FormData();
      data.append('name', form.name);
      data.append('username', form.username);
      data.append('bio', form.bio);
      data.append('phone', form.phone);
      data.append('contactEmail', form.contactEmail);
      data.append('company', form.company);
      data.append('jobTitle', form.jobTitle);
      data.append('location', form.location);
      data.append('saveContactEnabled', String(form.saveContactEnabled));
      data.append('saveContactDisplay', form.saveContactDisplay);
      data.append('theme', form.theme);
      data.append('buttonStyle', form.buttonStyle);
      data.append('buttonBackground', form.buttonBackground);
      data.append('pageBackground', form.pageBackground);
      if (file) {
        data.append('profileImage', file);
      } else {
        // Always send it: an empty string removes the photo, a URL keeps it.
        data.append('profileImage', form.profileImage);
      }
      const { data: res } = await api.put('/users/me', data);
      setUser(res.user);
    } else if (user) {
      setUser({ ...user, ...form, theme: form.theme as ThemeName, buttonStyle: form.buttonStyle as ButtonStyle });
    }

    setFile(null);
    setSavedForm(form);
    setSaved(true);
  }

  return (
    <DashboardLayout title="Edit profile">
      {dirty && (
        <div className="save-toast" role="status">
          <span className="save-toast-dot" />
          <span>Unsaved changes</span>
          <button className="save-toast-btn" type="button" onClick={save}>
            Save
          </button>
        </div>
      )}
      <div className="editor-grid">
        <form
          className="panel space-y-5 p-6"
          onSubmit={(event) => {
            event.preventDefault();
            save();
          }}
        >
          {saved && <p className="success">Profile saved.</p>}

          <div className="profile-tabs" role="tablist">
            <button type="button" role="tab" className={`profile-tab ${tab === 'profile' ? 'active' : ''}`} aria-selected={tab === 'profile'} onClick={() => setTab('profile')}>
              Profile
            </button>
            <button type="button" role="tab" className={`profile-tab ${tab === 'contact' ? 'active' : ''}`} aria-selected={tab === 'contact'} onClick={() => setTab('contact')}>
              Contact
            </button>
            <button type="button" role="tab" className={`profile-tab ${tab === 'appearance' ? 'active' : ''}`} aria-selected={tab === 'appearance'} onClick={() => setTab('appearance')}>
              Appearance
            </button>
          </div>

          {tab === 'profile' && (
            <>
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
                Profile picture
                <div className="flex items-center gap-3">
                  {form.profileImage && (
                    <img src={form.profileImage} alt="" className="h-14 w-14 shrink-0 rounded-full object-cover" />
                  )}
                  <input
                    className="input"
                    type="file"
                    accept="image/png,image/jpeg,image/webp,image/gif"
                    onChange={onFileChange}
                  />
                  {form.profileImage && (
                    <button
                      className="btn-ghost shrink-0"
                      type="button"
                      onClick={() => {
                        setFile(null);
                        setForm((prev) => ({ ...prev, profileImage: '' }));
                      }}
                    >
                      <Trash2 size={16} />
                      Remove
                    </button>
                  )}
                </div>
              </label>
            </>
          )}

          {tab === 'contact' && (
            <>
              <label className="toggle-row">
                <span>
                  <strong>Show “Save contact”</strong>
                  <span className="toggle-hint">Let visitors save you to their phone in one tap.</span>
                </span>
                <input
                  type="checkbox"
                  checked={form.saveContactEnabled}
                  onChange={(event) => setForm({ ...form, saveContactEnabled: event.target.checked })}
                />
              </label>
              {form.saveContactEnabled && (
                <div className="field-label">
                  Display as
                  <div className="chip-row">
                    <button
                      type="button"
                      className={`style-chip ${form.saveContactDisplay === 'button' ? 'active' : ''}`}
                      onClick={() => setForm({ ...form, saveContactDisplay: 'button' })}
                    >
                      Button
                    </button>
                    <button
                      type="button"
                      className={`style-chip ${form.saveContactDisplay === 'icon' ? 'active' : ''}`}
                      onClick={() => setForm({ ...form, saveContactDisplay: 'icon' })}
                    >
                      Icon only
                    </button>
                  </div>
                </div>
              )}
              <p className="text-xs text-slate-400">
                These details fill the contact card. They’re only shared when someone taps “Save contact”.
              </p>
              <div className="grid gap-4 sm:grid-cols-2">
                <label className="field-label">
                  Phone
                  <input
                    className="input"
                    type="tel"
                    value={form.phone}
                    onChange={(event) => setForm({ ...form, phone: event.target.value })}
                    placeholder="+855 12 345 678"
                  />
                </label>
                <label className="field-label">
                  Contact email
                  <input
                    className="input"
                    type="email"
                    value={form.contactEmail}
                    onChange={(event) => setForm({ ...form, contactEmail: event.target.value })}
                    placeholder="you@example.com"
                  />
                </label>
                <label className="field-label">
                  Job title
                  <input className="input" value={form.jobTitle} onChange={(event) => setForm({ ...form, jobTitle: event.target.value })} />
                </label>
                <label className="field-label">
                  Company
                  <input className="input" value={form.company} onChange={(event) => setForm({ ...form, company: event.target.value })} />
                </label>
              </div>
              <label className="field-label">
                Location
                <input
                  className="input"
                  value={form.location}
                  onChange={(event) => setForm({ ...form, location: event.target.value })}
                  placeholder="Phnom Penh, Cambodia"
                />
              </label>
            </>
          )}

          {tab === 'appearance' && (
            <>
              <div className="field-label">
                Theme
                <div className="swatch-grid">
                  {themes.map((theme) => (
                    <button
                      key={theme}
                      type="button"
                      className={`theme-swatch theme-${theme} ${form.theme === theme ? 'active' : ''}`}
                      onClick={() => setForm({ ...form, theme, buttonBackground: themePrimary[theme], pageBackground: '' })}
                      aria-pressed={form.theme === theme}
                      aria-label={`${theme} theme`}
                    >
                      <span>{theme}</span>
                    </button>
                  ))}
                </div>
              </div>
              <div className="field-label">
                Button style
                <div className="chip-row">
                  {buttonStyles.map((style) => (
                    <button
                      key={style}
                      type="button"
                      className={`style-chip ${form.buttonStyle === style ? 'active' : ''}`}
                      onClick={() => setForm({ ...form, buttonStyle: style })}
                      aria-pressed={form.buttonStyle === style}
                    >
                      {style}
                    </button>
                  ))}
                </div>
              </div>
              <p className="text-xs text-slate-400">
                Fine-tune the theme: pick a custom primary or page color, or leave them to use the theme's own palette.
              </p>
              <div className="grid gap-4 sm:grid-cols-2">
                <label className="field-label">
                  Primary color
                  <input
                    className="input"
                    type="color"
                    value={form.buttonBackground || '#38bdf8'}
                    onChange={(event) => setForm({ ...form, buttonBackground: event.target.value })}
                  />
                </label>
                <label className="field-label">
                  Page background
                  <input
                    className="input"
                    type="color"
                    value={form.pageBackground || '#020617'}
                    onChange={(event) => setForm({ ...form, pageBackground: event.target.value })}
                  />
                </label>
              </div>
            </>
          )}

          <button className="btn-primary" type="submit">
            Save profile
          </button>
        </form>
        {previewUser && (
          <div>
            <div className="mb-3 text-sm font-bold text-slate-400">Live preview</div>
            <PhonePreview user={previewUser} links={links} />
          </div>
        )}
      </div>
    </DashboardLayout>
  );
}
