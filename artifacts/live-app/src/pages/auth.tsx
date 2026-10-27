import { useState, type FormEvent, type ReactNode } from 'react';
import { BookOpenCheck, GraduationCap, Presentation, ShieldCheck, Users, Video } from 'lucide-react';
import { Link, Redirect, useLocation, useSearch } from 'wouter';
import { useMutation } from '@tanstack/react-query';
import { GRADES, SUBJECTS, loginSchema, signupSchema, type AuthResult, type SignupRole } from '@workspace/live-core';
import { api, errorMessage } from '@/lib/api';
import { homePath, useSession } from '@/lib/session';
import { Banner, Button, Card, Logo, Segmented, Select, TextField } from '@/ui';

function useNext() {
  const search = new URLSearchParams(useSearch());
  const next = search.get('next');
  return next && next.startsWith('/') && !next.startsWith('//') ? next : null;
}

function AuthLayout({ title, subtitle, children, footer }: { title: string; subtitle?: ReactNode; children: ReactNode; footer?: ReactNode }) {
  return (
    <div className="min-h-dvh bg-background md:grid md:place-items-center md:p-6">
      <div className="mx-auto w-full max-w-md px-5 pt-[calc(var(--safe-top)+2rem)] pb-10 md:rounded-xl md:bg-surface-container-lowest md:p-10 md:shadow-e3">
        <Link href="/welcome" className="mb-8 inline-flex text-on-surface">
          <Logo />
        </Link>
        <h1 className="text-headline-lg">{title}</h1>
        {subtitle && <p className="mt-1 text-body-lg text-on-surface-variant">{subtitle}</p>}
        <div className="mt-8">{children}</div>
        {footer && <div className="mt-8 text-center text-body-md text-on-surface-variant">{footer}</div>}
      </div>
    </div>
  );
}

const ROLE_CARDS: Array<{ role: SignupRole; title: string; body: string; icon: ReactNode }> = [
  { role: 'student', title: 'أنا طالب', body: 'احجز حصصك، احضر لايف، واسأل المدرس على طول.', icon: <GraduationCap /> },
  { role: 'teacher', title: 'أنا مدرس', body: 'اعمل جدولك، ابعت اللينك، والفلوس في محفظتك.', icon: <Presentation /> },
  { role: 'parent', title: 'أنا ولي أمر', body: 'تابع الحضور والواجبات والدرجات أول بأول.', icon: <ShieldCheck /> },
];

