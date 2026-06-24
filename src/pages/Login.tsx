import { useState } from 'react';
import { Navigate, useNavigate } from 'react-router-dom';
import axios from 'axios';
import { Send, TriangleAlert } from 'lucide-react';
import { TelegramLogin } from '../components/TelegramLogin';
import { useAuth } from '../context/AuthContext';

export function Login() {
  const { user, loading, loginWithTelegram, linkTelegram } = useAuth();
  const navigate = useNavigate();
  const [legacy, setLegacy] = useState({ email: '', password: '' });
  const linking = Boolean(legacy.email && legacy.password);

  if (loading) {
    return <main className="auth-page text-slate-300">Loading...</main>;
  }

  if (user) {
    return <Navigate to="/dashboard" replace />;
  }

  // One Telegram button drives both paths: if the user filled the legacy
  // email/password fields, link those onto the Telegram account; else plain login.
  async function handleAuth(payload: Parameters<typeof loginWithTelegram>[0]) {
    try {
      if (legacy.email && legacy.password) {
        await linkTelegram(legacy.email, legacy.password, payload);
      } else {
        await loginWithTelegram(payload);
      }
      navigate('/dashboard', { replace: true });
    } catch (err) {
      // Surface the server's message (e.g. "Invalid email or password.") to the widget.
      const msg = axios.isAxiosError(err) ? err.response?.data?.message : undefined;
      throw new Error(msg || 'Could not sign in. Please try again.');
    }
  }

  return (
    <main className="auth-page">
      <div className="auth-card">
        <p className="eyebrow">Welcome</p>
        <h1 className="text-3xl font-black text-white">Sign in to OneTapZ</h1>
        <p className="text-sm text-slate-400">Continue with Telegram to access your profile.</p>
        {linking && (
          <p className="text-center text-xs font-semibold text-acid">
            Your Telegram will be linked to <span className="break-all">{legacy.email}</span> — you keep your profile and links.
          </p>
        )}
        <TelegramLogin onAuth={handleAuth} />

        <details className="auth-legacy">
          <summary className="flex cursor-pointer items-center gap-2 text-sm font-semibold text-amber-300">
            <TriangleAlert size={15} />
            Registered with email &amp; password before?
          </summary>
          <p className="mt-2 text-xs text-slate-400">
            Email sign-in has been retired. Enter your old email and password, then use the Telegram button
            above to connect your account — your profile and links carry over.
          </p>
          <label className="field-label mt-3">
            Email
            <input
              className="input"
              type="email"
              autoComplete="email"
              value={legacy.email}
              onChange={(e) => setLegacy({ ...legacy, email: e.target.value })}
            />
          </label>
          <label className="field-label">
            Password
            <input
              className="input"
              type="password"
              autoComplete="current-password"
              value={legacy.password}
              onChange={(e) => setLegacy({ ...legacy, password: e.target.value })}
            />
          </label>
        </details>

        <p className="flex items-center justify-center gap-2 text-center text-xs text-slate-500">
          <Send size={14} />
          OneTapZ uses Telegram signed data to sign you in.
        </p>
      </div>
    </main>
  );
}
