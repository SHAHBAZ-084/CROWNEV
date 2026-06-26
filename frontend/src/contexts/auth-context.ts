import { createContext, type Context } from 'react';
import type { User } from '../types';

export interface AuthContextValue {
  user: User | null;
  loading: boolean;
  login: (email: string, password: string) => Promise<User>;
  loginWithGoogle: (idToken: string) => Promise<User>;
  logout: () => void;
  setUser: (user: User | null) => void;
}

const AUTH_CONTEXT_KEY = '__crown_ev_auth_context__';

type GlobalWithAuth = typeof globalThis & {
  [AUTH_CONTEXT_KEY]?: Context<AuthContextValue | null>;
};

const globalForAuth = globalThis as GlobalWithAuth;

/** Singleton context — survives Vite HMR and lazy-chunk duplicate module loads. */
export const AuthContext =
  globalForAuth[AUTH_CONTEXT_KEY] ??
  (globalForAuth[AUTH_CONTEXT_KEY] = createContext<AuthContextValue | null>(null));