export function Welcome() {
  const { me } = useSession();
  if (me) return <Redirect to={homePath(me.user.role)} />;
  return (
    <div className="min-h-dvh bg-background">
      <div className="relative overflow-hidden bg-gradient-ink px-5 pt-[calc(var(--safe-top)+1.5rem)] pb-16 text-white">
        <div className="pointer-events-none absolute -top-24 -left-24 size-72 rounded-full bg-gradient-live opacity-40 blur-3xl" aria-hidden="true" />
        <div className="pointer-events-none absolute -bottom-32 -right-16 size-72 rounded-full bg-gradient-brand opacity-30 blur-3xl" aria-hidden="true" />
        <div className="relative mx-auto max-w-3xl">
          <div className="flex items-center justify-between">
            <Logo />
            <Link href="/login" className="state-layer rounded-full px-4 py-2 text-label-lg text-white/90">
              تسجيل الدخول
            </Link>
          </div>
          <div className="mt-14 max-w-xl md:mt-20">
            <span className="inline-flex items-center gap-2 rounded-full bg-white/10 px-3 py-1 text-label-md backdrop-blur">
              <span className="size-2 animate-live-pulse rounded-full bg-live" /> حصص مباشرة، من أي مكان
            </span>
            <h1 className="mt-4 text-display-md md:text-display-lg">
              الحصة الحلوة
              <br />
              بقت <span className="bg-gradient-live bg-clip-text text-transparent">لايف</span>.
            </h1>
            <p className="mt-4 max-w-md text-body-lg text-white/75">مدرسك بيشرح لايف، وانت بتسأل وهو بيرد. والحصة بتتسجل لو فاتتك. وولي الأمر متابع كل حاجة.</p>
          </div>
          <div className="mt-8 flex flex-wrap gap-3 text-label-lg text-white/80">
            <span className="inline-flex items-center gap-2">
              <Video className="size-5" /> بث وتسجيل
            </span>
            <span className="inline-flex items-center gap-2">
              <BookOpenCheck className="size-5" /> واجبات ودرجات
            </span>
            <span className="inline-flex items-center gap-2">
              <Users className="size-5" /> متابعة ولي الأمر
            </span>
          </div>
        </div>
      </div>
      <div className="mx-auto -mt-8 max-w-3xl px-5 pb-[calc(var(--safe-bottom)+2rem)]">
        <h2 className="sr-only">اختار نوع حسابك</h2>
        <div className="grid gap-3 md:grid-cols-3">
          {ROLE_CARDS.map((c, i) => (
            <Link
              key={c.role}
              href={`/signup?role=${c.role}`}
              className="state-layer press flex animate-enter items-start gap-4 rounded-lg bg-surface-container-lowest p-5 shadow-e2 md:flex-col"
              style={{ animationDelay: `${i * 80}ms` }}
            >
              <span className="grid size-12 shrink-0 place-items-center rounded-md bg-primary-container text-on-primary-container [&_svg]:size-6">{c.icon}</span>
              <span>
                <span className="block text-title-lg">{c.title}</span>
                <span className="mt-1 block text-body-md text-on-surface-variant">{c.body}</span>
              </span>
            </Link>
          ))}
        </div>
        <p className="mt-8 text-center text-body-md text-on-surface-variant">
          عندك حساب؟{' '}
          <Link href="/login" className="text-label-lg text-secondary">
            سجّل دخول
          </Link>
        </p>
      </div>
    </div>
  );
}

export function Login() {
  const { me, signIn } = useSession();
  const [, navigate] = useLocation();
  const next = useNext();
  const [form, setForm] = useState({ email: '', password: '' });
  const [error, setError] = useState<string | null>(null);
  const login = useMutation({
    mutationFn: (body: typeof form) => api<AuthResult>('/auth/login', { body }),
    onSuccess: (r) => {
      signIn(r);
      navigate(next ?? homePath(r.me.user.role), { replace: true });
    },
    onError: (e) => setError(errorMessage(e)),
  });
  if (me && !login.isPending) return <Redirect to={next ?? homePath(me.user.role)} />;

  const submit = (e: FormEvent) => {
    e.preventDefault();
    const v = loginSchema.safeParse(form);
    if (!v.success) return setError(v.error.issues[0]?.message ?? null);
    setError(null);
    login.mutate(form);
  };
  return (
    <AuthLayout
      title="أهلاً بيك تاني 👋"
      subtitle="سجّل دخول وكمّل من مكان ما وقفت."
      footer={
        <>
          لسه معندكش حساب؟{' '}
          <Link href={`/signup${next ? `?next=${encodeURIComponent(next)}` : ''}`} className="text-label-lg text-secondary">
            اعمل حساب
          </Link>
        </>
      }
    >
      <form onSubmit={submit} className="flex flex-col gap-5" noValidate>
        {error && <Banner tone="error">{error}</Banner>}
        <TextField label="الإيميل" type="email" autoComplete="email" inputMode="email" ltr value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} />
        <TextField label="الباسورد" type="password" autoComplete="current-password" ltr value={form.password} onChange={(e) => setForm({ ...form, password: e.target.value })} />
        <Link href="/forgot-password" className="-mt-2 self-start text-label-lg text-secondary">
          نسيت الباسورد؟
        </Link>
        <Button type="submit" size="lg" block loading={login.isPending}>
          دخول
        </Button>
      </form>
    </AuthLayout>
  );
}

