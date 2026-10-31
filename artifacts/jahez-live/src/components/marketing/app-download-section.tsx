import { Smartphone } from 'lucide-react';
import { SectionHeader } from '@/components/marketing/section-header';
import { isConfigured, siteConfig } from '@/lib/site-config';

function StoreButton({ href, label, sub }: { href: string; label: string; sub: string }) {
  const configured = isConfigured(href);
  const content = (
    <>
      <Smartphone size={20} />
      <span>
        <small>{label}</small>
        <strong>{sub}</strong>
      </span>
    </>
  );
  return configured ? (
    <a href={href} target="_blank" rel="noreferrer noopener" className="store-button" data-testid={`link-store-${sub.toLowerCase()}`}>
      {content}
    </a>
  ) : (
    <span className="store-button store-button-disabled" aria-disabled="true" data-testid={`store-disabled-${sub.toLowerCase()}`}>
      {content}
      <em>قريباً</em>
    </span>
  );
}

export function AppDownloadSection() {
  return (
    <section className="app-promo-section">
      <div className="container-wide app-promo-grid">
        <div className="fade-up">
          <SectionHeader kicker="التطبيق" title="حصصك في متناولك." />
          <p className="app-promo-copy">تصفح الحصص، واحجز مقعدك، وتلقّ تنبيهات بمواعيدها.</p>
          <div className="app-promo-buttons">
            <StoreButton href={siteConfig.androidStoreUrl} label="حمّل التطبيق على" sub="Android" />
            <StoreButton href={siteConfig.iosStoreUrl} label="حمّل التطبيق على" sub="iPhone" />
          </div>
        </div>
        <div className="app-promo-visual fade-up delay-1" >
          <div className="app-promo-banner"><span className="app-banner-orbit" /><img src={`${import.meta.env.BASE_URL}images/student-anywhere.webp`} width={1024} height={1024} loading="lazy" alt="طالبة تتابع حصتها وتدوّن ملاحظاتها" /><span className="app-banner-note">حصتك أقرب. أينما كنت.</span></div>
        </div>
      </div>
    </section>
  );
}
