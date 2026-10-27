import { useState } from 'react';
import { ArrowDownToLine, ArrowUpFromLine, Clock, Info, RotateCcw, Wallet as WalletIcon } from 'lucide-react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { MIN_PAYOUT_CENTS, PAYOUT_METHOD_LABELS, PAYOUT_METHODS, payoutRequestSchema, type PayoutMethod, type WalletDTO, type WalletEntryDTO } from '@workspace/live-core';
import { api, errorMessage } from '@/lib/api';
import { cn } from '@/lib/cn';
import { fmtDateTime, money } from '@/lib/format';
import { Badge, Banner, Button, Card, EmptyState, List, ListItem, Page, PageSpinner, Segmented, Select, Sheet, TextField, TopBar, toast } from '@/ui';

const ENTRY: Record<WalletEntryDTO['kind'], { label: string; icon: React.ReactNode; cls: string }> = {
  sale: { label: 'حجز', icon: <ArrowDownToLine />, cls: 'bg-success-container text-on-success-container' },
  commission: { label: 'عمولة', icon: <Info />, cls: 'bg-surface-container-high text-on-surface-variant' },
  payout: { label: 'سحب', icon: <ArrowUpFromLine />, cls: 'bg-secondary-container text-on-secondary-container' },
  refund: { label: 'استرجاع', icon: <RotateCcw />, cls: 'bg-error-container text-on-error-container' },
  adjustment: { label: 'تسوية', icon: <Info />, cls: 'bg-surface-container-high text-on-surface-variant' },
};

