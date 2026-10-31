import { useState, useSyncExternalStore, type ReactNode } from 'react';
import { CheckCircle2, Copy, Download, MoreVertical, Plus, Share } from 'lucide-react';
import { useLocation } from 'wouter';
import { canPromptInstall, detectDevice, inAppBrowser, justInstalled, promptInstall, runningInstalled, subscribeInstall, type Device } from '@/lib/install-prompt';
import { Banner, Button, Card, Logo, Segmented, toast } from '@/ui';

const deviceOptions: { value: Device; label: string }[] = [
  { value: 'android', label: 'أندرويد' },
  { value: 'ios', label: 'آيفون' },
  { value: 'desktop', label: 'كمبيوتر' },
];

const deviceNames: Record<Device, string> = { android: 'هاتف أندرويد', ios: 'آيفون', desktop: 'الكمبيوتر' };

const steps: Record<Device, ReactNode[]> = {
  ios: [
    <>اضغط زر المشاركة <Share size={16} className="inline align-text-bottom" /> في Safari أو Chrome.</>,
    <>اختر «إضافة إلى الشاشة الرئيسية» <Plus size={16} className="inline align-text-bottom" />. إذا لم تظهر، انزل في القائمة.</>,
    <>اضغط «إضافة»، وستجد جاهز Live على شاشتك الرئيسية.</>,
  ],
  android: [
    <>افتح هذه الصفحة في Chrome، ثم اضغط القائمة <MoreVertical size={16} className="inline align-text-bottom" /> بجوار العنوان.</>,
    <>اختر «تثبيت التطبيق» أو «إضافة إلى الشاشة الرئيسية».</>,
    <>اضغط «تثبيت»، وستجد جاهز Live على شاشتك الرئيسية.</>,
  ],
  desktop: [
    <>افتح هذه الصفحة في Chrome أو Edge.</>,
    <>اضغط أيقونة التثبيت <Download size={16} className="inline align-text-bottom" /> في شريط العنوان، أو افتح القائمة <MoreVertical size={16} className="inline align-text-bottom" /> واختر «تثبيت جاهز Live».</>,
    <>اضغط «تثبيت»، وسيفتح جاهز Live في نافذة خاصة به.</>,
  ],
};

export function InstallPage() {
  const [, navigate] = useLocation();
  const actual = detectDevice();
  const [device, setDevice] = useState<Device>(() => {
    const asked = new URLSearchParams(window.location.search).get('device');
    return asked === 'android' || asked === 'ios' || asked === 'desktop' ? asked : actual;
  });
  const canPrompt = useSyncExternalStore(subscribeInstall, canPromptInstall);
  const installed = useSyncExternalStore(subscribeInstall, justInstalled);
  const pageUrl = `${window.location.origin}/install?device=${device}`;

  const install = async () => {
    if (await promptInstall()) toast('تم تثبيت جاهز Live');
  };
  const copyLink = async () => {
    try {
      await navigator.clipboard.writeText(pageUrl);
      toast('تم نسخ الرابط');
    } catch {
      toast(pageUrl);
    }
  };

  return (
    <main className="mx-auto flex min-h-dvh max-w-lg flex-col gap-5 px-5 py-10">
      <Logo />
      <div>
        <h1 className="text-headline-md font-bold">ثبّت جاهز Live على جهازك</h1>
        <p className="mt-1 text-body-md text-on-surface-variant">نسخة خفيفة تفتح من الشاشة الرئيسية مثل التطبيق، دون الحاجة إلى متجر.</p>
      </div>

      {runningInstalled() || installed ? (
        <Banner tone="success" title="جاهز Live مثبّت على جهازك" action={<Button onClick={() => navigate('/')}>افتح التطبيق</Button>}>
          <CheckCircle2 size={16} className="inline align-text-bottom" /> يمكنك فتحه في أي وقت من شاشتك الرئيسية.
        </Banner>
      ) : (
        <>
          <Segmented value={device} onChange={setDevice} options={deviceOptions} />

          {inAppBrowser() && <Banner tone="warning" title="افتح الصفحة في متصفح هاتفك">لا يمكن التثبيت من داخل فيسبوك أو إنستجرام. افتح القائمة واختر الفتح في {actual === 'ios' ? 'Safari' : 'Chrome'}.</Banner>}

          {device !== actual && (
            <Banner tone="info" title={`افتح هذه الصفحة من ${deviceNames[device]}`} action={<Button variant="outlined" size="sm" onClick={() => void copyLink()}><Copy /> نسخ الرابط</Button>}>
              التثبيت يتم من الجهاز نفسه.
            </Banner>
          )}

          {device === actual && canPrompt && (
            <Button size="lg" block onClick={() => void install()}>
              <Download /> تثبيت الآن
            </Button>
          )}

          <Card variant="outlined">
            <h2 className="mb-3 text-title-md font-bold">{device === actual && canPrompt ? 'أو ثبّته بنفسك' : 'خطوات التثبيت'}</h2>
            <ol className="flex flex-col gap-3">
              {steps[device].map((step, i) => (
                <li key={i} className="flex gap-3 text-body-md">
                  <span className="flex size-7 shrink-0 items-center justify-center rounded-full bg-primary text-label-md font-bold text-on-primary">{i + 1}</span>
                  <span className="min-w-0 pt-0.5">{step}</span>
                </li>
              ))}
            </ol>
          </Card>
        </>
      )}

      <Button variant="text" block onClick={() => navigate('/')}>المتابعة من المتصفح</Button>
    </main>
  );
}
