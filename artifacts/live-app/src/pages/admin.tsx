import { VerificationQueueLink } from '@/components/verification-notice';
import { QueryError } from '@/components/query-error';
import { useState } from 'react';
import { Banknote, CheckCircle2, GraduationCap, HandCoins, Landmark, Presentation, Ticket, Users, XCircle } from 'lucide-react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { PAYMENT_METHOD_LABELS, PAYOUT_METHOD_LABELS, ROLE_LABELS, type AdminOverviewDTO, type AdminUserDTO, type PayoutDTO, type Role } from '@workspace/live-core';
import { api, errorMessage } from '@/lib/api';
import { fmtDateTime, money } from '@/lib/format';
import { Avatar, Badge, Banner, Button, Card, Chip, EmptyState, List, ListItem, Page, PageSpinner, SectionHeader, Sheet, Stat, StatGrid, TextArea, TopBar, toast } from '@/ui';

export function AdminOverview() {
  const q = useQuery({ queryKey: ['admin-overview'], queryFn: () => api<AdminOverviewDTO>('/admin/overview'), refetchInterval: 60_000 });
  if (q.isPending) return <PageSpinner />;
  if (!q.data) return <><TopBar title="لوحة الإدارة" /><Page><QueryError error={q.error} retry={q.refetch} /></Page></>;
  const d = q.data;
  return (
    <>
      <TopBar title="لوحة الإدارة" large subtitle="الفلوس والنشاط على المنصة" />
      <Page wide>
        <div className="mb-5"><VerificationQueueLink /></div>
        {d.pendingReviews.length > 0 && <section className="mb-6"><SectionHeader title="معاملات تحتاج إلى مراجعة" /><Banner tone="warning">راجع هذه المعاملات في لوحة بوابة الدفع. لا يُعد الاسترداد مكتملًا حتى يؤكده المزود.</Banner><List className="mt-4">{d.pendingReviews.map(p => <ListItem key={p.id} title={p.lectureTitle} subtitle={`${p.payer.name} · ${money(p.amountCents)} · ${p.id}`} trailing={<Badge tone="warning">{p.refundPending ? 'استرداد قيد التنفيذ' : 'مراجعة المبلغ'}</Badge>} />)}</List></section>}

        <StatGrid>
          <Stat icon={<Banknote />} tone="secondary" label="إجمالي المدفوعات" value={money(d.gmvCents)} />
          <Stat icon={<HandCoins />} tone="success" label="عمولة المنصة" value={money(d.platformCents)} />
          <Stat icon={<Landmark />} tone="tertiary" label="مستحق للمدرسين" value={money(d.teacherPayableCents)} />
          <Stat icon={<CheckCircle2 />} tone="primary" label="اتحوّل للمدرسين" value={money(d.paidOutCents)} />
        </StatGrid>
        <StatGrid className="mt-3">
          <Stat icon={<Presentation />} label="مدرسين" value={d.counts.teachers} />
          <Stat icon={<GraduationCap />} label="طلاب" value={d.counts.students} />
          <Stat icon={<Users />} label="أولياء أمور" value={d.counts.parents} />
          <Stat icon={<Ticket />} label="حجوزات" value={d.counts.bookings} hint={`${d.counts.lectures} حصة`} />
        </StatGrid>

        <div className="mt-8 grid gap-6 xl:grid-cols-2">
          <section>
            <SectionHeader title={`طلبات سحب مستنية (${d.pendingPayouts.length})`} />
            <PayoutList payouts={d.pendingPayouts} />
          </section>
          <section>
            <SectionHeader title="آخر المدفوعات" />
            {d.recentPayments.length === 0 ? (
              <EmptyState icon={<Banknote />} title="لا توجد مدفوعات بعد" />
            ) : (
              <List>
                {d.recentPayments.map((p) => (
                  <ListItem
                    key={p.id}
                    leading={<Avatar name={p.payer.name} size="sm" />}
                    title={p.lectureTitle}
                    subtitle={`${p.payer.name} ← ${p.teacher.name} · ${p.method ? PAYMENT_METHOD_LABELS[p.method] : ''} · ${fmtDateTime(p.createdAt)}`}
                    trailing={
                      <span className="flex flex-col items-end">
                        <span className="font-num text-title-sm text-on-surface">{money(p.amountCents)}</span>
                        {p.status === 'refunded' && <Badge tone="error">اترجع</Badge>}
                      </span>
                    }
                  />
                ))}
              </List>
            )}
          </section>
        </div>
      </Page>
    </>
  );
}

