import { useMemo, useState, type ReactNode } from 'react';
import { useLocation } from 'wouter';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { ArrowDown, ArrowUp, CheckCircle2, ChevronLeft, ChevronRight, Copy, Download, Eye, FileCheck2, KeyRound, LogIn, MessageCircle, MoreVertical, RotateCcw, Search, ShieldOff, Trash2, Users, XCircle } from 'lucide-react';
import { ACTIVE_TEACHER_MIN_STUDENTS, DELETE_CONFIRM_WORD, LECTURE_STATUS_LABELS, ROLE_LABELS, USER_STEP_LABELS, type AdminUserDTO, type AdminUserDetailDTO, type AdminUsersBulkResult, type BookingStatus, type Role, type UserStepKey } from '@workspace/live-core';
import { QueryError } from '@/components/query-error';
import { api, apiUrl, authHeaders, errorMessage } from '@/lib/api';
import { cn } from '@/lib/cn';
import { fmtDateTime, fmtShortDate, money } from '@/lib/format';
import { homePath, useMe, useSession } from '@/lib/session';
import { ActionMenu, Avatar, Badge, Banner, Button, Chip, EmptyState, IconButton, Page, PageSpinner, Select, Sheet, TextField, TopBar, toast } from '@/ui';

const PAGE_SIZE = 50;
const ACTIVE_TARGET = 100;
const STEP_ORDER = Object.keys(USER_STEP_LABELS) as UserStepKey[];
const VERIFICATION: Record<NonNullable<AdminUserDTO['verification']>, { label: string; tone: 'success' | 'warning' | 'error' | 'primary' | undefined }> = {
  not_submitted: { label: 'لم يُرسل', tone: undefined },
  pending: { label: 'قيد المراجعة', tone: 'warning' },
  approved: { label: 'موثّق', tone: 'success' },
  rejected: { label: 'مرفوض', tone: 'error' },
  needs_changes: { label: 'يحتاج تعديل', tone: 'warning' },
};

const BOOKING_STATUS_LABELS: Record<BookingStatus, string> = { pending_payment: 'مستني الدفع', confirmed: 'مؤكد', cancelled: 'ملغي', refunded: 'مسترد' };

type SortKey = 'name' | 'role' | 'phone' | 'email' | 'step' | 'verification' | 'lastSeenAt' | 'createdAt' | 'lectures' | 'bookings' | 'balanceCents' | 'suspended';

const sortValue: Record<SortKey, (u: AdminUserDTO) => string | number> = {
  name: (u) => u.name,
  role: (u) => ROLE_LABELS[u.role],
  phone: (u) => u.phone ?? '',
  email: (u) => u.email,
  step: (u) => STEP_ORDER.indexOf(u.step.key),
  verification: (u) => u.verification ?? '',
  lastSeenAt: (u) => (u.lastSeenAt ? new Date(u.lastSeenAt).getTime() : 0),
  createdAt: (u) => new Date(u.createdAt).getTime(),
  lectures: (u) => u.lectures,
  bookings: (u) => u.bookings,
  balanceCents: (u) => u.balanceCents,
  suspended: (u) => (u.suspended ? 1 : 0),
};

async function copy(text: string, done: string) {
  try {
    await navigator.clipboard.writeText(text);
    toast(done);
  } catch {
    toast('المتصفح منع النسخ. حدد النص وانسخه بنفسك.');
  }
}

function whatsappUrl(phone: string) {
  const digits = phone.replace(/\D/g, '');
  return `https://wa.me/${digits.startsWith('0') ? `2${digits}` : digits}`;
}

/** The file comes from the API, which needs the session token, so a plain link can't fetch it. */
async function downloadUsers(ids?: string[]) {
  const response = await fetch(apiUrl('/admin/users/export'), { method: 'POST', headers: { ...authHeaders(), 'Content-Type': 'application/json' }, body: JSON.stringify(ids ? { ids } : {}) });
  if (!response.ok) throw new Error('تعذر تجهيز الملف. جرّب تاني.');
  const url = URL.createObjectURL(await response.blob());
  const link = document.createElement('a');
  link.href = url;
  link.download = `gahez-live-users-${new Date().toISOString().slice(0, 10)}.xlsx`;
  document.body.append(link);
  link.click();
  link.remove();
  setTimeout(() => URL.revokeObjectURL(url), 10_000);
}

