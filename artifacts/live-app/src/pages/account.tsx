import { useEffect, useState } from 'react';
import { Bell, Copy, LogOut, Mail, Moon, Palette, Sun, SunMoon } from 'lucide-react';
import { Link, useLocation } from 'wouter';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { GRADES, ROLE_LABELS, SUBJECTS, type MeDTO, type NotificationDTO } from '@workspace/live-core';
import { api, errorMessage } from '@/lib/api';
import { cn } from '@/lib/cn';
import { fmtRelative } from '@/lib/format';
import { useMe, useSession } from '@/lib/session';
import { getTheme, setTheme, type ThemeChoice } from '@/lib/theme';
import { Avatar, Badge, Banner, Button, Card, EmptyState, List, ListItem, Page, Segmented, Select, TextArea, TextField, TopBar, toast } from '@/ui';

export function Account() {
  const me = useMe();
  const { signOut } = useSession();
  const qc = useQueryClient();
  const [, navigate] = useLocation();
  const [theme, setThemeState] = useState<ThemeChoice>(getTheme());
  const [form, setForm] = useState({
    name: me.user.name,
    phone: me.user.phone ?? '',
    headline: me.teacher?.headline ?? '',
    bio: me.teacher?.bio ?? '',
    subject: me.teacher?.subject ?? '',
    grade: me.student?.grade ?? '',
  });
  const [parentEmail, setParentEmail] = useState(me.student?.parentEmail ?? '');
  const save = useMutation({
    mutationFn: () =>
      api<MeDTO>('/me', {
        method: 'PATCH',
        body: {
          name: form.name,
          phone: form.phone,
          ...(me.teacher && { headline: form.headline, bio: form.bio, subject: form.subject }),
          ...(me.student && { grade: form.grade }),
        },
      }),
    onSuccess: (m) => {
      qc.setQueryData(['me'], m);
      toast('اتحفظ');
    },
    onError: (e) => toast(errorMessage(e)),
  });
  const invite = useMutation({
    mutationFn: () => api('/me/parent-invite', { body: { email: parentEmail } }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['me'] });
      toast('بعتنا الدعوة لولي الأمر');
    },
    onError: (e) => toast(errorMessage(e)),
  });

  return (
    <>
      <TopBar title="حسابي" large />
      <Page>
        <Card pad="lg" className="mb-4 flex items-center gap-4">
          <Avatar name={me.user.name} src={me.user.avatarUrl} size="lg" />
          <div className="min-w-0">
            <p className="truncate text-title-lg">{me.user.name}</p>
            <p className="truncate text-body-md text-on-surface-variant" dir="ltr">
              {me.user.email}
            </p>
            <Badge tone="primary" className="mt-1">
              {ROLE_LABELS[me.user.role]}
            </Badge>
          </div>
        </Card>

        {me.student && (
          <Card className="mb-4 flex flex-col gap-4">
            <div>
              <p className="text-title-md">ولي الأمر</p>
              <p className="text-body-md text-on-surface-variant">بيوصله إيميل بكل حجز ودرجة، ويتابع حضورك من حسابه.</p>
            </div>
            <div className="flex items-center gap-3 rounded-md bg-surface-container p-4">
              <div className="flex-1">
                <p className="text-body-sm text-on-surface-variant">كود الربط بتاعك</p>
                <p className="font-num text-headline-md tracking-[0.3em]" dir="ltr">
                  {me.student.linkCode}
                </p>
              </div>
              <Button
                variant="tonal"
                size="sm"
                onClick={async () => {
                  await navigator.clipboard?.writeText(me.student!.linkCode);
                  toast('اتنسخ الكود');
                }}
              >
                <Copy /> نسخ
              </Button>
            </div>
            {me.student.parents.length > 0 && (
              <div className="flex flex-wrap gap-2">
                {me.student.parents.map((p) => (
                  <Badge key={p.id} tone="success">
                    {p.name} متابعك
                  </Badge>
                ))}
              </div>
            )}
            <div className="flex items-end gap-2">
              <TextField containerClassName="flex-1" label="إيميل ولي الأمر" type="email" ltr value={parentEmail} onChange={(e) => setParentEmail(e.target.value)} />
              <Button variant="tonal" className="h-12" loading={invite.isPending} disabled={!parentEmail} onClick={() => invite.mutate()}>
                <Mail /> ابعت دعوة
              </Button>
            </div>
          </Card>
        )}

        <Card className="mb-4 flex flex-col gap-4">
          <p className="text-title-md">بياناتك</p>
          <TextField label="الاسم" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} />
          <TextField label="الموبايل" type="tel" ltr value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} />
          {me.teacher && (
            <>
              <TextField label="سطر تعريفي" value={form.headline} onChange={(e) => setForm({ ...form, headline: e.target.value })} placeholder="مدرس فيزياء ثانوي · 12 سنة خبرة" hint="بيظهر تحت اسمك في صفحة الحجز" />
              <Select label="المادة" value={form.subject} onChange={(e) => setForm({ ...form, subject: e.target.value })} options={SUBJECTS.map((s) => ({ value: s.key, label: s.label }))} placeholder="اختار" />
              <TextArea label="نبذة عنك" value={form.bio} onChange={(e) => setForm({ ...form, bio: e.target.value })} rows={3} />
            </>
          )}
          {me.student && <Select label="الصف" value={form.grade} onChange={(e) => setForm({ ...form, grade: e.target.value })} options={GRADES.map((g) => ({ value: g.key, label: g.label }))} placeholder="اختار" />}
          <Button className="self-start" loading={save.isPending} onClick={() => save.mutate()}>
            احفظ
          </Button>
        </Card>

        <Card className="mb-4 flex flex-col gap-3">
          <p className="flex items-center gap-2 text-title-md">
            <Palette className="size-5" /> الشكل
          </p>
          <Segmented
            value={theme}
            onChange={(t) => {
              setTheme(t);
              setThemeState(t);
            }}
            options={[
              { value: 'system', label: 'زي الموبايل', icon: <SunMoon /> },
              { value: 'light', label: 'فاتح', icon: <Sun /> },
              { value: 'dark', label: 'غامق', icon: <Moon /> },
            ]}
          />
        </Card>

        <List className="mb-6">
          <ListItem href="/notifications" leading={<Bell className="size-6 text-on-surface-variant" />} title="التنبيهات" chevron />
          <ListItem href="/design" leading={<Palette className="size-6 text-on-surface-variant" />} title="نظام التصميم" subtitle="Gahez Live Design System" chevron />
        </List>
        <Button
          variant="danger-text"
          block
          onClick={async () => {
            await signOut();
            navigate('/welcome', { replace: true });
          }}
        >
          <LogOut /> تسجيل الخروج
        </Button>
        <p className="mt-6 text-center text-body-sm text-on-surface-variant">
          Gahez Live · <span className="font-num">v0.1</span> · محتاج مساعدة؟ <a className="text-secondary" href="mailto:support@gahez.space">support@gahez.space</a>
        </p>
      </Page>
    </>
  );
}

