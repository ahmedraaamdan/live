import { createContext, useCallback, useContext, useEffect, useRef, useState, type ReactNode } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import type { AuthResult, MeDTO, Role } from '@workspace/live-core';
import { api, getToken, setToken, setSwitchToken, hasSwitchToken } from './api';

interface Session {
  me: MeDTO | null;
  loading: boolean;
  error: unknown;
  retry: () => unknown;
  signIn: (result: AuthResult) => void;
  signOut: () => Promise<void>;
  switchAccount: (id: string) => Promise<MeDTO>;
  returnToAdmin: () => Promise<MeDTO>;
  switchBusy: boolean;
}

const SessionContext = createContext<Session | null>(null);

export function SessionProvider({ children }: { children: ReactNode }) {
  const qc = useQueryClient();
  const [switchBusy, setSwitchBusy] = useState(false);
  const switchLock = useRef(false);
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
    const onSwitchExpired = () => { void (async () => {
      setSwitchBusy(true);
      try {
        await qc.cancelQueries(); qc.clear(); setHasToken(Boolean(getToken()));
        if (getToken()) await qc.fetchQuery({ queryKey: ['me'], queryFn: () => api<MeDTO>('/me') });
      } catch { /* Query state preserves a retry path if the network is offline. */ }
      finally { setSwitchBusy(false); }
    })(); };
    window.addEventListener('gl:signed-out', onSignedOut);
    window.addEventListener('gl:switch-expired', onSwitchExpired);
    return () => { window.removeEventListener('gl:signed-out', onSignedOut); window.removeEventListener('gl:switch-expired', onSwitchExpired); };
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
    const wasSwitching = hasSwitchToken();
    await api('/auth/logout', { method: 'POST' }).catch(() => undefined);
    if (wasSwitching) { setSwitchToken(null); await api('/auth/logout', { method: 'POST' }).catch(() => undefined); }
    setToken(null);
    setHasToken(false);
    qc.clear();
  }, [qc]);

  const switchAccount = useCallback(async (id: string) => {
    if (qc.isMutating()) throw new Error('انتظر اكتمال العملية الحالية ثم بدّل الحساب.');
    if (switchLock.current) throw new Error('تبديل الحساب قيد التنفيذ.');
    switchLock.current = true; setSwitchBusy(true);
    try {
      await qc.cancelQueries();
      const result = await api<AuthResult>(`/auth/switch/${id}/start`, { body: {} });
      await qc.cancelQueries();
      setSwitchToken(result.token);
      qc.clear(); qc.setQueryData(['me'], result.me); setHasToken(true);
      return result.me;
    } finally { switchLock.current = false; setSwitchBusy(false); }
  }, [qc]);
  const returnToAdmin = useCallback(async () => {
    if (qc.isMutating()) throw new Error('انتظر اكتمال العملية الحالية ثم ارجع إلى حسابك.');
    if (switchLock.current) throw new Error('تبديل الحساب قيد التنفيذ.');
    switchLock.current = true; setSwitchBusy(true);
    try {
      await api('/auth/switch/stop', { body: {} });
      await qc.cancelQueries(); setSwitchToken(null); qc.clear();
      const restored = await api<MeDTO>('/me');
      qc.setQueryData(['me'], restored); setHasToken(true);
      return restored;
    } finally { switchLock.current = false; setSwitchBusy(false); }
  }, [qc]);

  const value: Session = {
    me: hasToken ? (me.data ?? null) : null,
    loading: hasToken && me.isPending,
    error: hasToken && !me.data && me.isError ? me.error : null,
    retry: me.refetch,
    signIn,
    signOut,
    switchAccount, returnToAdmin, switchBusy,
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