function HeaderCell({ label, column, sort, onSort, className }: { label: string; column: SortKey; sort: { key: SortKey; dir: 1 | -1 }; onSort: (key: SortKey) => void; className?: string }) {
  const active = sort.key === column;
  return (
    <th scope="col" className={className} aria-sort={active ? (sort.dir === 1 ? 'ascending' : 'descending') : 'none'}>
      <button type="button" onClick={() => onSort(column)}>
        {label}
        {active && (sort.dir === 1 ? <ArrowUp aria-hidden="true" /> : <ArrowDown aria-hidden="true" />)}
      </button>
    </th>
  );
}

function PhoneCell({ phone }: { phone: string | null }) {
  if (!phone) return <span className="users-empty">لا يوجد</span>;
  return (
    <span className="users-phone">
      <span dir="ltr" className="font-num">{phone}</span>
      <a href={whatsappUrl(phone)} target="_blank" rel="noopener noreferrer" aria-label={`واتساب ${phone}`} title="واتساب"><MessageCircle /></a>
    </span>
  );
}

function UserDetails({ id, onClose, onSwitch, canSwitch, onReset }: { id: string; onClose: () => void; onSwitch: (user: AdminUserDTO) => void; canSwitch: boolean; onReset: (user: AdminUserDTO) => void }) {
  const [, navigate] = useLocation();
  const me = useMe();
  const q = useQuery({ queryKey: ['admin-user', id], queryFn: () => api<AdminUserDetailDTO>(`/admin/users/${id}`) });
  const d = q.data;
  const u = d?.user;
  return (
    <Sheet open onOpenChange={(open) => !open && onClose()} title={u?.name ?? 'بيانات المستخدم'} description={u ? `${ROLE_LABELS[u.role]}${u.detail ? ` · ${u.detail}` : ''}` : undefined} className="users-details">
      {q.isPending && <PageSpinner />}
      {q.isError && <QueryError error={q.error} retry={q.refetch} />}
      {u && d && (
        <div className="flex flex-col gap-6" data-allow-copy>
          <dl className="users-facts">
            <div><dt>الموبايل</dt><dd><PhoneCell phone={u.phone} /></dd></div>
            <div><dt>الإيميل</dt><dd dir="ltr">{u.email}</dd></div>
            <div><dt>التسجيل</dt><dd>{fmtDateTime(u.createdAt)}</dd></div>
            <div><dt>آخر دخول</dt><dd>{u.lastSeenAt ? fmtDateTime(u.lastSeenAt) : 'لسه'}</dd></div>
            <div><dt>الجهاز</dt><dd>{u.device ?? 'غير معروف'}</dd></div>
            <div><dt>الحالة</dt><dd>{u.suspended ? 'موقوف' : 'شغال'}</dd></div>
            {u.role === 'teacher' && <div><dt>الرصيد</dt><dd className="font-num">{money(u.balanceCents)}</dd></div>}
            {u.role === 'teacher' && <div><dt>مدرس نشط</dt><dd>{u.active ? 'نعم' : `لسه (حصة مدفوعة لـ${ACTIVE_TEACHER_MIN_STUDENTS} طلاب في آخر 30 يوم)`}</dd></div>}
          </dl>
          <div className="flex flex-wrap gap-2">
            {u.phone && <Button size="sm" variant="tonal" onClick={() => void copy(u.phone!, 'اتنسخ الموبايل')}><Copy /> نسخ الموبايل</Button>}
            <Button size="sm" variant="tonal" onClick={() => void copy(u.email, 'اتنسخ الإيميل')}><Copy /> نسخ الإيميل</Button>
            {canSwitch && u.id !== me.user.id && <Button size="sm" variant="tonal" onClick={() => onSwitch(u)}><LogIn /> ادخل على حسابه</Button>}
            {me.isSuperAdmin && u.role === 'teacher' && u.verification !== 'not_submitted' && <Button size="sm" variant="tonal" onClick={() => navigate(`/admin/teacher-verifications/${u.id}`)}><FileCheck2 /> طلب التوثيق</Button>}
            <Button size="sm" variant="tonal" onClick={() => onReset(u)}><KeyRound /> رابط تغيير كلمة السر</Button>
          </div>
          <section>
            <h3 className="mb-2 text-title-md">الخطوات اللي عملها</h3>
            <ol className="users-timeline">
              {d.timeline.map((step) => <li key={step.key}><span>{USER_STEP_LABELS[step.key]}</span><time>{fmtDateTime(step.at)}</time></li>)}
            </ol>
          </section>
          {d.security && (
            <section>
              <h3 className="mb-2 text-title-md">حماية الحساب</h3>
              <ul className="users-flags">
                <li>{d.security.mfaEnabled ? <CheckCircle2 /> : <XCircle />} المصادقة الثنائية</li>
                <li>{d.security.google ? <CheckCircle2 /> : <XCircle />} Google{d.security.google ? `: ${d.security.google}` : ''}</li>
                <li>{d.security.facebook ? <CheckCircle2 /> : <XCircle />} فيسبوك{d.security.facebook ? `: ${d.security.facebook}` : ''}</li>
              </ul>
            </section>
          )}
          {d.lectures.length > 0 && (
            <section>
              <h3 className="mb-2 text-title-md">آخر الحصص</h3>
              <ul className="users-mini-list">
                {d.lectures.map((l) => <li key={l.id}><button type="button" onClick={() => navigate(`/lectures/${l.id}`)}>{l.title}</button><span>{LECTURE_STATUS_LABELS[l.status]} · {fmtShortDate(l.startsAt)} · {l.priceCents ? money(l.priceCents) : 'مجانية'} · {l.bookings} حجز</span></li>)}
              </ul>
            </section>
          )}
          {d.bookings.length > 0 && (
            <section>
              <h3 className="mb-2 text-title-md">آخر الحجوزات</h3>
              <ul className="users-mini-list">
                {d.bookings.map((b) => <li key={`${b.lectureId}-${b.createdAt}`}><button type="button" onClick={() => navigate(`/lectures/${b.lectureId}`)}>{b.title}</button><span>{BOOKING_STATUS_LABELS[b.status]} · {b.pricePaidCents ? money(b.pricePaidCents) : 'مجانية'} · {fmtShortDate(b.createdAt)}</span></li>)}
              </ul>
            </section>
          )}
          {d.sessions.length > 0 && (
            <section>
              <h3 className="mb-2 text-title-md">آخر الدخول</h3>
              <ul className="users-mini-list">
                {d.sessions.map((s) => <li key={s.at}><span>{s.device}{s.support ? ' · تبديل حساب من الإدارة' : ''}</span><span>{fmtDateTime(s.at)}</span></li>)}
              </ul>
            </section>
          )}
        </div>
      )}
    </Sheet>
  );
}

