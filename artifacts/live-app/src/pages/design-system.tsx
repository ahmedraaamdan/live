import { useState, type ReactNode } from 'react';
import { Bell, CalendarPlus, Heart, Moon, Plus, Radio, Search, Settings, Sun, SunMoon, Wallet } from 'lucide-react';
import type { LectureDTO } from '@workspace/live-core';
import { LectureCard } from '@/components/lecture-card';
import { getTheme, setTheme, type ThemeChoice } from '@/lib/theme';
import {
  Avatar,
  AvatarStack,
  Badge,
  Banner,
  Button,
  Card,
  Chip,
  EmptyState,
  IconButton,
  List,
  ListItem,
  LiveBadge,
  Logo,
  ProgressBar,
  ProgressRing,
  Segmented,
  Select,
  Sheet,
  Skeleton,
  Spinner,
  Stat,
  StatGrid,
  Switch,
  TextArea,
  TextField,
  TopBar,
  toast,
} from '@/ui';

/**
 * The living reference for the design system: every token and component,
 * rendered from the real code. If it isn't shown here, it isn't in the
 * system yet. See DESIGN_SYSTEM.md for the rules.
 */
export function DesignSystem() {
  const [theme, setThemeState] = useState<ThemeChoice>(getTheme());
  const [seg, setSeg] = useState<'a' | 'b' | 'c'>('a');
  const [chip, setChip] = useState(true);
  const [sw, setSw] = useState(true);
  const [sheet, setSheet] = useState(false);

  return (
    <div className="min-h-dvh bg-background">
      <TopBar
        title="Gahez Live Design System"
        back="/"
        actions={
          <Segmented
            size="sm"
            className="w-56"
            value={theme}
            onChange={(t) => {
              setTheme(t);
              setThemeState(t);
            }}
            options={[
              { value: 'system', label: '', icon: <SunMoon /> },
              { value: 'light', label: '', icon: <Sun /> },
              { value: 'dark', label: '', icon: <Moon /> },
            ]}
          />
        }
      />
      <main className="mx-auto max-w-[var(--content-max)] px-4 pb-24 md:px-6">
        <header className="mb-10 rounded-2xl bg-gradient-ink p-8 text-white">
          <Logo size="lg" />
          <h1 className="mt-6 text-display-sm">نظام تصميم Gahez Live</h1>
          <p className="mt-2 max-w-2xl text-body-lg text-white/75">
            مبني على أساسات Material Design 3 (أدوار الألوان، مقياس الخطوط، الأشكال، طبقات الحالة والحركة)، بلمسات Apple HIG على الموبايل: عناوين كبيرة، Sheets من تحت، وأهداف لمس 44px. عربي وRTL من الأول، وفاتح وغامق.
          </p>
        </header>

        <Section n="01" title="الألوان: أدوار، مش ألوان">
          <p className="mb-4 text-body-md text-on-surface-variant">كل مكوّن بيقرا دور (primary، surface-container…) والدور بيتغيّر بين الفاتح والغامق. الوردي (Live) هو الفعل الأساسي، الأزرق (Gahez) للاختيار والبيانات، السماوي للتقدّم.</p>
          <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
            {(
              [
                ['primary', 'on-primary'],
                ['primary-container', 'on-primary-container'],
                ['secondary', 'on-secondary'],
                ['secondary-container', 'on-secondary-container'],
                ['tertiary', 'on-tertiary'],
                ['tertiary-container', 'on-tertiary-container'],
                ['success-container', 'on-success-container'],
                ['warning-container', 'on-warning-container'],
                ['error', 'on-error'],
                ['error-container', 'on-error-container'],
                ['live', 'on-live'],
                ['inverse-surface', 'inverse-on-surface'],
              ] as const
            ).map(([bg, fg]) => (
              <div key={bg} className="flex h-24 flex-col justify-end rounded-lg p-3" style={{ background: `var(--${bg})`, color: `var(--${fg})` }}>
                <span className="text-label-lg">{bg}</span>
                <span className="font-num text-label-sm opacity-80">on: {fg}</span>
              </div>
            ))}
          </div>
          <div className="mt-3 grid grid-cols-3 gap-2 md:grid-cols-7">
            {['surface', 'surface-container-lowest', 'surface-container-low', 'surface-container', 'surface-container-high', 'surface-container-highest', 'outline-variant'].map((t) => (
              <div key={t} className="flex h-20 items-end rounded-md border border-outline-variant p-2 text-label-sm text-on-surface" style={{ background: `var(--${t})` }}>
                {t.replace('surface-container', 'sc')}
              </div>
            ))}
          </div>
          <div className="mt-3 grid gap-3 md:grid-cols-3">
            <div className="h-20 rounded-lg bg-gradient-brand p-3 text-label-lg text-white">gradient-brand</div>
            <div className="h-20 rounded-lg bg-gradient-live p-3 text-label-lg text-white">gradient-live</div>
            <div className="h-20 rounded-lg bg-gradient-ink p-3 text-label-lg text-white">gradient-ink</div>
          </div>
        </Section>

        <Section n="02" title="الخطوط">
          <p className="mb-4 text-body-md text-on-surface-variant">Cairo للعربي، وSpace Grotesk للأرقام (أسعار، عدّادات، أكواد) بأرقام متساوية العرض. أقصى 4 مقاسات في الشاشة الواحدة.</p>
          <Card className="divide-y divide-outline-variant" pad="none">
            {(
              [
                ['display-md', 'الحصة الحلوة بقت لايف'],
                ['display-sm', 'الحصة الحلوة بقت لايف'],
                ['headline-lg', 'الكهربية التيارية'],
                ['headline-md', 'حجزك اتأكد!'],
                ['headline-sm', 'الحصة القادمة'],
                ['title-lg', 'واجبات بانتظارك'],
                ['title-md', 'أ. محمد سامي'],
                ['title-sm', 'سؤال من يوسف'],
                ['body-lg', 'مدرسك بيشرح لايف، وانت بتسأل وهو بيرد.'],
                ['body-md', 'هنفكّرك قبلها بساعة، وهيوصلك إشعار.'],
                ['body-sm', 'وصلك الإيميل ده لأنك حجزت حصة.'],
                ['label-lg', 'احجز مكانك'],
                ['label-md', 'مباشر'],
              ] as const
            ).map(([k, sample]) => (
              <div key={k} className="flex items-baseline gap-4 px-5 py-3">
                <span className="w-28 shrink-0 font-num text-label-md text-on-surface-variant">{k}</span>
                <span className={`text-${k}`}>{sample}</span>
              </div>
            ))}
            <div className="flex items-baseline gap-4 px-5 py-3">
              <span className="w-28 shrink-0 font-num text-label-md text-on-surface-variant">font-num</span>
              <span className="font-num text-headline-md">150 ج.م · 01:24:09 · 4R4QJJZ</span>
            </div>
          </Card>
        </Section>

        <Section n="03" title="الأشكال والارتفاع">
          <div className="flex flex-wrap gap-4">
            {(['xs', 'sm', 'md', 'lg', 'xl', '2xl', 'full'] as const).map((r) => (
              <div key={r} className="grid size-20 place-items-center bg-secondary-container font-num text-label-md text-on-secondary-container" style={{ borderRadius: `var(--radius-${r})` }}>
                {r}
              </div>
            ))}
          </div>
          <div className="mt-6 flex flex-wrap gap-6">
            {(['e1', 'e2', 'e3', 'e4', 'e5', 'glow'] as const).map((e) => (
              <div key={e} className="grid size-24 place-items-center rounded-lg bg-surface-container-lowest font-num text-label-md" style={{ boxShadow: `var(--shadow-${e})` }}>
                {e}
              </div>
            ))}
          </div>
        </Section>

        <Section n="04" title="الأزرار">
          <div className="flex flex-wrap items-center gap-3">
            <Button>
              <Plus /> filled
            </Button>
            <Button variant="tonal">tonal</Button>
            <Button variant="outlined">outlined</Button>
            <Button variant="text">text</Button>
            <Button variant="neutral">neutral</Button>
            <Button variant="live">
              <Radio /> live
            </Button>
            <Button variant="danger">danger</Button>
            <Button loading>loading</Button>
            <Button disabled>disabled</Button>
          </div>
          <div className="mt-4 flex flex-wrap items-center gap-3">
            <Button size="sm">sm</Button>
            <Button size="md">md</Button>
            <Button size="lg">lg · CTA</Button>
          </div>
          <div className="mt-4 flex flex-wrap items-center gap-2">
            <IconButton label="بحث">
              <Search />
            </IconButton>
            <IconButton label="إعدادات" variant="tonal">
              <Settings />
            </IconButton>
            <IconButton label="أضف" variant="filled">
              <Plus />
            </IconButton>
            <IconButton label="تنبيهات" variant="outlined">
              <Bell />
            </IconButton>
          </div>
          <p className="mt-3 text-body-sm text-on-surface-variant">filled واحد بس في الشاشة للفعل الأهم. live للدخول للبث أو بدايته بس.</p>
        </Section>

        <Section n="05" title="الإدخال والاختيار">
          <div className="grid gap-5 md:grid-cols-2">
            <TextField label="الإيميل" placeholder="name@example.com" ltr hint="هنبعتلك عليه تأكيد الحجز" />
            <TextField label="الباسورد" type="password" error="الباسورد لازم يكون 8 حروف على الأقل" />
            <Select label="الصف" placeholder="اختر" options={[{ value: 's3', label: 'تالتة ثانوي' }]} defaultValue="" />
            <TextArea label="ماذا ستشرح في الحصة؟" rows={2} />
          </div>
          <div className="mt-5 flex flex-col gap-4">
            <Segmented
              className="max-w-md"
              value={seg}
              onChange={setSeg}
              options={[
                { value: 'a', label: 'الجاية' },
                { value: 'b', label: 'السابقة' },
                { value: 'c', label: 'المسودات' },
              ]}
            />
            <div className="flex flex-wrap gap-2">
              <Chip selected={chip} onClick={() => setChip(!chip)}>
                فيزياء
              </Chip>
              <Chip>كيمياء</Chip>
              <Chip icon={<CalendarPlus />}>النهارده</Chip>
            </div>
            <div className="max-w-md">
              <Switch checked={sw} onChange={setSw} label="افتح الحجز" description="الرابط متاح ويمكن للطلاب الحجز" />
            </div>
          </div>
        </Section>

        <Section n="06" title="الحالة والتقدّم">
          <div className="flex flex-wrap items-center gap-2">
            <LiveBadge />
            <Badge tone="primary">فيزياء</Badge>
            <Badge tone="secondary">كمان ساعتين</Badge>
            <Badge tone="tertiary">تسجيل متاح</Badge>
            <Badge tone="success">اتجاوب</Badge>
            <Badge tone="warning">سؤال</Badge>
            <Badge tone="error">متأخر</Badge>
            <Badge tone="outline">مسودة</Badge>
            <Spinner className="text-primary" />
          </div>
          <div className="mt-5 grid items-center gap-6 md:grid-cols-3">
            <ProgressBar value={0.68} />
            <div className="flex gap-4">
              <ProgressRing value={0.86} tone="success">
                <span className="font-num text-title-sm">86%</span>
              </ProgressRing>
              <ProgressRing value={0.6} tone="tertiary">
                <span className="font-num text-title-sm">6/10</span>
              </ProgressRing>
            </div>
            <div className="flex flex-col gap-2">
              <Skeleton className="w-3/4" />
              <Skeleton className="w-1/2" />
            </div>
          </div>
          <div className="mt-5 grid gap-3 md:grid-cols-2">
            <Banner tone="info" title="معلومة">التسجيل هيبقى متاح بعد الحصة.</Banner>
            <Banner tone="success" title="تمام">حجزك اتأكد.</Banner>
            <Banner tone="warning" title="انتبه">فيه 3 أسئلة من غير رد.</Banner>
            <Banner tone="error" title="مشكلة">الدفع ماتمّش.</Banner>
          </div>
        </Section>

        <Section n="07" title="الأسطح والقوائم">
          <StatGrid>
            <Stat icon={<Wallet />} tone="success" label="دخلك هذا الشهر" value="12,450 ج.م" />
            <Stat icon={<Heart />} tone="primary" label="تقييم" value="94%" hint="من 320 تقييم" />
            <Stat label="طلاب" value="128" />
            <Stat label="حصص قادمة" value="6" tone="tertiary" icon={<CalendarPlus />} />
          </StatGrid>
          <div className="mt-4 grid gap-4 md:grid-cols-2">
            <List>
              <ListItem leading={<Avatar name="يوسف أحمد" />} title="يوسف أحمد" subtitle="حضر ساعة و20 د" trailing="150 ج.م" />
              <ListItem leading={<Avatar name="مريم خالد" />} title="مريم خالد" subtitle="حضرت 45 دقيقة" trailing="150 ج.م" chevron onClick={() => toast('ListItem')} />
              <ListItem leading={<Avatar name="عمر سعيد" />} title="عمر سعيد" subtitle="محضرش" />
            </List>
            <div className="flex flex-col gap-3">
              <Card>elevated</Card>
              <Card variant="filled">filled</Card>
              <Card variant="outlined">outlined</Card>
              <div className="flex items-center gap-3">
                <Avatar name="أ. محمد سامي" size="lg" />
                <AvatarStack names={['يوسف', 'مريم', 'عمر', 'سارة', 'علي', 'نور']} />
              </div>
            </div>
          </div>
        </Section>

        <Section n="08" title="الطبقات">
          <div className="flex flex-wrap gap-3">
            <Button variant="tonal" onClick={() => setSheet(true)}>
              افتح Sheet
            </Button>
            <Button variant="outlined" onClick={() => toast('اتنسخ اللينك')}>
              Snackbar
            </Button>
          </div>
          <Sheet open={sheet} onOpenChange={setSheet} title="Bottom sheet" description="على الموبايل بتطلع من تحت، ومن 600px بتبقى dialog في النص." footer={<Button block onClick={() => setSheet(false)}>تمام</Button>}>
            <p className="text-body-md">المحتوى هنا.</p>
          </Sheet>
        </Section>

        <Section n="09" title="أنماط">
          <div className="grid gap-4 md:grid-cols-2">
            <LectureCard lecture={SAMPLE} showTeacher />
            <Card>
              <EmptyState icon={<CalendarPlus />} title="جدولك بانتظار أول حصة" body="اعمل أول حصة ومشاركة الرابط لطلابك." action={<Button>إنشاء حصة</Button>} />
            </Card>
          </div>
        </Section>
      </main>
    </div>
  );
}

function Section({ n, title, children }: { n: string; title: string; children: ReactNode }) {
  return (
    <section className="mb-12">
      <h2 className="mb-4 flex items-baseline gap-3 text-headline-sm">
        <span className="font-num text-title-md text-primary">{n}</span>
        {title}
      </h2>
      {children}
    </section>
  );
}

const SAMPLE: LectureDTO = {
  id: 'sample',
  code: 'ABC1234',
  title: 'الكهربية التيارية — قانون أوم وتوصيل المقاومات',
  subject: 'physics',
  grade: 's3',
  description: '',
  startsAt: new Date(Date.now() + 2 * 3600_000).toISOString(),
  durationMin: 90,
  priceCents: 15000,
  capacity: 60,
  status: 'scheduled',
  listed: true,
  liveStartedAt: null,
  liveEndedAt: null,
  teacher: { id: 't', name: 'أ. محمد سامي', avatarUrl: null, headline: 'مدرس فيزياء', subject: 'physics' },
  seatsTaken: 42,
  booking: null,
  recording: null,
  votes: { likes: 120, dislikes: 6, mine: 0, canVote: false },
  viewersNow: 0,
  stats: null,
};
