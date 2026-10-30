import { StudyBanner, StudyIllustration } from '@/components/study-illustration';
import { QueryError } from '@/components/query-error';
import { useState } from 'react';
import { Eye, NotebookPen, Radio, Sparkles, ThumbsUp, Ticket } from 'lucide-react';
import { Link, useLocation } from 'wouter';
import { useQuery } from '@tanstack/react-query';
import { SUBJECTS, subjectLabel, type FeedDTO, type FeedItem, type StudentHomeDTO } from '@workspace/live-core';
import { Countdown } from '@/components/bits';
import { approvalPct } from '@/components/vote';
import { NotificationsButton } from '@/layouts/app-shell';
import { api } from '@/lib/api';
import { cn } from '@/lib/cn';
import { fmtDateTime, fmtRelative, greeting, money } from '@/lib/format';
import { useMe } from '@/lib/session';
import { Avatar, Badge, Button, Card, Chip, EmptyState, LinkCard, LiveBadge, Page, SectionHeader, SectionLink, TopBar } from '@/ui';

export function StudentHome() {
  const me = useMe();
  const [, navigate] = useLocation();
  const [subject, setSubject] = useState<string>('');
  const home = useQuery({ queryKey: ['student-home'], queryFn: () => api<StudentHomeDTO>('/student/home'), refetchInterval: 30_000 });
  const feed = useQuery({ queryKey: ['feed', subject], queryFn: () => api<FeedDTO>(`/feed${subject ? `?subject=${subject}` : ''}`), refetchInterval: 30_000 });
  const h = home.data;
  const myLive = h?.liveNow[0];
  const next = h?.upcoming[0];

  return (
    <>
      <TopBar title={`${greeting()}، ${me.user.name.split(' ')[0]}`} large subtitle="ما الذي تريد تعلّمه اليوم؟" actions={<NotificationsButton />} />
      <Page wide>
        {home.isError && <QueryError error={home.error} retry={home.refetch} />}
        {feed.isError && <QueryError error={feed.error} retry={feed.refetch} />}
        {!myLive && !next && home.isSuccess && <StudyBanner title="خطوة جديدة في تعلّمك" body="اختر حصتك، واسأل مدرسك، وتابع مهامك من هنا." />}
        {/* Mine first: my class on air, or my next one. */}
        {myLive ? (
          <Card variant="ink" pad="lg" className="relative mb-6 overflow-hidden rounded-xl">
            <div className="pointer-events-none absolute -top-16 -left-16 size-56 rounded-full bg-gradient-live opacity-40 blur-3xl" aria-hidden="true" />
            <div className="relative">
              <LiveBadge label="حصتك مباشرة الآن" />
              <h2 className="mt-3 text-headline-md">{myLive.title}</h2>
              <p className="mt-1 text-body-md text-white/70">{myLive.teacher.name}</p>
              <Button variant="live" size="lg" className="mt-5" onClick={() => navigate(`/live/${myLive.id}`)}>
                <Radio /> انضم إلى البث
              </Button>
            </div>
          </Card>
        ) : next ? (
          <LinkCard href={`/lectures/${next.id}`} variant="filled" className="app-upcoming-ticket mb-6 flex items-center gap-4 rounded-xl">
            <StudyIllustration />
            <div className="grid size-14 shrink-0 place-items-center rounded-lg bg-primary-container text-on-primary-container">
              <Ticket className="size-7" />
            </div>
            <div className="min-w-0 flex-1">
              <p className="text-label-lg text-on-surface-variant">حصتك القادمة · {subjectLabel(next.subject)}</p>
              <p className="truncate text-title-lg">{next.title}</p>
              <p className="text-body-md text-on-surface-variant">{fmtDateTime(next.startsAt)}</p>
            </div>
            <Countdown to={next.startsAt} className="hidden text-headline-sm md:block" />
          </LinkCard>
        ) : null}

        {h && h.pendingAssignments.length > 0 && (
          <section className="mb-8">
            <SectionHeader title="واجبات بانتظارك" action={<SectionLink href="/s/assignments">الكل</SectionLink>} />
            <div className="scrollbar-none -mx-4 flex snap-x gap-3 overflow-x-auto px-4 md:mx-0 md:px-0">
              {h.pendingAssignments.map((a) => (
                <LinkCard key={a.id} href={`/s/assignments/${a.id}`} pad="sm" className="w-64 shrink-0 snap-start">
                  <div className="flex items-center gap-2 text-tertiary">
                    <NotebookPen className="size-5" />
                    <span className="text-label-md">{a.dueAt ? `التسليم ${fmtRelative(a.dueAt)}` : 'دون موعد محدد'}</span>
                  </div>
                  <p className="mt-2 line-clamp-2 text-title-md">{a.title}</p>
                  <p className="mt-1 truncate text-body-sm text-on-surface-variant">{a.lectureTitle}</p>
                </LinkCard>
              ))}
            </div>
          </section>
        )}

        {/* Discovery: every teacher's classes, ranked (docs/app/RANKING.md). */}
        <div className="scrollbar-none -mx-4 mb-5 flex gap-2 overflow-x-auto px-4 md:mx-0 md:px-0">
          <Chip selected={!subject} onClick={() => setSubject('')} icon={<Sparkles />}>
            لك
          </Chip>
          {SUBJECTS.filter((s) => s.key !== 'other').map((s) => (
            <Chip key={s.key} selected={subject === s.key} onClick={() => setSubject(s.key)}>
              {s.label}
            </Chip>
          ))}
        </div>

        <section className="mb-8">
          <SectionHeader
            title={
              <span className="inline-flex items-center gap-2">
                <span className="size-2.5 animate-live-pulse rounded-full bg-live" aria-hidden="true" /> مباشر الآن
              </span>
            }
          />
          {feed.isPending ? (
            <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
              {[0, 1, 2].map((i) => (
                <div key={i} className="skeleton h-52 rounded-lg" />
              ))}
            </div>
          ) : feed.data?.live.length ? (
            <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
              {feed.data.live.map((it, i) => (
                <FeedCard key={it.lecture.id} item={it} rank={i} />
              ))}
            </div>
          ) : (
            <Card variant="filled" className="text-center">
              <p className="text-body-md text-on-surface-variant">مفيش بث شغال دلوقتي{subject ? ` في ${subjectLabel(subject)}` : ''}. بص على الحصص الجاية تحت.</p>
            </Card>
          )}
        </section>

        <section>
          <SectionHeader title="حصص قادمة" />
          {feed.data?.upcoming.length ? (
            <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
              {feed.data.upcoming.map((it) => (
                <FeedCard key={it.lecture.id} item={it} />
              ))}
            </div>
          ) : (
            !feed.isPending && <EmptyState icon={<Ticket />} title="مفيش حصص متجدولة" body="أول ما المدرسين ينزّلوا حصص جديدة هتلاقيها هنا. ولو معاك لينك من مدرسك افتحه على طول." />
          )}
        </section>
      </Page>
    </>
  );
}

