import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { createContext, useContext, type ReactNode } from 'react';
import { ApiError, api } from '../services/api';
import type { AdminSession } from '../types';

interface SessionUser { id: string; name: string; email: string }

function createAuth<T>(prefix: string, loginPath: string, logoutPath: string, mePath: string) {
  interface Ctx {
    me: T | null;
    loading: boolean;
    login: (email: string, password: string) => Promise<void>;
    logout: () => Promise<void>;
    refresh: () => Promise<unknown>;
  }
  const Context = createContext<Ctx | null>(null);
  const key = [prefix, 'me'];

  function Provider({ children }: { children: ReactNode }) {
    const qc = useQueryClient();
    const q = useQuery({
      queryKey: key,
      queryFn: async () => {
        try {
          return await api.get<T>(mePath);
        } catch (e) {
          if (e instanceof ApiError && e.status === 401) return null;
          throw e;
        }
      },
      staleTime: 60_000,
      retry: false,
    });
    const loginMut = useMutation({
      mutationFn: (v: { email: string; password: string }) => api.post(loginPath, v),
    });
    const value: Ctx = {
      me: q.data ?? null,
      loading: q.isLoading,
      login: async (email, password) => {
        await loginMut.mutateAsync({ email, password });
        await qc.invalidateQueries({ queryKey: key });
      },
      logout: async () => {
        await api.post(logoutPath);
        qc.setQueryData(key, null);
        qc.removeQueries({ predicate: (query) => query.queryKey[0] !== prefix });
      },
      refresh: () => qc.invalidateQueries({ queryKey: key }),
    };
    return <Context.Provider value={value}>{children}</Context.Provider>;
  }

  function useIt() {
    const ctx = useContext(Context);
    if (!ctx) throw new Error('Provider de autenticação ausente');
    return ctx;
  }
  return { Provider, useIt };
}

const user = createAuth<SessionUser>('user', '/auth/login', '/auth/logout', '/auth/me');
export const UserAuthProvider = user.Provider;
export const useUserAuth = user.useIt;

const admin = createAuth<AdminSession>('admin', '/admin/auth/login', '/admin/auth/logout', '/admin/auth/me');
export const AdminAuthProvider = admin.Provider;
export const useAdminAuth = admin.useIt;

export const can = (me: AdminSession | null, permission: string) => !!me?.permissions.includes(permission);
