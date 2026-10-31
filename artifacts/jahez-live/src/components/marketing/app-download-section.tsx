import { Monitor } from 'lucide-react';
import type { ReactNode } from 'react';
import { SectionHeader } from '@/components/marketing/section-header';
import { isConfigured, siteConfig } from '@/lib/site-config';

const GooglePlayLogo = () => (
  <svg viewBox="0 0 24 24" width="26" height="26" aria-hidden="true">
    <path fill="#4285F4" d="M3.6 1.8Q3.2 2.2 3.2 3v18q0 .8.4 1.2L13.7 12z" />
    <path fill="#34A853" d="M3.6 1.8 13.7 12l3.4-3.4L5.3 2c-.7-.4-1.3-.5-1.7-.2z" />
    <path fill="#EA4335" d="M3.6 22.2 13.7 12l3.4 3.4L5.3 22c-.7.4-1.3.5-1.7.2z" />
    <path fill="#FBBC04" d="M17.1 8.6 13.7 12l3.4 3.4 3.8-2.2c1.1-.6 1.1-1.8 0-2.4z" />
  </svg>
);

const AppleLogo = ({ size = 26 }: { size?: number }) => (
  <svg viewBox="0 0 24 24" width={size} height={size} fill="currentColor" aria-hidden="true">
    <path d="M12.152 6.896c-.948 0-2.415-1.078-3.96-1.04-2.04.027-3.91 1.183-4.961 3.014-2.117 3.675-.546 9.103 1.519 12.09 1.013 1.454 2.208 3.09 3.792 3.039 1.52-.065 2.09-.987 3.935-.987 1.831 0 2.35.987 3.96.948 1.637-.026 2.676-1.48 3.676-2.948 1.156-1.688 1.636-3.325 1.662-3.415-.039-.013-3.182-1.221-3.22-4.857-.026-3.04 2.48-4.494 2.597-4.559-1.429-2.09-3.623-2.324-4.39-2.376-2-.156-3.675 1.09-4.61 1.09zM15.53 3.83c.843-1.012 1.4-2.427 1.245-3.83-1.207.052-2.662.805-3.532 1.818-.78.896-1.454 2.338-1.273 3.714 1.338.104 2.715-.688 3.559-1.701" />
  </svg>
);

const AndroidLogo = () => (
  <svg viewBox="0 0 24 24" width="22" height="22" aria-hidden="true">
    <path fill="#3DDC84" d="M2 18.5a10 10 0 0 1 20 0z" />
    <path stroke="#3DDC84" strokeWidth="1.6" strokeLinecap="round" d="M7.4 9.8 5.6 6.6M16.6 9.8l1.8-3.2" />
    <circle cx="8" cy="14.6" r="1.1" fill="#fff" />
    <circle cx="16" cy="14.6" r="1.1" fill="#fff" />
  </svg>
);

function StoreButton({ href, logo, store }: { href: string; logo: ReactNode; store: string }) {
  const content = (
    <>
      {logo}
      <span>
        <small>{isConfigured(href) ? 'حمّل التطبيق من' : 'قريبًا على'}</small>
        <strong>{store}</strong>
      </span>
    </>
  );
  return isConfigured(href) ? (
    <a href={href} target="_blank" rel="noreferrer noopener" className="store-button" data-testid={`link-store-${store}`}>
      {content}
    </a>
  ) : (
    <span className="store-button store-button-disabled" aria-disabled="true" data-testid={`store-disabled-${store}`}>
      {content}
    </span>
  );
}

const installTargets = [
  { device: 'android', label: 'أندرويد', icon: <AndroidLogo /> },
  { device: 'ios', label: 'آيفون', icon: <AppleLogo size={20} /> },
  { device: 'desktop', label: 'كمبيوتر', icon: <Monitor size={20} /> },
];

export function AppDownloadSection() {
  return (
    <section className="app-promo-section">
      <div className="container-wide app-promo-grid">
        <div className="fade-up">
          <SectionHeader kicker="التطبيق" title="حصصك في متناولك." />
          <p className="app-promo-copy">تصفح الحصص، واحجز مقعدك، وتلقّ تنبيهات بمواعيدها.</p>
          <div className="app-promo-buttons">
            <StoreButton href={siteConfig.androidStoreUrl} logo={<GooglePlayLogo />} store="Google Play" />
            <StoreButton href={siteConfig.iosStoreUrl} logo={<AppleLogo />} store="App Store" />
          </div>
          <div className="app-install">
            <h3>ثبّته على الشاشة الرئيسية</h3>
            <p>نسخة خفيفة تفتح مثل التطبيق، دون الحاجة إلى متجر. اختر جهازك:</p>
            <div className="app-install-options">
              {installTargets.map((t) => (
                <a key={t.device} href={`${siteConfig.appUrl}/install?device=${t.device}`} className="app-install-option" data-testid={`link-install-${t.device}`}>
                  {t.icon}
                  <span>{t.label}</span>
                </a>
              ))}
            </div>
          </div>
        </div>
        <div className="app-promo-visual fade-up delay-1" >
          <div className="app-promo-banner"><span className="app-banner-orbit" /><img src={`${import.meta.env.BASE_URL}images/student-anywhere.webp`} width={1024} height={1024} loading="lazy" alt="طالبة تتابع حصتها وتدوّن ملاحظاتها" /><span className="app-banner-note">حصتك أقرب. أينما كنت.</span></div>
        </div>
      </div>
    </section>
  );
}
