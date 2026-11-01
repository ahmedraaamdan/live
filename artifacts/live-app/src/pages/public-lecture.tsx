import { useCapabilities } from '@/lib/capabilities';
import { PhoneSheet } from '@/components/booking-panels';
import { FollowTeacherButton, SaveLectureButton } from '@/components/lecture-actions';
import { useState } from 'react';
import { BookOpen, CalendarClock, Check, Clock, CreditCard, Radio, ShieldCheck, ThumbsUp, Users } from 'lucide-react';
import { Link, useLocation } from 'wouter';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { STUDENT_CANCEL_HOURS, gradeLabel, isTrialLecture, subjectLabel, type LectureDTO } from '@workspace/live-core';
import { Countdown } from '@/components/bits';
import { lectureEnded } from '@/components/lecture-card';
import { approvalPct } from '@/components/vote';
import { requestBooking, cacheConfirmedBooking } from '@/lib/booking-cache';
import { ApiError, api, errorMessage } from '@/lib/api';
import { fmtDay, fmtDuration, fmtTime, money } from '@/lib/format';
import { openCheckout } from '@/lib/platform';
import { useSession } from '@/lib/session';
import { Avatar, Banner, Button, LiveBadge, Logo, PageSpinner, toast } from '@/ui';
import { ArrowRight, ArrowLeft } from 'lucide-react';
import { LessonArtwork } from '@/components/lesson-artwork';
import '@/styles/lesson.css';

