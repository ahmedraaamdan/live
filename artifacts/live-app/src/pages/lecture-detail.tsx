import { HomeworkTemplates } from '@/components/homework-templates';
import { fromCairoInput, toCairoInput } from '@/lib/calendar';
import { useCapabilities } from '@/lib/capabilities';
import { LessonArtwork } from '@/components/lesson-artwork';
import '@/styles/lesson.css';
import { QuizEditor, newQuestion } from '@/components/quiz-editor';
import type { QuizQuestion } from '@workspace/live-core';
import { useEffect, useRef, useState } from 'react';
import {
  CalendarClock,
  Clock,
  Edit3,
  Film,
  Link2,
  MessagesSquare,
  MoreVertical,
  NotebookPen,
  Plus,
  Radio,
  Share2,
  Trash2,
  Users,
  Wallet,
} from 'lucide-react';
import { Link, useLocation } from 'wouter';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import {
  HEARTBEAT_SECONDS,
  LIVE_OPEN_MINUTES_BEFORE,
  assignmentInputSchema,
  gradeLabel,
  subjectLabel,
  type AssignmentDTO,
  type AttendanceDTO,
  type BookingDTO,
  type LectureDTO,
  type MessageDTO,
} from '@workspace/live-core';
import { Countdown, ShareLectureSheet } from '@/components/bits';
import { StatusBadge, lectureEnded } from '@/components/lecture-card';
import { BoardReview } from '@/components/board/board-review';
import { MessageItem, threadMessages } from '@/components/qa';
import { VoteBar } from '@/components/vote';
import { api, errorMessage } from '@/lib/api';
import { fmtDay, fmtDuration, fmtMinutes, fmtRelative, fmtTime, money, toLocalInput } from '@/lib/format';
import { useMe } from '@/lib/session';
import {
  ActionBar,
  ActionMenu,
  Avatar,
  Badge,
  Banner,
  Button,
  Card,
  EmptyState,
  IconButton,
  List,
  ListItem,
  Page,
  PageSpinner,
  ProgressBar,
  Segmented,
  Sheet,
  Stat,
  StatGrid,
  TextArea,
  TextField,
  TopBar,
  toast,
} from '@/ui';

export function LectureDetail({ id }: { id: string }) {
  const me = useMe();
  const q = useQuery({ queryKey: ['lecture', id], queryFn: () => api<LectureDTO>(`/lectures/${id}`), refetchInterval: 20_000 });
  if (q.isPending) return <PageSpinner />;
  if (q.error || !q.data)
    return (
      <>
        <TopBar title="الحصة" back />
        <Page>
          <Banner tone="error">{errorMessage(q.error)}</Banner>
        </Page>
      </>
    );
  const l = q.data;
  const isOwner = l.teacher.id === me.user.id || me.user.role === 'admin';
  return isOwner ? <TeacherLecture l={l} /> : <StudentLecture l={l} />;
}

function LectureHeader({ l, showTeacher }: { l: LectureDTO; showTeacher?: boolean }) {
  return (
    <div className="lesson-detail-header">
      <div className="lesson-detail-copy">
      <div className="flex flex-wrap items-center gap-2">
        <Badge tone="primary">{subjectLabel(l.subject)}</Badge>
        <Badge>{gradeLabel(l.grade)}</Badge>
        <StatusBadge lecture={l} />
      </div>
      <h1 className="mt-3 text-headline-lg">{l.title}</h1>
      <div className="mt-2 flex flex-wrap gap-x-5 gap-y-1 text-body-md text-on-surface-variant">
        <span className="inline-flex items-center gap-1.5">
          <CalendarClock className="size-4" /> {fmtDay(l.startsAt)}، {fmtTime(l.startsAt)}
        </span>
        <span className="inline-flex items-center gap-1.5">
          <Clock className="size-4" /> {fmtDuration(l.durationMin)}
        </span>
        <span className="font-num text-title-sm text-on-surface">{l.priceCents ? money(l.priceCents) : 'مجانية'}</span>
      </div>
      {showTeacher && (
        <Link href={`/teachers/${l.teacher.id}`} className="teacher-link mt-4 flex items-center gap-3" aria-label={`ملف المدرس ${l.teacher.name}`}>
          <Avatar name={l.teacher.name} src={l.teacher.avatarUrl} />
          <div>
            <p className="text-title-md">{l.teacher.name}</p>
            {l.teacher.headline && <p className="text-body-sm text-on-surface-variant">{l.teacher.headline}</p>}
          </div>
        </Link>
      )}
      {l.description && <p className="lesson-detail-description">{l.description}</p>}
      </div><LessonArtwork subject={l.subject} label={subjectLabel(l.subject)} coverUrl={l.coverUrl} />
    </div>
  );
}

