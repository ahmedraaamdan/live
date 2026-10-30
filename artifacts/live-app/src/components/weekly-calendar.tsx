import { useState } from 'react';
import { CalendarDays, ChevronLeft, ChevronRight, Plus } from 'lucide-react';
import { useQuery } from '@tanstack/react-query';
import { Link, useLocation } from 'wouter';
import type { LectureDTO } from '@workspace/live-core';
import { api } from '@/lib/api';
import { addCalendarDays, cairoDay, cairoSlot, cairoWeekStart } from '@/lib/calendar';
import { fmtShortDate, fmtTime } from '@/lib/format';
import { Button, Card, IconButton } from '@/ui';
import { useTeacherVerification } from './verification-notice';
import { QueryError } from './query-error';
import { StatusBadge } from './lecture-card';

const HOURS = Array.from({ length: 16 }, (_, i) => i + 8);
const weekday = (day: string) =>
  new Intl.DateTimeFormat('ar-EG', { weekday: 'short', timeZone: 'Africa/Cairo' }).format(cairoSlot(day, 12));

export function WeeklyCalendar() {
  const [, navigate] = useLocation();
  const verification = useTeacherVerification();
  const [selected, setSelected] = useState(cairoDay());
  const [week, setWeek] = useState(cairoWeekStart(cairoDay()));
  const days = Array.from({ length: 7 }, (_, i) => addCalendarDays(week, i));
  const from = cairoSlot(week, 0).toISOString(),
    to = cairoSlot(addCalendarDays(week, 7), 0).toISOString();

  const q = useQuery({
    queryKey: ['teacher-calendar', week],
    queryFn: () => api<LectureDTO[]>(`/teacher/calendar?from=${encodeURIComponent(from)}&to=${encodeURIComponent(to)}`),
  });

  const shift = (n: number) => {
    setWeek(value => addCalendarDays(value, n * 7));
    setSelected(value => addCalendarDays(value, n * 7));
  };

  const schedule = (day: string, hour: number) =>
    navigate(
      verification.data?.status === 'approved'
        ? `/t/lectures/new?startsAt=${encodeURIComponent(cairoSlot(day, hour).toISOString())}`
        : '/t/verification',
    );

  const occupies = (day: string, hour: number) =>
    (q.data ?? []).find(l => {
      const at = cairoSlot(day, hour).getTime(),
        start = new Date(l.startsAt).getTime();
      return start < at + 3600000 && start + l.durationMin * 60000 > at;
    });

  const dayLectures = (q.data ?? []).filter(l => {
    const start = new Date(l.startsAt).getTime(),
      fromDay = cairoSlot(selected, 0).getTime(),
      nextDay = cairoSlot(addCalendarDays(selected, 1), 0).getTime();
    return start < nextDay && start + l.durationMin * 60000 > fromDay;
  });

  const slot = (day: string, hour: number, compact = false) => {
    const lecture = occupies(day, hour);
    const past = cairoSlot(day, hour).getTime() < Date.now();

    if (!lecture) {
      return (
        <button
          key={hour}
          type="button"
          className={`calendar-slot ${past ? 'is-past' : ''}`}
          disabled={past}
          aria-label={`جدولة حصة ${fmtShortDate(cairoSlot(day, hour))}، ${fmtTime(cairoSlot(day, hour))}`}
          onClick={() => schedule(day, hour)}
        >
          {compact ? fmtTime(cairoSlot(day, hour)) : <Plus size={15} />}
        </button>
      );
    }

    const prevLecture = occupies(day, hour - 1);
    const nextLecture = occupies(day, hour + 1);
    const isFirst = !prevLecture || prevLecture.id !== lecture.id;
    const isLast = !nextLecture || nextLecture.id !== lecture.id;
    const isMulti = !isFirst || !isLast;

    const startMs = new Date(lecture.startsAt).getTime();
    const endMs = startMs + lecture.durationMin * 60000;
    const timeRange = `${fmtTime(lecture.startsAt)} – ${fmtTime(new Date(endMs))}`;

    let multiCls = '';
    if (isMulti) {
      if (isFirst) multiCls = 'calendar-slot-multi-start';
      else if (isLast) multiCls = 'calendar-slot-multi-end';
      else multiCls = 'calendar-slot-multi-mid';
    }

    return (
      <button
        key={hour}
        type="button"
        className={`calendar-slot calendar-slot-booked ${lecture.status === 'live' ? 'is-live' : ''} ${past ? 'is-past' : ''} ${multiCls}`}
        aria-label={`${lecture.title}، ${timeRange}`}
        onClick={() => navigate(`/lectures/${lecture.id}`)}
      >
        {compact ? (
          <span>{isFirst ? timeRange : 'تابع الحصة'}</span>
        ) : (
          <>
            {isFirst ? (
              <>
                <span className="font-semibold">{lecture.title}</span>
                <small className="font-num opacity-90">{timeRange}</small>
              </>
            ) : (
              <span className="opacity-50 text-[10px]">تابع ({lecture.title})</span>
            )}
          </>
        )}
      </button>
    );
  };

  return (
    <section className="teacher-calendar" aria-label="التقويم الأسبوعي">
      <div className="calendar-title">
        <div>
          <p className="profile-eyebrow">
            <CalendarDays size={16} /> جدولك، على راحتك
          </p>
          <h2>أسبوعك الدراسي</h2>
          <p className="text-body-sm text-on-surface-variant">اختر موعدًا فارغًا لإنشاء حصة. جميع الأوقات بتوقيت القاهرة.</p>
        </div>
        <Button variant="tonal" size="sm" onClick={() => schedule(selected, 19)}>
          <Plus /> موعد مخصص
        </Button>
      </div>
      <Card className="calendar-card">
        <div className="calendar-toolbar">
          <IconButton label="الأسبوع السابق" onClick={() => shift(-1)}>
            <ChevronRight />
          </IconButton>
          <div className="text-center">
            <strong>
              {fmtShortDate(cairoSlot(week, 12))} — {fmtShortDate(cairoSlot(days[6]!, 12))}
            </strong>
            <button
              type="button"
              onClick={() => {
                setWeek(cairoWeekStart(cairoDay()));
                setSelected(cairoDay());
              }}
            >
              هذا الأسبوع
            </button>
          </div>
          <IconButton label="الأسبوع التالي" onClick={() => shift(1)}>
            <ChevronLeft />
          </IconButton>
        </div>
        {q.isError ? (
          <QueryError error={q.error} retry={q.refetch} />
        ) : q.isPending ? (
          <div className="skeleton h-72 rounded-xl" />
        ) : (
          <>
            <div className="calendar-day-selector">
              {days.map(day => (
                <button
                  type="button"
                  key={day}
                  aria-pressed={day === selected}
                  aria-label={`${weekday(day)} ${fmtShortDate(cairoSlot(day, 12))}`}
                  className={`${day === selected ? 'selected' : ''} ${day === cairoDay() ? 'today' : ''}`}
                  onClick={() => setSelected(day)}
                >
                  <span>{weekday(day)}</span>
                  <strong>{Number(day.slice(-2))}</strong>
                  <i />
                </button>
              ))}
            </div>
            <div className="calendar-mobile-agenda">
              {dayLectures.length ? (
                <div className="calendar-agenda-events">
                  {dayLectures.map(l => {
                    const endMs = new Date(l.startsAt).getTime() + l.durationMin * 60000;
                    return (
                      <Link key={l.id} href={`/lectures/${l.id}`} className="calendar-agenda-event">
                        <span className="font-num">
                          {fmtTime(l.startsAt)} – {fmtTime(new Date(endMs))}
                        </span>
                        <strong>{l.title}</strong>
                        <StatusBadge lecture={l} />
                      </Link>
                    );
                  })}
                </div>
              ) : (
                <p className="calendar-empty">اليوم مفتوح لأفكارك. اختر وقت حصتك.</p>
              )}
              <div className="calendar-time-options">{HOURS.map(hour => slot(selected, hour, true))}</div>
            </div>
            <div className="calendar-week-scroll">
              <div className="calendar-week-grid">
                <span className="calendar-corner" />
                {days.map(day => (
                  <div className={`calendar-column-title ${day === cairoDay() ? 'today' : ''}`} key={day}>
                    {weekday(day)}
                    <strong>{Number(day.slice(-2))}</strong>
                  </div>
                ))}
                {HOURS.map(hour => (
                  <div className="calendar-grid-row" key={hour}>
                    <span className="calendar-hour">{fmtTime(cairoSlot(week, hour))}</span>
                    {days.map(day => {
                      const lecture = occupies(day, hour);
                      const nextLecture = occupies(day, hour + 1);
                      const hasContinuationBelow = Boolean(lecture && nextLecture && nextLecture.id === lecture.id);
                      const prevLecture = occupies(day, hour - 1);
                      const isContinuationAbove = Boolean(lecture && prevLecture && prevLecture.id === lecture.id);

                      return (
                        <div
                          key={day}
                          className={`calendar-cell ${hasContinuationBelow ? 'has-continuation-below' : ''} ${isContinuationAbove ? 'is-continuation-above' : ''}`}
                        >
                          {slot(day, hour)}
                        </div>
                      );
                    })}
                  </div>
                ))}
              </div>
            </div>
          </>
        )}
      </Card>
    </section>
  );
}
