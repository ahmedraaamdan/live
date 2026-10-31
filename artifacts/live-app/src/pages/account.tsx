import { MediaUpload } from '@/components/media-upload';
import { ProfileLinksEditor, linkDraft, type LinkDraft } from '@/components/profile-links-editor';
import { ShareTeacherCard } from '@/components/share-teacher-card';
import { QueryError } from '@/components/query-error';
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
  const [avatarUrl, setAvatarUrl] = useState(me.user.avatarUrl ?? '');
  const [experience, setExperience] = useState(me.teacher?.experience ?? '');
  const [socialLinks, setSocialLinks] = useState<LinkDraft[]>((me.teacher?.socialLinks ?? []).map(linkDraft));
  const [certificates, setCertificates] = useState<LinkDraft[]>((me.teacher?.certificates ?? []).map(linkDraft));
  const [uploading, setUploading] = useState(0);
  const [shareProfile, setShareProfile] = useState(false);
  const mediaBusy = (busy: boolean) => setUploading(n => Math.max(0, n + (busy ? 1 : -1)));
  useEffect(() => { const sync = () => setThemeState(getTheme()); const settings = () => document.getElementById('account-settings')?.scrollIntoView({ block: 'start' }); window.addEventListener('gl:theme', sync); window.addEventListener('gl:settings-open', settings); if (new URLSearchParams(window.location.search).get('section') === 'settings') settings(); return () => { window.removeEventListener('gl:theme', sync); window.removeEventListener('gl:settings-open', settings); }; }, []);
  const [parentEmail, setParentEmail] = useState(me.student?.parentEmail ?? '');
  const save = useMutation({
    mutationFn: () =>
      api<MeDTO>('/me', {
        method: 'PATCH',
        body: {
          name: form.name,
          avatarUrl,
          phone: form.phone,
          ...(me.teacher && { headline: form.headline, bio: form.bio, subject: form.subject, experience, socialLinks: socialLinks.map(({ _key, ...link }) => link), certificates: certificates.map(({ _key, ...link }) => link) }),
          ...(me.student && { grade: form.grade }),
        },
      }),
    onSuccess: (m) => {
      qc.setQueryData(['me'], m);
      qc.invalidateQueries({ queryKey: ['teacher-profile', m.user.id] });
      qc.invalidateQueries({ queryKey: ['lecture'] });
      qc.invalidateQueries({ queryKey: ['lectures'] });
      qc.invalidateQueries({ queryKey: ['student-feed'] });
      toast('حُفظت التغييرات');
    },
    onError: (e) => toast(errorMessage(e)),
  });
  const invite = useMutation({
    mutationFn: () => api('/me/parent-invite', { body: { email: parentEmail } }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['me'] });
      toast('أُرسلت الدعوة إلى ولي الأمر');
    },
    onError: (e) => toast(errorMessage(e)),
  });

  return (
    <>
      <TopBar title="حسابي" large />
      <Page>
        <Card pad="lg" className="mb-4 flex items-center gap-4">
          <Avatar name={me.user.name} src={avatarUrl || null} size="lg" />
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

        {me.teacher && <div className="mb-4 flex flex-wrap gap-2"><Button variant="tonal" onClick={() => navigate(`/teachers/${me.user.id}`)}>ملفي العام</Button><Button onClick={() => setShareProfile(true)}>كارت المشاركة ورابطك</Button></div>}
        {me.student && (
          <Card className="mb-4 flex flex-col gap-4">
            <div>
              <p className="text-title-md">ولي الأمر</p>
              <p className="text-body-md text-on-surface-variant">تصله إشعارات الحجوزات والدرجات، ويتابع حضورك من حسابه.</p>
            </div>
            <div className="flex items-center gap-3 rounded-md bg-surface-container p-4">
              <div className="flex-1">
                <p className="text-body-sm text-on-surface-variant">رمز ربط حسابك</p>
                <p className="font-num text-headline-md tracking-[0.3em]" dir="ltr">
                  {me.student.linkCode}
                </p>
              </div>
              <Button
                variant="tonal"
                size="sm"
                onClick={async () => {
                  await navigator.clipboard?.writeText(me.student!.linkCode);
                  toast('نُسخ الرمز');
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
              <TextField containerClassName="flex-1" label="البريد الإلكتروني لولي الأمر" type="email" ltr value={parentEmail} onChange={(e) => setParentEmail(e.target.value)} />
              <Button variant="tonal" className="h-12" loading={invite.isPending} disabled={!parentEmail} onClick={() => invite.mutate()}>
                <Mail /> إرسال دعوة
              </Button>
            </div>
          </Card>
        )}

        <Card className="mb-4 flex flex-col gap-4">
          <p className="text-title-md">بياناتك</p>
          <MediaUpload purpose="avatar" value={avatarUrl || null} onChange={url => setAvatarUrl(url ?? '')} onBusyChange={mediaBusy} />
          <TextField label="الاسم" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} />
          <TextField label="رقم الهاتف" type="tel" ltr value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} />
          {me.teacher && (
            <>
              <TextField label="سطر تعريفي" value={form.headline} onChange={(e) => setForm({ ...form, headline: e.target.value })} placeholder="مدرس فيزياء ثانوي · 12 سنة خبرة" hint="يظهر تحت اسمك في صفحة الحجز" />
              <Select label="المادة" value={form.subject} onChange={(e) => setForm({ ...form, subject: e.target.value })} options={SUBJECTS.map((s) => ({ value: s.key, label: s.label }))} placeholder="اختر" />
              <TextArea label="نبذة عنك" value={form.bio} onChange={(e) => setForm({ ...form, bio: e.target.value })} rows={3} maxLength={600} />
              <TextArea label="خبرتك وطريقتك في الشرح" value={experience} onChange={e => setExperience(e.target.value)} rows={5} maxLength={3000} placeholder="ماذا درست؟ وما الخبرات التي اكتسبتها؟ وكيف تساعد طلابك على الفهم؟" />
              <ProfileLinksEditor links={socialLinks} onChange={setSocialLinks} onBusyChange={mediaBusy} />
              <ProfileLinksEditor links={certificates} onChange={setCertificates} certificates onBusyChange={mediaBusy} />
            </>
          )}
          {me.student && <Select label="الصف" value={form.grade} onChange={(e) => setForm({ ...form, grade: e.target.value })} options={GRADES.map((g) => ({ value: g.key, label: g.label }))} placeholder="اختر" />}
          <Button className="self-start" disabled={uploading > 0} loading={save.isPending} onClick={() => save.mutate()}>
            حفظ التغييرات
          </Button>
        </Card>

        <Card className="mb-4 flex flex-col gap-3" id="account-settings">
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
              { value: 'system', label: 'حسب الجهاز', icon: <SunMoon /> },
              { value: 'light', label: 'فاتح', icon: <Sun /> },
              { value: 'dark', label: 'داكن', icon: <Moon /> },
            ]}
          />
        </Card>

        <List className="mb-6">
          {me.teacher && <ListItem href="/t/verification" leading={<Bell className="size-6 text-on-surface-variant" />} title="توثيق الحساب وحمايته" chevron />}
          <ListItem href="/notifications" leading={<Bell className="size-6 text-on-surface-variant" />} title="التنبيهات" chevron />
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
          Gahez Live · <span className="font-num">v0.1</span> · تحتاج إلى مساعدة؟ <a className="text-secondary" href="mailto:support@gahez.space">support@gahez.space</a>
        </p>
      </Page>
      {me.teacher && <ShareTeacherCard teacherId={me.user.id} open={shareProfile} onOpenChange={setShareProfile} />}
    </>
  );
}

export function Notifications() {
  const qc = useQueryClient();
  const q = useQuery({ queryKey: ['notifications'], queryFn: () => api<NotificationDTO[]>('/notifications') });
  const read = useMutation({ mutationFn: () => api('/notifications/read', { method: 'POST' }), onSuccess: () => { qc.invalidateQueries({ queryKey: ['me'] }); qc.setQueryData<NotificationDTO[]>(['notifications'], rows => rows?.map(n => ({ ...n, readAt: n.readAt ?? new Date().toISOString() }))); } });
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
        {q.isError && <QueryError error={q.error} retry={q.refetch} />}
        {q.isPending && <div className="skeleton h-48 rounded-lg" />}
        {q.data?.length === 0 && <EmptyState icon={<Bell />} title="لا توجد تنبيهات بعد" body="تجد هنا إشعارات الحجوزات وبداية الحصص والواجبات والدرجات." />}
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