// ---------------------------------------------------------------- teacher

function TeacherLecture({ l }: { l: LectureDTO }) {
  const [, navigate] = useLocation();
  const qc = useQueryClient();
  const [tab, setTab] = useState<'students' | 'qa' | 'homework' | 'recording'>('students');
  const [share, setShare] = useState(false);
  const [confirmCancel, setConfirmCancel] = useState(false);
  const ended = lectureEnded(l);
  const openSoon = l.status === 'scheduled' && new Date(l.startsAt).getTime() - Date.now() <= LIVE_OPEN_MINUTES_BEFORE * 60_000 && !ended;
  const cancel = useMutation({
    mutationFn: () => api<LectureDTO>(`/lectures/${l.id}/cancel`, { method: 'POST' }),
    onSuccess: (x) => {
      qc.setQueryData(['lecture', l.id], x);
      qc.invalidateQueries({ queryKey: ['lectures'] });
      setConfirmCancel(false);
      toast('أُلغيت الحصة. يمكنك متابعة طلبات الاسترداد من سجل المدفوعات.');
    },
    onError: (e) => toast(errorMessage(e)),
  });
  const editable = l.status === 'draft' || (l.status === 'scheduled' && !ended);

  return (
    <>
      <TopBar
        title={l.title}
        back="/t/lectures"
        actions={
          <>
            <IconButton label="مشاركة" onClick={() => setShare(true)}>
              <Share2 />
            </IconButton>
            {editable && (
              <ActionMenu
                trigger={
                  <IconButton label="خيارات">
                    <MoreVertical />
                  </IconButton>
                }
                items={[
                  { label: 'تعديل', icon: <Edit3 />, onSelect: () => navigate(`/t/lectures/${l.id}/edit`) },
                  { label: 'إلغاء الحصة', icon: <Trash2 />, danger: true, onSelect: () => setConfirmCancel(true) },
                ]}
              />
            )}
          </>
        }
      />
      <Page wide>
        <LectureHeader l={l} />
        {l.stats && (
          <StatGrid className="mb-6 lg:grid-cols-3">
            <Stat icon={<Users />} tone="secondary" label="حاجزين" value={l.capacity ? `${l.stats.bookings}/${l.capacity}` : l.stats.bookings} />
            <Stat icon={<Wallet />} tone="success" label="دخلك من الحصة" value={money(l.stats.teacherCents)} />
            <Stat icon={<Radio />} tone="primary" label="حضروا" value={l.stats.attendees} className="col-span-2 lg:col-span-1" />
          </StatGrid>
        )}
        {l.status === 'scheduled' && !ended && (
          <Card variant="filled" className="mb-6 flex items-center gap-4">
            <div className="flex-1">
              <p className="text-body-md text-on-surface-variant">البث بيبدأ بعد</p>
              <Countdown to={l.startsAt} className="text-headline-md" />
            </div>
            <Button variant="tonal" onClick={() => setShare(true)}>
              <Share2 /> مشاركة الرابط
            </Button>
          </Card>
        )}
        <Segmented
          className="mb-5"
          value={tab}
          onChange={setTab}
          options={[
            { value: 'students', label: 'الطلاب' },
            { value: 'qa', label: 'الأسئلة' },
            { value: 'homework', label: 'الواجب' },
            { value: 'recording', label: 'التسجيل' },
          ]}
        />
        {tab === 'students' && <StudentsTab l={l} />}
        {tab === 'qa' && <QaHistory l={l} host />}
        {tab === 'homework' && <HomeworkTab l={l} />}
        {tab === 'recording' && <RecordingTab l={l} />}
      </Page>
      {(l.status === 'live' || openSoon) && (
        <ActionBar>
          <Button variant="live" size="lg" block onClick={() => navigate(`/live/${l.id}`)}>
            <Radio /> {l.status === 'live' ? 'ارجع للبث' : 'افتح استوديو البث'}
          </Button>
        </ActionBar>
      )}
      <ShareLectureSheet open={share} onOpenChange={setShare} code={l.code} title={l.title} />
      <Sheet
        open={confirmCancel}
        onOpenChange={setConfirmCancel}
        title="تلغي الحصة؟"
        description="كل الطلاب اللي دفعوا هيرجعلهم فلوسهم، وهيوصلهم إيميل بالإلغاء. مينفعش ترجع في القرار ده."
        footer={
          <>
            <Button variant="danger" block loading={cancel.isPending} onClick={() => cancel.mutate()}>
              أيوه، الغي الحصة
            </Button>
            <Button variant="outlined" block onClick={() => setConfirmCancel(false)}>
              لأ
            </Button>
          </>
        }
      >
        <span />
      </Sheet>
    </>
  );
}

