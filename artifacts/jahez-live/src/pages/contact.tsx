import { type FormEvent, useState } from 'react';
import { Mail, MessageCircle, Send } from 'lucide-react';
import { ContentPage } from '@/components/marketing/content-page';
import { useSeo } from '@/hooks/use-seo';
import { routes } from '@/lib/routes';
import { breadcrumbJsonLd } from '@/lib/structured-data';
import { isConfigured, siteConfig } from '@/lib/site-config';

export default function Contact() {
  useSeo({
    title: routes.contact.title,
    description: routes.contact.description,
    path: routes.contact.path,
    jsonLd: breadcrumbJsonLd([{ label: 'الرئيسية', path: '/' }, { label: 'تواصل معنا' }]),
  });

  const [sent, setSent] = useState(false);

  const submit = (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    // TODO: wire to a real backend/email endpoint (e.g. artifacts/api-server)
    // before launch. The form is fully built and validated client-side —
    // only the submission target needs connecting.
    setSent(true);
  };

  const directChannels = [
    { key: 'email', configured: isConfigured(siteConfig.supportEmail), href: `mailto:${siteConfig.supportEmail}`, icon: Mail, label: siteConfig.supportEmail },
    { key: 'whatsapp', configured: isConfigured(siteConfig.whatsappNumber), href: `https://wa.me/${siteConfig.whatsappNumber}`, icon: MessageCircle, label: siteConfig.whatsappNumber },
  ].filter((c) => c.configured);

  return (
    <ContentPage
      eyebrow="مركز المساعدة"
      title="عندك سؤال؟"
      subtitle="لو عندك سؤال عن حجز، مدرس، دفع أو استخدام المنصة، ابعتلنا."
      crumbs={[{ label: 'الرئيسية', path: '/' }, { label: 'تواصل معنا' }]}
    >
      <div className="mp-contact-grid">
        <div>
          {sent ? (
            <div className="mp-contact-success fade-up" data-testid="text-contact-success">
              <Send size={22} />
              <h2>وصلتنا رسالتك.</h2>
              <p>هنراجعها ونتواصل معاك في أقرب وقت.</p>
            </div>
          ) : (
            <form className="auth-form mp-contact-form" onSubmit={submit} data-testid="form-contact">
              <label>
                الاسم
                <input required placeholder="اسمك بالكامل" data-testid="input-contact-name" />
              </label>
              <label>
                البريد الإلكتروني
                <input required type="email" placeholder="you@example.com" data-testid="input-contact-email" />
              </label>
              <label>
                رقم الهاتف <span className="mp-optional">(اختياري)</span>
                <input type="tel" placeholder="01xxxxxxxxx" data-testid="input-contact-phone" />
              </label>
              <label>
                الموضوع
                <input required placeholder="عايز تتكلم عن إيه؟" data-testid="input-contact-subject" />
              </label>
              <label>
                الرسالة
                <textarea required rows={5} placeholder="اكتب رسالتك هنا..." data-testid="input-contact-message" />
              </label>
              <button className="button-primary auth-submit" type="submit" data-testid="button-contact-submit">
                <Send size={16} /> إرسال الرسالة
              </button>
            </form>
          )}
        </div>
        <div className="mp-contact-side">
        <div className="contact-mascot" aria-hidden="true"><div data-gahez-mascot="phone" data-face="talk" data-dir="rtl" /></div>
        {directChannels.length > 0 && (
          <div className="mp-contact-channels">
            <h2>قنوات تانية</h2>
            {directChannels.map(({ key, href, icon: Icon, label }) => (
              <a key={key} href={href} target="_blank" rel="noreferrer noopener" className="mp-contact-channel" data-testid={`link-contact-${key}`}>
                <Icon size={18} /> {label}
              </a>
            ))}
          </div>
        )}
        </div>
      </div>
    </ContentPage>
  );
}
