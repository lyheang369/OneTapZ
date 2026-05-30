import { useState } from 'react';
import type { FormEvent } from 'react';
import { Link, Navigate, useNavigate } from 'react-router-dom';
import { Send } from 'lucide-react';
import { TelegramLogin } from '../components/TelegramLogin';
import { useAuth } from '../context/AuthContext';

export function Login() {
  const { user, loading, login, loginWithTelegram } = useAuth();
  const navigate = useNavigate();
  const [form, setForm] = useState({ email: '', password: '' });
  const [error, setError] = useState('');

  async function onSubmit(event: FormEvent) {
    event.preventDefault();
    setError('');

    try {
      await login(form.email, form.password);
      navigate('/dashboard', { replace: true });
    } catch {
      setError('Invalid email or password.');
    }
  }

  if (loading) {
    return <main className="auth-page text-slate-300">Loading...</main>;
  }

  if (user) {
    return <Navigate to="/dashboard" replace />;
  }

  return (
    <main className="auth-page">
      <form className="auth-card" onSubmit={onSubmit}>
        <p className="eyebrow">Welcome back</p>
        <h1 className="text-3xl font-black text-white">Sign in to OneTapZ</h1>
        {error && <p className="alert">{error}</p>}
        <label className="field-label">
          Email
          <input
            className="input"
            type="email"
            value={form.email}
            onChange={(event) => setForm({ ...form, email: event.target.value })}
            required
          />
        </label>
        <label className="field-label">
          Password
          <input
            className="input"
            type="password"
            value={form.password}
            onChange={(event) => setForm({ ...form, password: event.target.value })}
            required
          />
        </label>
        <button className="btn-primary w-full justify-center" type="submit">
          Sign in
        </button>
        <div className="auth-divider">or</div>
        <TelegramLogin
          onAuth={async (payload) => {
            await loginWithTelegram(payload);
            navigate('/dashboard', { replace: true });
          }}
        />
        <p className="text-center text-sm text-slate-400">
          New to OneTapZ? <Link to="/register">Create an account</Link>
        </p>
        <p className="flex items-center justify-center gap-2 text-center text-xs text-slate-500">
          <Send size={14} />
          Telegram login uses Telegram signed data when configured.
        </p>
      </form>
    </main>
  );
}
