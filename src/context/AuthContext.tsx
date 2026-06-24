/* eslint-disable react-refresh/only-export-components */
import { createContext, useContext, useEffect, useState } from 'react';
import type { ReactNode } from 'react';
import { api } from '../lib/api';
import { createLocalAccount, loginLocalAccount, readLocalAccountUser, saveLocalUser } from '../lib/localStore';
import type { User } from '../lib/types';

type AuthContextValue = {
  user: User | null;
  token: string | null;
  loading: boolean;
  login: (email: string, password: string) => Promise<void>;
  register: (payload: { name: string; email: string; username: string; password: string }) => Promise<void>;
  loginWithTelegram: (payload: TelegramLoginPayload) => Promise<void>;
  linkTelegram: (email: string, password: string, payload: TelegramLoginPayload) => Promise<void>;
  logout: () => void;
  setUser: (user: User) => void;
  // True right after a brand-new Telegram Mini App user is provisioned, so the
  // app can route them through username onboarding before the dashboard.
  pendingOnboard: boolean;
  clearOnboard: () => void;
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
  theme: user.theme || 'dark',
  buttonStyle: user.buttonStyle || 'pill',
  // Empty = "use the theme's palette". Don't backfill a color or the theme's
  // own primary/background tokens would always be overridden.
  buttonBackground: user.buttonBackground || '',
  pageBackground: user.pageBackground || '',
});

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [token, setToken] = useState<string | null>(() => localStorage.getItem('onetapz_token'));
  const [loading, setLoading] = useState(true);
  const [pendingOnboard, setPendingOnboard] = useState(false);

  useEffect(() => {
    let alive = true;

    async function loadMe() {
      setLoading(true);

      // Telegram Mini App: when launched inside Telegram with no existing
      // session, auto-authenticate from the signed initData.
      const tg = typeof window !== 'undefined' ? window.Telegram?.WebApp : undefined;
      if (tg) {
        tg.ready?.();
        tg.expand?.();
      }
      if (tg?.initData && !token) {
        try {
          const { data } = await api.post('/auth/telegram/webapp', { initData: tg.initData });
          localStorage.setItem('onetapz_token', data.token);
          if (alive) {
            setToken(data.token);
            setUser(normalizeUser(data.user));
            if (data.isNew) setPendingOnboard(true);
            setLoading(false);
          }
          return;
        } catch {
          // Fall through to the normal flow if verification fails.
        }
      }

      if (!token) {
        if (alive) setUser(null);
        setLoading(false);
        return;
      }

      if (token.startsWith('local:')) {
        const localUser = readLocalAccountUser(token.replace('local:', ''));
        if (alive) setUser(localUser ? normalizeUser(localUser) : null);
        setLoading(false);
        return;
      }

      try {
        const { data } = await api.get('/auth/me');
        const nextUser = normalizeUser(data.user);
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
    try {
      const { data } = await api.post('/auth/login', { email, password });
      localStorage.setItem('onetapz_token', data.token);
      setToken(data.token);
      const nextUser = normalizeUser(data.user);
      setUser(nextUser);
    } catch {
      const localUser = normalizeUser(loginLocalAccount(email, password));
      const localToken = `local:${localUser.id}`;
      localStorage.setItem('onetapz_token', localToken);
      setToken(localToken);
      setUser(localUser);
    }
  }

  async function register(payload: { name: string; email: string; username: string; password: string }) {
    try {
      const { data } = await api.post('/auth/register', payload);
      localStorage.setItem('onetapz_token', data.token);
      setToken(data.token);
      setUser(normalizeUser(data.user));
    } catch {
      const localUser = normalizeUser(createLocalAccount(payload));
      const localToken = `local:${localUser.id}`;
      localStorage.setItem('onetapz_token', localToken);
      setToken(localToken);
      setUser(localUser);
    }
  }

  async function loginWithTelegram(payload: TelegramLoginPayload) {
    const { data } = await api.post('/auth/telegram', payload);
    localStorage.setItem('onetapz_token', data.token);
    setToken(data.token);
    const nextUser = normalizeUser(data.user);
    setUser(nextUser);
  }

  async function linkTelegram(email: string, password: string, payload: TelegramLoginPayload) {
    const { data } = await api.post('/auth/telegram/link', { email, password, telegram: payload });
    localStorage.setItem('onetapz_token', data.token);
    setToken(data.token);
    setUser(normalizeUser(data.user));
  }

  function logout() {
    localStorage.removeItem('onetapz_token');
    setToken(null);
    setUser(null);
    setPendingOnboard(false);
  }

  function clearOnboard() {
    setPendingOnboard(false);
  }

  function updateUser(nextUser: User) {
    const normalized = normalizeUser(nextUser);
    saveLocalUser(normalized);
    setUser(normalized);
  }

  return (
    <AuthContext.Provider
      value={{ user, token, loading, login, register, loginWithTelegram, linkTelegram, logout, setUser: updateUser, pendingOnboard, clearOnboard }}
    >
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