export function Notifications() {
  const qc = useQueryClient();
  const q = useQuery({ queryKey: ['notifications'], queryFn: () => api<NotificationDTO[]>('/notifications') });
  const read = useMutation({ mutationFn: () => api('/notifications/read', { method: 'POST' }), onSuccess: () => qc.invalidateQueries({ queryKey: ['me'] }) });
  const unread = q.data?.some((n) => !n.readAt);
  useEffect(() => {
    // Opening the list marks everything read (after it has rendered unread).
    if (unread) {
      const t = setTimeout(() => read.mutate(), 1500);
      return () => clearTimeout(t);
    }
    return undefined;
  }, [unread]); // eslint-disable-line react-hooks/exhaustive-deps
  return (
    <>
      <TopBar title="التنبيهات" large />
      <Page>
        {q.isPending && <div className="skeleton h-48 rounded-lg" />}
        {q.data?.length === 0 && <EmptyState icon={<Bell />} title="مفيش تنبيهات" body="هنا هتلاقي الحجوزات، بداية البث، الواجبات والدرجات." />}
        {q.data && q.data.length > 0 && (
          <List>
            {q.data.map((n) => (
              <ListItem
                key={n.id}
                href={n.link ?? undefined}
                className={cn(!n.readAt && 'bg-secondary-container/40')}
                leading={<span className={cn('mt-1 size-2.5 rounded-full', n.readAt ? 'bg-transparent' : 'bg-primary')} />}
                title={n.title}
                subtitle={n.body || undefined}
                trailing={<span className="text-body-sm">{fmtRelative(n.createdAt)}</span>}
              />
            ))}
          </List>
        )}
      </Page>
    </>
  );
}

