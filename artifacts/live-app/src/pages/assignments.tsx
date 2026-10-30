import { useRef, useState } from 'react';
import { Camera, CheckCircle2, FileText, ImagePlus, NotebookPen, Send, X } from 'lucide-react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import type { AssignmentDTO, AssignmentDetailDTO, SubmissionDTO, UploadDTO } from '@workspace/live-core';
import { api, errorMessage, uploadFile } from '@/lib/api';
import { fmtDateTime, fmtRelative } from '@/lib/format';
import { useMe } from '@/lib/session';
import {
  ActionBar,
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
  Spinner,
  TextArea,
  TextField,
  TopBar,
  toast,
} from '@/ui';

function overdue(a: AssignmentDTO) {
  return a.dueAt && !a.mySubmission && new Date(a.dueAt).getTime() < Date.now();
}

export function AssignmentList() {
  const me = useMe();
  const teacher = me.user.role === 'teacher';
  const [tab, setTab] = useState<'todo' | 'done'>('todo');
  const q = useQuery({ queryKey: ['assignments', 'all'], queryFn: () => api<AssignmentDTO[]>('/assignments') });
  const all = q.data ?? [];
  const list = teacher
    ? all.filter((a) => (tab === 'todo' ? (a.counts?.submitted ?? 0) > (a.counts?.graded ?? 0) : true))
    : all.filter((a) => (tab === 'todo' ? !a.mySubmission : Boolean(a.mySubmission)));

  return (
    <>
      <TopBar title="الواجبات" large />
      <Page>
        <Segmented
          className="mb-5 max-w-sm"
          value={tab}
          onChange={setTab}
          options={teacher ? [{ value: 'todo', label: 'بانتظار التصحيح' }, { value: 'done', label: 'جميع الواجبات' }] : [{ value: 'todo', label: 'المطلوب' }, { value: 'done', label: 'المسلّم' }]}
        />
        {q.isPending && <div className="skeleton h-48 rounded-lg" />}
        {q.isError && <Banner tone="error">{errorMessage(q.error)} <Button variant="text" onClick={() => void q.refetch()}>إعادة المحاولة</Button></Banner>}
        {q.isSuccess && list.length === 0 && (
          <EmptyState
            icon={tab === 'todo' ? <CheckCircle2 /> : <NotebookPen />}
            title={tab === 'todo' ? (teacher ? 'لا توجد إجابات بانتظار التصحيح' : 'أنجزت واجباتك الحالية') : 'لا توجد نتائج بعد'}
            body={teacher ? 'أضف واجبًا من صفحة الحصة، تبويب «الواجب».' : 'يصلك إشعار حين ينشر المدرس واجبًا جديدًا.'}
          />
        )}
        {list.length > 0 && (
          <List>
            {list.map((a) => (
              <ListItem
                key={a.id}
                href={`${teacher ? '/t' : '/s'}/assignments/${a.id}`}
                chevron
                leading={
                  <span className="grid size-11 place-items-center rounded-md bg-tertiary-container text-on-tertiary-container">
                    <NotebookPen className="size-5" />
                  </span>
                }
                title={a.title}
                subtitle={teacher ? `${a.lectureTitle} · سلّم ${a.counts?.submitted}/${a.counts?.students}` : `${a.lectureTitle}${a.dueAt ? ` · ${fmtRelative(a.dueAt)}` : ''}`}
                trailing={
                  teacher ? (
                    (a.counts?.submitted ?? 0) - (a.counts?.graded ?? 0) > 0 ? (
                      <Badge tone="warning">
                        <span className="font-num">{(a.counts?.submitted ?? 0) - (a.counts?.graded ?? 0)}</span> بانتظار المراجعة
                      </Badge>
                    ) : null
                  ) : a.mySubmission?.score != null ? (
                    <Badge tone="success">
                      <span className="font-num">
                        {a.mySubmission.score}/{a.maxScore}
                      </span>
                    </Badge>
                  ) : a.mySubmission ? (
                    <Badge tone="secondary">بانتظار التصحيح</Badge>
                  ) : overdue(a) ? (
                    <Badge tone="error">متأخر</Badge>
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

export function AssignmentDetail({ id }: { id: string }) {
  const me = useMe();
  const q = useQuery({ queryKey: ['assignment', id], queryFn: () => api<AssignmentDetailDTO>(`/assignments/${id}`) });
  if (q.isPending) return <PageSpinner />;
  if (!q.data)
    return (
      <>
        <TopBar title="الواجب" back />
        <Page>
          <Banner tone="error">{errorMessage(q.error)}</Banner>
        </Page>
      </>
    );
  return me.user.role === 'teacher' ? <GradeQueue a={q.data} /> : <Submit a={q.data} />;
}

function Brief({ a }: { a: AssignmentDTO }) {
  return (
    <Card className="mb-6">
      <p className="text-label-lg text-on-surface-variant">{a.lectureTitle}</p>
      <h1 className="mt-1 text-headline-md">{a.title}</h1>
      <div className="mt-2 flex flex-wrap gap-2">
        <Badge tone="tertiary">من {a.maxScore}</Badge>
        {a.questions.length > 0 && <Badge tone="primary">{a.questions.length} أسئلة · تصحيح تلقائي</Badge>}
        {a.dueAt && <Badge tone={overdue(a) ? 'error' : 'neutral'}>آخر موعد {fmtDateTime(a.dueAt)}</Badge>}
      </div>
      {a.instructions && <p className="mt-4 text-body-lg whitespace-pre-wrap">{a.instructions}</p>}
    </Card>
  );
}

function Attachments({ files }: { files: UploadDTO[] }) {
  if (!files.length) return null;
  return (
    <div className="mt-3 grid grid-cols-3 gap-2">
      {files.map((f) =>
        f.mime.startsWith('image/') ? (
          <a key={f.id} href={f.url} target="_blank" rel="noreferrer" className="block overflow-hidden rounded-md bg-surface-container">
            <img src={f.url} alt={f.filename} className="aspect-square w-full object-cover" />
          </a>
        ) : (
          <a key={f.id} href={f.url} target="_blank" rel="noreferrer" className="flex aspect-square flex-col items-center justify-center gap-1 rounded-md bg-surface-container p-2 text-center text-body-sm">
            <FileText className="size-6" />
            <span className="line-clamp-2">{f.filename}</span>
          </a>
        ),
      )}
    </div>
  );
}

function Submit({ a }: { a: AssignmentDetailDTO }) {
  const qc = useQueryClient();
  const mine = a.mySubmission;
  const graded = mine?.score != null;
  const [editing, setEditing] = useState(!mine);
  const [body, setBody] = useState(mine?.body ?? '');
  const [files, setFiles] = useState<UploadDTO[]>(mine?.attachments ?? []);
  const [answers, setAnswers] = useState<Record<string, number>>(mine?.answers ?? {});
  const quiz = a.questions.length > 0;
  const [uploading, setUploading] = useState(false);
  const input = useRef<HTMLInputElement>(null);
  const submit = useMutation({
    mutationFn: () => api<SubmissionDTO>(`/assignments/${a.id}/submit`, { body: { body, attachmentIds: files.map((f) => f.id), answers: quiz ? answers : {} } }),
    onSuccess: (saved) => {
      qc.setQueryData<AssignmentDetailDTO>(['assignment', a.id], old => old ? { ...old, mySubmission: saved } : old);
      qc.invalidateQueries({ queryKey: ['assignment', a.id] });
      qc.invalidateQueries({ queryKey: ['assignments'] });
      qc.invalidateQueries({ queryKey: ['student-home'] });
      setEditing(false);
      toast(quiz ? 'سُلّم الاختبار وأصبحت نتيجتك جاهزة' : 'سُلّم الواجب بنجاح');
    },
    onError: (e) => toast(errorMessage(e)),
  });
  const onPick = async (list: FileList | null) => {
    if (!list?.length || uploading) return;
    setUploading(true);
    try {
      for (const f of Array.from(list).slice(0, 10 - files.length)) {
        const up = await uploadFile(f);
        setFiles((cur) => [...cur, up]);
      }
    } catch (e) {
      toast(errorMessage(e));
    } finally {
      setUploading(false);
      if (input.current) input.current.value = '';
    }
  };

  return (
    <>
      <TopBar title="الواجب" back="/s/assignments" />
      <Page>
        <Brief a={a} />
        {graded && (
          <Card variant="filled" className="mb-6 flex items-center gap-4 bg-success-container text-on-success-container">
            <div className="font-num text-display-sm">
              {mine!.score}
              <span className="text-title-lg opacity-70">/{a.maxScore}</span>
            </div>
            <div className="flex-1">
              <p className="text-title-md">درجتك</p><Badge tone="neutral">{mine!.gradingMethod === 'automatic' ? 'تصحيح تلقائي · قابل لمراجعة المدرس' : 'راجعه المدرس'}</Badge>
              {mine!.feedback && <p className="text-body-md">{mine!.feedback}</p>}
            </div>
          </Card>
        )}
        {!editing && mine ? (
          <Card>
            <div className="flex items-center justify-between">
              <p className="text-title-md">إجابتك</p>
              {a.dueAt && new Date(mine.submittedAt) > new Date(a.dueAt) && <Badge tone="warning">تسليم متأخر</Badge>}
              <span className="text-body-sm text-on-surface-variant">سُلّمت {fmtRelative(mine.submittedAt)}</span>
            </div>
            {quiz && <QuizAnswers a={a} answers={mine.answers} />}
            {mine.body && <p className="mt-2 text-body-lg whitespace-pre-wrap">{mine.body}</p>}
            <Attachments files={mine.attachments} />
            {!graded && (
              <Button variant="outlined" className="mt-4" onClick={() => { setBody(mine.body); setFiles(mine.attachments); setAnswers(mine.answers); setEditing(true); }}>
                تعديل الإجابة
              </Button>
            )}
          </Card>
        ) : (
          <div className="flex flex-col gap-4 pb-24 lg:pb-0">
            {quiz && <><Banner tone="info">تظهر الدرجة بعد التسليم مباشرة. راجع اختياراتك؛ لا يمكن تعديلها بعد التصحيح.</Banner><p role="status" className="text-body-md">أجبت عن {a.questions.filter(q => answers[q.id] != null).length} من {a.questions.length} أسئلة</p><ProgressBar value={a.questions.filter(q => answers[q.id] != null).length / a.questions.length} /><QuizAnswers a={a} answers={answers} onChange={setAnswers} disabled={submit.isPending} /></>}
            <TextArea label={quiz ? 'ملاحظة للمدرس (اختياري)' : 'إجابتك'} value={body} onChange={(e) => setBody(e.target.value)} rows={6} placeholder="اكتب إجابتك هنا، أو أرفق صورة واضحة للحل." />
            <div>
              <p className="mb-2 text-label-lg">صور الحل</p>
              <div className="grid grid-cols-3 gap-2">
                {files.map((f) => (
                  <div key={f.id} className="relative overflow-hidden rounded-md bg-surface-container">
                    {f.mime.startsWith('image/') ? <img src={f.url} alt="" className="aspect-square w-full object-cover" /> : <div className="grid aspect-square place-items-center p-2 text-center text-body-sm">{f.filename}</div>}
                    <IconButton label="إزالة" size="sm" variant="stage" className="absolute top-1 left-1" onClick={() => setFiles(files.filter((x) => x.id !== f.id))}>
                      <X />
                    </IconButton>
                  </div>
                ))}
                {files.length < 10 && (
                  <button
                    type="button"
                    disabled={uploading || submit.isPending}
                    onClick={() => input.current?.click()}
                    className="state-layer flex aspect-square flex-col items-center justify-center gap-1 rounded-md border-2 border-dashed border-outline-variant text-on-surface-variant"
                  >
                    {uploading ? <Spinner /> : <ImagePlus className="size-7" />}
                    <span className="text-label-md">{uploading ? 'جارٍ الرفع…' : 'إضافة ملف'}</span>
                  </button>
                )}
              </div>
              <input ref={input} disabled={uploading || submit.isPending} type="file" accept="image/*,application/pdf" capture="environment" multiple hidden onChange={(e) => void onPick(e.target.files)} />
              <p className="mt-2 inline-flex items-center gap-1 text-body-sm text-on-surface-variant">
                <Camera className="size-4" /> يمكنك إرفاق صور الحل أو ملف PDF (حتى 12 ميغابايت للملف).
              </p>
            </div>
          </div>
        )}
      </Page>
      {editing && (
        <ActionBar>
          {mine && <Button variant="text" disabled={submit.isPending} onClick={() => setEditing(false)}>إلغاء التعديل</Button>}
          <Button size="lg" block loading={submit.isPending} disabled={uploading || (quiz ? a.questions.some(q => answers[q.id] == null) : (!body.trim() && files.length === 0))} onClick={() => submit.mutate()}>
            <Send className="-scale-x-100" /> تسليم الواجب
          </Button>
        </ActionBar>
      )}
    </>
  );
}

function GradeQueue({ a }: { a: AssignmentDetailDTO }) {
  const qc = useQueryClient();
  const [open, setOpen] = useState<SubmissionDTO | null>(null);
  const [score, setScore] = useState('');
  const [feedback, setFeedback] = useState('');
  const [completed, setCompleted] = useState<Set<string>>(new Set());
  const grade = useMutation({
    mutationFn: () => api<SubmissionDTO>(`/submissions/${open!.id}/grade`, { body: { score: Number(score), feedback } }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['assignment', a.id] });
      qc.invalidateQueries({ queryKey: ['assignments'] });
      qc.invalidateQueries({ queryKey: ['teacher-dashboard'] });
      toast('حُفظت الدرجة وأُرسل إشعار بالنتيجة');
      setCompleted(prev => new Set([...prev, open!.id]));
      // Straight to the next one waiting.
      const nextUp = a.submissions.find((s) => s.id !== open!.id && !completed.has(s.id) && s.gradedAt == null);
      if (nextUp) openFor(nextUp);
      else setOpen(null);
    },
    onError: (e) => toast(errorMessage(e)),
  });
  const openFor = (s: SubmissionDTO) => {
    setOpen(s);
    setScore(s.score != null ? String(s.score) : '');
    setFeedback(s.feedback ?? '');
  };
  const c = a.counts!;
  return (
    <>
      <TopBar title="الواجب" back="/t/assignments" />
      <Page>
        <Brief a={a} />
        <Card className="mb-6">
          <div className="flex justify-between text-body-md">
            <span>
              سلّم <span className="font-num text-title-sm">{c.submitted}</span> من <span className="font-num">{c.students}</span>
            </span>
            <span>
              صُحّح <span className="font-num text-title-sm">{c.graded}</span>
            </span>
          </div>
          <ProgressBar className="mt-3" value={c.students ? c.submitted / c.students : 0} tone="tertiary" />
        </Card>
        {a.submissions.length === 0 ? (
          <EmptyState icon={<NotebookPen />} title="لم تُرسل إجابات بعد" body="يصلك إشعار عند تسليم الطلاب لإجاباتهم." />
        ) : (
          <List>
            {a.submissions.map((s) => (
              <ListItem
                key={s.id}
                onClick={() => openFor(s)}
                leading={<Avatar name={s.student?.name ?? ''} src={s.student?.avatarUrl} />}
                title={s.student?.name}
                subtitle={`سلّم ${fmtRelative(s.submittedAt)}${s.attachments.length ? ` · ${s.attachments.length} صورة` : ''}`}
                trailing={
                  s.score != null ? (
                    <Badge tone="success">
                      <span className="font-num">
                        {s.score}/{a.maxScore}
                      </span>
                    </Badge>
                  ) : (
                    <Badge tone="warning">{a.dueAt && new Date(s.submittedAt) > new Date(a.dueAt) ? 'متأخر · بانتظار التصحيح' : 'بانتظار التصحيح'}</Badge>
                  )
                }
                chevron
              />
            ))}
          </List>
        )}
      </Page>
      <Sheet
        open={Boolean(open)}
        onOpenChange={(o) => !o && setOpen(null)}
        title={open?.student?.name ?? ''}
        description={open ? `سلّم ${fmtRelative(open.submittedAt)}` : undefined}
        footer={
          <Button block size="lg" loading={grade.isPending} disabled={score.trim() === '' || !Number.isInteger(Number(score)) || Number(score) < 0 || Number(score) > a.maxScore} onClick={() => grade.mutate()}>
            حفظ الدرجة
          </Button>
        }
      >
        {open && (
          <div className="flex flex-col gap-4">
            {a.questions.length > 0 && <><Badge tone="primary">{open.gradingMethod === 'automatic' ? 'نتيجة تلقائية — يمكنك مراجعتها' : 'مراجعة المدرس'}</Badge><QuizAnswers a={a} answers={open.answers} /></>}
            {open.body && <p className="rounded-md bg-surface-container p-4 text-body-lg whitespace-pre-wrap">{open.body}</p>}
            <Attachments files={open.attachments} />
            <div className="flex flex-wrap gap-2">
              {[a.maxScore, Math.round(a.maxScore * 0.9), Math.round(a.maxScore * 0.75), Math.round(a.maxScore * 0.5)].map((v, i) => (
                <button key={i} type="button" onClick={() => setScore(String(v))} className="state-layer h-10 rounded-full bg-surface-container-high px-4 font-num text-label-lg">
                  {v}
                </button>
              ))}
            </div>
            <TextField label={`الدرجة (من ${a.maxScore})`} type="number" min={0} max={a.maxScore} step={1} inputMode="numeric" ltr value={score} onChange={(e) => setScore(e.target.value)} />
            <TextArea label="تعليقك" value={feedback} onChange={(e) => setFeedback(e.target.value)} rows={3} placeholder="أضف ملاحظات واضحة تساعد الطالب على تحسين إجابته." />
          </div>
        )}
      </Sheet>
    </>
  );
}

function QuizAnswers({ a, answers, onChange, disabled = false }: { a: AssignmentDTO; answers: Record<string, number>; onChange?: (answers: Record<string, number>) => void; disabled?: boolean }) {
  return <div className="flex flex-col gap-4">{a.questions.map((q, i) => <fieldset key={q.id} disabled={disabled} className="rounded-xl border border-outline-variant p-4"><legend className="px-1 text-title-md">{i + 1}. {q.prompt} <span className="text-body-sm">({q.points} درجات)</span></legend><div className="mt-2 flex flex-col gap-2">{q.options.map((option, index) => <label key={index} className={`flex min-h-12 items-center gap-3 rounded-md border p-3 text-body-md ${answers[q.id] === index ? 'border-primary bg-primary-container text-on-primary-container' : 'border-outline-variant'} ${onChange ? 'cursor-pointer' : ''}`}><input type="radio" name={`${a.id}-${q.id}`} value={index} checked={answers[q.id] === index} disabled={!onChange || disabled} onChange={() => onChange?.({ ...answers, [q.id]: index })} className="size-4 accent-primary" /><span className="flex-1">{option}</span>{q.correctIndex === index && <Badge tone="success">الصحيحة</Badge>}</label>)}</div></fieldset>)}</div>;
}
