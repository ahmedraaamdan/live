import { useEffect, useState } from 'react';
import { Bookmark, BookmarkCheck, UserCheck, UserPlus } from 'lucide-react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { api, errorMessage } from '@/lib/api';
import { Button, IconButton, toast } from '@/ui';

/** Keep a class to come back and book it later. Students only. */
export function SaveLectureButton({ lectureId, saved, className }: { lectureId: string; saved?: boolean; className?: string }) {
  const qc = useQueryClient();
  const [on, setOn] = useState(Boolean(saved));
  useEffect(() => setOn(Boolean(saved)), [saved]);
  const toggle = useMutation({
    mutationFn: (next: boolean) => api(`/lectures/${lectureId}/save`, { method: next ? 'POST' : 'DELETE' }),
    onMutate: (next) => setOn(next),
    onSuccess: (_data, next) => {
      void qc.invalidateQueries({ queryKey: ['saved-lectures'] });
      toast(next ? 'حفظنا الحصة لتعود إليها لاحقًا' : 'أزلنا الحصة من المحفوظات');
    },
    onError: (error, next) => {
      setOn(!next);
      toast(errorMessage(error));
    },
  });
  return (
    <IconButton className={className} variant="tonal" size="sm" label={on ? 'إزالة من المحفوظات' : 'حفظ الحصة'} aria-pressed={on} onClick={() => toggle.mutate(!on)}>
      {on ? <BookmarkCheck className="text-primary" /> : <Bookmark />}
    </IconButton>
  );
}

/** Follow a teacher so their classes come first. Students only. */
export function FollowTeacherButton({ teacherId, followed, compact, className }: { teacherId: string; followed?: boolean; compact?: boolean; className?: string }) {
  const qc = useQueryClient();
  const [on, setOn] = useState(Boolean(followed));
  useEffect(() => setOn(Boolean(followed)), [followed]);
  const toggle = useMutation({
    mutationFn: (next: boolean) => api(`/teachers/${teacherId}/follow`, { method: next ? 'POST' : 'DELETE' }),
    onMutate: (next) => setOn(next),
    onSuccess: (_data, next) => {
      void qc.invalidateQueries({ queryKey: ['feed'] });
      void qc.invalidateQueries({ queryKey: ['teacher-profile', teacherId] });
      toast(next ? 'تتابع هذا المدرس الآن، وستظهر حصصه أولًا' : 'ألغيت متابعة المدرس');
    },
    onError: (error, next) => {
      setOn(!next);
      toast(errorMessage(error));
    },
  });
  if (compact) {
    return (
      <IconButton className={className} variant="tonal" size="sm" label={on ? 'إلغاء متابعة المدرس' : 'متابعة المدرس'} aria-pressed={on} onClick={() => toggle.mutate(!on)}>
        {on ? <UserCheck className="text-primary" /> : <UserPlus />}
      </IconButton>
    );
  }
  return (
    <Button size="sm" variant={on ? 'tonal' : 'filled'} className={className} aria-pressed={on} onClick={() => toggle.mutate(!on)}>
      {on ? <UserCheck /> : <UserPlus />} {on ? 'تتابعه' : 'متابعة'}
    </Button>
  );
}