function PayoutList({ payouts }: { payouts: PayoutDTO[] }) {
  const qc = useQueryClient();
  const [open, setOpen] = useState<PayoutDTO | null>(null);
  const [note, setNote] = useState('');
  const decide = useMutation({
    mutationFn: (status: 'paid' | 'rejected') => api<PayoutDTO>(`/admin/payouts/${open!.id}`, { body: { status, note } }),
    onSuccess: (p) => {
      qc.invalidateQueries({ queryKey: ['admin-overview'] });
      qc.invalidateQueries({ queryKey: ['admin-payouts'] });
      setOpen(null);
      setNote('');
      toast(p.status === 'paid' ? 'اتسجّل التحويل، والمدرس وصله إيميل' : 'اترفض الطلب والمبلغ رجع لرصيده');
    },
    onError: (e) => toast(errorMessage(e)),
  });
  if (payouts.length === 0) return <EmptyState icon={<CheckCircle2 />} title="لا توجد طلبات بانتظار المراجعة" />;
  return (
    <>
      <List>
        {payouts.map((p) => (
          <ListItem
            key={p.id}
            onClick={p.status === 'requested' ? () => setOpen(p) : undefined}
            leading={<Avatar name={p.teacher?.name ?? ''} size="sm" />}
            title={
              <span>
                <span className="font-num">{money(p.amountCents)}</span> · {p.teacher?.name}
              </span>
            }
            subtitle={`${PAYOUT_METHOD_LABELS[p.method]}: ${p.account} · ${fmtDateTime(p.createdAt)}`}
            trailing={<Badge tone={p.status === 'paid' ? 'success' : p.status === 'rejected' ? 'error' : 'warning'}>{p.status === 'paid' ? 'اتحوّل' : p.status === 'rejected' ? 'اترفض' : 'مستني'}</Badge>}
            chevron={p.status === 'requested'}
          />
        ))}
      </List>
      <Sheet
        open={Boolean(open)}
        onOpenChange={(o) => !o && setOpen(null)}
        title={open ? `تحويل ${money(open.amountCents)}` : ''}
        description={open ? `${open.teacher?.name} · ${PAYOUT_METHOD_LABELS[open.method]}` : undefined}
        footer={
          <>
            <Button block loading={decide.isPending && decide.variables === 'paid'} onClick={() => decide.mutate('paid')}>
              <CheckCircle2 /> حوّلت الفلوس
            </Button>
            <Button block variant="outlined" loading={decide.isPending && decide.variables === 'rejected'} onClick={() => decide.mutate('rejected')}>
              <XCircle /> ارفض
            </Button>
          </>
        }
      >
        {open && (
          <div className="flex flex-col gap-4">
            <Card variant="filled">
              <p className="text-body-sm text-on-surface-variant">حوّل على</p>
              <p className="mt-1 font-num text-title-lg break-all" dir="ltr">
                {open.account}
              </p>
            </Card>
            <TextArea label="ملاحظة للمدرس" value={note} onChange={(e) => setNote(e.target.value)} rows={2} placeholder="رقم العملية، أو سبب الرفض" />
          </div>
        )}
      </Sheet>
    </>
  );
}

export function AdminPayouts() {
  const q = useQuery({ queryKey: ['admin-payouts'], queryFn: () => api<PayoutDTO[]>('/admin/payouts') });
  return (
    <>
      <TopBar title="السحوبات" large />
      <Page>{q.isPending ? <PageSpinner /> : q.isError ? <QueryError error={q.error} retry={q.refetch} /> : <PayoutList payouts={q.data ?? []} />}</Page>
    </>
  );
}

export function AdminUsers() {
  const [role, setRole] = useState<Role | ''>('');
  const qc = useQueryClient();
  const q = useQuery({ queryKey: ['admin-users', role], queryFn: () => api<AdminUserDTO[]>(`/admin/users${role ? `?role=${role}` : ''}`) });
  const suspend = useMutation({
    mutationFn: (u: { id: string; suspended: boolean }) => api(`/admin/users/${u.id}/suspend`, { body: { suspended: u.suspended } }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['admin-users'] });
      toast('اتحدّث الحساب');
    },
  });
  return (
    <>
      <TopBar title="المستخدمين" large />
      <Page>
        <div className="scrollbar-none mb-4 flex gap-2 overflow-x-auto">
          {(['', 'teacher', 'student', 'parent', 'admin'] as const).map((r) => (
            <Chip key={r || 'all'} selected={role === r} onClick={() => setRole(r)}>
              {r ? ROLE_LABELS[r] : 'الكل'}
            </Chip>
          ))}
        </div>
        {q.isError ? <QueryError error={q.error} retry={q.refetch} /> : q.isPending ? (
          <PageSpinner />
        ) : (
          <List>
            {q.data?.map((u) => (
              <ListItem
                key={u.id}
                leading={<Avatar name={u.name} src={u.avatarUrl} />}
                title={u.name}
                subtitle={`${u.email} · ${ROLE_LABELS[u.role]}${u.role === 'teacher' ? ` · ${u.lectures} حصة` : u.role === 'student' ? ` · ${u.bookings} حجز` : ''}`}
                trailing={
                  u.role !== 'admin' ? (
                    <Button size="sm" variant="danger-text" onClick={() => suspend.mutate({ id: u.id, suspended: true })}>
                      إيقاف
                    </Button>
                  ) : null
                }
              />
            ))}
          </List>
        )}
      </Page>
    </>
  );
}
