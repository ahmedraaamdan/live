import { useEffect, useState } from 'react';
import { Apple, CheckCircle2, CreditCard, FlaskConical, Smartphone, XCircle } from 'lucide-react';
import { useLocation } from 'wouter';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { PAYMENT_METHOD_LABELS, type PaymentDTO, type PaymentMethod } from '@workspace/live-core';
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
  const q = useQuery({
    queryKey: ['payment', id],
    queryFn: () => api<PaymentDTO>(`/payments/${id}`),
    refetchInterval: (query) => (query.state.data?.status === 'pending' && Date.now() - since < 120_000 ? 2000 : false),
  });
  const p = q.data;
  useEffect(() => {
    if (p?.status === 'succeeded') {
      qc.invalidateQueries({ queryKey: ['student-home'] });
      qc.invalidateQueries({ queryKey: ['lecture', p.lectureId] });
      qc.invalidateQueries({ queryKey: ['me'] });
    }
  }, [p?.status, p?.lectureId, qc]);

  if (q.isPending) return <PageSpinner />;
  if (!p) return <Banner tone="error">{errorMessage(q.error)}</Banner>;

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
            <h1 className="mt-6 text-headline-md">بنأكد الدفع…</h1>
            <p className="mt-2 text-body-md text-on-surface-variant">ثواني وهيتأكد حجزك. متقفلش الصفحة.</p>
          </>
        )}
        {p.status === 'succeeded' && (
          <>
            <div className="mx-auto grid size-24 animate-pop place-items-center rounded-full bg-success-container text-on-success-container">
              <CheckCircle2 className="size-12" />
            </div>
            <h1 className="mt-6 text-headline-lg">حجزك اتأكد! 🎉</h1>
            <p className="mt-2 text-body-lg text-on-surface-variant">مكانك في «{p.lectureTitle}» محجوز. وصلك إيميل بالتفاصيل، ووصل لولي أمرك كمان.</p>
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
            <h1 className="mt-6 text-headline-md">{p.status === 'refunded' ? 'المبلغ اترجع' : 'الدفع ماتمّش'}</h1>
            <p className="mt-2 text-body-md text-on-surface-variant">مخصمناش منك حاجة. جرّب تاني أو استخدم وسيلة دفع تانية.</p>
            <Button size="lg" block className="mt-6" onClick={() => navigate(`/lectures/${p.lectureId}`, { replace: true })}>
              جرّب تاني
            </Button>
          </>
        )}
        {p.status === 'pending' && Date.now() - since > 120_000 && (
          <Banner tone="warning" className="mt-6 text-start">
            الدفع واخد وقت أكتر من العادي. لو اتخصم منك، الحجز هيتأكد لوحده أول ما البنك يرد.
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