function StudentsTab({ l }: { l: LectureDTO }) {
  const bookings = useQuery({ queryKey: ['bookings', l.id], queryFn: () => api<BookingDTO[]>(`/lectures/${l.id}/bookings`) });
  const attendance = useQuery({ queryKey: ['attendance', l.id], queryFn: () => api<AttendanceDTO[]>(`/lectures/${l.id}/attendance`), enabled: l.status !== 'scheduled' });
  const byStudent = new Map((attendance.data ?? []).map((a) => [a.student.id, a]));
  const maxSecs = l.durationMin * 60;
  if (bookings.isPending) return <div className="skeleton h-40" />;
  if (!bookings.data?.length) return <EmptyState icon={<Users />} title="لم تصل حجوزات بعد" body="مشاركة رابط الحجز لطلابك على واتساب، وأول ما حد يدفع هيظهر هنا." />;
  return (
    <List>
      {bookings.data.map((b) => {
        const a = b.student ? byStudent.get(b.student.id) : undefined;
        const secs = (a?.liveSeconds ?? 0) + (a?.replaySeconds ?? 0);
        return (
          <ListItem
            key={b.id}
            leading={<Avatar name={b.student?.name ?? ''} src={b.student?.avatarUrl} />}
            title={b.student?.name}
            subtitle={
              l.status === 'scheduled' ? (
                gradeLabel(b.student?.grade)
              ) : (
                <span className="flex items-center gap-2">
                  <ProgressBar value={secs / maxSecs} className="w-20" tone={a?.liveSeconds ? 'success' : 'secondary'} />
                  <span>{secs ? `حضر ${fmtMinutes(secs)}` : 'محضرش'}</span>
                </span>
              )
            }
            trailing={b.status === 'refunded' ? <Badge tone="error">اترجع</Badge> : <span className="font-num">{money(b.pricePaidCents)}</span>}
          />
        );
      })}
    </List>
  );
}

export function QaHistory({ l, host }: { l: LectureDTO; host?: boolean }) {
  const qc = useQueryClient();
  const q = useQuery({ queryKey: ['messages', l.id], queryFn: () => api<MessageDTO[]>(`/lectures/${l.id}/messages`) });
  const [replyTo, setReplyTo] = useState<MessageDTO | null>(null);
  const [reply, setReply] = useState('');
  const send = useMutation({
    mutationFn: () => api<MessageDTO>(`/lectures/${l.id}/messages`, { body: { body: reply, parentId: replyTo?.id } }),
    onSuccess: () => {
      setReply('');
      setReplyTo(null);
      qc.invalidateQueries({ queryKey: ['messages', l.id] });
      toast('اتبعت الرد، والطالب هيوصله إشعار');
    },
  });
  if (q.isPending) return <div className="skeleton h-40" />;
  const { top, answers } = threadMessages(q.data ?? []);
  const open = top.filter((m) => m.kind === 'question' && !m.answered).length;
  if (top.length === 0) return <EmptyState icon={<MessagesSquare />} title="لا توجد أسئلة بعد" body="أسئلة الطلاب وتعليقاتهم أثناء البث بتتحفظ هنا." />;
  return (
    <>
      {host && open > 0 && (
        <Banner tone="warning" className="mb-4">
          فيه <span className="font-num">{open}</span> سؤال لسه من غير رد. ردّك هيوصل للطالب كإشعار.
        </Banner>
      )}
      <Card className="divide-y divide-outline-variant py-1">
        {top.map((m) => (
          <MessageItem key={m.id} m={m} answers={answers.get(m.id)} host={host} onReply={setReplyTo} onUpdate={() => qc.invalidateQueries({ queryKey: ['messages', l.id] })} />
        ))}
      </Card>
      <Sheet
        open={Boolean(replyTo)}
        onOpenChange={(o) => !o && setReplyTo(null)}
        title="رد على السؤال"
        description={replyTo?.body}
        footer={
          <Button block disabled={!reply.trim()} loading={send.isPending} onClick={() => send.mutate()}>
            إرسال الرد
          </Button>
        }
      >
        <TextArea value={reply} onChange={(e) => setReply(e.target.value)} rows={4} aria-label="الرد" autoFocus />
      </Sheet>
    </>
  );
}

