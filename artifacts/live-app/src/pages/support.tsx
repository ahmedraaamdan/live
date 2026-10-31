import { useState } from 'react';
import { LifeBuoy, Plus, Send } from 'lucide-react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { ROLE_LABELS, TICKET_CATEGORY_LABELS, TICKET_STATUS_LABELS, ticketInputSchema, type TicketCategory, type TicketDetailDTO, type TicketDTO, type TicketStatus } from '@workspace/live-core';
import { QueryError } from '@/components/query-error';
import { api, errorMessage } from '@/lib/api';
import { cn } from '@/lib/cn';
import { fmtDateTime, fmtRelative } from '@/lib/format';
import { useMe } from '@/lib/session';
import { Avatar, Badge, Banner, Button, Card, EmptyState, Fab, List, ListItem, Page, PageSpinner, Select, Sheet, TextArea, TextField, TopBar, toast } from '@/ui';

const categoryOptions = (Object.keys(TICKET_CATEGORY_LABELS) as TicketCategory[]).map((value) => ({ value, label: TICKET_CATEGORY_LABELS[value] }));
const statusTone: Record<TicketStatus, 'warning' | 'success' | 'neutral'> = { open: 'warning', answered: 'success', closed: 'neutral' };

function StatusBadge({ status }: { status: TicketStatus }) {
  return <Badge tone={statusTone[status]}>{TICKET_STATUS_LABELS[status]}</Badge>;
}

function NewTicketSheet({ open, onOpenChange }: { open: boolean; onOpenChange: (open: boolean) => void }) {
  const qc = useQueryClient();
  const [form, setForm] = useState({ category: '', subject: '', body: '' });
  const [error, setError] = useState<string | null>(null);
  const send = useMutation({
    mutationFn: () => api<TicketDTO>('/tickets', { body: form }),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ['tickets'] });
      setForm({ category: '', subject: '', body: '' });
      setError(null);
      onOpenChange(false);
      toast('وصلتنا رسالتك، وسنرد عليك هنا');
    },
    onError: (e) => setError(errorMessage(e)),
  });
  const submit = () => {
    const valid = ticketInputSchema.safeParse(form);
    if (!valid.success) return setError(valid.error.issues[0]?.message ?? null);
    setError(null);
    send.mutate();
  };
  return (
    <Sheet
      open={open}
      onOpenChange={onOpenChange}
      title="كيف يمكننا مساعدتك؟"
      description="تصل رسالتك إلى فريق الإدارة، ويظهر الرد هنا وعلى بريدك الإلكتروني."
      footer={
        <Button block loading={send.isPending} onClick={submit}>
          <Send /> إرسال
        </Button>
      }
    >
      <div className="flex flex-col gap-4">
        {error && <Banner tone="error">{error}</Banner>}
        <Select label="الموضوع" value={form.category} onChange={(e) => setForm({ ...form, category: e.target.value })} placeholder="اختر نوع المشكلة" options={categoryOptions} />
        <TextField label="عنوان مختصر" value={form.subject} maxLength={120} onChange={(e) => setForm({ ...form, subject: e.target.value })} />
        <TextArea label="التفاصيل" value={form.body} rows={5} maxLength={4000} onChange={(e) => setForm({ ...form, body: e.target.value })} hint="اذكر اسم الحصة أو رقم العملية إن وجد." />
      </div>
    </Sheet>
  );
}

export function SupportList() {
  const q = useQuery({ queryKey: ['tickets'], queryFn: () => api<TicketDTO[]>('/tickets') });
  const [open, setOpen] = useState(false);
  return (
    <>
      <TopBar title="الدعم" large subtitle="اسأل فريق الإدارة وتابع الرد من هنا" back />
      <Page>
        {q.isError ? (
          <QueryError error={q.error} retry={q.refetch} />
        ) : q.isPending ? (
          <PageSpinner />
        ) : q.data.length === 0 ? (
          <EmptyState icon={<LifeBuoy />} title="لا توجد تذاكر بعد" body="لديك سؤال أو مشكلة؟ أرسل لنا تذكرة وسنرد عليك هنا." action={<Button onClick={() => setOpen(true)}>إرسال تذكرة</Button>} />
        ) : (
          <List>
            {q.data.map((t) => (
              <ListItem key={t.id} href={`/support/${t.id}`} chevron title={t.subject} subtitle={`${TICKET_CATEGORY_LABELS[t.category]} · ${fmtRelative(t.updatedAt)}`} trailing={<StatusBadge status={t.status} />} />
            ))}
          </List>
        )}
      </Page>
      {q.data && q.data.length > 0 && (
        <Fab label="تذكرة جديدة" onClick={() => setOpen(true)}>
          <Plus />
        </Fab>
      )}
      <NewTicketSheet open={open} onOpenChange={setOpen} />
    </>
  );
}

