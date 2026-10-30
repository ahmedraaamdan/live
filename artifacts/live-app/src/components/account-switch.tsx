import { useEffect, useLayoutEffect, useRef, useState } from 'react';
import { ArrowRightLeft, LogOut, Search, Undo2 } from 'lucide-react';
import { useLocation } from 'wouter';
import { useQuery } from '@tanstack/react-query';
import { ROLE_LABELS, type UserDTO } from '@workspace/live-core';
import { api, errorMessage } from '@/lib/api';
import { homePath, useSession } from '@/lib/session';
import { Avatar } from '@/ui/avatar';
import { Button } from '@/ui/button';
import { Banner, Spinner } from '@/ui/feedback';
import { TextField } from '@/ui/form';
import { Sheet } from '@/ui/overlay';
import { toast } from 'sonner';
import '@/styles/account-switch.css';

type SearchUser = UserDTO & { suspended: boolean };
export function AccountSwitchTools() {
  const session = useSession();
  const [, navigate] = useLocation();
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState('');
  const [debounced, setDebounced] = useState('');
  useEffect(() => { const timer = setTimeout(() => setDebounced(query), 200); return () => clearTimeout(timer); }, [query]);
  const owner = Boolean(session.me?.isSuperAdmin);
  const acting = Boolean(session.me?.impersonation);
  const users = useQuery({ queryKey: ['account-switch-users', debounced], queryFn: ({ signal }) => api<SearchUser[]>(`/auth/switch/users?q=${encodeURIComponent(debounced)}`, { signal }), enabled: owner && open });
  if (!owner && !acting) return null;
  const goBack = async () => { try { const me = await session.returnToAdmin(); navigate(homePath(me.user.role), { replace: true }); } catch(e) { toast(errorMessage(e)); } };
  return <>
    <div className="account-switch-tools">
      <Button variant="text" className="account-tool-button" aria-label={acting ? 'العودة إلى حسابي' : 'تبديل الحساب'} title={acting ? 'العودة إلى حسابي' : 'تبديل الحساب'} disabled={session.switchBusy} onClick={() => acting ? void goBack() : setOpen(true)}>{session.switchBusy ? <Spinner /> : acting ? <Undo2 /> : <ArrowRightLeft />}<span className="account-tool-label">{acting ? 'العودة لحسابي' : 'تبديل الحساب'}</span></Button>
      <Button variant="text" className="account-tool-button" aria-label="تسجيل الخروج" title="تسجيل الخروج" disabled={session.switchBusy} onClick={async () => { await session.signOut(); navigate('/welcome', { replace: true }); }}><LogOut /><span className="account-tool-label">تسجيل الخروج</span></Button>
    </div>
    <Sheet open={open && owner} onOpenChange={setOpen} title="التبديل إلى حساب" description="ابحث عن طالب أو مدرس أو أي مستخدم. يظهر لك حسابه بصلاحياته الأصلية، ويمكنك العودة إلى حسابك من الشريط العلوي.">
      <TextField autoFocus label="البحث عن مستخدم" placeholder="الاسم أو البريد الإلكتروني أو الهاتف" value={query} onChange={e => setQuery(e.target.value)} trailing={<Search className="size-5" />} />
      <div className="account-switch-results" aria-busy={users.isFetching}>
        {users.isPending && <p className="account-switch-empty"><Spinner /> جارٍ تحميل المستخدمين</p>}
        {users.isError && <Banner tone="error" action={<Button variant="text" onClick={() => void users.refetch()}>إعادة المحاولة</Button>}>{errorMessage(users.error)}</Banner>}
        {users.data?.length === 0 && <p className="account-switch-empty">لا توجد حسابات مطابقة للبحث.</p>}
        {users.data?.map(user => <button key={user.id} className="account-switch-user" disabled={session.switchBusy} onClick={async () => { try { const me = await session.switchAccount(user.id); setOpen(false); navigate(homePath(me.user.role), { replace: true }); } catch(e) { toast(errorMessage(e)); } }}><Avatar name={user.name} src={user.avatarUrl} /><span><strong dir="auto">{user.name}</strong><small dir="ltr">{user.email}</small></span><span className="account-switch-role">{ROLE_LABELS[user.role]}{user.suspended ? ' · موقوف' : ''}</span></button>)}
      </div>
    </Sheet>
  </>;
}
export function AccountSwitchBanner() {
  const session = useSession();
  const banner = useRef<HTMLElement>(null);
  const active = Boolean(session.me?.impersonation);
  useLayoutEffect(() => {
    const el = banner.current;
    if (!active || !el) return;
    const parent = el.parentElement!;
    const measure = () => parent.style.setProperty('--account-switch-height', `${Math.ceil(el.getBoundingClientRect().height)}px`);
    measure();
    const observer = typeof ResizeObserver !== 'undefined' ? new ResizeObserver(measure) : null;
    observer?.observe(el); window.addEventListener('resize', measure);
    return () => { observer?.disconnect(); window.removeEventListener('resize', measure); parent.style.removeProperty('--account-switch-height'); };
  }, [active]);
  const [, navigate] = useLocation();
  if (!session.me?.impersonation) return null;
  return <aside ref={banner} className="account-switch-banner" role="status"><span>أنت تستخدم حساب <strong dir="auto">{session.me.user.name}</strong><small>{ROLE_LABELS[session.me.user.role]} · وصول إداري مسجّل</small></span><Button size="sm" loading={session.switchBusy} onClick={async () => { try { const me = await session.returnToAdmin(); navigate(homePath(me.user.role), { replace: true }); } catch(e) { toast(errorMessage(e)); } }}><Undo2 /> العودة لحسابي</Button></aside>;
}