function HomeworkTab({ l }: { l: LectureDTO }) {
  const qc = useQueryClient();
  const [, navigate] = useLocation();
  const q = useQuery({ queryKey: ['assignments', l.id], queryFn: () => api<AssignmentDTO[]>(`/assignments?lectureId=${l.id}`) });
  const [open, setOpen] = useState(false);
  const [mode, setMode] = useState<'manual' | 'quiz'>('manual');
  const [questions, setQuestions] = useState<QuizQuestion[]>([newQuestion()]);
  const [form, setForm] = useState({ title: '', instructions: '', dueAt: toCairoInput(new Date(Date.now() + 3 * 86_400_000)), maxScore: '10' });
  const [error, setError] = useState<string | null>(null);
  const create = useMutation({
    mutationFn: (body: unknown) => api<AssignmentDTO>(`/lectures/${l.id}/assignments`, { body }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['assignments'] });
      setOpen(false);
      setForm({ ...form, title: '', instructions: '' });
      setQuestions([newQuestion()]);
      setMode('manual');
      toast('نُشر الواجب وأُرسل إشعار إلى الطلاب');
    },
    onError: (e) => setError(errorMessage(e)),
  });
  const submit = () => {
    const due = form.dueAt ? fromCairoInput(form.dueAt) : null;
    if (form.dueAt && !due) return setError('أدخل موعدًا صحيحًا');
    const body = { title: form.title, instructions: form.instructions, dueAt: due?.toISOString() ?? null, maxScore: mode === 'quiz' ? questions.reduce((n, q) => n + q.points, 0) : Number(form.maxScore), questions: mode === 'quiz' ? questions : [] };
    const v = assignmentInputSchema.safeParse(body);
    if (!v.success) return setError(v.error.issues[0]?.message ?? null);
    setError(null);
    create.mutate(body);
  };
  return (
    <>
      <div className="mb-4 flex justify-end">
        <Button variant="tonal" onClick={() => setOpen(true)}>
          <Plus /> واجب جديد
        </Button>
      </div>
      {q.isPending && <div className="skeleton h-32 rounded-lg" />}
      {q.isError && <Banner tone="error">{errorMessage(q.error)} <Button variant="text" onClick={() => void q.refetch()}>إعادة المحاولة</Button></Banner>}
      {q.data?.length === 0 && <EmptyState icon={<NotebookPen />} title="لا يوجد واجب لهذه الحصة" body="نزّل واجب، وكل طالب حاجز هيوصله إيميل وإشعار." />}
      {q.data && q.data.length > 0 && (
        <List>
          {q.data.map((a) => (
            <ListItem
              key={a.id}
              href={`/t/assignments/${a.id}`}
              chevron
              leading={
                <span className="grid size-11 place-items-center rounded-md bg-tertiary-container text-on-tertiary-container">
                  <NotebookPen className="size-5" />
                </span>
              }
              title={a.title}
              subtitle={`سلّم ${a.counts?.submitted ?? 0} من ${a.counts?.students ?? 0} · اتصحّح ${a.counts?.graded ?? 0}`}
            />
          ))}
        </List>
      )}
      <Sheet
        open={open}
        onOpenChange={setOpen}
        title="واجب جديد"
        footer={
          <Button block loading={create.isPending} onClick={submit}>
            نشر الواجب
          </Button>
        }
      >
        <div className="flex flex-col gap-4">
          {error && <Banner tone="error">{error}</Banner>}
          <HomeworkTemplates draft={() => ({ title: form.title, instructions: form.instructions, maxScore: mode === 'quiz' ? questions.reduce((n, q) => n + q.points, 0) : Number(form.maxScore), questions: mode === 'quiz' ? questions : [] })} apply={template => { setForm(current => ({ ...current, title: template.title, instructions: template.instructions, maxScore: String(template.maxScore) })); setQuestions(template.questions.length ? template.questions.map(question => ({ ...question, id: crypto.randomUUID(), options: [...question.options] })) : [newQuestion()]); setMode(template.questions.length ? 'quiz' : 'manual'); setError(null); }} />
          <Segmented value={mode} onChange={setMode} options={[{ value: 'manual', label: 'واجب كتابي' }, { value: 'quiz', label: 'تصحيح تلقائي' }]} />
          <TextField label="العنوان" value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} placeholder="مسائل على قانون أوم" />
          <TextArea label="المطلوب" value={form.instructions} onChange={(e) => setForm({ ...form, instructions: e.target.value })} rows={4} placeholder="حل المسائل من 1 لـ 5 في الكتاب، وصوّر الحل." />
          <div className="grid grid-cols-2 gap-4">
            <TextField label="آخر موعد بتوقيت القاهرة" type="datetime-local" ltr value={form.dueAt} onChange={(e) => setForm({ ...form, dueAt: e.target.value })} />
            <TextField label="الدرجة النهائية" type="number" min={1} max={1000} disabled={mode === 'quiz'} inputMode="numeric" ltr value={mode === 'quiz' ? questions.reduce((n, q) => n + q.points, 0) : form.maxScore} onChange={(e) => setForm({ ...form, maxScore: e.target.value })} />
          </div>
          {mode === 'quiz' && <QuizEditor questions={questions} onChange={setQuestions} />}
          <button type="button" className="sr-only" onClick={() => navigate('/t/assignments')}>
            كل الواجبات
          </button>
        </div>
      </Sheet>
    </>
  );
}

