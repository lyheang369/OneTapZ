import { useState } from 'react';
import type { FormEvent } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';

export function Login() {
  const navigate = useNavigate();
  const { login } = useAuth();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');

  async function onSubmit(event: FormEvent) {
    event.preventDefault();
    setError('');
    try {
      await login(email, password);
      navigate('/dashboard');
    } catch {
      setError('Login failed. Check your credentials or API connection.');
    }
  }

  return (
    <main className="auth-page">
      <form className="auth-card" onSubmit={onSubmit}>
        <p className="eyebrow">Welcome back</p>
        <h1 className="text-3xl font-black text-white">Log in to OneTapZ</h1>
        {error && <p className="alert">{error}</p>}
        <label className="field-label">
          Email
          <input className="input" value={email} onChange={(event) => setEmail(event.target.value)} />
        </label>
        <label className="field-label">
          Password
          <input
            className="input"
            type="password"
            value={password}
            onChange={(event) => setPassword(event.target.value)}
          />
        </label>
        <button className="btn-primary w-full justify-center" type="submit">
          Login
        </button>
        <p className="text-center text-sm text-slate-400">
          No account?{' '}
          <Link className="text-sky-300" to="/register">
            Register
          </Link>
        </p>
      </form>
    </main>
  );
}
