import { VerificationNotice } from '@/components/verification-notice';
import { WeeklyCalendar } from '@/components/weekly-calendar';
import { StudyIllustration } from '@/components/study-illustration';
import { useCapabilities } from '@/lib/capabilities';
import { QueryError } from '@/components/query-error';
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
import { Banner, Button, Card, EmptyState, Fab, LiveBadge, Page, SectionHeader, SectionLink, Stat, StatGrid, TopBar } from '@/ui';

export function TeacherHome() {
  const me = useMe();
  const capabilities = useCapabilities();
  const [, navigate] = useLocation();
  const [share, setShare] = useState(false);
  const q = useQuery({ queryKey: ['teacher-dashboard'], queryFn: () => api<TeacherDashboardDTO>('/teacher/dashboard'), refetchInterval: 30_000 });
  const d = q.data;
  const next = d?.liveNow ?? d?.upcoming[0] ?? null;
  const canGoLive = next && (next.status === 'live' || new Date(next.startsAt).getTime() - Date.now() <= LIVE_OPEN_MINUTES_BEFORE * 60_000);

  return (
    <>
      <TopBar title={`${greeting()}، ${me.user.name.split(' ').slice(0, 2).join(' ')}`} large subtitle="ملخص حصصك ونشاطك اليوم" actions={<NotificationsButton />} />
      <Page wide>
        <VerificationNotice />
        {capabilities.data?.liveParticipantLimit && <div className="mb-5"><Banner tone="info">وضع التجربة: حتى {capabilities.data.liveParticipantLimit - 1} طالبًا في الحصة، و{capabilities.data.liveRoomLimit} حصة مباشرة في الوقت نفسه. التسجيل غير مفعّل في هذه المرحلة.</Banner></div>}
        {capabilities.data && (!capabilities.data.liveConfigured || !capabilities.data.paymentConfigured) && <div className="mb-5"><Banner tone="warning">{!capabilities.data.liveConfigured && 'خدمة البث لم تُفعّل بعد. '}{!capabilities.data.paymentConfigured && 'الحجز المدفوع غير متاح حاليًا. '}يمكنك تجهيز الحصص والواجبات، وسيتيح مسؤول المنصة الخدمات بعد ربطها.</Banner></div>}
        {/* Hero: the next lecture, with the one action that matters right now. */}
        {q.isError ? <QueryError error={q.error} retry={q.refetch} /> : q.isPending ? (
          <div className="skeleton h-48 rounded-xl" />
        ) : next ? (
          <Card variant="ink" pad="lg" className="app-teacher-feature relative overflow-hidden rounded-xl">
            <StudyIllustration />
            <div className="pointer-events-none absolute -top-20 -left-20 size-64 rounded-full bg-gradient-live opacity-30 blur-3xl" aria-hidden="true" />
            <div className="relative flex flex-col gap-4 md:flex-row md:items-end md:justify-between">
              <div className="min-w-0">
                {next.status === 'live' ? <LiveBadge label="أنت على الهواء" /> : <span className="text-label-lg text-white/70">الحصة القادمة</span>}
                <h2 className="mt-2 line-clamp-2 text-headline-md">{next.title}</h2>
                <p className="mt-1 text-body-md text-white/70">
                  {fmtDateTime(next.startsAt)} · <span className="font-num">{next.seatsTaken}</span> طالب حاجز
                </p>
                {next.status !== 'live' && (
                  <p className="mt-3 text-title-md">
                    تبدأ بعد <Countdown to={next.startsAt} className="text-headline-sm" />
                  </p>
                )}
              </div>
              <div className="flex shrink-0 flex-wrap gap-3">
                <Button variant="neutral" className="bg-white/12 text-white" onClick={() => setShare(true)}>
                  <Share2 /> مشاركة الرابط
                </Button>
                <Button variant="live" disabled={!canGoLive} onClick={() => navigate(`/live/${next.id}`)}>
                  <Radio /> {next.status === 'live' ? 'العودة للبث' : 'ابدأ البث'}
                </Button>
              </div>
            </div>
            {!canGoLive && <p className="relative mt-3 text-body-sm text-white/60">يتاح زر البث قبل الموعد بـ{LIVE_OPEN_MINUTES_BEFORE} دقيقة.</p>}
            <ShareLectureSheet open={share} onOpenChange={setShare} code={next.code} title={next.title} />
          </Card>
        ) : (
          <Card pad="lg" className="rounded-xl">
            <EmptyState
              icon={<CalendarPlus />}
              title="جدولك بانتظار أول حصة"
              body="ابدأ بحصة مجانية: أضف الموضوع والموعد، وابعت اللينك لطلابك."
              action={
                <Button size="lg" onClick={() => navigate('/t/lectures/new')}>
                  <CalendarPlus /> إنشاء حصة
                </Button>
              }
            />
          </Card>
        )}

        <StatGrid className="mt-6">
          <Stat icon={<Wallet />} tone="success" label="دخلك هذا الشهر" value={d ? money(d.stats.monthEarningsCents) : '—'} hint={d ? `متاح للسحب ${money(d.stats.availableCents)}` : undefined} />
          <Stat icon={<Users />} tone="secondary" label="طلابك" value={d?.stats.studentsCount ?? '—'} hint={d ? `${d.stats.monthBookings} حجز هذا الشهر` : undefined} />
          <Stat icon={<CalendarPlus />} tone="tertiary" label="حصص قادمة" value={d?.stats.upcomingCount ?? '—'} />
          <Link href="/t/assignments" className="contents">
            <Stat icon={<ClipboardCheck />} tone="primary" label="واجبات بانتظار التصحيح" value={d?.stats.toGrade ?? '—'} className="state-layer cursor-pointer" />
          </Link>
        </StatGrid>

        <WeeklyCalendar />
        <section className="mt-8">
          <SectionHeader title="الجدول" action={<SectionLink href="/t/lectures">كل الحصص</SectionLink>} />
          <div className="grid gap-3 md:grid-cols-2">
            {q.isPending && [0, 1].map((i) => <LectureCardSkeleton key={i} />)}
            {d?.upcoming.slice(next?.status === 'live' ? 0 : 1, 7).map((l) => <LectureCard key={l.id} lecture={l} />)}
          </div>
          {d && d.upcoming.length <= 1 && next && <p className="py-6 text-center text-body-md text-on-surface-variant">لا توجد حصص أخرى مجدولة.</p>}
        </section>
      </Page>
      <Fab label="حصة جديدة" onClick={() => navigate('/t/lectures/new')}>
        <CalendarPlus />
      </Fab>
    </>
  );
}
