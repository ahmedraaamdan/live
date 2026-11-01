import { ThemeToggle } from '@/components/account-menu';
import { MfaLogin } from '@/components/mfa-login';
import type { LoginResult } from '@workspace/live-core';
import { useState, type FormEvent, type ReactNode } from 'react';
import { ArrowLeft, BookOpenCheck, GraduationCap, Presentation, ShieldCheck, Users, Video } from 'lucide-react';
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
    <main className="gl-auth">
      <header className="gl-auth-header"><Link href="/welcome"><Logo /></Link><div className="auth-header-actions"><ThemeToggle /><a href="https://live.gahez.space/">عن جاهز Live <ArrowLeft size={16} /></a></div></header>
      <div className="gl-auth-grid">
        <aside className="gl-auth-story"><span className="gl-eyebrow">السؤال بداية التعلّم.</span><h2>شرح أقرب.<br /><span>وبداية أسهل.</span></h2><p>اختر حصتك، وتعلّم مع مدرّسك مباشرة. كل ما تحتاجه لرحلتك التعليمية في مكان واحد.</p><img src={`${import.meta.env.BASE_URL}images/learning-hero.webp`} width={1000} height={1250} alt="رسم توضيحي لمدرس مصري مع شاشات حصص مباشرة" decoding="async" /><div className="gl-auth-note"><BookOpenCheck size={18} /> معك من أول سؤال.</div></aside>
        <section className="gl-auth-paper"><span className="gl-eyebrow">خطوتك التالية تبدأ هنا</span><h1>{title}</h1>{subtitle && <p className="gl-auth-subtitle">{subtitle}</p>}<div className="gl-auth-body">{children}</div>{footer && <div className="gl-auth-footer">{footer}</div>}</section>
      </div>
    </main>
  );
}

const ROLE_CARDS: Array<{ role: SignupRole; title: string; body: string; icon: ReactNode }> = [
  { role: 'student', title: 'أنا طالب', body: 'اختر حصتك، واحضر مباشرة، واسأل حتى تفهم.', icon: <GraduationCap /> },
  { role: 'teacher', title: 'أنا مدرس', body: 'نظّم حصصك، وشاركها مع طلابك، وتابع حجوزاتك.', icon: <Presentation /> },
  { role: 'parent', title: 'أنا ولي أمر', body: 'تابع حضور أبنائك وواجباتهم ودرجاتهم من حسابك.', icon: <ShieldCheck /> },
];

export function Welcome() {
  const { me } = useSession();
  if (me) return <Redirect to={homePath(me.user.role)} />;
  return (
    <main className="gl-welcome">
      <header className="gl-welcome-header"><Logo /><div className="auth-header-actions"><ThemeToggle /><Link className="gl-welcome-login" href="/login">تسجيل الدخول <ArrowLeft size={18} /></Link></div></header>
      <section className="gl-welcome-hero"><div className="gl-welcome-copy"><span className="gl-eyebrow"><span /> حصص مباشرة، من أي مكان</span><h1>جاهز لتفهم؟<br /><span>اختر بدايتك.</span></h1><p>حصتك، ومدرّسك، وأسئلتك. مساحة واحدة تتعلّم فيها مباشرة، وتنظّم مواعيدك، وتتابع تقدّمك.</p><div className="gl-welcome-features"><span><Video size={18} /> شرح مباشر</span><span><BookOpenCheck size={18} /> واجبات ومراجعة</span><span><Users size={18} /> متابعة الأسرة</span></div></div><div className="gl-welcome-art"><img src={`${import.meta.env.BASE_URL}images/learning-hero.webp`} alt="تصميم توضيحي لمدرس مصري يحمل جهازًا لوحيًا" width={1000} height={1250} fetchPriority="high" /><span>السؤال جزء من الحصة.</span></div></section>
      <section className="gl-welcome-roles" aria-labelledby="choose-role"><div className="gl-welcome-section-title"><h2 id="choose-role">أنت هنا بصفتك…</h2><span>اختر حسابك، ولنبدأ.</span></div><div className="gl-role-grid">{ROLE_CARDS.map((c, i) => <Link key={c.role} href={`/signup?role=${c.role}`} className="gl-role-card animate-enter" style={{ animationDelay: `${i * 80}ms` }}><span className="gl-role-icon">{c.icon}</span><div><strong>{c.title}</strong><p>{c.body}</p></div><ArrowLeft className="gl-role-arrow" size={21} /></Link>)}</div><p className="gl-welcome-footer">لديك حساب بالفعل؟ <Link href="/login">تسجيل الدخول</Link><span> · </span><a href="https://live.gahez.space/">استكشف جاهز Live</a></p></section>
    </main>
  );
}

