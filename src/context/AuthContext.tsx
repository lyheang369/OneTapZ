/* eslint-disable react-refresh/only-export-components */
import { createContext, useContext, useEffect, useState } from 'react';
import type { ReactNode } from 'react';
import { api } from '../lib/api';
import { readLocalUser, saveLocalUser } from '../lib/localStore';
import type { User } from '../lib/types';

type AuthContextValue = {
  user: User | null;
  token: string | null;
  loading: boolean;
  login: (email: string, password: string) => Promise<void>;
  register: (payload: { name: string; email: string; username: string; password: string }) => Promise<void>;
  loginWithTelegram: (payload: TelegramLoginPayload) => Promise<void>;
  logout: () => void;
  setUser: (user: User) => void;
};

const AuthContext = createContext<AuthContextValue | undefined>(undefined);

export type TelegramLoginPayload = {
  id: number;
  first_name?: string;
  last_name?: string;
  username?: string;
  photo_url?: string;
  auth_date: number;
  hash: string;
};

const normalizeUser = (user: User): User => ({
  ...user,
  buttonStyle: user.buttonStyle || 'pill',
  buttonBackground: user.buttonBackground || '#2563eb',
  pageBackground: user.pageBackground || '#0f172a',
});

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [token, setToken] = useState<string | null>(() => localStorage.getItem('onetapz_token'));
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let alive = true;

    async function loadMe() {
      setLoading(true);

      if (!token) {
        if (alive) setUser(null);
        setLoading(false);
        return;
      }

      try {
        const { data } = await api.get('/auth/me');
        const nextUser = normalizeUser({ ...data.user, ...readLocalUser(data.user.id) });
        if (alive) setUser(nextUser);
      } catch {
        localStorage.removeItem('onetapz_token');
        if (alive) setToken(null);
      } finally {
        if (alive) setLoading(false);
      }
    }

    loadMe();
    return () => {
      alive = false;
    };
  }, [token]);

  async function login(email: string, password: string) {
    const { data } = await api.post('/auth/login', { email, password });
    localStorage.setItem('onetapz_token', data.token);
    setToken(data.token);
    const nextUser = normalizeUser({ ...data.user, ...readLocalUser(data.user.id) });
    setUser(nextUser);
  }

  async function register(payload: { name: string; email: string; username: string; password: string }) {
    const { data } = await api.post('/auth/register', payload);
    localStorage.setItem('onetapz_token', data.token);
    setToken(data.token);
    setUser(normalizeUser(data.user));
  }

  async function loginWithTelegram(payload: TelegramLoginPayload) {
    const { data } = await api.post('/auth/telegram', payload);
    localStorage.setItem('onetapz_token', data.token);
    setToken(data.token);
    const nextUser = normalizeUser({ ...data.user, ...readLocalUser(data.user.id) });
    setUser(nextUser);
  }

  function logout() {
    localStorage.removeItem('onetapz_token');
    setToken(null);
    setUser(null);
  }

  function updateUser(nextUser: User) {
    const normalized = normalizeUser(nextUser);
    saveLocalUser(normalized);
    setUser(normalized);
  }

  return (
    <AuthContext.Provider value={{ user, token, loading, login, register, loginWithTelegram, logout, setUser: updateUser }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used inside AuthProvider');
  }
  return context;
}
