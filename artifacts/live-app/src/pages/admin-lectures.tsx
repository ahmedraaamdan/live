import { useState } from 'react';
import { useMutation, useQuery } from '@tanstack/react-query';
import { CalendarDays, Mail, UsersRound } from 'lucide-react';
import { Link } from 'wouter';
import {
  getAllGradesForCurriculum, gradeLabel, lectureMailCopy, lectureMailDraftSchema, subjectLabel,
  type AdminLectureFilter, type AdminLecturePage, type AdminLectureRow, type LectureMailDraft, type LectureMailProgress,
} from '@workspace/live-core';
import { QueryError } from '@/components/query-error';
import { api, errorMessage } from '@/lib/api';
import { fmtDateTime, fmtDuration, money } from '@/lib/format';
import { Badge, Banner, Button, Card, Page, PageSpinner, Segmented, Select, Sheet, TextArea, TextField, TopBar } from '@/ui';

const filters = [
  { value: 'upcoming', label: 'قادمة ومباشرة' },
  { value: 'ended', label: 'انتهت' },
  { value: 'other', label: 'مسودات وملغاة' },
] as const;

const statuses = {
  scheduled: { label: 'قادمة', tone: 'primary' },
  live: { label: 'مباشرة الآن', tone: 'success' },
  ended: { label: 'انتهت', tone: 'neutral' },
  cancelled: { label: 'ملغاة', tone: 'error' },
  draft: { label: 'مسودة', tone: 'outline' },
} as const;

const templates = [
  { value: 'reminder', label: 'تذكير قبل الحصة' },
  { value: 'followup', label: 'متابعة بعد الحصة' },
  { value: 'announcement', label: 'تحديث بخصوص الحصة' },
] as const;

function LectureEmailSheet({ lecture, close }: { lecture: AdminLectureRow; close: () => void }) {
  const [draft, setDraft] = useState<LectureMailDraft>(() => {
    const template = lecture.status === 'ended' ? 'followup' : 'reminder';
    return { template, audience: lecture.teacher.suspended ? 'students' : 'teacher', ...lectureMailCopy(template, lecture.title) };
  });
  const [requestId] = useState(() => crypto.randomUUID());
  const [previewFor, setPreviewFor] = useState<LectureMailDraft | null>(null);
  const endpoint = `/admin/lectures/${lecture.id}/email`;
  const preview = useMutation({
    mutationFn: (body: LectureMailDraft) => api<{ html: string }>(`${endpoint}/preview`, { body }),
  });
  const send = useMutation({
    mutationFn: (body: LectureMailDraft) => api<{ id: string }>(endpoint, { body: { ...body, requestId } }),
  });
  const jobId = send.data?.id;
  const progress = useQuery({
    queryKey: ['admin-lecture-mail', lecture.id, jobId],
    queryFn: ({ signal }) => api<LectureMailProgress>(`${endpoint}/${jobId}`, { signal }),
    enabled: Boolean(jobId),
    refetchInterval: (q) => q.state.data?.done ? false : 2000,
  });
  const audiences = [
    ...(!lecture.teacher.suspended ? [{ value: 'teacher', label: `المدرس — ${lecture.teacher.name}` }] : []),
    ...(lecture.booked > 0 ? [{ value: 'students', label: `الطلاب اللي حجزهم مؤكد (${lecture.booked})` }] : []),
    ...(!lecture.teacher.suspended && lecture.booked > 0 ? [{ value: 'both', label: 'المدرس والطلاب' }] : []),
  ];
  const valid = lectureMailDraftSchema.safeParse(draft);
  const busy = send.isPending || Boolean(jobId);
  const error = send.error ?? (previewFor === draft ? preview.error : null);

  return (
    <Sheet open onOpenChange={(open) => { if (!open && !send.isPending) close(); }} title="إيميل الحصة" description={lecture.title}
      footer={jobId ? <Button onClick={close}>قفل</Button> : (
        <>
          <Button variant="outlined" disabled={!valid.success || !audiences.length || busy} loading={preview.isPending}
            onClick={() => { if (valid.success) { setPreviewFor(draft); preview.mutate(valid.data); } }}>معاينة</Button>
          <Button disabled={!valid.success || !audiences.length || previewFor !== draft || !preview.isSuccess} loading={send.isPending}
            onClick={() => { if (valid.success) send.mutate(valid.data); }}><Mail /> إرسال الإيميل</Button>
        </>
      )}>
      <div className="grid gap-4">
        {error && <Banner tone="error">{errorMessage(error)}</Banner>}
        {jobId ? (
          progress.data ? (
            <Banner tone={progress.data.done && progress.data.failed > 0 ? 'error' : 'info'}>
              {progress.data.done ? 'اكتمل الإرسال' : 'جارٍ إرسال الإيميل'} · اتبعت {progress.data.sent} من {progress.data.total}
              {progress.data.failed > 0 && ` · تعذّر إرسال ${progress.data.failed}`}
            </Banner>
          ) : progress.isError ? (
            <QueryError error={progress.error} retry={progress.refetch} />
          ) : <Banner tone="info">الإيميل في قائمة الإرسال. تقدر تقفل النافذة والإرسال هيكمل.</Banner>
        ) : (
          <>
            <div className="grid gap-4 sm:grid-cols-2">
              <Select label="المستلم" value={draft.audience} options={audiences} disabled={busy}
                onChange={(e) => { const audience = e.target.value as LectureMailDraft['audience']; setDraft((d) => ({ ...d, audience })); }} />
              <Select label="القالب" value={draft.template} options={templates} disabled={busy}
                onChange={(e) => { const template = e.target.value as LectureMailDraft['template']; setDraft((d) => ({ ...d, template, ...lectureMailCopy(template, lecture.title) })); }} />
            </div>
            <TextField label="عنوان الإيميل" value={draft.subject} maxLength={250} disabled={busy}
              onChange={(e) => { const subject = e.target.value; setDraft((d) => ({ ...d, subject })); }} />
            <TextField label="العنوان داخل القالب" value={draft.title} maxLength={200} disabled={busy}
              onChange={(e) => { const title = e.target.value; setDraft((d) => ({ ...d, title })); }} />
            <TextArea label="نص الرسالة" value={draft.message} maxLength={4000} rows={4} disabled={busy}
              onChange={(e) => { const message = e.target.value; setDraft((d) => ({ ...d, message })); }} />
            {previewFor === draft && preview.data && (
              <iframe title="معاينة إيميل جاهز لايف" sandbox="" srcDoc={preview.data.html} className="h-96 w-full rounded-lg border border-outline-variant bg-white" />
            )}
          </>
        )}
      </div>
    </Sheet>
  );
}