export function Login() {
  const { me, signIn } = useSession();
  const [, navigate] = useLocation();
  const next = useNext();
  const [form, setForm] = useState({ email: '', password: '' });
  const [mfaChallenge, setMfaChallenge] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const login = useMutation({
    mutationFn: (body: typeof form) => api<LoginResult>('/auth/login', { body }),
    onSuccess: (r) => {
      if ('requiresMfa' in r) { setMfaChallenge(r.challenge); setForm(current => ({ ...current, password: '' })); return; }
      signIn(r);
      navigate(next ?? homePath(r.me.user.role), { replace: true });
    },
    onError: (e) => setError(errorMessage(e)),
  });
  if (me && !login.isPending) return <Redirect to={next ?? homePath(me.user.role)} />;

  if (mfaChallenge) return <AuthLayout title="خطوة أخيرة للدخول" subtitle="حسابك محمي بالمصادقة الثنائية."><MfaLogin challenge={mfaChallenge} onBack={() => { setMfaChallenge(null); setError(null); }} onAuthenticated={result => { signIn(result); navigate(next ?? homePath(result.me.user.role), { replace: true }); }} /></AuthLayout>;
  const submit = (e: FormEvent) => {
    e.preventDefault();
    const v = loginSchema.safeParse(form);
    if (!v.success) return setError(v.error.issues[0]?.message ?? null);
    setError(null);
    login.mutate(form);
  };
  return (
    <AuthLayout
      title="مرحبًا بعودتك 👋"
      subtitle="سجّل الدخول وتابع رحلتك من حيث توقّفت."
      footer={
        <>
          ليس لديك حساب؟{' '}
          <Link href={`/signup${next ? `?next=${encodeURIComponent(next)}` : ''}`} className="text-label-lg text-secondary">
            إنشاء حساب
          </Link>
        </>
      }
    >
      <form onSubmit={submit} className="flex flex-col gap-5" noValidate>
        {error && <Banner tone="error">{error}</Banner>}
        <TextField label="البريد الإلكتروني" type="email" autoComplete="email" inputMode="email" ltr value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} />
        <TextField label="كلمة المرور" type="password" autoComplete="current-password" ltr value={form.password} onChange={(e) => setForm({ ...form, password: e.target.value })} />
        <Link href="/forgot-password" className="-mt-2 self-start text-label-lg text-secondary">
          نسيت كلمة المرور؟
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
      title="أنشئ حسابك"
      subtitle="اختر نوع حسابك وأكمل بياناتك للبدء."
      footer={
        <>
          لديك حساب؟{' '}
          <Link href={`/login${next ? `?next=${encodeURIComponent(next)}` : ''}`} className="text-label-lg text-secondary">
            تسجيل الدخول
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
        <TextField label={role === 'teacher' ? 'الاسم الذي يعرفك به طلابك' : 'الاسم'} autoComplete="name" value={form.name} onChange={set('name')} placeholder={role === 'teacher' ? 'أ. محمد سامي' : ''} />
        <TextField label="البريد الإلكتروني" type="email" autoComplete="email" inputMode="email" ltr value={form.email} onChange={set('email')} />
        <TextField label="رقم الهاتف" type="tel" autoComplete="tel" inputMode="tel" ltr value={form.phone} onChange={set('phone')} placeholder="01xxxxxxxxx" hint="مطلوب عند حجز حصة مدفوعة" />
        <TextField label="كلمة المرور" type="password" autoComplete="new-password" ltr value={form.password} onChange={set('password')} hint="8 أحرف على الأقل" />
        {role === 'student' && (
          <>
            <Select label="الصف الدراسي" value={form.grade} onChange={set('grade')} placeholder="اختر صفك الدراسي" options={GRADES.map((g) => ({ value: g.key, label: g.label }))} />
            <TextField
              label="البريد الإلكتروني لولي الأمر"
              type="email"
              inputMode="email"
              ltr
              value={form.parentEmail}
              onChange={set('parentEmail')}
              hint="تصله إشعارات الحجوزات، ويمكنه متابعة حضورك وواجباتك."
            />
          </>
        )}
        {role === 'teacher' && <Select label="المادة" value={form.subject} onChange={set('subject')} placeholder="اختر المادة التي تدرّسها" options={SUBJECTS.map((s) => ({ value: s.key, label: s.label }))} />}
        {role === 'parent' && <TextField label="رمز ربط حساب الابن أو الابنة" ltr value={form.childCode} onChange={set('childCode')} hint="تجده في صفحة «حسابي» لدى الابن أو الابنة، ويمكنك إضافته لاحقًا." className="font-num tracking-widest uppercase" />}
        <Button type="submit" size="lg" block loading={signup.isPending}>
          إنشاء الحساب
        </Button>
        <p className="text-center text-body-sm text-on-surface-variant">بالتسجيل، فإنك توافق على <a href="https://live.gahez.space/terms" target="_blank" rel="noreferrer">الشروط</a> و<a href="https://live.gahez.space/privacy" target="_blank" rel="noreferrer">سياسة الخصوصية</a>.</p>
      </form>
    </AuthLayout>
  );
}

