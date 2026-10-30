import { QueryError } from '@/components/query-error';
import { useState } from 'react';
import { CalendarCheck, Clock, NotebookPen, Plus, Star, UserPlus } from 'lucide-react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { gradeLabel, type ChildDetailDTO, type ChildSummaryDTO } from '@workspace/live-core';
import { lectureEnded } from '@/components/lecture-card';
import { NotificationsButton } from '@/layouts/app-shell';
import { api, errorMessage } from '@/lib/api';
import { fmtDateTime, fmtMinutes, money } from '@/lib/format';
import { useMe } from '@/lib/session';
import {
  Avatar,
  Badge,
  Banner,
  Button,
  Card,
  EmptyState,
  LinkCard,
  List,
  ListItem,
  Page,
  PageSpinner,
  ProgressRing,
  Segmented,
  Sheet,
  Stat,
  StatGrid,
  TextField,
  TopBar,
  toast,
} from '@/ui';

const pct = (v: number | null) => (v == null ? '—' : `${Math.round(v * 100)}%`);

export function ParentHome() {
  const me = useMe();
  const qc = useQueryClient();
  const q = useQuery({ queryKey: ['children'], queryFn: () => api<ChildSummaryDTO[]>('/parent/children') });
  const [open, setOpen] = useState(false);
  const [code, setCode] = useState('');
  const link = useMutation({
    mutationFn: () => api<ChildSummaryDTO>('/parent/children', { body: { code } }),
    onSuccess: (c) => {
      qc.invalidateQueries({ queryKey: ['children'] });
      setOpen(false);
      setCode('');
      toast(`اتربط حساب ${c.student.name}`);
    },
  });

  return (
    <>
      <TopBar title={`أهلاً ${me.user.name.split(' ')[0]}`} large subtitle="متابعة أولادك أول بأول" actions={<NotificationsButton />} />
      <Page>
        {q.isError && <QueryError error={q.error} retry={q.refetch} />}
        {q.isPending && <div className="skeleton h-56 rounded-xl" />}
        {q.data?.length === 0 && (
          <EmptyState
            icon={<UserPlus />}
            title="اربط حساب ابنك أو بنتك"
            body="هتلاقي «كود الربط» في صفحة «حسابي» عندهم. هتشوف الحضور ووقت المشاهدة والواجبات والدرجات."
            action={
              <Button size="lg" onClick={() => setOpen(true)}>
                <Plus /> اربط حساب
              </Button>
            }
          />
        )}
        <div className="flex flex-col gap-4">
          {q.data?.map((c) => (
            <LinkCard key={c.student.id} href={`/p/children/${c.student.id}`} pad="lg" className="rounded-xl">
              <div className="flex items-center gap-3">
                <Avatar name={c.student.name} src={c.student.avatarUrl} size="lg" />
                <div className="min-w-0 flex-1">
                  <p className="text-title-lg">{c.student.name}</p>
                  <p className="text-body-md text-on-surface-variant">{gradeLabel(c.student.grade)}</p>
                </div>
              </div>
              <div className="mt-5 grid grid-cols-3 gap-3 text-center">
                <Ring label="الحضور" value={c.stats.attendanceRate} tone="success" />
                <Ring label="الواجبات" value={c.stats.assignmentsTotal ? c.stats.assignmentsSubmitted / c.stats.assignmentsTotal : null} tone="tertiary" />
                <Ring label="الدرجات" value={c.stats.avgScorePct == null ? null : c.stats.avgScorePct / 100} tone="secondary" />
              </div>
              {c.next && (
                <div className="mt-5 flex items-center gap-3 rounded-md bg-surface-container p-3">
                  <CalendarCheck className="size-5 text-secondary" />
                  <span className="min-w-0 flex-1 truncate text-body-md">
                    الحصة القادمة: <span className="text-title-sm">{c.next.title}</span>
                  </span>
                  <span className="shrink-0 text-body-sm text-on-surface-variant">{fmtDateTime(c.next.startsAt)}</span>
                </div>
              )}
            </LinkCard>
          ))}
          {q.data && q.data.length > 0 && (
            <Button variant="outlined" onClick={() => setOpen(true)} className="self-start">
              <Plus /> ربط حساب آخر
            </Button>
          )}
        </div>
      </Page>
      <Sheet
        open={open}
        onOpenChange={setOpen}
        title="اربط حساب ابنك"
        description="الكود في صفحة «حسابي» عنده، 6 حروف وأرقام."
        footer={
          <Button block size="lg" loading={link.isPending} disabled={code.trim().length < 4} onClick={() => link.mutate()}>
            اربط
          </Button>
        }
      >
        {link.error && <Banner tone="error" className="mb-4">{errorMessage(link.error)}</Banner>}
        <TextField label="كود الربط" ltr value={code} onChange={(e) => setCode(e.target.value.toUpperCase())} className="text-center font-num text-headline-sm tracking-[0.4em]" maxLength={8} autoFocus />
      </Sheet>
    </>
  );
}

function Ring({ label, value, tone }: { label: string; value: number | null; tone: 'success' | 'tertiary' | 'secondary' }) {
  return (
    <div className="flex flex-col items-center gap-2">
      <ProgressRing value={value} tone={tone} size={76}>
        <span className="font-num text-title-md">{pct(value)}</span>
      </ProgressRing>
      <span className="text-label-lg text-on-surface-variant">{label}</span>
    </div>
  );
}