function RecordingTab({ l }: { l: LectureDTO }) {
  const capabilities = useCapabilities();
  const qc = useQueryClient();
  const [url, setUrl] = useState('');
  const attach = useMutation({
    mutationFn: () => api(`/lectures/${l.id}/recording`, { body: { url } }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['lecture', l.id] });
      setUrl('');
      toast('التسجيل اتضاف، والطلاب وصلهم إشعار');
    },
    onError: (e) => toast(errorMessage(e)),
  });
  return (
    <div className="flex flex-col gap-4">
      {l.recording ? (
        <RecordingPlayer l={l} />
      ) : (
        <EmptyState
          icon={<Film />}
          title={capabilities.data?.recordingConfigured ? 'لم يُتح تسجيل لهذه الحصة بعد' : 'التسجيل الآلي غير مفعّل'}
          body="يمكنك إضافة رابط تسجيل تملكه أدناه لإتاحته للطلاب الحاجزين."
        />
      )}
      <BoardReview lectureId={l.id} />
      <Card variant="outlined" className="flex flex-col gap-3">
        <p className="text-title-md">عندك تسجيل في مكان تاني؟</p>
        <TextField placeholder="https://…" ltr value={url} onChange={(e) => setUrl(e.target.value)} trailing={<Link2 className="me-2 size-5 text-on-surface-variant" />} aria-label="لينك التسجيل" />
        <Button variant="tonal" className="self-start" disabled={!url} loading={attach.isPending} onClick={() => attach.mutate()}>
          ضيف اللينك
        </Button>
      </Card>
    </div>
  );
}

/** Plays the recording; students' viewing time counts as replay attendance. */
export function RecordingPlayer({ l, track }: { l: LectureDTO; track?: boolean }) {
  const rec = l.recording;
  const playing = useRef(false);
  useEffect(() => {
    if (!track) return;
    const t = setInterval(() => {
      if (playing.current && document.visibilityState === 'visible') void api(`/lectures/${l.id}/heartbeat`, { body: { mode: 'replay' } }).catch(() => undefined);
    }, HEARTBEAT_SECONDS * 1000);
    return () => clearInterval(t);
  }, [l.id, track]);
  if (!rec) return null;
  if (rec.status !== 'ready' || !rec.url)
    return (
      <Banner tone="info" title="التسجيل بيتجهّز">
        بياخد دقايق بعد ما البث يخلص، وهيوصلك إشعار أول ما يجهز.
      </Banner>
    );
  const isFile = /\.(mp4|m3u8|webm|mov)(\?|$)/i.test(rec.url);
  return isFile ? (
    <video
      src={rec.url}
      controls
      playsInline
      preload="metadata"
      className="aspect-video w-full rounded-lg bg-stage"
      onPlay={() => (playing.current = true)}
      onPause={() => (playing.current = false)}
      onEnded={() => (playing.current = false)}
    />
  ) : (
    <Card variant="filled" className="flex items-center gap-4">
      <span className="grid size-12 place-items-center rounded-md bg-tertiary-container text-on-tertiary-container">
        <Film />
      </span>
      <p className="flex-1 text-title-md">التسجيل متاح</p>
      <Button onClick={() => window.open(rec.url!, '_blank')}>مشاهدة التسجيل</Button>
    </Card>
  );
}

