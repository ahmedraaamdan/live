import { type FormEvent, useState } from 'react';
import { ClientOnly } from '@/components/client-only';
import { Mail, MessageCircle, Send } from 'lucide-react';
import { ContentPage } from '@/components/marketing/content-page';
import { useSeo } from '@/hooks/use-seo';
import { routes } from '@/lib/routes';
import { breadcrumbJsonLd } from '@/lib/structured-data';
import { isConfigured, siteConfig } from '@/lib/site-config';

/** Where to reach us when the form itself cannot send. */
const FALLBACK_WHATSAPP = 'https://wa.me/201111385543';
const FALLBACK_EMAIL = 'support@gahez.space';

const ERRORS = {
  invalid: 'اكتب اسمك وإيميل صحيح، والموضوع والرسالة.',
  busy: 'وصلنا رسايل كتير من نفس الجهاز. جرّب تاني بعد شوية.',
  failed: 'مقدرناش نبعت رسالتك دلوقتي. جرّب تاني بعد شوية.',
} as const;

type ContactState = 'idle' | 'sending' | 'sent' | keyof typeof ERRORS;

/** POSTs to the server's /api/contact, which mails the team and the visitor. */
async function sendContact(fields: Record<string, string>): Promise<'sent' | keyof typeof ERRORS> {
  try {
    const response = await fetch('/api/contact', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(fields),
    });
    if (response.ok) {
      const body = (await response.json().catch(() => null)) as { success?: boolean } | null;
      return body?.success ? 'sent' : 'failed';
    }
    if (response.status === 422) return 'invalid';
    if (response.status === 429) return 'busy';
    return 'failed';
  } catch {
    return 'failed';
  }
}

export default function Contact() {
  useSeo({
    title: routes.contact.title,
    description: routes.contact.description,
    path: routes.contact.path,
    jsonLd: breadcrumbJsonLd([{ label: 'الرئيسية', path: '/' }, { label: 'تواصل معنا' }]),
  });

  const [state, setState] = useState<ContactState>('idle');

  const submit = async (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const form = new FormData(e.currentTarget);
    const field = (name: string) => String(form.get(name) ?? '');
    setState('sending');
    setState(
      await sendContact({
        name: field('name'),
        email: field('email'),
        phone: field('phone'),
        subject: field('subject'),
        message: field('message'),
        _gotcha: field('company'),
      }),
    );
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
          {state === 'sent' ? (
            <div className="mp-contact-success fade-up" data-testid="text-contact-success">
              <Send size={22} />
              <h2>وصلتنا رسالتك.</h2>
              <p>هنراجعها ونتواصل معاك في أقرب وقت.</p>
            </div>
          ) : (
            <form className="auth-form mp-contact-form" onSubmit={submit} data-testid="form-contact">
              <label>
                الاسم
                <input required name="name" maxLength={120} placeholder="اسمك بالكامل" data-testid="input-contact-name" />
              </label>
              <label>
                البريد الإلكتروني
                <input required name="email" type="email" dir="ltr" maxLength={200} placeholder="you@example.com" data-testid="input-contact-email" />
              </label>
              <label>
                رقم الهاتف <span className="mp-optional">(اختياري)</span>
                <input name="phone" type="tel" dir="ltr" maxLength={40} placeholder="01xxxxxxxxx" data-testid="input-contact-phone" />
              </label>
              <label>
                الموضوع
                <input required name="subject" maxLength={200} placeholder="عايز تتكلم عن إيه؟" data-testid="input-contact-subject" />
              </label>
              <label>
                الرسالة
                <textarea required name="message" maxLength={5000} rows={5} placeholder="اكتب رسالتك هنا..." data-testid="input-contact-message" />
              </label>
              {/* Hidden from people; a bot that fills every field fills this one too. */}
              <input className="waitlist-trap" name="company" tabIndex={-1} autoComplete="off" aria-hidden="true" />
              {state in ERRORS ? (
                <p className="waitlist-error" role="alert" data-testid="text-contact-error">
                  {ERRORS[state as keyof typeof ERRORS]}
                  <br />
                  تقدر كمان تكلّمنا مباشرة على{' '}
                  <a href={FALLBACK_WHATSAPP} target="_blank" rel="noreferrer noopener">واتساب</a> أو{' '}
                  <a href={`mailto:${FALLBACK_EMAIL}`} dir="ltr">{FALLBACK_EMAIL}</a>.
                </p>
              ) : null}
              <button className="button-primary auth-submit" type="submit" disabled={state === 'sending'} data-testid="button-contact-submit">
                <Send size={16} /> {state === 'sending' ? 'جارٍ الإرسال…' : 'إرسال الرسالة'}
              </button>
            </form>
          )}
        </div>
        <div className="mp-contact-side">
        <div className="contact-mascot" aria-hidden="true"><ClientOnly><div data-gahez-mascot="phone" data-face="talk" data-dir="rtl" /></ClientOnly></div>
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
