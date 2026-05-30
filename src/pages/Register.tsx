import { useState } from 'react';
import type { FormEvent } from 'react';
import { Link, Navigate, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';

export function Register() {
  const { user, loading, register } = useAuth();
  const navigate = useNavigate();
  const [form, setForm] = useState({ name: '', email: '', username: '', password: '' });
  const [error, setError] = useState('');

  async function onSubmit(event: FormEvent) {
    event.preventDefault();
    setError('');

    try {
      await register(form);
      navigate('/dashboard', { replace: true });
    } catch {
      setError('Could not create that account. Try a different email or username.');
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
        <p className="eyebrow">Create profile</p>
        <h1 className="text-3xl font-black text-white">Register your OneTapZ</h1>
        {error && <p className="alert">{error}</p>}
        <label className="field-label">
          Name
          <input className="input" value={form.name} onChange={(event) => setForm({ ...form, name: event.target.value })} required />
        </label>
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
          Username
          <input
            className="input"
            value={form.username}
            onChange={(event) => setForm({ ...form, username: event.target.value.toLowerCase().replace(/[^a-z0-9_-]/g, '') })}
            required
          />
        </label>
        <label className="field-label">
          Password
          <input
            className="input"
            type="password"
            minLength={6}
            value={form.password}
            onChange={(event) => setForm({ ...form, password: event.target.value })}
            required
          />
        </label>
        <button className="btn-primary w-full justify-center" type="submit">
          Create account
        </button>
        <p className="text-center text-sm text-slate-400">
          Already have an account? <Link to="/login">Sign in</Link>
        </p>
      </form>
    </main>
  );
}