export function Signup() {
  const { me, signIn } = useSession();
  const [, navigate] = useLocation();
  const search = new URLSearchParams(useSearch());
  const next = useNext();
  const childCode = search.get('code') ?? '';
  const initialRole = (['student', 'teacher', 'parent'] as const).find((r) => r === search.get('role')) ?? (childCode ? 'parent' : 'student');
  const [role, setRole] = useState<SignupRole>(initialRole);
  const [form, setForm] = useState({ name: '', email: '', phone: '', password: '', grade: '', subject: '', parentEmail: '', childCode });
  const [error, setError] = useState<string | null>(null);
  const set = (k: keyof typeof form) => (e: { target: { value: string } }) => setForm({ ...form, [k]: e.target.value });

  const signup = useMutation({
    mutationFn: (body: unknown) => api<AuthResult>('/auth/signup', { body }),
    onSuccess: (r) => {
      signIn(r);
      navigate(next ?? homePath(r.me.user.role), { replace: true });
    },
    onError: (e) => setError(errorMessage(e)),
  });
  if (me && !signup.isPending) return <Redirect to={next ?? homePath(me.user.role)} />;

  const submit = (e: FormEvent) => {
    e.preventDefault();
    const body = {
      role,
      name: form.name,
      email: form.email,
      phone: form.phone,
      password: form.password,
      ...(role === 'student' && { grade: form.grade || undefined, parentEmail: form.parentEmail }),
      ...(role === 'teacher' && { subject: form.subject || undefined }),
      ...(role === 'parent' && form.childCode && { childCode: form.childCode }),
    };
    const v = signupSchema.safeParse(body);
    if (!v.success) return setError(v.error.issues[0]?.message ?? null);
    setError(null);
    signup.mutate(body);
  };

  return (
    <AuthLayout
      title="اعمل حسابك"
      subtitle="دقيقة واحدة وتبقى جاهز."
      footer={
        <>
          عندك حساب؟{' '}
          <Link href={`/login${next ? `?next=${encodeURIComponent(next)}` : ''}`} className="text-label-lg text-secondary">
            سجّل دخول
          </Link>
        </>
      }
    >
      <form onSubmit={submit} className="flex flex-col gap-5" noValidate>
        <Segmented
          ariaLabel="نوع الحساب"
          value={role}
          onChange={setRole}
          options={[
            { value: 'student', label: 'طالب' },
            { value: 'teacher', label: 'مدرس' },
            { value: 'parent', label: 'ولي أمر' },
          ]}
        />
        {error && <Banner tone="error">{error}</Banner>}
        <TextField label={role === 'teacher' ? 'اسمك زي ما الطلاب يعرفوه' : 'الاسم'} autoComplete="name" value={form.name} onChange={set('name')} placeholder={role === 'teacher' ? 'أ. محمد سامي' : ''} />
        <TextField label="الإيميل" type="email" autoComplete="email" inputMode="email" ltr value={form.email} onChange={set('email')} />
        <TextField label="رقم الموبايل" type="tel" autoComplete="tel" inputMode="tel" ltr value={form.phone} onChange={set('phone')} placeholder="01xxxxxxxxx" hint="اختياري" />
        <TextField label="الباسورد" type="password" autoComplete="new-password" ltr value={form.password} onChange={set('password')} hint="8 حروف على الأقل" />
        {role === 'student' && (
          <>
            <Select label="الصف الدراسي" value={form.grade} onChange={set('grade')} placeholder="اختار صفّك" options={GRADES.map((g) => ({ value: g.key, label: g.label }))} />
            <TextField
              label="إيميل ولي الأمر"
              type="email"
              inputMode="email"
              ltr
              value={form.parentEmail}
              onChange={set('parentEmail')}
              hint="هيوصله إيميل بكل حجز، ويقدر يتابع حضورك وواجباتك."
            />
          </>
        )}
        {role === 'teacher' && <Select label="المادة" value={form.subject} onChange={set('subject')} placeholder="بتدرّس إيه؟" options={SUBJECTS.map((s) => ({ value: s.key, label: s.label }))} />}
        {role === 'parent' && <TextField label="كود ابنك أو بنتك" ltr value={form.childCode} onChange={set('childCode')} hint="موجود في صفحة «حسابي» عندهم. تقدر تضيفه بعدين." className="font-num tracking-widest uppercase" />}
        <Button type="submit" size="lg" block loading={signup.isPending}>
          اعمل الحساب
        </Button>
        <p className="text-center text-body-sm text-on-surface-variant">بالتسجيل انت موافق على الشروط وسياسة الخصوصية.</p>
      </form>
    </AuthLayout>
  );
}

