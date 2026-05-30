/* eslint-disable react-refresh/only-export-components */
import { createContext, useContext, useEffect, useState } from 'react';
import type { ReactNode } from 'react';
import { useClerk, useUser } from '@clerk/react';
import { api } from '../lib/api';
import type { User } from '../lib/types';

type AuthContextValue = {
  user: User | null;
  token: string | null;
  loading: boolean;
  login: (email: string, password: string) => Promise<void>;
  register: (payload: { name: string; email: string; username: string; password: string }) => Promise<void>;
  logout: () => void;
  setUser: (user: User) => void;
};

const AuthContext = createContext<AuthContextValue | undefined>(undefined);

export function AuthProvider({ children }: { children: ReactNode }) {
  const { signOut } = useClerk();
  const { isLoaded: clerkLoaded, isSignedIn, user: clerkUser } = useUser();
  const [user, setUser] = useState<User | null>(null);
  const [token, setToken] = useState<string | null>(() => localStorage.getItem('onetapz_token'));
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let alive = true;

    async function loadMe() {
      setLoading(true);

      if (!token) {
        if (!clerkLoaded) return;

        if (isSignedIn && clerkUser) {
          const email = clerkUser.primaryEmailAddress?.emailAddress || '';
          const username =
            clerkUser.username ||
            email.split('@')[0] ||
            `user-${clerkUser.id.slice(-6)}`.toLowerCase();
          const name =
            clerkUser.fullName ||
            [clerkUser.firstName, clerkUser.lastName].filter(Boolean).join(' ') ||
            username;

          if (alive) {
            setUser({
              id: clerkUser.id,
              name,
              email,
              username: username.toLowerCase(),
              bio: '',
              profileImage: clerkUser.imageUrl || '',
              theme: 'minimal',
              role: 'user',
              isActive: true,
            });
            setLoading(false);
          }
          return;
        }

        if (alive) setUser(null);
        setLoading(false);
        return;
      }

      try {
        const { data } = await api.get('/auth/me');
        if (alive) setUser(data.user);
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
  }, [token, clerkLoaded, isSignedIn, clerkUser]);

  async function login(email: string, password: string) {
    const { data } = await api.post('/auth/login', { email, password });
    localStorage.setItem('onetapz_token', data.token);
    setToken(data.token);
    setUser(data.user);
  }

  async function register(payload: { name: string; email: string; username: string; password: string }) {
    const { data } = await api.post('/auth/register', payload);
    localStorage.setItem('onetapz_token', data.token);
    setToken(data.token);
    setUser(data.user);
  }

  async function logout() {
    localStorage.removeItem('onetapz_token');
    setToken(null);
    setUser(null);
    if (isSignedIn) {
      await signOut({ redirectUrl: '/' });
    }
  }

  return (
    <AuthContext.Provider value={{ user, token, loading, login, register, logout, setUser }}>
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