export function ChildDetail({ id }: { id: string }) {
  const q = useQuery({ queryKey: ['child', id], queryFn: () => api<ChildDetailDTO>(`/parent/children/${id}`) });
  const [tab, setTab] = useState<'lectures' | 'homework' | 'payments'>('lectures');
  if (q.isPending) return <PageSpinner />;
  if (!q.data)
    return (
      <>
        <TopBar title="المتابعة" back="/p" />
        <Page>
          <Banner tone="error">{errorMessage(q.error)}</Banner>
        </Page>
      </>
    );
  const c = q.data;
  const s = c.stats;
  return (
    <>
      <TopBar title={c.student.name} back="/p" />
      <Page>
        <div className="mb-6 flex items-center gap-4">
          <Avatar name={c.student.name} src={c.student.avatarUrl} size="xl" />
          <div>
            <h1 className="text-headline-md">{c.student.name}</h1>
            <p className="text-body-md text-on-surface-variant">{gradeLabel(c.student.grade)}</p>
          </div>
        </div>
        <StatGrid>
          <Stat icon={<CalendarCheck />} tone="success" label="نسبة الحضور" value={pct(s.attendanceRate)} hint={`حضر ${s.lecturesAttended} من ${s.lecturesPast} حصة`} />
          <Stat icon={<Clock />} tone="secondary" label="وقت المشاهدة" value={fmtMinutes(s.minutesWatched * 60)} />
          <Stat icon={<NotebookPen />} tone="tertiary" label="الواجبات" value={`${s.assignmentsSubmitted}/${s.assignmentsTotal}`} hint="اتسلّمت" />
          <Stat icon={<Star />} tone="primary" label="متوسط الدرجات" value={s.avgScorePct == null ? '—' : `${s.avgScorePct}%`} />
        </StatGrid>
        {s.attendanceRate != null && s.attendanceRate < 0.6 && (
          <Banner tone="warning" className="mt-4" title="الحضور قليل">
            {c.student.name.split(' ')[0]} فوّت أكتر من حصة. ممكن تتكلموا سوا، والتسجيلات متاحة لو حب يعوّض.
          </Banner>
        )}
        <Segmented
          className="mt-6 mb-4"
          value={tab}
          onChange={setTab}
          options={[
            { value: 'lectures', label: 'الحصص' },
            { value: 'homework', label: 'الواجبات' },
            { value: 'payments', label: 'المدفوعات' },
          ]}
        />
        {tab === 'lectures' &&
          (c.lectures.length === 0 ? (
            <EmptyState icon={<CalendarCheck />} title="لا توجد حصص محجوزة" />
          ) : (
            <List>
              {c.lectures.map(({ lecture: l, attendedSeconds }) => {
                const past = lectureEnded(l);
                return (
                  <ListItem
                    key={l.id}
                    title={l.title}
                    subtitle={`${l.teacher.name} · ${fmtDateTime(l.startsAt)}`}
                    trailing={
                      l.status === 'live' ? (
                        <Badge tone="primary">مباشر</Badge>
                      ) : !past ? (
                        <Badge tone="secondary">جاية</Badge>
                      ) : attendedSeconds >= 300 ? (
                        <Badge tone="success">حضر {fmtMinutes(attendedSeconds)}</Badge>
                      ) : (
                        <Badge tone="error">محضرش</Badge>
                      )
                    }
                  />
                );
              })}
            </List>
          ))}
        {tab === 'homework' &&
          (c.assignments.length === 0 ? (
            <EmptyState icon={<NotebookPen />} title="لا توجد واجبات بعد" />
          ) : (
            <List>
              {c.assignments.map((a) => (
                <ListItem
                  key={a.id}
                  title={a.title}
                  subtitle={a.lectureTitle}
                  trailing={
                    a.mySubmission?.score != null ? (
                      <Badge tone="success">
                        <span className="font-num">
                          {a.mySubmission.score}/{a.maxScore}
                        </span>
                      </Badge>
                    ) : a.mySubmission ? (
                      <Badge tone="secondary">اتسلّم</Badge>
                    ) : a.dueAt && new Date(a.dueAt) < new Date() ? (
                      <Badge tone="error">متأخر</Badge>
                    ) : (
                      <Badge tone="warning">لسه</Badge>
                    )
                  }
                />
              ))}
            </List>
          ))}
        {tab === 'payments' &&
          (c.payments.length === 0 ? (
            <EmptyState icon={<Star />} title="لا توجد مدفوعات" />
          ) : (
            <List>
              {c.payments.map((p) => (
                <ListItem
                  key={p.id}
                  title={p.lectureTitle}
                  subtitle={fmtDateTime(p.createdAt)}
                  trailing={
                    <span className="flex flex-col items-end">
                      <span className="font-num text-title-sm text-on-surface">{money(p.amountCents)}</span>
                      {p.status === 'refunded' && <Badge tone="error">اترجع</Badge>}
                    </span>
                  }
                />
              ))}
            </List>
          ))}
      </Page>
    </>
  );
}