/** The page behind the link a teacher shares. Works signed out; booking asks to sign in. */
export function PublicLecture({ params }: { params: { code: string } }) {
  const code = params.code.toUpperCase();
  const capabilities = useCapabilities();
  const qc = useQueryClient();
  const { me } = useSession();
  const [, navigate] = useLocation();
  const q = useQuery({ queryKey: ['public-lecture', code, me?.user.id], queryFn: () => api<LectureDTO>(`/l/${code}`), refetchInterval: 15_000 });
  const [phoneSheet, setPhoneSheet] = useState<'closed' | 'needed' | 'rejected'>('closed');
  const book = useMutation({
    mutationFn: ({ id, phone }: { id: string; phone?: string }) => requestBooking(id, me?.user.id ?? '', phone),
    onSuccess: async (r) => {
      setPhoneSheet('closed');
      if (r.checkoutUrl && r.payment) await openCheckout(r.checkoutUrl);
      else if (r.booking.status === 'confirmed' && q.data) {
        await cacheConfirmedBooking(qc, q.data, r.booking as typeof r.booking & { status: 'confirmed' });
        toast('تم تأكيد حجزك');
        navigate(q.data.status === 'live' ? `/live/${r.booking.lectureId}` : `/lectures/${r.booking.lectureId}?booked=1`);
      }
    },
    onError: async (e) => {
      if (e instanceof ApiError && e.code === 'phone_required') return setPhoneSheet('needed');
      if (e instanceof ApiError && e.code === 'mobile_invalid') return setPhoneSheet('rejected');
      if (e instanceof ApiError && (e.status === 0 || e.status >= 500)) {
        try { const current = await api<LectureDTO>(`/l/${code}`); if (current.booking?.status === 'confirmed') { await cacheConfirmedBooking(qc, current, { id: current.booking.id, status: 'confirmed' }); toast('حجزك مؤكّد'); navigate(current.status === 'live' ? `/live/${current.id}` : `/lectures/${current.id}?booked=1`); return; } } catch { /* Preserve the original error; never repeat a charge automatically. */ }
      }
      toast(errorMessage(e));
    },
  });

  if (q.isPending) return <PageSpinner />;
  if (q.error || !q.data)
    return (
      <div className="mx-auto max-w-md px-5 pt-20 text-center">
        <Logo className="mb-8" />
        <Banner tone="error" title="هذا الرابط غير متاح">
          {errorMessage(q.error)}
        </Banner>
        <Button className="mt-6" variant="outlined" onClick={() => navigate('/')}>
          افتح Gahez Live
        </Button>
      </div>
    );

  const l = q.data;
  const ended = lectureEnded(l);
  const booked = l.booking?.status === 'confirmed';
  const full = l.capacity != null && l.seatsTaken >= l.capacity && !booked;
  const closed = ended || l.status === 'cancelled';
  const pct = approvalPct(l.votes);
  const student = me?.user.role === 'student';

  let cta: React.ReactNode;
  if (booked) {
    cta =
      l.status === 'live' ? (
        <Button variant="live" size="lg" block onClick={() => navigate(`/live/${l.id}`)}>
          <Radio /> انضم إلى البث
        </Button>
      ) : (
        <Button size="lg" block onClick={() => navigate(`/lectures/${l.id}`)}>
          حجزك مؤكّد · افتح الحصة
        </Button>
      );
  } else if (closed) {
    cta = (
      <Button size="lg" block disabled>
        {l.status === 'cancelled' ? 'أُلغيت الحصة' : 'انتهت الحصة'}
      </Button>
    );
  } else if (full) {
    cta = (
      <Button size="lg" block disabled>
        اكتمل العدد
      </Button>
    );
  } else if (l.priceCents > 0 && capabilities.data?.paymentConfigured === false) {
    cta = <Banner tone="warning" className="w-full">الحجز المدفوع غير متاح مؤقتًا. لم يُنشأ حجز أو تُحجز أموال.</Banner>;
  } else if (!me) {
    cta = (
      <Button size="lg" block onClick={() => navigate(`/signup?role=student&next=${encodeURIComponent(`/l/${code}`)}`)}>
        احجز مكانك {l.priceCents ? `· ${money(l.priceCents)}` : 'مجانًا'}
      </Button>
    );
  } else if (student) {
    cta = (
      <Button size="lg" block loading={book.isPending} onClick={() => book.mutate({ id: l.id })}>
        {l.priceCents ? `احجز مقعدك · ${money(l.priceCents)}` : 'احجز مجانًا'}
      </Button>
    );
  } else {
    cta = <Banner tone="info" className="w-full">يمكن حجز الحصة من حساب طالب.</Banner>;
  }

  return (
    <div className="lesson-page">
      <header className="lesson-nav">
        <Link href="/" aria-label="جاهز Live — الرئيسية"><Logo /></Link>
        <button className="lesson-back" onClick={() => window.history.length > 1 ? window.history.back() : navigate('/')}><ArrowRight size={18} /> العودة</button>
      </header>
      <div className="lesson-wrap">
        <nav className="lesson-breadcrumb" aria-label="مسار الصفحة"><Link href="/">جاهز Live</Link><span>/</span><span>{subjectLabel(l.subject)}</span><span>/</span><span>تفاصيل الحصة</span></nav>
        <div className="lesson-layout">
          <main className="lesson-main">
            <div className="lesson-heading">
              <div className="lesson-tags"><span>{subjectLabel(l.subject)}</span><span>{gradeLabel(l.grade)}</span>{l.status === 'live' && <LiveBadge />}</div>
              <h1>{l.title}</h1>
              <div className="lesson-byline"><Avatar name={l.teacher.name} src={l.teacher.avatarUrl} /><div><span>مع المدرس</span><strong dir="auto">{l.teacher.name}</strong></div>{pct != null && <span className="lesson-approval"><ThumbsUp size={15} /> {pct}% من التقييمات إيجابية</span>}</div>
            </div>
            {isTrialLecture(l) && !l.teacher.verified && <Banner tone="info" className="lesson-trial-note">حصة تجريبية مجانية. حساب المدرس لسه قيد التوثيق.</Banner>}
            <LessonArtwork subject={l.subject} label={subjectLabel(l.subject)} coverUrl={l.coverUrl} />
            <section className="lesson-about">
              <span className="lesson-kicker">قبل أن نبدأ</span><h2>ما الذي ينتظرك في الحصة؟</h2>
              {l.description ? <p className="lesson-description">{l.description}</p> : <p className="lesson-description">حصة مباشرة في {subjectLabel(l.subject)} مع {l.teacher.name}. راجع الموعد وتفاصيل الحجز، ثم انضم من حسابك عند بدء البث.</p>}
              <div className="lesson-benefits"><div><Radio /><strong>شرح مباشر</strong><p>تابع الشرح وقت حدوثه.</p></div><div><BookOpen /><strong>أسئلتك لها مكان</strong><p>أرسل سؤالك للمدرس أثناء الحصة.</p></div><div><ShieldCheck /><strong>كل شيء في حسابك</strong><p>الحجز ورابط الانضمام في مكان واحد.</p></div></div>
            </section>
            <Link href={`/teachers/${l.teacher.id}`} className="lesson-teacher teacher-link" aria-label={`ملف المدرس ${l.teacher.name}`}><Avatar name={l.teacher.name} src={l.teacher.avatarUrl} size="lg" /><div><span className="lesson-kicker">مدرس الحصة</span><h2 dir="auto">{l.teacher.name}</h2><p>{l.teacher.headline || `مدرس ${subjectLabel(l.subject)} · ${gradeLabel(l.grade)}`}</p><span className="text-primary text-body-sm">الملف والتقييم ←</span></div></Link>
          </main>
          <aside className="lesson-booking" aria-label="تفاصيل الحجز">
            <div className="lesson-booking-top"><span><Radio size={16} /> حصة مباشرة أونلاين</span><span className="lesson-ticket-mark" aria-hidden="true">G</span></div>
            <div className="lesson-price"><strong>{l.priceCents ? money(l.priceCents) : 'مجانية'}</strong><span>للحصة الواحدة</span></div>
            <div className="lesson-facts">
              <Fact icon={<CalendarClock />} label="موعدنا" value={fmtDay(l.startsAt)} detail={fmtTime(l.startsAt)} />
              <Fact icon={<Clock />} label="مدة الحصة" value={fmtDuration(l.durationMin)} />
              <Fact icon={<Users />} label="المقاعد المتاحة" value={l.capacity ? `${Math.max(0, l.capacity - l.seatsTaken)} من ${l.capacity}` : 'الحجز متاح'} />
            </div>
            {!closed && l.status !== 'live' && <div className="lesson-countdown"><span>نلتقي بعد</span><Countdown to={l.startsAt} /></div>}
            <div className="lesson-cta">{cta}</div>
            {!closed && !booked && <p className="lesson-booking-note"><ShieldCheck size={15} /> {l.priceCents ? `يتأكد مقعدك بعد إتمام الدفع. استرداد كامل عند الإلغاء قبل الحصة بـ${STUDENT_CANCEL_HOURS} ساعة، وإذا لم تُعقد الحصة.` : 'احجز مقعدك وانضم من حسابك.'}</p>}
            {student && !closed && <div className="mt-3 flex items-center justify-between gap-2"><span className="text-body-sm text-on-surface-variant">{l.saved ? 'محفوظة في حصصك' : 'احفظها وعُد إليها لاحقًا'}</span><span className="flex gap-2"><FollowTeacherButton teacherId={l.teacher.id} followed={l.teacher.followed} compact /><SaveLectureButton lectureId={l.id} saved={l.saved} /></span></div>}
            <div className="lesson-includes"><span><Check /> رابط البث داخل حسابك</span><span><Check /> متابعة من الهاتف أو الحاسوب</span>{capabilities.data?.recordingConfigured && <span><Check /> التسجيل عند إتاحته من المدرس</span>}</div>
            {l.priceCents > 0 && !closed && capabilities.data?.paymentConfigured && <p className="lesson-payment"><CreditCard size={16} /> ادفع عبر وسائل بوابة الدفع المتاحة</p>}
          </aside>
        </div>
        <footer className="lesson-footer"><Logo /><span>مساحة للتعلّم. ووقت للفهم.</span><Link href="/">اكتشف جاهز <ArrowLeft size={16} /></Link></footer>
      </div>
      <div className="lesson-mobile-booking"><div><strong>{l.priceCents ? money(l.priceCents) : 'مجانية'}</strong><span>{fmtTime(l.startsAt)} · {fmtDay(l.startsAt)}</span></div><div>{cta}</div></div>
      <PhoneSheet open={phoneSheet !== 'closed'} onOpenChange={(open) => !open && setPhoneSheet('closed')} invalid={phoneSheet === 'rejected'} pending={book.isPending} onSubmit={(phone) => book.mutate({ id: l.id, phone })} />
    </div>
  );
}

function Fact({ icon, label, value, detail }: { icon: React.ReactNode; label: string; value: string; detail?: string }) {
  return <div className="lesson-fact"><span className="lesson-fact-icon">{icon}</span><div><span>{label}</span><strong>{value}</strong></div>{detail && <b>{detail}</b>}</div>;
}