export function AdminLectures() {
  const [filter, setFilter] = useState<AdminLectureFilter>('upcoming');
  const [page, setPage] = useState(0);
  const [email, setEmail] = useState<AdminLectureRow | null>(null);
  const lectures = useQuery({
    queryKey: ['admin-lectures', filter, page],
    queryFn: ({ signal }) => api<AdminLecturePage>(`/admin/lectures?filter=${filter}&page=${page}`, { signal }),
    refetchInterval: 30_000,
  });

  return (
    <>
      <TopBar title="الحصص" subtitle="متابعة الحصص والحجوزات والإيميلات" />
      <Page className="flex flex-col gap-5">
        <Card className="flex flex-col gap-4 border-s-4 border-s-primary p-4 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex items-center gap-3">
            <span className="grid size-11 shrink-0 place-items-center rounded-xl bg-primary-container text-on-primary-container"><CalendarDays size={22} /></span>
            <div>
              <h2 className="text-title-lg">جدول الحصص</h2>
              <p className="text-body-sm text-on-surface-variant">المواعيد بتوقيت القاهرة</p>
            </div>
          </div>
          <Segmented ariaLabel="حالة الحصص" value={filter} options={filters} onChange={(value) => { setFilter(value); setPage(0); }} />
        </Card>

        {lectures.isPending ? <PageSpinner /> : lectures.isError ? <QueryError error={lectures.error} retry={lectures.refetch} /> : (
          <>
            {lectures.data.rows.length === 0 && <Card className="p-8 text-center text-on-surface-variant">مفيش حصص في القسم ده.</Card>}
            <ul className="grid gap-3">
              {lectures.data.rows.map((row) => {
                const status = statuses[row.status];
                const grade = getAllGradesForCurriculum(row.curriculum).find((item) => item.key === row.grade)?.label ?? gradeLabel(row.grade);
                return (
                  <li key={row.id}>
                    <Card className="grid gap-4 p-4 sm:grid-cols-2 xl:grid-cols-[1.4fr_1fr_1fr_auto] xl:items-center">
                      <div className="min-w-0">
                        <Badge tone={status.tone}>{status.label}</Badge>
                        <h3 className="mt-1 break-words text-title-lg"><Link className="hover:underline" href={`/lectures/${row.id}`}>{row.title}</Link></h3>
                        <p className="text-body-sm text-on-surface-variant">{subjectLabel(row.subject)} · {grade}</p>
                        <p className="text-body-sm text-on-surface-variant">{fmtDateTime(row.startsAt)} · {fmtDuration(row.durationMin)}</p>
                      </div>
                      <div className="min-w-0 text-body-sm">
                        <p className="text-label-md text-on-surface-variant">المدرس</p>
                        <p className="break-words text-title-sm">{row.teacher.name}</p>
                        <p className="break-all text-on-surface-variant"><bdi>{row.teacher.email}</bdi></p>
                        {row.teacher.phone && <p className="text-on-surface-variant"><bdi>{row.teacher.phone}</bdi></p>}
                      </div>
                      <div className="text-body-sm text-on-surface-variant">
                        <p className="flex items-center gap-1.5 font-bold text-on-surface"><UsersRound size={16} /> {row.booked} حجز مؤكد{row.capacity !== null && ` من ${row.capacity}`}</p>
                        <p>{row.attended} حضروا · {row.pending} في انتظار الدفع</p>
                        <p>{row.priceCents ? money(row.priceCents, row.currency) : 'مجانية'} · {row.remindersSent} تذكير تلقائي اتبعت</p>
                      </div>
                      <Button variant="outlined" className="justify-self-start xl:justify-self-end" disabled={row.teacher.suspended && row.booked === 0} onClick={() => setEmail(row)}><Mail /> إرسال إيميل</Button>
                    </Card>
                  </li>
                );
              })}
            </ul>
            {(page > 0 || lectures.data.hasMore) && (
              <nav className="flex items-center justify-center gap-3" aria-label="صفحات الحصص">
                <Button variant="outlined" disabled={page === 0} onClick={() => setPage((p) => p - 1)}>السابق</Button>
                <span className="text-body-sm">صفحة {page + 1}</span>
                <Button variant="outlined" disabled={!lectures.data.hasMore} onClick={() => setPage((p) => p + 1)}>التالي</Button>
              </nav>
            )}
          </>
        )}
      </Page>
      {email && <LectureEmailSheet key={email.id} lecture={email} close={() => setEmail(null)} />}
    </>
  );
}
