import { CalendarClock, CircleDollarSign, UserPlus, Users, Video } from 'lucide-react';
import { Header } from '@/components/marketing/header';
import { Footer } from '@/components/marketing/footer';
import { openSignup } from '@/lib/signup';
import { SectionHeader } from '@/components/marketing/section-header';
import { CTASection } from '@/components/marketing/cta-section';
import { useSeo } from '@/hooks/use-seo';
import { routes } from '@/lib/routes';
import { breadcrumbJsonLd } from '@/lib/structured-data';

const sections = [
  { icon: <Video size={22} />, title: 'إنشاء حصص' },
  { icon: <CalendarClock size={22} />, title: 'تحديد السعر والميعاد' },
  { icon: <Users size={22} />, title: 'ظهور للطلاب' },
  { icon: <CircleDollarSign size={22} />, title: 'حجز ودفع' },
];

export default function ForTeachers() {
  useSeo({
    title: routes.forTeachers.title,
    description: routes.forTeachers.description,
    path: routes.forTeachers.path,
    jsonLd: breadcrumbJsonLd([{ label: 'الرئيسية', path: '/' }, { label: 'للمدرسين' }]),
  });


  return (
    <div className="app-shell" dir="rtl">
      <Header />
      <main>
        <section className="landing-hero" style={{ minHeight: 'auto', paddingBottom: 60 }}>
          <div className="container-wide teacher-hero-grid">
            <div className="landing-hero-copy fade-up">
              <div className="eyebrow"><span className="eyebrow-line" /> للمدرسين <span className="eyebrow-dot" /></div>
              <h1 style={{ fontSize: 'var(--text-display-hero)' }}>درّس أونلاين<br /><em>من غير ما تبني المنصة بنفسك.</em></h1>
              <p className="hero-copy">افتح حسابك كمدرس، اعمل حصتك، حدد الميعاد والسعر، وخلي الطلاب يلاقوك ويحجزوا.</p>
              <div className="hero-actions">
                <button className="button-primary" onClick={() => openSignup('teacher')} data-testid="button-teachers-hero-cta"><UserPlus size={18} /> ابدأ كمدرس</button>
              </div>
            </div>
            <div className="teacher-dashboard-preview fade-up delay-1" aria-hidden="true">
              <div className="teacher-dashboard-head"><span>لوحة المدرس</span><span className="signal-live"><i /> LIVE</span></div>
              <div className="teacher-dashboard-stats">
                <div><strong>٣٤٢</strong><span>مشاهد الآن</span></div>
                <div><strong>٤٫٩</strong><span>التقييم</span></div>
                <div><strong>١٢٫٤k</strong><span>متابع</span></div>
              </div>
              <div className="teacher-dashboard-bar" />
              <div className="teacher-dashboard-bar short" />
            </div>
          </div>
        </section>

        <section className="section">
          <div className="container-wide">
            <SectionHeader kicker="ليه جاهز Live؟" title="كل حاجة تحتاجها عشان تبدأ." />
            <div className="friction-grid teacher-features-grid">
              {sections.map((s) => (
                <div className="friction-card hover-lift" key={s.title}>
                  <span className="friction-icon">{s.icon}</span>
                  <h3>{s.title}</h3>
                </div>
              ))}
            </div>
          </div>
        </section>

        <CTASection kicker="خطوتك الأولى" title="ابدأ تدريسك أونلاين النهاردة." copy="افتح حسابك كمدرس مجانًا وابدأ حصتك الأولى.">
          <button className="button-secondary" onClick={() => openSignup('teacher')} data-testid="button-teachers-final-cta"><UserPlus size={16} /> ابدأ كمدرس</button>
        </CTASection>
      </main>
      <Footer />
    </div>
  );
}
