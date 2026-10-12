import { createContext, useContext, useEffect, useState, type ReactNode } from 'react';
import { api, auth } from '../api/client';
import type { User } from '../api/types';

interface Ctx { user: User | null; loading: boolean; login: (email: string, password: string) => Promise<void>; logout: () => void }
const AuthCtx = createContext<Ctx>(null!);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(!!auth.token);

  useEffect(() => {
    if (!auth.token) return;
    api.get<{ user: User }>('/api/auth/me').then((r) => setUser(r.user)).catch(() => auth.clear()).finally(() => setLoading(false));
  }, []);

  const login = async (email: string, password: string) => {
    const r = await api.post<{ token: string; user: User }>('/api/auth/login', { email, password }, { auth: false });
    auth.set(r.token);
    setUser(r.user);
  };
  const logout = () => { auth.clear(); setUser(null); };

  return <AuthCtx.Provider value={{ user, loading, login, logout }}>{children}</AuthCtx.Provider>;
}

export const useAuth = () => useContext(AuthCtx);