/** A ranked card: live state and viewers, approval, and why it's here. */
function FeedCard({ item, rank }: { item: FeedItem; rank?: number }) {
  const l = item.lecture;
  const booked = l.booking?.status === 'confirmed';
  const href = booked ? (l.status === 'live' ? `/live/${l.id}` : `/lectures/${l.id}`) : `/l/${l.code}`;
  const pct = approvalPct(l.votes);
  const full = l.capacity != null && l.seatsTaken >= l.capacity;
  return (
    <article className={cn('lecture-card gl-feed-card state-layer press group block overflow-hidden rounded-lg bg-surface-container-lowest shadow-e1 transition-shadow hover:shadow-e3', rank === 0 && 'md:col-span-2 xl:col-span-1')}>
      <Link href={href} className="lecture-card-hitbox" aria-label={`تفاصيل حصة ${l.title}`} />
      {/* Cover: subject colour field with the teacher, like a stream thumbnail. */}
      <div className={cn('gl-feed-cover relative flex h-28 items-end p-4', l.status === 'live' ? 'bg-gradient-live' : 'bg-gradient-brand')}>
        {l.coverUrl && <><img src={l.coverUrl} className="feed-cover-photo" alt="" loading="lazy" /><div className="feed-cover-shade" /></>}
        <div className="absolute top-3 start-3 flex items-center gap-2">
          {l.status === 'live' ? <LiveBadge /> : <Badge className="bg-black/30 text-white backdrop-blur">{fmtRelative(l.startsAt)}</Badge>}
          {l.status === 'live' && l.viewersNow > 0 && (
            <Badge className="bg-black/30 text-white backdrop-blur">
              <Eye /> <span className="font-num">{l.viewersNow}</span>
            </Badge>
          )}
        </div>
        <div className="absolute top-3 end-3">
          {booked ? <Badge tone="success">حاجز</Badge> : full ? <Badge tone="error">كامل</Badge> : null}
        </div>
        <Link href={`/teachers/${l.teacher.id}`} className="teacher-link lecture-card-teacher flex items-center gap-2 text-white">
          <Avatar name={l.teacher.name} src={l.teacher.avatarUrl} size="sm" ring />
          <span className="text-title-sm drop-shadow">{l.teacher.name}</span>
        </Link>
      </div>
      <div className="p-4">
        <div className="flex items-center gap-2 text-body-sm text-on-surface-variant">
          <span>{subjectLabel(l.subject)}</span>
          {pct != null && (
            <span className="inline-flex items-center gap-1 text-success">
              <ThumbsUp className="size-3.5" /> <span className="font-num">{pct}%</span>
            </span>
          )}
          {item.reason && <span className="ms-auto rounded-full bg-tertiary-container px-2 py-0.5 text-label-sm text-on-tertiary-container">{item.reason}</span>}
        </div>
        <h3 className="mt-1.5 line-clamp-2 text-title-lg">{l.title}</h3>
        <div className="mt-3 flex items-center justify-between">
          <span className="text-body-sm text-on-surface-variant">{l.status === 'live' ? 'مباشرة الآن' : fmtDateTime(l.startsAt)}</span>
          <span className="font-num text-title-md">{l.priceCents ? money(l.priceCents) : 'مجانية'}</span>
        </div>
      </div>
    </article>
  );
}
