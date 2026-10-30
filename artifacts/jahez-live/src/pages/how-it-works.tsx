import { Link } from 'wouter';
import { CirclePlay, Eye, UserPlus, Wallet } from 'lucide-react';
import { Header } from '@/components/marketing/header';
import { Footer } from '@/components/marketing/footer';
import { CTASection } from '@/components/marketing/cta-section';
import { useSeo } from '@/hooks/use-seo';
import { routes } from '@/lib/routes';
import { breadcrumbJsonLd } from '@/lib/structured-data';

const bookingSteps = [
  { icon: <Eye size={20} />, title: 'اختر الحصة', copy: 'راجع الموضوع والمدرس والموعد والسعر.' },
  { icon: <Wallet size={20} />, title: 'احجز وادفع', copy: 'أكمل الحجز بإحدى طرق الدفع المتاحة.' },
  { icon: <CirclePlay size={20} />, title: 'انضم في الموعد', copy: 'تجد تفاصيل الدخول ضمن حجزك قبل بداية الحصة.' },
];

function Timeline({ items }: { items: { icon: React.ReactNode; title: string; copy: string }[] }) {
  return (
    <ol className="hiw-timeline">
      {items.map((item, i) => (
        <li key={item.title} className="hiw-timeline-item fade-up" style={{ '--index': i } as React.CSSProperties}>
          <span className="hiw-timeline-icon">{item.icon}</span>
          <div>
            <h3>{item.title}</h3>
            <p>{item.copy}</p>
          </div>
        </li>
      ))}
    </ol>
  );
}

export default function HowItWorks() {
  useSeo({
    title: routes.howItWorks.title,
    description: routes.howItWorks.description,
    path: routes.howItWorks.path,
    jsonLd: breadcrumbJsonLd([{ label: 'الرئيسية', path: '/' }, { label: 'كيف يعمل؟' }]),
  });

  return (
    <div className="app-shell" dir="rtl">
      <Header />
      <main>
        <section className="classes-hero">
          <div className="container-wide">
            <p className="section-kicker fade-up">الدليل</p>
            <h1 className="classes-hero-title fade-up">الحجز بسيط.</h1>
            <p className="classes-hero-copy fade-up delay-1">اختر الحصة، وأكمل الحجز، ثم انضم في موعدها. إليك خطوات حضور حصتك الأولى.</p>
          </div>
        </section>

        <section className="section stagger-children">
          <div className="container-wide">
            <h2 className="section-title" style={{ marginBottom: 26 }}>الخطوات</h2>
            <Timeline items={bookingSteps} />
          </div>
        </section>

        <CTASection kicker="هل أنت مستعد للبدء؟" title="هل ترغب في التدريس؟">
          <Link href={routes.forTeachers.path} className="button-secondary" data-testid="link-hiw-teacher"><UserPlus size={16} /> انضم كمدرس</Link>
        </CTASection>
      </main>
      <Footer />
    </div>
  );
}