export function ForgotPassword() {
  const [email, setEmail] = useState('');
  const [sent, setSent] = useState(false);
  const m = useMutation({ mutationFn: () => api('/auth/forgot', { body: { email } }), onSuccess: () => setSent(true) });
  return (
    <AuthLayout title="نسيت كلمة المرور؟" subtitle="أدخل بريدك الإلكتروني لتلقي رابط تعيين كلمة مرور جديدة." footer={<Link href="/login" className="text-label-lg text-secondary">العودة إلى تسجيل الدخول</Link>}>
      {sent ? (
        <Banner tone="success" title="تحقّق من بريدك الإلكتروني">
          إذا كان البريد مرتبطًا بحساب، فستصلك رسالة بالتعليمات. تحقّق أيضًا من مجلد الرسائل غير المرغوب فيها.
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
          <TextField label="البريد الإلكتروني" type="email" inputMode="email" ltr value={email} onChange={(e) => setEmail(e.target.value)} />
          <Button type="submit" size="lg" block loading={m.isPending}>
            إرسال الرابط
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
    <AuthLayout title="كلمة مرور جديدة" subtitle="اختر كلمة مرور يصعب تخمينها وتختلف عن كلمات مرور حساباتك الأخرى.">
      <form
        className="flex flex-col gap-5"
        onSubmit={(e) => {
          e.preventDefault();
          m.mutate();
        }}
      >
        {m.error && <Banner tone="error">{errorMessage(m.error)}</Banner>}
        <TextField label="كلمة المرور الجديدة" type="password" autoComplete="new-password" ltr value={password} onChange={(e) => setPassword(e.target.value)} hint="8 أحرف على الأقل" />
        <Button type="submit" size="lg" block loading={m.isPending}>
          حفظ ومتابعة
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
    <AuthLayout title="ربط حساب الابن أو الابنة" subtitle="تابع الحضور والواجبات والدرجات من حساب ولي الأمر.">
      <Card variant="filled" className="mb-6 text-center">
        <p className="text-body-md text-on-surface-variant">رمز الربط</p>
        <p className="mt-1 font-num text-display-sm tracking-[0.3em]" dir="ltr">
          {code}
        </p>
      </Card>
      {link.error && <Banner tone="error" className="mb-4">{errorMessage(link.error)}</Banner>}
      <Button size="lg" block loading={link.isPending} onClick={() => link.mutate()}>
        ربط الحساب
      </Button>
    </AuthLayout>
  );
}