// ---------------------------------------------------------------- student / parent

function StudentLecture({ l }: { l: LectureDTO }) {
  const me = useMe();
  const [, navigate] = useLocation();
  const booked = l.booking?.status === 'confirmed';
  const ended = lectureEnded(l);
  const student = me.user.role === 'student';
  const hw = useQuery({ queryKey: ['assignments', l.id], queryFn: () => api<AssignmentDTO[]>(`/assignments?lectureId=${l.id}`), enabled: booked && student });

  return (
    <>
      <TopBar title={l.title} back />
      <Page>
        <LectureHeader l={l} showTeacher />
        {booked && student && l.status !== 'scheduled' && l.status !== 'cancelled' && (
          <Card variant="outlined" className="mb-6 flex flex-col gap-3">
            <p className="text-title-md">الحصة عجبتك؟</p>
            <VoteBar lecture={l} />
            <p className="text-body-sm text-on-surface-variant">تقييمك بيساعد زمايلك يلاقوا أحسن الحصص.</p>
          </Card>
        )}
        {!booked && student && l.status !== 'cancelled' && !ended && (
          <Banner tone="info" title="لم تحجز هذه الحصة بعد" action={<Button onClick={() => navigate(`/l/${l.code}`)}>احجز مكانك</Button>} />
        )}
        {l.status === 'cancelled' && <Banner tone="warning" title="أُلغيت هذه الحصة">{l.priceCents ? 'يمكنك متابعة حالة الاسترداد من سجل المدفوعات.' : null}</Banner>}
        {booked && l.status === 'scheduled' && !ended && (
          <Card variant="filled" pad="lg" className="lesson-schedule mb-6 text-center">
            <p className="text-body-md text-on-surface-variant">نلتقي في الحصة بعد</p>
            <Countdown to={l.startsAt} className="mt-1 block text-display-sm" />
            <p className="mt-2 text-body-sm text-on-surface-variant">ستجد رابط الانضمام هنا عند بدء المدرس للبث.</p>
          </Card>
        )}
        {booked && l.recording && l.status !== 'live' && (
          <section className="mb-6">
            <h2 className="mb-3 text-title-lg">التسجيل</h2>
            {l.recording ? <RecordingPlayer l={l} track={student} /> : <Banner tone="info">لم يُتح تسجيل لهذه الحصة.</Banner>}
          </section>
        )}
        {booked && (ended || l.status === 'live') && <BoardReview lectureId={l.id} />}
        {booked && student && hw.data && hw.data.length > 0 && (
          <section className="mb-6">
            <h2 className="mb-3 text-title-lg">الواجب</h2>
            <List>
              {hw.data.map((a) => (
                <ListItem
                  key={a.id}
                  href={`/s/assignments/${a.id}`}
                  chevron
                  leading={
                    <span className="grid size-11 place-items-center rounded-md bg-tertiary-container text-on-tertiary-container">
                      <NotebookPen className="size-5" />
                    </span>
                  }
                  title={a.title}
                  subtitle={a.dueAt ? `التسليم ${fmtRelative(a.dueAt)}` : 'دون موعد محدد'}
                  trailing={
                    a.mySubmission?.score != null ? (
                      <Badge tone="success">
                        <span className="font-num">
                          {a.mySubmission.score}/{a.maxScore}
                        </span>
                      </Badge>
                    ) : a.mySubmission ? (
                      <Badge tone="secondary">اتسلّم</Badge>
                    ) : (
                      <Badge tone="warning">مستني</Badge>
                    )
                  }
                />
              ))}
            </List>
          </section>
        )}
        {booked && (ended || l.status === 'live') && (
          <section className="mb-6">
            <h2 className="mb-3 text-title-lg">الأسئلة</h2>
            <QaHistory l={l} />
          </section>
        )}
      </Page>
      {booked && student && l.status === 'live' && (
        <ActionBar>
          <Button variant="live" size="lg" block onClick={() => navigate(`/live/${l.id}`)}>
            <Radio /> انضم إلى البث الآن
          </Button>
        </ActionBar>
      )}
    </>
  );
}
