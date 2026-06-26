import {
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from 'react';
import { authApi, setToken } from '../api/client';
import { readCachedUser, writeCachedUser } from '../lib/authCache';
import type { User } from '../types';
import { AuthContext } from './auth-context';

export type { AuthContextValue } from './auth-context';

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUserState] = useState<User | null>(() => readCachedUser());
  const [loading, setLoading] = useState(() => !!localStorage.getItem('token') && !readCachedUser());

  const setUser = useCallback((next: User | null) => {
    writeCachedUser(next);
    setUserState(next);
  }, []);

  useEffect(() => {
    const token = localStorage.getItem('token');
    if (!token) {
      setLoading(false);
      return;
    }
    authApi
      .me()
      .then(setUser)
      .catch(() => {
        setToken(null);
        setUser(null);
      })
      .finally(() => setLoading(false));
  }, [setUser]);

  const login = useCallback(async (email: string, password: string) => {
    const { token, user: u } = await authApi.login(email, password);
    setToken(token);
    setUser(u);
    return u;
  }, [setUser]);

  const loginWithGoogle = useCallback(async (idToken: string) => {
    const { token, user: u } = await authApi.googleLogin(idToken);
    setToken(token);
    setUser(u);
    return u;
  }, [setUser]);

  const logout = useCallback(() => {
    setToken(null);
    setUser(null);
  }, [setUser]);

  const value = useMemo(
    () => ({ user, loading, login, loginWithGoogle, logout, setUser }),
    [user, loading, login, loginWithGoogle, logout, setUser]
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used within AuthProvider');
  return ctx;
}
