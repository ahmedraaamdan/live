import { useTeacherVerification } from '@/components/verification-notice';
import { MediaUpload } from '@/components/media-upload';
import { addCalendarDays, cairoDay, cairoSlot, fromCairoInput, toCairoInput } from '@/lib/calendar';
import { QueryError } from '@/components/query-error';
import { useEffect, useState, type FormEvent } from 'react';
import { useLocation } from 'wouter';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { GRADES, SUBJECTS, lectureInputSchema, splitBooking, type LectureDTO } from '@workspace/live-core';
import { ShareLectureSheet } from '@/components/bits';
import { api, errorMessage } from '@/lib/api';
import { money, toLocalInput } from '@/lib/format';
import { useMe } from '@/lib/session';
import { ActionBar, Banner, Button, Card, Chip, Page, PageSpinner, Select, Switch, TextArea, TextField, TopBar, toast } from '@/ui';

const DURATIONS = [45, 60, 90, 120, 150];
const PRICES = [0, 50, 100, 150, 200, 300];

function defaultStart() {
  const chosen = new Date(new URLSearchParams(window.location.search).get('startsAt') ?? '');
  if (Number.isFinite(chosen.getTime())) return chosen;
  return cairoSlot(addCalendarDays(cairoDay(), 1), 19);
}