export function TicketThread({ id }: { id: string }) {
  const me = useMe();
  const qc = useQueryClient();
  const [reply, setReply] = useState('');
  const q = useQuery({ queryKey: ['ticket', id], queryFn: () => api<TicketDetailDTO>(`/tickets/${id}`), refetchInterval: 30_000 });
  const done = (updated: TicketDetailDTO) => {
    qc.setQueryData(['ticket', id], updated);
    void qc.invalidateQueries({ queryKey: ['tickets'] });
    void qc.invalidateQueries({ queryKey: ['admin-tickets'] });
  };
  const send = useMutation({
    mutationFn: () => api<TicketDetailDTO>(`/tickets/${id}/messages`, { body: { body: reply } }),
    onSuccess: (updated) => {
      setReply('');
      done(updated);
    },
    onError: (e) => toast(errorMessage(e)),
  });
  const close = useMutation({ mutationFn: () => api<TicketDetailDTO>(`/tickets/${id}/close`, { method: 'POST' }), onSuccess: done, onError: (e) => toast(errorMessage(e)) });
  if (q.isPending) return <PageSpinner />;
  if (!q.data) return <><TopBar title="التذكرة" back /><Page><QueryError error={q.error} retry={q.refetch} /></Page></>;
  const t = q.data;
  const asAdmin = me.user.role === 'admin';
  return (
    <>
      <TopBar title="التذكرة" back />
      <Page>
        <div className="mb-5 flex flex-wrap items-start justify-between gap-3">
          <div className="min-w-0">
            <h1 className="text-headline-sm">{t.subject}</h1>
            <p className="mt-1 text-body-sm text-on-surface-variant">{TICKET_CATEGORY_LABELS[t.category]}{t.user ? ` · ${t.user.name} (${ROLE_LABELS[t.user.role]}) · ${t.user.email}` : ''}</p>
          </div>
          <StatusBadge status={t.status} />
        </div>
        <div className="mb-6 flex flex-col gap-3">
          {t.messages.map((m) => {
            const mine = m.fromAdmin === asAdmin;
            return (
              <div key={m.id} className={cn('flex gap-3', mine ? 'flex-row-reverse' : '')}>
                <Avatar name={m.author.name} src={m.author.avatarUrl} size="sm" />
                <Card variant={mine ? 'filled' : 'outlined'} pad="sm" className="min-w-0 max-w-[85%]">
                  <p className="text-label-md text-on-surface-variant">{m.author.name} · {fmtDateTime(m.createdAt)}</p>
                  <p className="mt-1 whitespace-pre-wrap text-body-md" data-allow-copy>{m.body}</p>
                </Card>
              </div>
            );
          })}
        </div>
        {t.status === 'closed' ? (
          <Banner tone="info" title="أُغلقت هذه التذكرة">إذا احتجت إلى مساعدة أخرى، أرسل تذكرة جديدة.</Banner>
        ) : (
          <div className="flex flex-col gap-3">
            <TextArea label={asAdmin ? 'ردك على المستخدم' : 'أضف ردًا'} value={reply} rows={3} maxLength={4000} onChange={(e) => setReply(e.target.value)} />
            <div className="flex flex-wrap gap-2">
              <Button loading={send.isPending} disabled={!reply.trim()} onClick={() => send.mutate()}>
                <Send /> إرسال
              </Button>
              <Button variant="text" loading={close.isPending} onClick={() => close.mutate()}>
                إغلاق التذكرة
              </Button>
            </div>
          </div>
        )}
      </Page>
    </>
  );
}

export function AdminTickets() {
  const q = useQuery({ queryKey: ['admin-tickets'], queryFn: () => api<TicketDTO[]>('/admin/tickets'), refetchInterval: 60_000 });
  return (
    <>
      <TopBar title="تذاكر الدعم" large />
      <Page>
        {q.isError ? (
          <QueryError error={q.error} retry={q.refetch} />
        ) : q.isPending ? (
          <PageSpinner />
        ) : q.data.length === 0 ? (
          <EmptyState icon={<LifeBuoy />} title="لا توجد تذاكر" />
        ) : (
          <List>
            {q.data.map((t) => (
              <ListItem
                key={t.id}
                href={`/support/${t.id}`}
                chevron
                leading={<Avatar name={t.user?.name ?? ''} src={t.user?.avatarUrl} size="sm" />}
                title={t.subject}
                subtitle={`${t.user?.name ?? ''}${t.user ? ` (${ROLE_LABELS[t.user.role]})` : ''} · ${TICKET_CATEGORY_LABELS[t.category]} · ${fmtRelative(t.updatedAt)}`}
                trailing={<StatusBadge status={t.status} />}
              />
            ))}
          </List>
        )}
      </Page>
    </>
  );
}
