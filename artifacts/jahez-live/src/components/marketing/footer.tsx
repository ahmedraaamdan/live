import { Link } from 'wouter';
import { Twitter } from 'lucide-react';
import { Logo } from '@/components/marketing/signal-mark';
import { footerGroup } from '@/lib/routes';
import { isConfigured, siteConfig } from '@/lib/site-config';
import { FacebookIcon, InstagramIcon, TikTokIcon, YouTubeIcon } from '@/components/marketing/social-icons';

const socialLinks = [
  { key: 'instagram', href: siteConfig.social.instagram, icon: InstagramIcon, label: 'انستجرام' },
  { key: 'tiktok', href: siteConfig.social.tiktok, icon: TikTokIcon, label: 'تيك توك' },
  { key: 'x', href: siteConfig.social.x, icon: Twitter, label: 'إكس' },
  { key: 'youtube', href: siteConfig.social.youtube, icon: YouTubeIcon, label: 'يوتيوب' },
  { key: 'facebook', href: siteConfig.social.facebook, icon: FacebookIcon, label: 'فيسبوك' },
].filter((s) => isConfigured(s.href));

// The other Gahez products. Every product's footer lists the rest, so a
// visitor who arrives at one can find the family.
const PRODUCTS = [
  { name: 'Gahez Agent', line: 'وكيل AI يرد على عملاءك على واتساب وماسنجر وإنستجرام', href: 'https://agent.gahez.space/' },
  { name: 'Gahez أكاديمي', line: 'نظام لإدارة الأكاديميات والمراكز التعليمية', href: 'https://academy.gahez.space/' },
  { name: 'Gahez أدوات', line: 'أدوات مجانية بالعربي', href: 'https://tools.gahez.space/' },
  { name: 'Gahez Sticky', line: 'ملاحظات تظهر مباشرة على شاشة صاحبك', href: 'https://sticky.gahez.space/' },
];

function FooterColumn({ heading, group }: { heading: string; group: 'platform' | 'help' | 'legal' }) {
  const links = footerGroup(group);
  if (!links.length) return null;
  return (
    <div className="footer-col">
      <h3 className="footer-col-title">{heading}</h3>
      <ul className="footer-col-list">
        {links.map((r) => (
          <li key={r.path}>
            <Link href={r.path}>{r.footerLabel}</Link>
          </li>
        ))}
      </ul>
    </div>
  );
}

export function Footer() {
  const year = new Date().getFullYear();
  return (
    <footer className="site-footer">
      <div className="container-wide site-footer-top">
        <div className="footer-brand-col">
          <Logo />
          <p className="footer-tagline">حصص مباشرة أونلاين مع مدرسين حقيقيين.</p>
          {socialLinks.length > 0 && (
            <div className="footer-social">
              {socialLinks.map(({ key, href, icon: Icon, label }) => (
                <a key={key} href={href} target="_blank" rel="noreferrer noopener" aria-label={label} className="icon-button">
                  <Icon size={16} />
                </a>
              ))}
            </div>
          )}
        </div>
        <FooterColumn heading="المنصة" group="platform" />
        <FooterColumn heading="المساعدة" group="help" />
        <FooterColumn heading="قانوني" group="legal" />
        <div className="footer-col">
          <h3 className="footer-col-title">منتجات جاهز</h3>
          <ul className="footer-col-list">
            {PRODUCTS.map((product) => (
              <li key={product.href}>
                <a href={`${product.href}?utm_source=live&utm_medium=footer`}>
                  <span dir="ltr">{product.name}</span>: {product.line}
                </a>
              </li>
            ))}
          </ul>
        </div>
      </div>
      <div className="container-wide site-footer-bottom">
        {/* The year is baked in at build time; the client may be in a newer one. */}
        <span className="footer-copy" suppressHydrationWarning>© {year} جاهز Live</span>
      </div>
    </footer>
  );
}
