import { cacheConfirmedBooking } from '@/lib/booking-cache';
import { useEffect, useState } from 'react';
import { Apple, CheckCircle2, CreditCard, FlaskConical, Smartphone, XCircle } from 'lucide-react';
import { useLocation } from 'wouter';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { PAYMENT_METHOD_LABELS, type PaymentDTO, type PaymentMethod, type LectureDTO } from '@workspace/live-core';
import { Confetti } from '@/components/bits';
import { api, errorMessage } from '@/lib/api';
import { cn } from '@/lib/cn';
import { money } from '@/lib/format';
import { Banner, Button, Card, Logo, PageSpinner, Spinner } from '@/ui';

/**
 * Where the gateway sends the student back. The redirect itself proves
 * nothing, so this polls our API until the webhook has settled the payment.
 */
export function Checkout({ id }: { id: string }) {
  const [, navigate] = useLocation();
  const qc = useQueryClient();
  const [since] = useState(Date.now());
  const [timedOut, setTimedOut] = useState(false);
  useEffect(() => { const timer = setTimeout(() => setTimedOut(true), 120_000); return () => clearTimeout(timer); }, []);
  const q = useQuery({
    queryKey: ['payment', id],
    queryFn: () => api<PaymentDTO>(`/payments/${id}`),
    refetchInterval: (query) => (query.state.data?.status === 'pending' && Date.now() - since < 120_000 ? 2000 : false),
  });
  const p = q.data;
  useEffect(() => {
    if (p?.status === 'succeeded' && !p.refundPending && !p.requiresReview) {
      qc.invalidateQueries({ queryKey: ['student-home'] });
      qc.invalidateQueries({ queryKey: ['lecture', p.lectureId] });
      qc.invalidateQueries({ queryKey: ['me'] });
      qc.invalidateQueries({ queryKey: ['feed'] });
      qc.invalidateQueries({ queryKey: ['lectures'] });
      void api<LectureDTO>(`/lectures/${p.lectureId}`).then(lecture => { if (lecture.booking?.status === 'confirmed') return cacheConfirmedBooking(qc, lecture, { id: lecture.booking.id, status: 'confirmed' }); return undefined; }).catch(() => undefined);
    }
  }, [p?.status, p?.lectureId, qc]);

  if (q.isPending) return <PageSpinner />;
  if (!p) return <div className="mx-auto mt-10 max-w-md p-5"><Banner tone="error">{errorMessage(q.error)}</Banner><Button className="mt-4" onClick={() => void q.refetch()}>إعادة المحاولة</Button></div>;

  if (p.refundPending || p.requiresReview) return <div className="mx-auto max-w-md p-6 pt-20"><Logo className="mb-8" /><Banner tone="warning" title={p.refundPending ? 'الاسترداد قيد المراجعة' : 'المعاملة قيد المراجعة'}>{p.refundPending ? 'نراجع طلب الاسترداد مع بوابة الدفع. لا يُعد مكتملًا حتى يؤكده المزود.' : 'نراجع المبلغ المدفوع مع بوابة الدفع. لا تكرر العملية حتى تتضح النتيجة.'} يمكنك التواصل مع الدعم برقم العملية: {p.id}</Banner><Button className="mt-5" variant="tonal" block loading={q.isFetching} onClick={() => void q.refetch()}>تحديث حالة المعاملة</Button><Button className="mt-3" block onClick={() => navigate('/s/lectures')}>العودة إلى حصصي</Button></div>;
  return (
    <div className="grid min-h-dvh place-items-center bg-background px-5 pt-safe pb-safe">
      {p.status === 'succeeded' && <Confetti />}
      <div className="w-full max-w-md text-center">
        <Logo className="mb-10" />
        {p.status === 'pending' && (
          <>
            <div className="mx-auto grid size-20 place-items-center rounded-full bg-secondary-container text-on-secondary-container">
              <Spinner className="size-9" />
            </div>
            <h1 className="mt-6 text-headline-md">{p.voucher ? 'أكمل الدفع بالكود' : 'جارٍ تأكيد الدفع…'}</h1>
            {p.voucher && <Card className="mt-4"><p className="text-body-md">كود فوري / أمان</p><p className="my-3 font-num text-headline-md" dir="ltr" data-allow-copy>{p.voucher}</p><Button variant="tonal" onClick={() => void navigator.clipboard?.writeText(p.voucher!)}>نسخ كود الدفع</Button><p className="mt-3 text-body-sm">المبلغ: {money(p.amountCents)}. يتأكد الحجز بعد إتمام الدفع وتأكيد بوابة الدفع.</p></Card>}
            <p className="mt-2 text-body-md text-on-surface-variant">نتحقق من حالة العملية لدى بوابة الدفع.</p>
          </>
        )}
        {p.status === 'succeeded' && (
          <>
            <div className="mx-auto grid size-24 animate-pop place-items-center rounded-full bg-success-container text-on-success-container">
              <CheckCircle2 className="size-12" />
            </div>
            <h1 className="mt-6 text-headline-lg">تم تأكيد حجزك!</h1>
            <p className="mt-2 text-body-lg text-on-surface-variant">مقعدك في «{p.lectureTitle}» محجوز. يمكنك مراجعة تفاصيل الحجز من صفحة الحصة.</p>
            <Card variant="filled" className="mt-6 flex items-center justify-between text-start">
              <span className="text-body-md text-on-surface-variant">{p.method ? PAYMENT_METHOD_LABELS[p.method] : 'المبلغ'}</span>
              <span className="font-num text-title-lg">{money(p.amountCents)}</span>
            </Card>
            <Button size="lg" block className="mt-6" onClick={() => navigate(`/lectures/${p.lectureId}`, { replace: true })}>
              افتح الحصة
            </Button>
          </>
        )}
        {(p.status === 'failed' || p.status === 'refunded') && (
          <>
            <div className="mx-auto grid size-24 place-items-center rounded-full bg-error-container text-on-error-container">
              <XCircle className="size-12" />
            </div>
            <h1 className="mt-6 text-headline-md">{p.status === 'refunded' ? 'تم رد المبلغ' : 'لم يكتمل الدفع'}</h1>
            <p className="mt-2 text-body-md text-on-surface-variant">{p.status === 'refunded' ? 'سُجل رد المبلغ. يعتمد وقت ظهوره في حسابك على وسيلة الدفع.' : 'لم تؤكد بوابة الدفع إتمام العملية. تحقّق من حسابك قبل بدء محاولة جديدة.'}</p>
            <Button size="lg" block className="mt-6" onClick={() => navigate(`/lectures/${p.lectureId}`, { replace: true })}>
              حاول مجددًا
            </Button>
          </>
        )}
        {p.status === 'pending' && timedOut && (
          <Banner tone="warning" className="mt-6 text-start">
            تأخر تأكيد الدفع. إذا خُصم المبلغ، انتظر تحديث الحالة ولا تكرر الدفع. يمكنك العودة إلى حسابك ومراجعة الحجز.
            <div className="mt-3 flex flex-wrap gap-2"><Button variant="tonal" loading={q.isFetching} onClick={() => void q.refetch()}>تحديث حالة الدفع</Button><Button variant="text" onClick={() => navigate('/s/lectures')}>العودة إلى حصصي</Button></div>
          </Banner>
        )}
      </div>
    </div>
  );
}

