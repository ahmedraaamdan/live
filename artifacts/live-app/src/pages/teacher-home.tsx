import { useState } from 'react';
import { CalendarPlus, ClipboardCheck, Radio, Share2, Users, Wallet } from 'lucide-react';
import { Link, useLocation } from 'wouter';
import { useQuery } from '@tanstack/react-query';
import { LIVE_OPEN_MINUTES_BEFORE, type TeacherDashboardDTO } from '@workspace/live-core';
import { Countdown, ShareLectureSheet } from '@/components/bits';
import { LectureCard, LectureCardSkeleton } from '@/components/lecture-card';
import { NotificationsButton } from '@/layouts/app-shell';
import { api } from '@/lib/api';
import { fmtDateTime, greeting, money } from '@/lib/format';
import { useMe } from '@/lib/session';
import { Button, Card, EmptyState, Fab, LiveBadge, Page, SectionHeader, SectionLink, Stat, StatGrid, TopBar } from '@/ui';

export function TeacherHome() {
  const me = useMe();
  const [, navigate] = useLocation();
  const [share, setShare] = useState(false);
  const q = useQuery({ queryKey: ['teacher-dashboard'], queryFn: () => api<TeacherDashboardDTO>('/teacher/dashboard'), refetchInterval: 30_000 });
  const d = q.data;
  const next = d?.liveNow ?? d?.upcoming[0] ?? null;
  const canGoLive = next && (next.status === 'live' || new Date(next.startsAt).getTime() - Date.now() <= LIVE_OPEN_MINUTES_BEFORE * 60_000);

  return (
    <>
      <TopBar title={`${greeting()}، ${me.user.name.split(' ').slice(0, 2).join(' ')}`} large subtitle="ده ملخّص شغلك النهارده" actions={<NotificationsButton />} />
      <Page wide>
        {/* Hero: the next lecture, with the one action that matters right now. */}
        {q.isPending ? (
          <div className="skeleton h-48 rounded-xl" />
        ) : next ? (
          <Card variant="ink" pad="lg" className="relative overflow-hidden rounded-xl">
            <div className="pointer-events-none absolute -top-20 -left-20 size-64 rounded-full bg-gradient-live opacity-30 blur-3xl" aria-hidden="true" />
            <div className="relative flex flex-col gap-4 md:flex-row md:items-end md:justify-between">
              <div className="min-w-0">
                {next.status === 'live' ? <LiveBadge label="انت على الهوا" /> : <span className="text-label-lg text-white/70">الحصة الجاية</span>}
                <h2 className="mt-2 line-clamp-2 text-headline-md">{next.title}</h2>
                <p className="mt-1 text-body-md text-white/70">
                  {fmtDateTime(next.startsAt)} · <span className="font-num">{next.seatsTaken}</span> طالب حاجز
                </p>
                {next.status !== 'live' && (
                  <p className="mt-3 text-title-md">
                    بتبدأ بعد <Countdown to={next.startsAt} className="text-headline-sm" />
                  </p>
                )}
              </div>
              <div className="flex shrink-0 gap-3">
                <Button variant="neutral" className="bg-white/12 text-white" onClick={() => setShare(true)}>
                  <Share2 /> ابعت اللينك
                </Button>
                <Button variant="live" disabled={!canGoLive} onClick={() => navigate(`/live/${next.id}`)}>
                  <Radio /> {next.status === 'live' ? 'ارجع للبث' : 'ابدأ البث'}
                </Button>
              </div>
            </div>
            {!canGoLive && <p className="relative mt-3 text-body-sm text-white/60">زرار البث بيفتح قبل الميعاد بـ{LIVE_OPEN_MINUTES_BEFORE} دقيقة.</p>}
            <ShareLectureSheet open={share} onOpenChange={setShare} code={next.code} title={next.title} />
          </Card>
        ) : (
          <Card pad="lg" className="rounded-xl">
            <EmptyState
              icon={<CalendarPlus />}
              title="جدولك فاضي"
              body="اعمل أول حصة: عنوان، ميعاد وسعر. هنديك لينك تبعته لطلابك على واتساب."
              action={
                <Button size="lg" onClick={() => navigate('/t/lectures/new')}>
                  <CalendarPlus /> اعمل حصة
                </Button>
              }
            />
          </Card>
        )}

        <StatGrid className="mt-6">
          <Stat icon={<Wallet />} tone="success" label="دخلك الشهر ده" value={d ? money(d.stats.monthEarningsCents) : '—'} hint={d ? `متاح للسحب ${money(d.stats.availableCents)}` : undefined} />
          <Stat icon={<Users />} tone="secondary" label="طلابك" value={d?.stats.studentsCount ?? '—'} hint={d ? `${d.stats.monthBookings} حجز الشهر ده` : undefined} />
          <Stat icon={<CalendarPlus />} tone="tertiary" label="حصص جاية" value={d?.stats.upcomingCount ?? '—'} />
          <Link href="/t/assignments" className="contents">
            <Stat icon={<ClipboardCheck />} tone="primary" label="واجبات مستنية تصحيح" value={d?.stats.toGrade ?? '—'} className="state-layer cursor-pointer" />
          </Link>
        </StatGrid>

        <section className="mt-8">
          <SectionHeader title="الجدول" action={<SectionLink href="/t/lectures">كل الحصص</SectionLink>} />
          <div className="grid gap-3 md:grid-cols-2">
            {q.isPending && [0, 1].map((i) => <LectureCardSkeleton key={i} />)}
            {d?.upcoming.slice(next?.status === 'live' ? 0 : 1, 7).map((l) => <LectureCard key={l.id} lecture={l} />)}
          </div>
          {d && d.upcoming.length <= 1 && next && <p className="py-6 text-center text-body-md text-on-surface-variant">مفيش حصص تانية متجدولة.</p>}
        </section>
      </Page>
      <Fab label="حصة جديدة" onClick={() => navigate('/t/lectures/new')}>
        <CalendarPlus />
      </Fab>
    </>
  );
}
