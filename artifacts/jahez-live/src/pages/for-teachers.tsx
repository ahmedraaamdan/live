import {
  CalendarClock,
  CircleDollarSign,
  UserPlus,
  Users,
  Video,
} from "lucide-react";
import { Header } from "@/components/marketing/header";
import { Footer } from "@/components/marketing/footer";
import { openSignup } from "@/lib/signup";
import { SectionHeader } from "@/components/marketing/section-header";
import { CTASection } from "@/components/marketing/cta-section";
import { useSeo } from "@/hooks/use-seo";
import { routes } from "@/lib/routes";
import { breadcrumbJsonLd } from "@/lib/structured-data";

const sections = [
  { icon: <Video size={22} />, title: "إنشاء حصص" },
  { icon: <CalendarClock size={22} />, title: "تحديد السعر والموعد" },
  { icon: <Users size={22} />, title: "عرض حصصك للطلاب" },
  { icon: <CircleDollarSign size={22} />, title: "حجز ودفع" },
];

export default function ForTeachers() {
  useSeo({
    title: routes.forTeachers.title,
    description: routes.forTeachers.description,
    path: routes.forTeachers.path,
    jsonLd: breadcrumbJsonLd([
      { label: "الرئيسية", path: "/" },
      { label: "للمدرسين" },
    ]),
  });

  return (
    <div className="app-shell" dir="rtl">
      <Header />
      <main>
        <section
          className="landing-hero"
          style={{ minHeight: "auto", paddingBottom: 60 }}
        >
          <div className="container-wide teacher-hero-grid">
            <div className="landing-hero-copy fade-up">
              <div className="eyebrow">
                <span className="eyebrow-line" /> للمدرسين{" "}
                <span className="eyebrow-dot" />
              </div>
              <h1 style={{ fontSize: "var(--text-display-hero)" }}>
                ركّز على الشرح.
                <br />
                <em>ونظّم حصصك معنا.</em>
              </h1>
              <p className="hero-copy">
                أضف حصصك ومواعيدها وأسعارها، وتابع الحجوزات من حسابك. يجدك
                الطلاب ويطّلعون على ما تقدمه قبل الحجز.
              </p>
              <div className="hero-actions">
                <button
                  className="button-primary"
                  onClick={() => openSignup("teacher")}
                  data-testid="button-teachers-hero-cta"
                >
                  <UserPlus size={18} /> انضم كمدرس
                </button>
              </div>
            </div>
            <div
              className="teacher-dashboard-preview fade-up delay-1"
              aria-hidden="true"
            >
              <div className="teacher-dashboard-head">
                <span>مساحة المدرس</span>
                <span>معاينة توضيحية</span>
              </div>
              <div className="studio-workspace-title">
                <Video size={30} />
                <strong>
                  حصتك تبدأ
                  <br />
                  بفكرة واضحة.
                </strong>
              </div>
              <div className="studio-workspace-row">
                <span>01</span>
                <div>
                  <b>أضف موضوع الحصة</b>
                  <small>عنوان يوضح ما سيتعلّمه الطالب</small>
                </div>
                <Video size={20} />
              </div>
              <div className="studio-workspace-row">
                <span>02</span>
                <div>
                  <b>اختر الموعد والسعر</b>
                  <small>تفاصيل يراجعها الطالب قبل الحجز</small>
                </div>
                <CalendarClock size={20} />
              </div>
              <div className="studio-workspace-row">
                <span>03</span>
                <div>
                  <b>استعد للقاء طلابك</b>
                  <small>شرح مباشر ومساحة للمناقشة</small>
                </div>
                <Users size={20} />
              </div>
            </div>
          </div>
        </section>

        <section className="section">
          <div className="container-wide">
            <SectionHeader
              kicker="ماذا يقدم لك جاهز Live؟"
              title="من إعداد الحصة إلى متابعة الحجز."
            />
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

        <CTASection
          kicker="خطوتك الأولى"
          title="قدّم حصتك الأولى عبر الإنترنت."
          copy="أنشئ حساب المدرس وأضف تفاصيل حصتك الأولى."
        >
          <button
            className="button-secondary"
            onClick={() => openSignup("teacher")}
            data-testid="button-teachers-final-cta"
          >
            <UserPlus size={16} /> انضم كمدرس
          </button>
        </CTASection>
      </main>
      <Footer />
    </div>
  );
}
