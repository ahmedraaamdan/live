import { QueryError } from '@/components/query-error';
import { useState } from 'react';
import { CalendarPlus, CalendarX2, Ticket } from 'lucide-react';
import { useLocation } from 'wouter';
import { useQuery } from '@tanstack/react-query';
import type { LectureDTO } from '@workspace/live-core';
import { LectureCard, LectureCardSkeleton } from '@/components/lecture-card';
import { api } from '@/lib/api';
import { useMe } from '@/lib/session';
import { Button, EmptyState, Fab, Page, Segmented, TextField, TopBar } from '@/ui';

/** Teacher: their schedule. Student: what they booked. Same screen, two lenses. */
export function LectureList() {
  const me = useMe();
  const teacher = me.user.role === 'teacher';
  const [, navigate] = useLocation();
  const [scope, setScope] = useState<'upcoming' | 'past'>('upcoming');
  const q = useQuery({ queryKey: ['lectures', scope], queryFn: () => api<LectureDTO[]>(`/lectures?scope=${scope}`) });
  const [code, setCode] = useState('');

  return (
    <>
      <TopBar title={teacher ? 'الحصص' : 'حصصي'} large />
      <Page wide>
        {!teacher && (
          <form
            className="mb-5 flex items-end gap-2"
            onSubmit={(e) => {
              e.preventDefault();
              if (code.trim()) navigate(`/l/${code.trim().toUpperCase()}`);
            }}
          >
            <TextField containerClassName="flex-1" label="عندك كود حصة من المدرس؟" placeholder="مثلاً 4R4QJJZ" ltr value={code} onChange={(e) => setCode(e.target.value)} className="font-num tracking-widest uppercase" />
            <Button type="submit" variant="tonal" className="h-12">
              افتح
            </Button>
          </form>
        )}
        <Segmented
          className="mb-5 max-w-sm"
          value={scope}
          onChange={setScope}
          options={[
            { value: 'upcoming', label: 'الجاية' },
            { value: 'past', label: 'السابقة' },
          ]}
        />
        <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
          {q.isError && <QueryError error={q.error} retry={q.refetch} />}
        {q.isPending && [0, 1, 2].map((i) => <LectureCardSkeleton key={i} />)}
          {q.data?.map((l) => <LectureCard key={l.id} lecture={l} showTeacher={!teacher} />)}
        </div>
        {q.data?.length === 0 &&
          (scope === 'upcoming' ? (
            <EmptyState
              icon={teacher ? <CalendarPlus /> : <Ticket />}
              title={teacher ? 'مفيش حصص قادمة' : 'لم تحجز حصصًا بعد'}
              body={teacher ? 'إنشاء حصة ومشاركة الرابط لطلابك.' : 'افتح رابط الحصة الذي شاركه المدرس، أو أدخل رمزها في الحقل أعلاه.'}
              action={teacher ? <Button onClick={() => navigate('/t/lectures/new')}>إنشاء حصة</Button> : undefined}
            />
          ) : (
            <EmptyState icon={<CalendarX2 />} title="لا توجد حصص سابقة" body="تظهر هنا الحصص التي حضرتها مع التسجيلات المتاحة." />
          ))}
      </Page>
      {teacher && (
        <Fab label="حصة جديدة" onClick={() => navigate('/t/lectures/new')}>
          <CalendarPlus />
        </Fab>
      )}
    </>
  );
}
