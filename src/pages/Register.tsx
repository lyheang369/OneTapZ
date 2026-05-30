import { useState } from 'react';
import type { FormEvent } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';

export function Register() {
  const navigate = useNavigate();
  const { register } = useAuth();
  const [form, setForm] = useState({ name: '', email: '', username: '', password: '' });
  const [error, setError] = useState('');

  async function onSubmit(event: FormEvent) {
    event.preventDefault();
    setError('');
    try {
      await register(form);
      navigate('/dashboard');
    } catch {
      setError('Registration failed. Make sure MongoDB and the API are configured.');
    }
  }

  return (
    <main className="auth-page">
      <form className="auth-card" onSubmit={onSubmit}>
        <p className="eyebrow">Create profile</p>
        <h1 className="text-3xl font-black text-white">Register your OneTapZ</h1>
        {error && <p className="alert">{error}</p>}
        {Object.entries(form).map(([key, value]) => (
          <label key={key} className="field-label">
            {key}
            <input
              className="input"
              type={key === 'password' ? 'password' : 'text'}
              value={value}
              onChange={(event) => setForm((current) => ({ ...current, [key]: event.target.value }))}
              required
            />
          </label>
        ))}
        <button className="btn-primary w-full justify-center" type="submit">
          Register
        </button>
      </form>
    </main>
  );
}
