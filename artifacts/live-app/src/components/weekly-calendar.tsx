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
const weekday = (day: string) => new Intl.DateTimeFormat('ar-EG', { weekday: 'short', timeZone: 'Africa/Cairo' }).format(cairoSlot(day, 12));
export function WeeklyCalendar() {
  const [, navigate] = useLocation();
  const verification = useTeacherVerification();
  const [selected, setSelected] = useState(cairoDay());
  const [week, setWeek] = useState(cairoWeekStart(cairoDay()));
  const days = Array.from({ length: 7 }, (_, i) => addCalendarDays(week, i));
  const from = cairoSlot(week, 0).toISOString(), to = cairoSlot(addCalendarDays(week, 7), 0).toISOString();
  const q = useQuery({ queryKey: ['teacher-calendar', week], queryFn: () => api<LectureDTO[]>(`/teacher/calendar?from=${encodeURIComponent(from)}&to=${encodeURIComponent(to)}`) });
  const shift = (n: number) => { setWeek(value => addCalendarDays(value, n * 7)); setSelected(value => addCalendarDays(value, n * 7)); };
  const schedule = (day: string, hour: number) => navigate(verification.data?.status === 'approved' ? `/t/lectures/new?startsAt=${encodeURIComponent(cairoSlot(day, hour).toISOString())}` : '/t/verification');
  const occupies = (day: string, hour: number) => (q.data ?? []).find(l => { const at = cairoSlot(day, hour).getTime(), start = new Date(l.startsAt).getTime(); return start < at + 3600000 && start + l.durationMin * 60000 > at; });
  const dayLectures = (q.data ?? []).filter(l => { const start = new Date(l.startsAt).getTime(), fromDay = cairoSlot(selected, 0).getTime(), nextDay = cairoSlot(addCalendarDays(selected, 1), 0).getTime(); return start < nextDay && start + l.durationMin * 60000 > fromDay; });
  const slot = (day: string, hour: number, compact = false) => {
    const lecture = occupies(day, hour), past = cairoSlot(day, hour).getTime() < Date.now();
    return <button key={hour} type="button" className={`calendar-slot ${lecture ? `calendar-slot-booked ${lecture.status === 'live' ? 'is-live' : ''}` : ''} ${past ? 'is-past' : ''}`} disabled={!lecture && past} aria-label={lecture ? `${lecture.title}، ${fmtTime(lecture.startsAt)}` : `جدولة حصة ${fmtShortDate(cairoSlot(day, hour))}، ${fmtTime(cairoSlot(day, hour))}`} onClick={() => lecture ? navigate(`/lectures/${lecture.id}`) : schedule(day, hour)}>{lecture ? <><span>{compact ? fmtTime(lecture.startsAt) : lecture.title}</span>{!compact && <small>{fmtTime(lecture.startsAt)}</small>}</> : <>{compact ? fmtTime(cairoSlot(day, hour)) : <Plus size={15} />}</>}</button>;
  };
  return <section className="teacher-calendar" aria-label="التقويم الأسبوعي">
    <div className="calendar-title"><div><p className="profile-eyebrow"><CalendarDays size={16} /> جدولك، على راحتك</p><h2>أسبوعك الدراسي</h2><p className="text-body-sm text-on-surface-variant">اختر موعدًا فارغًا لإنشاء حصة. جميع الأوقات بتوقيت القاهرة.</p></div><Button variant="tonal" size="sm" onClick={() => schedule(selected, 19)}><Plus /> موعد مخصص</Button></div>
    <Card className="calendar-card">
      <div className="calendar-toolbar"><IconButton label="الأسبوع السابق" onClick={() => shift(-1)}><ChevronRight /></IconButton><div className="text-center"><strong>{fmtShortDate(cairoSlot(week, 12))} — {fmtShortDate(cairoSlot(days[6]!, 12))}</strong><button type="button" onClick={() => { setWeek(cairoWeekStart(cairoDay())); setSelected(cairoDay()); }}>هذا الأسبوع</button></div><IconButton label="الأسبوع التالي" onClick={() => shift(1)}><ChevronLeft /></IconButton></div>
      {q.isError ? <QueryError error={q.error} retry={q.refetch} /> : q.isPending ? <div className="skeleton h-72 rounded-xl" /> : <>
        <div className="calendar-day-selector">{days.map(day => <button type="button" key={day} aria-pressed={day === selected} aria-label={`${weekday(day)} ${fmtShortDate(cairoSlot(day, 12))}`} className={`${day === selected ? 'selected' : ''} ${day === cairoDay() ? 'today' : ''}`} onClick={() => setSelected(day)}><span>{weekday(day)}</span><strong>{Number(day.slice(-2))}</strong><i /></button>)}</div>
        <div className="calendar-mobile-agenda">
          {dayLectures.length ? <div className="calendar-agenda-events">{dayLectures.map(l => <Link key={l.id} href={`/lectures/${l.id}`} className="calendar-agenda-event"><span className="font-num">{fmtTime(l.startsAt)}</span><strong>{l.title}</strong><StatusBadge lecture={l} /></Link>)}</div> : <p className="calendar-empty">اليوم مفتوح لأفكارك. اختر وقت حصتك.</p>}
          <div className="calendar-time-options">{HOURS.map(hour => slot(selected, hour, true))}</div>
        </div>
        <div className="calendar-week-scroll"><div className="calendar-week-grid"><span className="calendar-corner" />{days.map(day => <div className={`calendar-column-title ${day === cairoDay() ? 'today' : ''}`} key={day}>{weekday(day)}<strong>{Number(day.slice(-2))}</strong></div>)}{HOURS.map(hour => <div className="calendar-grid-row" key={hour}><span className="calendar-hour">{fmtTime(cairoSlot(week, hour))}</span>{days.map(day => <div key={day} className="calendar-cell">{slot(day, hour)}</div>)}</div>)}</div></div>
      </>}
    </Card>
  </section>;
}