export function WalletPage() {
  const qc = useQueryClient();
  const q = useQuery({ queryKey: ['wallet'], queryFn: () => api<WalletDTO>('/wallet') });
  const [tab, setTab] = useState<'moves' | 'payouts'>('moves');
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState<{ amount: string; method: PayoutMethod; account: string }>({ amount: '', method: 'instapay', account: '' });
  const [error, setError] = useState<string | null>(null);
  const request = useMutation({
    mutationFn: (body: unknown) => api<WalletDTO>('/wallet/payouts', { body }),
    onSuccess: (w) => {
      qc.setQueryData(['wallet'], w);
      qc.invalidateQueries({ queryKey: ['teacher-dashboard'] });
      setOpen(false);
      setTab('payouts');
      toast('طلب السحب وصل، هيتحوّل خلال يومين عمل');
    },
    onError: (e) => setError(errorMessage(e)),
  });
  if (q.isPending) return <PageSpinner />;
  const w = q.data!;
  const feePct = w.feeBps / 100;

  const submit = () => {
    const body = { amountCents: Math.round(Number(form.amount) * 100), method: form.method, account: form.account };
    const v = payoutRequestSchema.safeParse(body);
    if (!v.success) return setError(v.error.issues[0]?.message ?? null);
    if (body.amountCents > w.availableCents) return setError('المبلغ أكبر من رصيدك المتاح');
    setError(null);
    request.mutate(body);
  };

  return (
    <>
      <TopBar title="المحفظة" large />
      <Page>
        <Card variant="ink" pad="lg" className="relative overflow-hidden rounded-xl">
          <div className="pointer-events-none absolute -top-16 -left-10 size-56 rounded-full bg-gradient-brand opacity-40 blur-3xl" aria-hidden="true" />
          <div className="relative">
            <p className="text-body-md text-white/70">متاح للسحب</p>
            <p className="mt-1 font-num text-display-md">{money(w.availableCents)}</p>
            <div className="mt-4 flex flex-wrap gap-x-6 gap-y-1 text-body-md text-white/75">
              <span className="inline-flex items-center gap-1.5">
                <Clock className="size-4" /> معلّق <span className="font-num text-white">{money(w.pendingCents)}</span>
              </span>
              <span>
                إجمالي دخلك <span className="font-num text-white">{money(w.lifetimeCents)}</span>
              </span>
            </div>
            <Button
              size="lg"
              className="mt-6 bg-white text-black shadow-none"
              disabled={w.availableCents < MIN_PAYOUT_CENTS}
              onClick={() => {
                setForm({ ...form, amount: String(w.availableCents / 100) });
                setError(null);
                setOpen(true);
              }}
            >
              <ArrowUpFromLine /> اسحب فلوسك
            </Button>
          </div>
        </Card>
        <p className="mt-3 flex gap-2 text-body-sm text-on-surface-variant">
          <Info className="mt-0.5 size-4 shrink-0" />
          فلوس كل حصة بتبقى متاحة بعد ما الحصة تخلص بيوم (عشان لو حصلت مشكلة نقدر نرجّع للطالب). عمولة المنصة {feePct}% من سعر الحصة.
        </p>

        <Segmented
          className="mt-6 mb-4 max-w-sm"
          value={tab}
          onChange={setTab}
          options={[
            { value: 'moves', label: 'الحركات' },
            { value: 'payouts', label: 'السحوبات' },
          ]}
        />
        {tab === 'moves' &&
          (w.entries.length === 0 ? (
            <EmptyState icon={<WalletIcon />} title="مفيش حركات لسه" body="أول ما طالب يحجز حصة مدفوعة، فلوسك هتظهر هنا." />
          ) : (
            <List>
              {w.entries.map((e) => {
                const meta = ENTRY[e.kind];
                return (
                  <ListItem
                    key={e.id}
                    leading={<span className={cn('grid size-11 place-items-center rounded-full [&_svg]:size-5', meta.cls)}>{meta.icon}</span>}
                    title={e.kind === 'payout' ? 'سحب' : (e.lectureTitle ?? meta.label)}
                    subtitle={`${meta.label} · ${fmtDateTime(e.createdAt)}`}
                    trailing={
                      <div className="flex flex-col items-end gap-1">
                        <span className={cn('font-num text-title-sm', e.amountCents < 0 ? 'text-on-surface' : 'text-success', e.status === 'void' && 'line-through opacity-50')}>
                          {e.amountCents > 0 ? '+' : '−'}
                          {money(Math.abs(e.amountCents))}
                        </span>
                        {e.status === 'pending' && <Badge tone="warning">معلّق</Badge>}
                        {e.status === 'void' && <Badge>اتلغى</Badge>}
                      </div>
                    }
                  />
                );
              })}
            </List>
          ))}
        {tab === 'payouts' &&
          (w.payouts.length === 0 ? (
            <EmptyState icon={<ArrowUpFromLine />} title="مسحبتش فلوس لسه" body={`تقدر تسحب أول ما رصيدك المتاح يوصل ${money(MIN_PAYOUT_CENTS)}.`} />
          ) : (
            <List>
              {w.payouts.map((p) => (
                <ListItem
                  key={p.id}
                  leading={<span className="grid size-11 place-items-center rounded-full bg-secondary-container text-on-secondary-container [&_svg]:size-5"><ArrowUpFromLine /></span>}
                  title={<span className="font-num">{money(p.amountCents)}</span>}
                  subtitle={`${PAYOUT_METHOD_LABELS[p.method]} · ${fmtDateTime(p.createdAt)}${p.adminNote ? ` · ${p.adminNote}` : ''}`}
                  trailing={<Badge tone={p.status === 'paid' ? 'success' : p.status === 'rejected' ? 'error' : 'warning'}>{p.status === 'paid' ? 'اتحوّل' : p.status === 'rejected' ? 'اترفض' : 'قيد التنفيذ'}</Badge>}
                />
              ))}
            </List>
          ))}
      </Page>
      <Sheet
        open={open}
        onOpenChange={setOpen}
        title="اسحب فلوسك"
        description={`متاح ${money(w.availableCents)}`}
        footer={
          <Button block size="lg" loading={request.isPending} onClick={submit}>
            اطلب السحب
          </Button>
        }
      >
        <div className="flex flex-col gap-4">
          {error && <Banner tone="error">{error}</Banner>}
          <TextField label="المبلغ" type="number" inputMode="decimal" ltr value={form.amount} onChange={(e) => setForm({ ...form, amount: e.target.value })} trailing={<span className="px-3 text-body-md text-on-surface-variant">ج.م</span>} />
          <Select label="هتستلم على" value={form.method} onChange={(e) => setForm({ ...form, method: e.target.value as PayoutMethod })} options={PAYOUT_METHODS.map((m) => ({ value: m, label: PAYOUT_METHOD_LABELS[m] }))} />
          <TextField
            label={form.method === 'bank' ? 'رقم الحساب (IBAN) واسم البنك' : form.method === 'instapay' ? 'عنوان InstaPay أو رقم الموبايل' : 'رقم المحفظة'}
            ltr={form.method !== 'bank'}
            value={form.account}
            onChange={(e) => setForm({ ...form, account: e.target.value })}
          />
        </div>
      </Sheet>
    </>
  );
}
