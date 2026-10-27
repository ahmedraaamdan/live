import { CalendarClock, Clock, CreditCard, Radio, ShieldCheck, Smartphone, ThumbsUp, Users } from 'lucide-react';
import { Link, useLocation } from 'wouter';
import { useMutation, useQuery } from '@tanstack/react-query';
import { gradeLabel, subjectLabel, type BookResult, type LectureDTO } from '@workspace/live-core';
import { Countdown } from '@/components/bits';
import { lectureEnded } from '@/components/lecture-card';
import { approvalPct } from '@/components/vote';
import { api, errorMessage } from '@/lib/api';
import { fmtDay, fmtDuration, fmtTime, money } from '@/lib/format';
import { openCheckout } from '@/lib/platform';
import { useSession } from '@/lib/session';
import { ActionBar, Avatar, Badge, Banner, Button, Card, IconButton, LiveBadge, Logo, PageSpinner, toast } from '@/ui';
import { ArrowRight } from 'lucide-react';

/** The page behind the link a teacher shares. Works signed out; booking asks to sign in. */
export function PublicLecture({ params }: { params: { code: string } }) {
  const code = params.code.toUpperCase();
  const { me } = useSession();
  const [, navigate] = useLocation();
  const q = useQuery({ queryKey: ['public-lecture', code, me?.user.id], queryFn: () => api<LectureDTO>(`/l/${code}`) });
  const book = useMutation({
    mutationFn: (id: string) => api<BookResult>(`/lectures/${id}/book`, { method: 'POST' }),
    onSuccess: async (r) => {
      if (r.checkoutUrl && r.payment) await openCheckout(r.checkoutUrl);
      else if (r.booking.status === 'confirmed') navigate(`/lectures/${r.booking.lectureId}?booked=1`);
    },
    onError: (e) => toast(errorMessage(e)),
  });

  if (q.isPending) return <PageSpinner />;
  if (q.error || !q.data)
    return (
      <div className="mx-auto max-w-md px-5 pt-20 text-center">
        <Logo className="mb-8" />
        <Banner tone="error" title="اللينك ده مش شغال">
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
          <Radio /> ادخل البث
        </Button>
      ) : (
        <Button size="lg" block onClick={() => navigate(`/lectures/${l.id}`)}>
          انت حاجز · افتح الحصة
        </Button>
      );
  } else if (closed) {
    cta = (
      <Button size="lg" block disabled>
        {l.status === 'cancelled' ? 'الحصة اتلغت' : 'الحصة خلصت'}
      </Button>
    );
  } else if (full) {
    cta = (
      <Button size="lg" block disabled>
        الأماكن خلصت
      </Button>
    );
  } else if (!me) {
    cta = (
      <Button size="lg" block onClick={() => navigate(`/signup?role=student&next=${encodeURIComponent(`/l/${code}`)}`)}>
        احجز مكانك {l.priceCents ? `· ${money(l.priceCents)}` : 'مجانًا'}
      </Button>
    );
  } else if (student) {
    cta = (
      <Button size="lg" block loading={book.isPending} onClick={() => book.mutate(l.id)}>
        {l.priceCents ? `احجز وادفع ${money(l.priceCents)}` : 'احجز مجانًا'}
      </Button>
    );
  } else {
    cta = <Banner tone="info" className="w-full">الحجز من حساب طالب بس.</Banner>;
  }

  return (
    <div className="min-h-dvh bg-background pb-32 lg:pb-12">
      <div className={`relative overflow-hidden px-5 pt-[calc(var(--safe-top)+1rem)] pb-10 text-white ${l.status === 'live' ? 'bg-gradient-live' : 'bg-gradient-ink'}`}>
        <div className="pointer-events-none absolute -bottom-24 -left-10 size-64 rounded-full bg-gradient-brand opacity-30 blur-3xl" aria-hidden="true" />
        <div className="relative mx-auto max-w-3xl">
          <div className="flex items-center justify-between">
            <IconButton label="رجوع" className="text-white" onClick={() => (window.history.length > 1 ? window.history.back() : navigate('/'))}>
              <ArrowRight />
            </IconButton>
            <Link href="/" className="text-white">
              <Logo />
            </Link>
          </div>
          <div className="mt-6 flex flex-wrap items-center gap-2">
            {l.status === 'live' && <LiveBadge className="bg-white text-live" />}
            <Badge className="bg-white/15 text-white">{subjectLabel(l.subject)}</Badge>
            <Badge className="bg-white/15 text-white">{gradeLabel(l.grade)}</Badge>
            {pct != null && (
              <Badge className="bg-white/15 text-white">
                <ThumbsUp /> <span className="font-num">{pct}%</span>
              </Badge>
            )}
          </div>
          <h1 className="mt-3 text-headline-lg md:text-display-sm">{l.title}</h1>
          <div className="mt-5 flex items-center gap-3">
            <Avatar name={l.teacher.name} src={l.teacher.avatarUrl} size="lg" ring />
            <div>
              <p className="text-title-lg">{l.teacher.name}</p>
              {l.teacher.headline && <p className="text-body-md text-white/70">{l.teacher.headline}</p>}
            </div>
          </div>
        </div>
      </div>

      <div className="mx-auto -mt-6 max-w-3xl px-4">
        <Card className="grid grid-cols-2 gap-4 md:grid-cols-4" pad="lg">
          <Fact icon={<CalendarClock />} label={fmtDay(l.startsAt)} value={fmtTime(l.startsAt)} />
          <Fact icon={<Clock />} label="المدة" value={fmtDuration(l.durationMin)} />
          <Fact icon={<Users />} label="الأماكن" value={l.capacity ? `${Math.max(0, l.capacity - l.seatsTaken)} فاضي` : 'مفتوح'} />
          <Fact icon={<CreditCard />} label="السعر" value={l.priceCents ? money(l.priceCents) : 'مجانية'} />
        </Card>

        {!closed && l.status !== 'live' && (
          <Card variant="filled" className="mt-4 flex items-center justify-between">
            <span className="text-body-md text-on-surface-variant">بتبدأ بعد</span>
            <Countdown to={l.startsAt} className="text-headline-sm" />
          </Card>
        )}

        {l.description && (
          <section className="mt-6">
            <h2 className="mb-2 text-title-lg">عن الحصة</h2>
            <p className="text-body-lg whitespace-pre-wrap text-on-surface-variant">{l.description}</p>
          </section>
        )}

        <section className="mt-6 grid gap-3 md:grid-cols-2">
          <Perk icon={<Radio />} title="لايف وتسأل على طول" body="اكتب سؤالك أثناء الشرح والمدرس يرد عليك." />
          <Perk icon={<ShieldCheck />} title="التسجيل ليك" body="فاتك جزء؟ التسجيل متاح بعد الحصة للحاجزين بس." />
        </section>

        {l.priceCents > 0 && !closed && (
          <div className="mt-6 flex flex-wrap items-center justify-center gap-x-4 gap-y-2 text-body-sm text-on-surface-variant">
            <span className="inline-flex items-center gap-1.5">
              <CreditCard className="size-4" /> كارت
            </span>
            <span className="inline-flex items-center gap-1.5">
              <Smartphone className="size-4" /> فودافون كاش ومحافظ
            </span>
            <span className="font-num">Apple Pay</span>
            <span className="font-num">Google Pay</span>
          </div>
        )}
        <div className="hidden lg:block">
          <div className="mt-8">{cta}</div>
        </div>
      </div>
      <ActionBar className="lg:hidden">{cta}</ActionBar>
    </div>
  );
}

function Fact({ icon, label, value }: { icon: React.ReactNode; label: string; value: string }) {
  return (
    <div className="flex flex-col gap-1">
      <span className="text-secondary [&_svg]:size-5">{icon}</span>
      <span className="text-body-sm text-on-surface-variant">{label}</span>
      <span className="font-num text-title-md">{value}</span>
    </div>
  );
}

function Perk({ icon, title, body }: { icon: React.ReactNode; title: string; body: string }) {
  return (
    <Card variant="outlined" className="flex gap-3" pad="sm">
      <span className="grid size-10 shrink-0 place-items-center rounded-md bg-primary-container text-on-primary-container [&_svg]:size-5">{icon}</span>
      <div>
        <p className="text-title-sm">{title}</p>
        <p className="text-body-sm text-on-surface-variant">{body}</p>
      </div>
    </Card>
  );
}
