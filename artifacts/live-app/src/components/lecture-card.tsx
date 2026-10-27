import { CalendarClock, Clock, PlayCircle, Users } from 'lucide-react';
import { LECTURE_STATUS_LABELS, gradeLabel, subjectLabel, type LectureDTO } from '@workspace/live-core';
import { cn } from '@/lib/cn';
import { fmtDateTime, fmtDuration, fmtRelative, money } from '@/lib/format';
import { Avatar, Badge, LinkCard, LiveBadge } from '@/ui';

export function lectureEnded(l: LectureDTO) {
  return l.status === 'ended' || (l.status === 'scheduled' && new Date(l.startsAt).getTime() + l.durationMin * 60_000 < Date.now());
}

export function StatusBadge({ lecture }: { lecture: LectureDTO }) {
  if (lecture.status === 'live') return <LiveBadge />;
  if (lecture.status === 'cancelled') return <Badge tone="error">{LECTURE_STATUS_LABELS.cancelled}</Badge>;
  if (lecture.status === 'draft') return <Badge tone="outline">{LECTURE_STATUS_LABELS.draft}</Badge>;
  if (lectureEnded(lecture))
    return lecture.recording?.status === 'ready' ? (
      <Badge tone="tertiary">
        <PlayCircle /> تسجيل متاح
      </Badge>
    ) : (
      <Badge>{LECTURE_STATUS_LABELS.ended}</Badge>
    );
  return <Badge tone="secondary">{fmtRelative(lecture.startsAt)}</Badge>;
}

/** The lecture as it appears in every list. `showTeacher` for students and parents. */
export function LectureCard({ lecture, showTeacher, className, href }: { lecture: LectureDTO; showTeacher?: boolean; className?: string; href?: string }) {
  const seats = lecture.capacity ? `${lecture.seatsTaken}/${lecture.capacity}` : String(lecture.seatsTaken);
  return (
    <LinkCard href={href ?? `/lectures/${lecture.id}`} className={cn('flex flex-col gap-3', lecture.status === 'live' && 'ring-2 ring-live', className)}>
      <div className="flex items-center gap-2">
        <Badge tone="primary">{subjectLabel(lecture.subject)}</Badge>
        <span className="text-body-sm text-on-surface-variant">{gradeLabel(lecture.grade)}</span>
        <span className="ms-auto">
          <StatusBadge lecture={lecture} />
        </span>
      </div>
      <h3 className="line-clamp-2 text-title-lg">{lecture.title}</h3>
      <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-body-md text-on-surface-variant">
        <span className="inline-flex items-center gap-1.5">
          <CalendarClock className="size-4" aria-hidden="true" />
          {fmtDateTime(lecture.startsAt)}
        </span>
        <span className="inline-flex items-center gap-1.5">
          <Clock className="size-4" aria-hidden="true" />
          {fmtDuration(lecture.durationMin)}
        </span>
        {lecture.stats && (
          <span className="inline-flex items-center gap-1.5">
            <Users className="size-4" aria-hidden="true" />
            <span className="font-num">{seats}</span>
          </span>
        )}
      </div>
      <div className="flex items-center gap-3 border-t border-outline-variant pt-3">
        {showTeacher ? (
          <>
            <Avatar name={lecture.teacher.name} src={lecture.teacher.avatarUrl} size="sm" />
            <span className="min-w-0 flex-1 truncate text-title-sm">{lecture.teacher.name}</span>
          </>
        ) : (
          <span className="flex-1 text-body-md text-on-surface-variant">
            {lecture.stats ? (
              <>
                دخلك <span className="font-num text-title-sm text-on-surface">{money(lecture.stats.teacherCents)}</span>
              </>
            ) : null}
          </span>
        )}
        <span className="font-num text-title-md">{lecture.priceCents ? money(lecture.priceCents) : 'مجانية'}</span>
      </div>
    </LinkCard>
  );
}

export function LectureCardSkeleton() {
  return (
    <div className="flex flex-col gap-3 rounded-lg bg-surface-container-lowest p-5 shadow-e1">
      <div className="skeleton h-6 w-24 rounded-full" />
      <div className="skeleton h-6 w-3/4" />
      <div className="skeleton h-4 w-1/2" />
      <div className="skeleton mt-2 h-9 w-full" />
    </div>
  );
}