export function LectureForm({ id }: { id?: string }) {
  const me = useMe();
  const verification = useTeacherVerification();
  const qc = useQueryClient();
  const [, navigate] = useLocation();
  const existing = useQuery({ queryKey: ['lecture', id], queryFn: () => api<LectureDTO>(`/lectures/${id}`), enabled: Boolean(id) });
  const [form, setForm] = useState({
    title: '',
    subject: me.teacher?.subject ?? '',
    grade: '',
    description: '',
    coverUrl: '',
    startsAt: toCairoInput(defaultStart()),
    durationMin: 90,
    priceEGP: '150',
    capacity: '',
    publish: true,
    listed: true,
  });
  const [uploadingCover, setUploadingCover] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [created, setCreated] = useState<LectureDTO | null>(null);

  useEffect(() => {
    const l = existing.data;
    if (!l) return;
    setForm({
      title: l.title,
      subject: l.subject,
      grade: l.grade,
      description: l.description,
      coverUrl: l.coverUrl ?? '',
      startsAt: toCairoInput(new Date(l.startsAt)),
      durationMin: l.durationMin,
      priceEGP: String(l.priceCents / 100),
      capacity: l.capacity ? String(l.capacity) : '',
      publish: l.status !== 'draft',
      listed: l.listed,
    });
  }, [existing.data]);

  const save = useMutation({
    mutationFn: (body: unknown) => api<LectureDTO>(id ? `/lectures/${id}` : '/lectures', { method: id ? 'PATCH' : 'POST', body }),
    onSuccess: (l) => {
      qc.invalidateQueries({ queryKey: ['lectures'] });
      qc.invalidateQueries({ queryKey: ['teacher-dashboard'] });
      qc.invalidateQueries({ queryKey: ['teacher-calendar'] });
      qc.invalidateQueries({ queryKey: ['teacher-public-lectures'] });
      qc.setQueryData(['lecture', l.id], l);
      if (id) {
        toast('حُفظت التعديلات');
        navigate(`/lectures/${l.id}`, { replace: true });
      } else setCreated(l);
    },
    onError: (e) => setError(errorMessage(e)),
  });

  if (verification.isPending) return <PageSpinner />;
  if (verification.isError) return <><TopBar title="توثيق الحساب" back /><Page><QueryError error={verification.error} retry={verification.refetch} /></Page></>;
  if (verification.data.status !== 'approved') return <><TopBar title="قبل أول حصة" back /><Page><Card className="flex flex-col gap-4"><h1 className="text-headline-md">وثّق حسابك أولًا.</h1><p>يتاح إنشاء الحصص وتعديلها بعد استكمال التوثيق وموافقة السوبر أدمن.</p><Button onClick={() => navigate('/t/verification')}>متابعة توثيق الحساب</Button></Card></Page></>;
  if (id && existing.isPending) return <PageSpinner />;

  if (id && existing.isError && !existing.data) return <><TopBar title="تعديل الحصة" back /><Page><QueryError error={existing.error} retry={existing.refetch} /></Page></>;
  const priceCents = Math.round(Number(form.priceEGP || 0) * 100);
  const { teacherCents } = splitBooking(priceCents);
  const set = (k: keyof typeof form) => (e: { target: { value: string } }) => setForm({ ...form, [k]: e.target.value });

  const submit = (e: FormEvent) => {
    e.preventDefault();
    const start = fromCairoInput(form.startsAt);
    if (!start) return setError('أدخل موعدًا صحيحًا للحصة');
    const body = {
      title: form.title,
      subject: form.subject,
      grade: form.grade,
      description: form.description,
      coverUrl: form.coverUrl || null,
      startsAt: start.toISOString(),
      durationMin: form.durationMin,
      priceCents,
      capacity: form.capacity ? Number(form.capacity) : null,
      publish: form.publish,
      listed: form.listed,
    };
    const v = lectureInputSchema.safeParse(body);
    if (!v.success) return setError(v.error.issues[0]?.message ?? null);
    setError(null);
    save.mutate(body);
  };

  return (
    <>
      <TopBar title={id ? 'تعديل الحصة' : 'حصة جديدة'} back />
      <Page>
        <form id="lecture-form" onSubmit={submit} className="flex flex-col gap-6 pb-24 lg:pb-0" noValidate>
          {error && <Banner tone="error">{error}</Banner>}
          <Card className="flex flex-col gap-5">
            <MediaUpload purpose="cover" value={form.coverUrl || null} onBusyChange={setUploadingCover} onChange={url => setForm(current => ({ ...current, coverUrl: url ?? '' }))} />
            <TextField label="عنوان الحصة" value={form.title} onChange={set('title')} placeholder="الكهربية التيارية: قانون أوم" maxLength={120} />
            <div className="grid gap-5 md:grid-cols-2">
              <Select label="المادة" value={form.subject} onChange={set('subject')} placeholder="اختر المادة" options={SUBJECTS.map((s) => ({ value: s.key, label: s.label }))} />
              <Select label="الصف" value={form.grade} onChange={set('grade')} placeholder="اختر الصف" options={GRADES.map((g) => ({ value: g.key, label: g.label }))} />
            </div>
            <TextArea label="ماذا ستشرح في الحصة؟" value={form.description} onChange={set('description')} placeholder="موضوعات الحصة وما يحتاج الطالب إلى تجهيزه قبل الحضور." rows={3} hint="اختياري، يظهر في صفحة الحجز" />
          </Card>

          <Card className="flex flex-col gap-5">
            <TextField label="الموعد بتوقيت القاهرة" type="datetime-local" value={form.startsAt} onChange={set('startsAt')} ltr />
            <div>
              <p className="mb-2 text-label-lg">المدة</p>
              <div className="flex flex-wrap gap-2">
                {DURATIONS.map((m) => (
                  <Chip key={m} selected={form.durationMin === m} onClick={() => setForm({ ...form, durationMin: m })}>
                    {m < 60 ? `${m} دقيقة` : m === 60 ? 'ساعة' : m === 90 ? 'ساعة ونص' : m === 120 ? 'ساعتين' : 'ساعتين ونص'}
                  </Chip>
                ))}
              </div>
            </div>
          </Card>

          <Card className="flex flex-col gap-5">
            <div>
              <p className="mb-2 text-label-lg">سعر الحصة</p>
              <div className="mb-3 flex flex-wrap gap-2">
                {PRICES.map((p) => (
                  <Chip key={p} selected={Number(form.priceEGP) === p} onClick={() => setForm({ ...form, priceEGP: String(p) })}>
                    {p === 0 ? 'مجانية' : <span className="font-num">{p} ج.م</span>}
                  </Chip>
                ))}
              </div>
              <TextField
                type="number"
                inputMode="decimal"
                min={0}
                value={form.priceEGP}
                onChange={set('priceEGP')}
                ltr
                trailing={<span className="px-3 text-body-md text-on-surface-variant">ج.م</span>}
                aria-label="السعر بالجنيه"
              />
              {priceCents > 0 && (
                <p className="mt-2 text-body-md text-on-surface-variant">
                  هيوصلك <span className="font-num text-title-sm text-success">{money(teacherCents)}</span> عن كل طالب، بعد عمولة المنصة 10%.
                </p>
              )}
            </div>
            <TextField label="أقصى عدد طلاب" type="number" inputMode="numeric" min={1} value={form.capacity} onChange={set('capacity')} ltr placeholder="دون حد أقصى" hint="اتركه فارغًا إذا لم تحدد عددًا أقصى" />
            <Switch checked={form.publish} onChange={(v) => setForm({ ...form, publish: v })} label="افتح الحجز" description={form.publish ? 'الرابط متاح ويمكن للطلاب الحجز' : 'مسودة: لا تظهر إلا لك'} />
            <Switch
              checked={form.listed}
              onChange={(v) => setForm({ ...form, listed: v })}
              label="اظهر في الصفحة الرئيسية"
              description={form.listed ? 'طلاب جداد يقدروا يلاقوها ويحجزوا' : 'باللينك بس: لطلابك وبس'}
            />
          </Card>
        </form>
      </Page>
      <ActionBar>
        <Button type="submit" form="lecture-form" size="lg" block loading={save.isPending} disabled={uploadingCover}>
          {id ? 'حفظ التعديلات' : 'إنشاء الحصة'}
        </Button>
      </ActionBar>
      {created && (
        <ShareLectureSheet
          open
          onOpenChange={(open) => {
            if (!open) navigate(`/lectures/${created.id}`, { replace: true });
          }}
          code={created.code}
          title={created.title}
        />
      )}
    </>
  );
}
