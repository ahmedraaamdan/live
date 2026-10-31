import { useEffect, useState, type ReactNode } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import type { AccountSecurityDTO } from '@workspace/live-core';
import { MfaEnrollment } from '@/components/mfa-enrollment';
import { QueryError } from '@/components/query-error';
import { api } from '@/lib/api';
import { useSession } from '@/lib/session';
import { Banner, Button, Card, Logo, PageSpinner } from '@/ui';

/**
 * Administrators set up two-factor before anything else. The screen stays until
 * they choose to continue, because the one-time recovery codes appear here and a
 * background refresh of the account must not take them away.
 */
export function AdminMfaGate({ children }: { children: ReactNode }) {
  const { me, signOut } = useSession();
  const qc = useQueryClient();
  const required = Boolean(me?.mfaSetupRequired);
  const [open, setOpen] = useState(required);
  useEffect(() => { if (required) setOpen(true); }, [required]);
  const security = useQuery({ queryKey: ['me-security'], queryFn: () => api<AccountSecurityDTO>('/me/security'), enabled: open });
  if (!open) return <>{children}</>;
  if (security.isPending) return <PageSpinner />;
  if (!security.data) return <div className="mx-auto max-w-xl p-5"><QueryError error={security.error} retry={security.refetch} /></div>;
  const enabled = security.data.mfaEnabled;
  return (
    <div className="mx-auto flex min-h-dvh max-w-xl flex-col gap-5 px-5 pt-safe pb-safe">
      <Logo className="mt-8" />
      <Banner tone="warning" title="خطوة مطلوبة لحسابات الإدارة">
        حساب الإدارة يتحكم في السحوبات وبيانات المستخدمين، لذلك تُفتح لوحة الإدارة بعد تفعيل المصادقة الثنائية.
      </Banner>
      <Card><MfaEnrollment security={security.data} onChange={() => void security.refetch()} /></Card>
      {enabled
        ? <Button size="lg" block onClick={() => { void qc.invalidateQueries({ queryKey: ['me'] }); setOpen(false); }}>حفظت رموز الاسترداد. افتح لوحة الإدارة</Button>
        : <Button variant="text" onClick={() => void signOut()}>تسجيل الخروج</Button>}
    </div>
  );
}