export function AdminUsers() {
  const me = useMe();
  const session = useSession();
  const [, navigate] = useLocation();
  const qc = useQueryClient();
  const owner = Boolean(me.isSuperAdmin);
  const q = useQuery({ queryKey: ['admin-users'], queryFn: () => api<AdminUserDTO[]>('/admin/users') });
  const [role, setRole] = useState<Role | ''>('');
  const [status, setStatus] = useState('');
  const [step, setStep] = useState('');
  const [search, setSearch] = useState('');
  const [sort, setSort] = useState<{ key: SortKey; dir: 1 | -1 }>({ key: 'createdAt', dir: -1 });
  const [page, setPage] = useState(0);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [details, setDetails] = useState<string | null>(null);
  const [removing, setRemoving] = useState<AdminUserDTO[] | null>(null);
  const [confirmWord, setConfirmWord] = useState('');
  const [report, setReport] = useState<AdminUsersBulkResult['results'] | null>(null);
  const [exporting, setExporting] = useState(false);

  const all = useMemo(() => q.data ?? [], [q.data]);
  const counts = useMemo(() => {
    const byRole: Record<string, number> = { '': all.length };
    for (const u of all) byRole[u.role] = (byRole[u.role] ?? 0) + 1;
    return byRole;
  }, [all]);
  const teachers = useMemo(() => all.filter((u) => u.role === 'teacher'), [all]);
  const rows = useMemo(() => {
    const needle = search.trim().toLowerCase();
    const filtered = all.filter((u) => (!role || u.role === role) && (!status || (status === 'suspended') === u.suspended) && (!step || u.step.key === step) && (!needle || `${u.name} ${u.email} ${u.phone ?? ''}`.toLowerCase().includes(needle)));
    const value = sortValue[sort.key];
    return [...filtered].sort((a, b) => {
      const x = value(a), y = value(b);
      return (typeof x === 'number' && typeof y === 'number' ? x - y : String(x).localeCompare(String(y), 'ar')) * sort.dir;
    });
  }, [all, role, status, step, search, sort]);
  const pages = Math.max(1, Math.ceil(rows.length / PAGE_SIZE));
  const current = Math.min(page, pages - 1);
  const visible = rows.slice(current * PAGE_SIZE, (current + 1) * PAGE_SIZE);
  const chosen = useMemo(() => all.filter((u) => selected.has(u.id)), [all, selected]);
  const allChosen = rows.length > 0 && rows.every((u) => selected.has(u.id));
  const filtering = Boolean(role || status || step || search.trim());
  const stepsInUse = useMemo(() => STEP_ORDER.filter((key) => all.some((u) => u.step.key === key && (!role || u.role === role))), [all, role]);

  const refresh = () => {
    void qc.invalidateQueries({ queryKey: ['admin-users'] });
    void qc.invalidateQueries({ queryKey: ['admin-user'] });
    void qc.invalidateQueries({ queryKey: ['admin-overview'] });
  };
  const bulk = useMutation({
    mutationFn: (body: { action: 'suspend' | 'restore' | 'delete'; ids: string[]; confirm?: string }) => api<AdminUsersBulkResult>('/admin/users/bulk', { body }),
    onSuccess: ({ results }) => {
      refresh();
      setRemoving(null);
      setConfirmWord('');
      setSelected(new Set());
      const skipped = results.filter((r) => r.outcome === 'skipped');
      const done = results.length - skipped.length;
      if (skipped.length) setReport(results);
      else toast(`اتنفّذ على ${done} ${done === 1 ? 'حساب' : 'حسابات'}`);
    },
    onError: (e) => toast(errorMessage(e)),
  });
  const reset = useMutation({
    mutationFn: (user: AdminUserDTO) => api(`/admin/users/${user.id}/password-reset`, { body: {} }),
    onSuccess: () => toast('اتبعت له رابط تغيير كلمة السر على إيميله'),
    onError: (e) => toast(errorMessage(e)),
  });

  const changeSort = (key: SortKey) => {
    setPage(0);
    setSort((s) => (s.key === key ? { key, dir: s.dir === 1 ? -1 : 1 } : { key, dir: key === 'createdAt' || key === 'lastSeenAt' ? -1 : 1 }));
  };
  const toggle = (id: string) => setSelected((s) => {
    const next = new Set(s);
    if (next.has(id)) next.delete(id);
    else next.add(id);
    return next;
  });
  const toggleAll = () => setSelected((s) => {
    const next = new Set(s);
    for (const u of rows) {
      if (allChosen) next.delete(u.id);
      else next.add(u.id);
    }
    return next;
  });
  const exportUsers = async (ids?: string[]) => {
    setExporting(true);
    try {
      await downloadUsers(ids);
      toast('نزل ملف Excel');
    } catch (e) {
      toast(errorMessage(e));
    } finally {
      setExporting(false);
    }
  };
  const switchInto = async (user: AdminUserDTO) => {
    try {
      const target = await session.switchAccount(user.id);
      navigate(homePath(target.user.role));
    } catch (e) {
      toast(errorMessage(e));
    }
  };
  const copyPhones = (users: AdminUserDTO[]) => {
    const phones = users.map((u) => u.phone).filter(Boolean);
    if (phones.length) void copy(phones.join('\n'), `اتنسخ ${phones.length} رقم`);
    else toast('مفيش أرقام في المحددين');
  };

  const rowMenu = (u: AdminUserDTO) => {
    const items: Array<{ label: string; icon: ReactNode; onSelect: () => void; danger?: boolean }> = [{ label: 'التفاصيل', icon: <Eye />, onSelect: () => setDetails(u.id) }];
    if (u.phone) items.push({ label: 'نسخ الموبايل', icon: <Copy />, onSelect: () => void copy(u.phone!, 'اتنسخ الموبايل') });
    items.push({ label: 'نسخ الإيميل', icon: <Copy />, onSelect: () => void copy(u.email, 'اتنسخ الإيميل') });
    if (owner && u.id !== me.user.id) items.push({ label: 'ادخل على حسابه', icon: <LogIn />, onSelect: () => void switchInto(u) });
    if (owner && u.role === 'teacher' && u.verification !== 'not_submitted') items.push({ label: 'طلب التوثيق', icon: <FileCheck2 />, onSelect: () => navigate(`/admin/teacher-verifications/${u.id}`) });
    items.push({ label: 'رابط تغيير كلمة السر', icon: <KeyRound />, onSelect: () => reset.mutate(u) });
    if (u.id !== me.user.id) items.push(u.suspended ? { label: 'إعادة التفعيل', icon: <RotateCcw />, onSelect: () => bulk.mutate({ action: 'restore', ids: [u.id] }) } : { label: 'إيقاف', icon: <ShieldOff />, onSelect: () => bulk.mutate({ action: 'suspend', ids: [u.id] }) });
    if (owner && u.id !== me.user.id) items.push({ label: 'حذف', icon: <Trash2 />, danger: true, onSelect: () => setRemoving([u]) });
    return items;
  };

  return (
    <>
      <TopBar title="المستخدمين" large subtitle={q.data ? `${all.length} حساب` : undefined} />
      <Page wide className={cn('users-page', selected.size > 0 && 'has-selection')}>
        {q.isError ? <QueryError error={q.error} retry={q.refetch} /> : q.isPending ? <PageSpinner /> : (
          <>
            <div className="users-summary">
              <span><b>{teachers.length}</b> مدرس</span>
              <span><b>{teachers.filter((u) => u.verification === 'approved').length}</b> موثّق</span>
              <span><b>{teachers.filter((u) => u.lectures > 0).length}</b> عمل حصة</span>
              <span className="users-summary-goal"><b>{teachers.filter((u) => u.active).length}</b> نشط من {ACTIVE_TARGET}</span>
            </div>

            <div className="users-toolbar">
              <div className="scrollbar-none flex items-center gap-2 overflow-x-auto py-1">
                {(['', 'teacher', 'student', 'parent', 'admin'] as const).map((r) => (
                  <Chip key={r || 'all'} selected={role === r} onClick={() => { setRole(r); setStep(''); setPage(0); }}>
                    {r ? ROLE_LABELS[r] : 'الكل'} <span className="font-num">({counts[r] ?? 0})</span>
                  </Chip>
                ))}
              </div>
            </div>
            <div className="users-toolbar">
              <TextField containerClassName="users-search" aria-label="بحث" placeholder="دوّر بالاسم أو الإيميل أو الموبايل" value={search} onChange={(e) => { setSearch(e.target.value); setPage(0); }} trailing={<span className="grid place-items-center px-3 text-on-surface-variant [&_svg]:size-5"><Search /></span>} />
              <Select aria-label="آخر خطوة" value={step} onChange={(e) => { setStep(e.target.value); setPage(0); }} placeholder="" options={[{ value: '', label: 'كل الخطوات' }, ...stepsInUse.map((key) => ({ value: key, label: USER_STEP_LABELS[key] }))]} />
              <Select aria-label="الحالة" value={status} onChange={(e) => { setStatus(e.target.value); setPage(0); }} placeholder="" options={[{ value: '', label: 'كل الحالات' }, { value: 'active', label: 'شغال' }, { value: 'suspended', label: 'موقوف' }]} />
              {owner && (
                <Button variant="tonal" loading={exporting && selected.size === 0} onClick={() => void exportUsers(filtering ? rows.map((u) => u.id) : undefined)}>
                  <Download /> تصدير Excel ({filtering ? rows.length : all.length})
                </Button>
              )}
            </div>

            {selected.size > 0 && (
              <div className="users-bulk" role="region" aria-label="إجراءات المحددين">
                <strong><span className="font-num">{selected.size}</span> محدد</strong>
                <Button size="sm" variant="tonal" onClick={() => copyPhones(chosen)}><Copy /> نسخ الأرقام</Button>
                {owner && <Button size="sm" variant="tonal" loading={exporting} onClick={() => void exportUsers([...selected])}><Download /> تصدير</Button>}
                <Button size="sm" variant="tonal" disabled={bulk.isPending} onClick={() => bulk.mutate({ action: 'suspend', ids: [...selected] })}><ShieldOff /> إيقاف</Button>
                <Button size="sm" variant="tonal" disabled={bulk.isPending} onClick={() => bulk.mutate({ action: 'restore', ids: [...selected] })}><RotateCcw /> تفعيل</Button>
                {owner && <Button size="sm" variant="danger-text" onClick={() => setRemoving(chosen)}><Trash2 /> حذف</Button>}
                <Button size="sm" variant="text" onClick={() => setSelected(new Set())}>إلغاء التحديد</Button>
              </div>
            )}

            {rows.length === 0 ? (
              <EmptyState icon={<Users />} title="مفيش مستخدمين بالفلتر ده" body="غيّر البحث أو الفلتر." />
            ) : (
              <div className="users-sheet" data-allow-copy>
                <table className="users-table">
                  <thead>
                    <tr>
                      <th scope="col" className="users-col-check"><input type="checkbox" checked={allChosen} onChange={toggleAll} aria-label={`تحديد الكل (${rows.length})`} title={`تحديد الكل (${rows.length})`} /></th>
                      <HeaderCell label="الاسم" column="name" sort={sort} onSort={changeSort} className="users-col-name" />
                      <HeaderCell label="النوع" column="role" sort={sort} onSort={changeSort} />
                      <HeaderCell label="الموبايل" column="phone" sort={sort} onSort={changeSort} />
                      <HeaderCell label="الإيميل" column="email" sort={sort} onSort={changeSort} />
                      <HeaderCell label="آخر خطوة" column="step" sort={sort} onSort={changeSort} />
                      <HeaderCell label="التوثيق" column="verification" sort={sort} onSort={changeSort} />
                      <HeaderCell label="آخر دخول" column="lastSeenAt" sort={sort} onSort={changeSort} />
                      <HeaderCell label="التسجيل" column="createdAt" sort={sort} onSort={changeSort} />
                      <th scope="col">الجهاز</th>
                      <HeaderCell label="حصص" column="lectures" sort={sort} onSort={changeSort} />
                      <HeaderCell label="حجوزات" column="bookings" sort={sort} onSort={changeSort} />
                      <HeaderCell label="الرصيد" column="balanceCents" sort={sort} onSort={changeSort} />
                      <HeaderCell label="الحالة" column="suspended" sort={sort} onSort={changeSort} />
                      <th scope="col" className="users-col-menu"><span className="sr-only">إجراءات</span></th>
                    </tr>
                  </thead>
                  <tbody>
                    {visible.map((u) => (
                      <tr key={u.id} className={cn(selected.has(u.id) && 'is-selected', u.suspended && 'is-suspended')}>
                        <td className="users-col-check"><input type="checkbox" checked={selected.has(u.id)} onChange={() => toggle(u.id)} aria-label={`تحديد ${u.name}`} /></td>
                        <td className="users-col-name">
                          <button type="button" className="users-name" onClick={() => setDetails(u.id)}>
                            <Avatar name={u.name} src={u.avatarUrl} size="sm" />
                            <span dir="auto">{u.name}</span>
                            {u.active && <Badge tone="success">نشط</Badge>}
                          </button>
                        </td>
                        <td>{ROLE_LABELS[u.role]}</td>
                        <td><PhoneCell phone={u.phone} /></td>
                        <td dir="ltr" className="users-email">{u.email}</td>
                        <td title={fmtDateTime(u.step.at)}>{USER_STEP_LABELS[u.step.key]}</td>
                        <td>{u.verification ? <Badge tone={VERIFICATION[u.verification].tone}>{VERIFICATION[u.verification].label}</Badge> : <span className="users-empty">—</span>}</td>
                        <td className="font-num" title={u.lastSeenAt ? fmtDateTime(u.lastSeenAt) : undefined}>{u.lastSeenAt ? fmtShortDate(u.lastSeenAt) : <span className="users-empty">لسه</span>}</td>
                        <td className="font-num" title={fmtDateTime(u.createdAt)}>{fmtShortDate(u.createdAt)}</td>
                        <td>{u.device ?? <span className="users-empty">—</span>}</td>
                        <td className="font-num">{u.role === 'teacher' ? u.lectures : <span className="users-empty">—</span>}</td>
                        <td className="font-num">{u.role === 'student' ? u.bookings : <span className="users-empty">—</span>}</td>
                        <td className="font-num">{u.role === 'teacher' ? money(u.balanceCents) : <span className="users-empty">—</span>}</td>
                        <td>{u.suspended ? <Badge tone="error">موقوف</Badge> : <span>شغال</span>}</td>
                        <td className="users-col-menu"><ActionMenu trigger={<IconButton label={`إجراءات ${u.name}`} size="sm"><MoreVertical /></IconButton>} items={rowMenu(u)} /></td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}

            {rows.length > 0 && (
              <div className="users-pager">
                <span className="font-num">{current * PAGE_SIZE + 1}–{Math.min((current + 1) * PAGE_SIZE, rows.length)} من {rows.length}</span>
                <div className="flex gap-1">
                  <IconButton label="الصفحة السابقة" size="sm" disabled={current === 0} onClick={() => setPage(current - 1)}><ChevronRight /></IconButton>
                  <IconButton label="الصفحة التالية" size="sm" disabled={current >= pages - 1} onClick={() => setPage(current + 1)}><ChevronLeft /></IconButton>
                </div>
              </div>
            )}
          </>
        )}
      </Page>

      {details && <UserDetails id={details} onClose={() => setDetails(null)} canSwitch={owner} onSwitch={(u) => { setDetails(null); void switchInto(u); }} onReset={(u) => reset.mutate(u)} />}

      <Sheet
        open={Boolean(removing)}
        onOpenChange={(open) => { if (!open) { setRemoving(null); setConfirmWord(''); } }}
        title={removing?.length === 1 ? `حذف ${removing[0]!.name}؟` : `حذف ${removing?.length ?? 0} حساب؟`}
        description="الحذف مبيترجعش."
        footer={
          <>
            <Button variant="tonal" onClick={() => { setRemoving(null); setConfirmWord(''); }}>إلغاء</Button>
            <Button variant="danger" loading={bulk.isPending} disabled={confirmWord.trim() !== DELETE_CONFIRM_WORD} onClick={() => removing && bulk.mutate({ action: 'delete', ids: removing.map((u) => u.id), confirm: confirmWord.trim() })}>
              <Trash2 /> احذف نهائيًا
            </Button>
          </>
        }
      >
        <div className="flex flex-col gap-4">
          {removing && removing.length > 1 && <p className="text-body-md">{removing.slice(0, 5).map((u) => u.name).join('، ')}{removing.length > 5 ? ` و${removing.length - 5} كمان` : ''}</p>}
          <Banner tone="warning">
            الحساب اللي مالوش حصص ولا فلوس بيتمسح بالكامل. واللي له سجل بتتمسح بياناته الشخصية ويتحرر إيميله، ويفضل سجل الحصص والفلوس من غير اسمه. الحساب اللي عليه رصيد أو حصة مدفوعة جاية مش هيتحذف، وهنقولك السبب.
          </Banner>
          <TextField label={`اكتب "${DELETE_CONFIRM_WORD}" للتأكيد`} value={confirmWord} onChange={(e) => setConfirmWord(e.target.value)} autoComplete="off" />
        </div>
      </Sheet>

      <Sheet open={Boolean(report)} onOpenChange={(open) => !open && setReport(null)} title="النتيجة" description={report ? `اتنفّذ على ${report.filter((r) => r.outcome !== 'skipped').length} من ${report.length}` : undefined}>
        <ul className="users-mini-list">
          {report?.map((r) => <li key={r.id}><strong dir="auto">{r.name}</strong><span>{r.outcome === 'skipped' ? r.reason : 'تم'}</span></li>)}
        </ul>
      </Sheet>
    </>
  );
}
