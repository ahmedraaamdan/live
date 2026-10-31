import { useState } from 'react';
import { CalendarX2, Flag } from 'lucide-react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { REPORT_REASON_LABELS, STUDENT_CANCEL_HOURS, type LectureDTO, type ReportReason } from '@workspace/live-core';
import { api, errorMessage } from '@/lib/api';
import { money } from '@/lib/format';
import { Banner, Button, Card, Select, Sheet, TextArea, TextField, toast } from '@/ui';

const reasonOptions = (Object.keys(REPORT_REASON_LABELS) as ReportReason[]).map((value) => ({ value, label: REPORT_REASON_LABELS[value] }));

function useLectureUpdate(l: LectureDTO) {
  const qc = useQueryClient();
  return (updated: LectureDTO) => {
    qc.setQueryData(['lecture', l.id], updated);
    for (const key of ['student-home', 'lectures', 'feed', 'public-lecture']) void qc.invalidateQueries({ queryKey: [key] });
  };
}

/** Leaving a booked class, with what happens to the money spelled out before confirming. */
export function CancelBookingCard({ l }: { l: LectureDTO }) {
  const update = useLectureUpdate(l);
  const [open, setOpen] = useState(false);
  const paid = l.priceCents > 0;
  const cancel = useMutation({
    mutationFn: () => api<LectureDTO>(`/lectures/${l.id}/booking/cancel`, { method: 'POST' }),
    onSuccess: (updated) => {
      setOpen(false);
      update(updated);
      toast(paid ? 'ألغينا حجزك، وسنتابع رد المبلغ مع بوابة الدفع' : 'ألغينا حجزك');
    },
    onError: (error) => toast(errorMessage(error)),
  });
  return (
    <>
      <Card variant="outlined" className="mb-6 flex flex-wrap items-center justify-between gap-3">
        <p className="min-w-0 flex-1 text-body-md text-on-surface-variant">{paid ? `يمكنك إلغاء حجزك واسترداد المبلغ كاملًا حتى ${STUDENT_CANCEL_HOURS} ساعة قبل الحصة.` : 'يمكنك إلغاء حجزك في أي وقت قبل الحصة.'}</p>
        <Button variant="outlined" size="sm" onClick={() => setOpen(true)}>
          <CalendarX2 /> إلغاء الحجز
        </Button>
      </Card>
      <Sheet
        open={open}
        onOpenChange={setOpen}
        title="إلغاء حجزك في هذه الحصة؟"
        footer={
          <>
            <Button block variant="danger" loading={cancel.isPending} onClick={() => cancel.mutate()}>
              تأكيد الإلغاء
            </Button>
            <Button block variant="text" onClick={() => setOpen(false)}>
              الإبقاء على الحجز
            </Button>
          </>
        }
      >
        <p className="text-body-md text-on-surface-variant">{paid ? `سنرد ${money(l.priceCents)} إلى وسيلة الدفع التي استخدمتها. قد تستغرق العملية بضعة أيام عمل.` : 'سيُتاح مقعدك لطالب آخر.'}</p>
      </Sheet>
    </>
  );
}

/** Reporting a finished class while its earnings are still on hold. */
export function ReportProblemCard({ l }: { l: LectureDTO }) {
  const update = useLectureUpdate(l);
  const [open, setOpen] = useState(false);
  const [reason, setReason] = useState<ReportReason | ''>('');
  const [details, setDetails] = useState('');
  const report = useMutation({
    mutationFn: () => api<LectureDTO>(`/lectures/${l.id}/report`, { body: { reason, details } }),
    onSuccess: (updated) => {
      setOpen(false);
      update(updated);
      toast('وصلنا بلاغك، وسنراجعه قبل تحويل قيمة الحصة للمدرس');
    },
    onError: (error) => toast(errorMessage(error)),
  });
  if (l.booking?.reported) {
    return <div className="mb-6"><Banner tone="info" title="وصلنا بلاغك">نراجع ما حدث في الحصة، وسيصلك إشعار بالنتيجة.</Banner></div>;
  }
  if (!l.booking?.canReport) return null;
  return (
    <>
      <Card variant="outlined" className="mb-6 flex flex-wrap items-center justify-between gap-3">
        <p className="min-w-0 flex-1 text-body-md text-on-surface-variant">حدثت مشكلة في الحصة؟ أبلغنا خلال 24 ساعة من انتهائها.</p>
        <Button variant="outlined" size="sm" onClick={() => setOpen(true)}>
          <Flag /> الإبلاغ عن مشكلة
        </Button>
      </Card>
      <Sheet
        open={open}
        onOpenChange={setOpen}
        title="ماذا حدث في الحصة؟"
        description="نراجع البلاغ قبل تحويل قيمة الحصة للمدرس، ولا نُظهر اسمك له."
        footer={
          <Button block loading={report.isPending} disabled={!reason} onClick={() => report.mutate()}>
            إرسال البلاغ
          </Button>
        }
      >
        <div className="flex flex-col gap-4">
          <Select label="سبب البلاغ" value={reason} onChange={(e) => setReason(e.target.value as ReportReason)} placeholder="اختر السبب" options={reasonOptions} />
          <TextArea label="تفاصيل تساعدنا" value={details} onChange={(e) => setDetails(e.target.value)} rows={3} maxLength={1000} hint="اختياري" />
        </div>
      </Sheet>
    </>
  );
}

/** The checkout needs a phone number: ask for it here rather than sending people away. */
export function PhoneSheet({ open, onOpenChange, onSubmit, pending, invalid }: { open: boolean; onOpenChange: (open: boolean) => void; onSubmit: (phone: string) => void; pending: boolean; invalid?: boolean }) {
  const [phone, setPhone] = useState('');
  const valid = /^\+?[0-9 ]{8,16}$/.test(phone.trim());
  return (
    <Sheet
      open={open}
      onOpenChange={onOpenChange}
      title="رقم هاتفك لإتمام الدفع"
      description="تطلبه بوابة الدفع لتأكيد العملية، وسنحفظه في حسابك."
      footer={
        <Button block loading={pending} disabled={!valid} onClick={() => onSubmit(phone.trim())}>
          متابعة الدفع
        </Button>
      }
    >
      <TextField label="رقم الهاتف" type="tel" inputMode="tel" autoComplete="tel" ltr value={phone} onChange={(e) => setPhone(e.target.value)} placeholder="01xxxxxxxxx" error={invalid ? 'بوابة الدفع لم تقبل هذا الرقم. تحقّق منه وحاول مجددًا.' : undefined} />
    </Sheet>
  );
}
