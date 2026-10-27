import { createContext, useCallback, useContext, useEffect, useState, type ReactNode } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import type { AuthResult, MeDTO, Role } from '@workspace/live-core';
import { api, getToken, setToken } from './api';

interface Session {
  me: MeDTO | null;
  loading: boolean;
  signIn: (result: AuthResult) => void;
  signOut: () => Promise<void>;
}

const SessionContext = createContext<Session | null>(null);

export function SessionProvider({ children }: { children: ReactNode }) {
  const qc = useQueryClient();
  const [hasToken, setHasToken] = useState(() => Boolean(getToken()));
  const me = useQuery({
    queryKey: ['me'],
    queryFn: () => api<MeDTO>('/me'),
    enabled: hasToken,
    staleTime: 30_000,
    // Keeps the notification badge fresh.
    refetchInterval: 60_000,
  });

  useEffect(() => {
    const onSignedOut = () => {
      setHasToken(false);
      qc.clear();
    };
    window.addEventListener('gl:signed-out', onSignedOut);
    return () => window.removeEventListener('gl:signed-out', onSignedOut);
  }, [qc]);

  const signIn = useCallback(
    (result: AuthResult) => {
      setToken(result.token);
      qc.clear();
      qc.setQueryData(['me'], result.me);
      setHasToken(true);
    },
    [qc],
  );

  const signOut = useCallback(async () => {
    await api('/auth/logout', { method: 'POST' }).catch(() => undefined);
    setToken(null);
    setHasToken(false);
    qc.clear();
  }, [qc]);

  const value: Session = {
    me: hasToken ? (me.data ?? null) : null,
    loading: hasToken && me.isPending,
    signIn,
    signOut,
  };
  return <SessionContext.Provider value={value}>{children}</SessionContext.Provider>;
}

export function useSession(): Session {
  const ctx = useContext(SessionContext);
  if (!ctx) throw new Error('useSession outside SessionProvider');
  return ctx;
}

/** For screens behind a signed-in guard. */
export function useMe(): MeDTO {
  const { me } = useSession();
  if (!me) throw new Error('useMe without a session');
  return me;
}

export function homePath(role: Role): string {
  return { student: '/s', teacher: '/t', parent: '/p', admin: '/admin' }[role];
}