export function ForgotPassword() {
  const [email, setEmail] = useState('');
  const [sent, setSent] = useState(false);
  const m = useMutation({ mutationFn: () => api('/auth/forgot', { body: { email } }), onSuccess: () => setSent(true) });
  return (
    <AuthLayout title="نسيت الباسورد؟" subtitle="اكتب إيميلك وهنبعتلك لينك تختار بيه باسورد جديد." footer={<Link href="/login" className="text-label-lg text-secondary">رجوع لتسجيل الدخول</Link>}>
      {sent ? (
        <Banner tone="success" title="بعتنالك إيميل">
          لو الإيميل ده عليه حساب، هيوصلك لينك خلال دقيقة. بص في الـSpam لو مش لاقيه.
        </Banner>
      ) : (
        <form
          className="flex flex-col gap-5"
          onSubmit={(e) => {
            e.preventDefault();
            m.mutate();
          }}
        >
          {m.error && <Banner tone="error">{errorMessage(m.error)}</Banner>}
          <TextField label="الإيميل" type="email" inputMode="email" ltr value={email} onChange={(e) => setEmail(e.target.value)} />
          <Button type="submit" size="lg" block loading={m.isPending}>
            ابعت اللينك
          </Button>
        </form>
      )}
    </AuthLayout>
  );
}

export function ResetPassword() {
  const token = new URLSearchParams(useSearch()).get('token') ?? '';
  const [, navigate] = useLocation();
  const [password, setPassword] = useState('');
  const m = useMutation({ mutationFn: () => api('/auth/reset', { body: { token, password } }), onSuccess: () => navigate('/login') });
  return (
    <AuthLayout title="باسورد جديد" subtitle="اختار باسورد سهل تفتكره وصعب حد يخمّنه.">
      <form
        className="flex flex-col gap-5"
        onSubmit={(e) => {
          e.preventDefault();
          m.mutate();
        }}
      >
        {m.error && <Banner tone="error">{errorMessage(m.error)}</Banner>}
        <TextField label="الباسورد الجديد" type="password" autoComplete="new-password" ltr value={password} onChange={(e) => setPassword(e.target.value)} hint="8 حروف على الأقل" />
        <Button type="submit" size="lg" block loading={m.isPending}>
          احفظ وادخل
        </Button>
      </form>
    </AuthLayout>
  );
}

/** From the parent's invitation email: link if signed in as a parent, otherwise sign up with the code. */
export function JoinParent() {
  const code = new URLSearchParams(useSearch()).get('code') ?? '';
  const { me } = useSession();
  const [, navigate] = useLocation();
  const link = useMutation({
    mutationFn: () => api('/parent/children', { body: { code } }),
    onSuccess: () => navigate('/p', { replace: true }),
  });
  if (!me) return <Redirect to={`/signup?role=parent&code=${encodeURIComponent(code)}`} />;
  if (me.user.role !== 'parent') return <Redirect to={homePath(me.user.role)} />;
  return (
    <AuthLayout title="ربط حساب ابنك" subtitle="هتتابع حضوره وواجباته ودرجاته من حسابك.">
      <Card variant="filled" className="mb-6 text-center">
        <p className="text-body-md text-on-surface-variant">كود الربط</p>
        <p className="mt-1 font-num text-display-sm tracking-[0.3em]" dir="ltr">
          {code}
        </p>
      </Card>
      {link.error && <Banner tone="error" className="mb-4">{errorMessage(link.error)}</Banner>}
      <Button size="lg" block loading={link.isPending} onClick={() => link.mutate()}>
        اربط الحساب
      </Button>
    </AuthLayout>
  );
}
