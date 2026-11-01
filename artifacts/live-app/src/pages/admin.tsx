import { VerificationQueueLink } from '@/components/verification-notice';
import { QueryError } from '@/components/query-error';
import { useState } from 'react';
import { Banknote, CheckCircle2, GraduationCap, HandCoins, Landmark, Presentation, ShieldAlert, Ticket, Users, XCircle } from 'lucide-react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { FUNDS_REVIEW_LABELS, PAYMENT_METHOD_LABELS, PAYOUT_METHOD_LABELS, REPORT_REASON_LABELS, type AdminOverviewDTO, type FundReviewDTO, type PayoutDTO } from '@workspace/live-core';
import { api, errorMessage } from '@/lib/api';
import { fmtDateTime, money } from '@/lib/format';
import { Avatar, Badge, Banner, Button, Card, EmptyState, List, ListItem, Page, PageSpinner, SectionHeader, Sheet, Stat, StatGrid, TextArea, TopBar, toast } from '@/ui';

const LIST_STEP = 5;

/** Long lists open with a few rows, and grow when asked. */
function useShowMore<T>(items: T[]) {
  const [count, setCount] = useState(LIST_STEP);
  return {
    visible: items.slice(0, count),
    more:
      items.length > count ? (
        <Button variant="text" block className="mt-2" onClick={() => setCount(count + LIST_STEP)}>
          عرض المزيد ({items.length - count})
        </Button>
      ) : null,
  };
}

function RecentPayments({ payments }: { payments: AdminOverviewDTO['recentPayments'] }) {
  const { visible, more } = useShowMore(payments);
  if (payments.length === 0) return <EmptyState icon={<Banknote />} title="لا توجد مدفوعات بعد" />;
  return (
    <>
      <List>
        {visible.map((p) => (
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
      {more}
    </>
  );
}

/** Classes whose earnings wait for a decision: pay the teacher, or give students their money back. */
function FundReviews() {
  const qc = useQueryClient();
  const q = useQuery({ queryKey: ['fund-reviews'], queryFn: () => api<FundReviewDTO[]>('/admin/fund-reviews'), refetchInterval: 60_000 });
  const refresh = () => {
    void qc.invalidateQueries({ queryKey: ['fund-reviews'] });
    void qc.invalidateQueries({ queryKey: ['admin-overview'] });
  };
  const decide = useMutation({
    mutationFn: ({ id, decision }: { id: string; decision: 'release' | 'refund' }) => api(`/admin/lectures/${id}/funds`, { body: { decision } }),
    onSuccess: (_data, { decision }) => {
      refresh();
      toast(decision === 'release' ? 'أصبحت الفلوس متاحة للمدرس' : 'سجّلنا رد قيمة الحصة للطلاب. نفّذ الرد من لوحة بوابة الدفع.');
    },
    onError: (e) => toast(errorMessage(e)),
  });
  const resolve = useMutation({
    mutationFn: ({ id, decision }: { id: string; decision: 'refund' | 'dismiss' }) => api(`/admin/reports/${id}`, { body: { decision } }),
    onSuccess: (_data, { decision }) => {
      refresh();
      toast(decision === 'refund' ? 'سجّلنا الرد لهذا الطالب. نفّذ الرد من لوحة بوابة الدفع.' : 'أغلقنا البلاغ');
    },
    onError: (e) => toast(errorMessage(e)),
  });
  if (!q.data?.length) return null;
  return (
    <section className="mb-6">
      <SectionHeader title={`حصص تحتاج إلى قرار (${q.data.length})`} />
      <div className="flex flex-col gap-3">
        {q.data.map((r) => (
          <Card key={r.lecture.id} variant="outlined">
            <div className="flex items-start gap-3">
              <ShieldAlert className="mt-1 size-6 shrink-0 text-warning" />
              <div className="min-w-0 flex-1">
                <p className="text-title-md">{r.lecture.title}</p>
                <p className="text-body-sm text-on-surface-variant">{r.teacher.name} · {fmtDateTime(r.lecture.startsAt)}</p>
                <p className="mt-2 text-body-md">{FUNDS_REVIEW_LABELS[r.reason]}</p>
                <p className="mt-1 text-body-sm text-on-surface-variant">
                  البث {r.lecture.liveMinutes} من {r.lecture.durationMin} دقيقة · حضر {r.lecture.attendees} طالب · المدفوع {money(r.amountCents)}
                </p>
              </div>
            </div>
            {r.reports.length > 0 && (
              <div className="mt-3 flex flex-col gap-2">
                {r.reports.map((report) => (
                  <div key={report.id} className="rounded-md bg-surface-container p-3">
                    <p className="text-title-sm">{report.student.name}: {REPORT_REASON_LABELS[report.reason]}</p>
                    {report.details && <p className="mt-1 whitespace-pre-wrap text-body-sm" data-allow-copy>{report.details}</p>}
                    <div className="mt-2 flex flex-wrap gap-2">
                      <Button size="sm" variant="tonal" disabled={resolve.isPending} onClick={() => resolve.mutate({ id: report.id, decision: 'refund' })}>رد المبلغ لهذا الطالب</Button>
                      <Button size="sm" variant="text" disabled={resolve.isPending} onClick={() => resolve.mutate({ id: report.id, decision: 'dismiss' })}>رفض البلاغ</Button>
                    </div>
                  </div>
                ))}
              </div>
            )}
            <div className="mt-3 flex flex-wrap gap-2">
              <Button size="sm" disabled={decide.isPending} onClick={() => decide.mutate({ id: r.lecture.id, decision: 'release' })}>
                <CheckCircle2 /> تحويل الفلوس للمدرس
              </Button>
              <Button size="sm" variant="outlined" disabled={decide.isPending} onClick={() => decide.mutate({ id: r.lecture.id, decision: 'refund' })}>
                <XCircle /> رد المبلغ لكل الطلاب
              </Button>
            </div>
          </Card>
        ))}
      </div>
    </section>
  );
}

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
        <FundReviews />
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
          <section className="min-w-0">
            <SectionHeader title={`طلبات سحب مستنية (${d.pendingPayouts.length})`} />
            <PayoutList payouts={d.pendingPayouts} />
          </section>
          <section className="min-w-0">
            <SectionHeader title="آخر المدفوعات" />
            <RecentPayments payments={d.recentPayments} />
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
  const { visible, more } = useShowMore(payouts);
  if (payouts.length === 0) return <EmptyState icon={<CheckCircle2 />} title="لا توجد طلبات بانتظار المراجعة" />;
  return (
    <>
      <List>
        {visible.map((p) => (
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
      {more}
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