const METHODS: Array<{ key: PaymentMethod; icon: React.ReactNode }> = [
  { key: 'card', icon: <CreditCard /> },
  { key: 'wallet', icon: <Smartphone /> },
  { key: 'apple_pay', icon: <Apple /> },
  { key: 'google_pay', icon: <span className="font-num text-title-sm">G</span> },
];

/** Development stand-in for the Paymob checkout (PAYMENT_PROVIDER=mock). */
export function DevPay({ id }: { id: string }) {
  const [, navigate] = useLocation();
  const [method, setMethod] = useState<PaymentMethod>('card');
  const q = useQuery({ queryKey: ['payment', id], queryFn: () => api<PaymentDTO>(`/payments/${id}`) });
  const pay = useMutation({
    mutationFn: (outcome: 'success' | 'failure') => api(`/payments/mock/${id}/complete`, { body: { method, outcome } }),
    onSuccess: () => navigate(`/checkout/${id}`, { replace: true }),
  });
  if (q.isPending) return <PageSpinner />;
  const p = q.data;
  return (
    <div className="grid min-h-dvh place-items-center bg-surface-container px-5 pt-safe pb-safe">
      <Card className="w-full max-w-md rounded-xl" pad="lg">
        <Banner tone="warning" title="بوابة دفع تجريبية">
          <span className="inline-flex items-center gap-1">
            <FlaskConical className="size-4" /> مفيش فلوس حقيقية. في الإنتاج بتظهر صفحة Paymob بدل دي.
          </span>
        </Banner>
        <p className="mt-6 text-body-md text-on-surface-variant">{p?.lectureTitle}</p>
        <p className="font-num text-display-sm">{p ? money(p.amountCents) : ''}</p>
        <div className="mt-6 grid grid-cols-2 gap-3" role="radiogroup" aria-label="وسيلة الدفع">
          {METHODS.map((m) => (
            <button
              key={m.key}
              type="button"
              role="radio"
              aria-checked={method === m.key}
              onClick={() => setMethod(m.key)}
              className={cn(
                'state-layer press flex h-16 items-center gap-3 rounded-md border-2 px-4 text-title-sm [&_svg]:size-5',
                method === m.key ? 'border-secondary bg-secondary-container text-on-secondary-container' : 'border-outline-variant',
              )}
            >
              {m.icon}
              {PAYMENT_METHOD_LABELS[m.key]}
            </button>
          ))}
        </div>
        <Button size="lg" block className="mt-6" loading={pay.isPending} onClick={() => pay.mutate('success')} disabled={p?.status !== 'pending'}>
          ادفع {p ? money(p.amountCents) : ''}
        </Button>
        <Button variant="danger-text" block className="mt-2" onClick={() => pay.mutate('failure')} disabled={p?.status !== 'pending'}>
          جرّب فشل الدفع
        </Button>
        {p?.status !== 'pending' && <p className="mt-3 text-center text-body-sm text-on-surface-variant">العملية دي اتقفلت ({p?.status}).</p>}
      </Card>
    </div>
  );
}
