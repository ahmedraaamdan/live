import { useEffect, useState } from 'react';
import { Link } from 'wouter';
import {
  ArrowDown, ArrowLeft, CalendarClock, CalendarDays, CarFront,
  CircleDollarSign, CirclePlay, Eye, Globe, LifeBuoy, MessageCircle,
  MonitorPlay, Radio, ShieldCheck, Sparkles, Star, TrendingUp,
  UserCheck, UserPlus, Users, Video,
} from 'lucide-react';
import { Header } from '@/components/marketing/header';
import { Footer } from '@/components/marketing/footer';
import { LAUNCH_DATE, openWaitlist } from '@/lib/waitlist';
import { SectionHeader } from '@/components/marketing/section-header';
import { StepCard } from '@/components/marketing/step-card';
import { FeatureCard } from '@/components/marketing/feature-card';
import { ClassCard } from '@/components/marketing/class-card';
import { CTASection } from '@/components/marketing/cta-section';
import { AppDownloadSection } from '@/components/marketing/app-download-section';
import { useSeo } from '@/hooks/use-seo';
import { routes } from '@/lib/routes';
import { organizationJsonLd, websiteJsonLd } from '@/lib/structured-data';
import { liveClasses, teachers, upcomingClasses } from '@/data/classes';

function LandingSignalVisual() {
  return (
    <div className="landing-visual fade-up delay-2" aria-label="معاينة لمساحة مذاكرة مباشرة">
      <div className="landing-visual-top"><span className="signal-live"><i /> LIVE / جلسة مباشرة</span><span>جاهز / 01</span></div>
      <div className="lesson-window">
        <div className="lesson-window-head"><span className="teacher-avatar avatar-a">نع</span><span><b>أ. نورة العتيبي</b><small>رياضيات • شرح النهايات</small></span><span className="window-users"><Users size={14} /> 342</span></div>
        <div className="lesson-board"><span className="board-label">THE EXPLANATION SIGNAL</span><div><small>السؤال الذي يفتح الفكرة</small><strong>متى تصبح<br /><em>النهاية واضحة؟</em></strong><div className="mini-equation"><span>سؤال</span><b>→</b><span>تجربة</span><b>→</b><span>فهم</span></div></div><span className="mini-note">هنا تبدأ الـ «آها»</span></div>
        <div className="lesson-window-foot"><span><MessageCircle size={14} /> اسأل المدرس مباشرة</span><span className="focus-chip">من بيتك، بتركيزك</span></div>
      </div>
      <div className="visual-sticker visual-sticker-one"><Radio size={16} /><span>حصص مباشرة<br /><b>كل يوم</b></span></div>
      <div className="landing-mascot" aria-hidden="true"><div data-gahez-mascot="hero" data-face="star" data-dir="rtl" /></div>
      <div className="visual-sticker visual-sticker-two"><span>+ ٦</span><small>مواد دراسية متاحة</small></div>
    </div>
  );
}

const whyLiveItems = [
  { icon: <UserCheck size={18} />, title: 'مدرس حقيقي', copy: 'اسأل، ناقش، وخد رد في نفس اللحظة.' },
  { icon: <CalendarClock size={18} />, title: 'ميعاد واضح', copy: 'تحجز الحصة وتدخل في وقتها.' },
  { icon: <TrendingUp size={18} />, title: 'اختيارات أكتر', copy: 'قارن بين مدرسين وحصص قبل ما تحجز.' },
  { icon: <Globe size={18} />, title: 'من أي مكان', copy: 'المهم تكون موجود وقت الحصة.' },
];

const trustItems = [
  { icon: <Star size={20} />, title: 'تقييمات من طلاب حقيقيين', copy: 'كل تقييم من طالب حضر الحصة فعلاً.' },
  { icon: <ShieldCheck size={20} />, title: 'مدرسين موثّقين', copy: 'علامة التوثيق تظهر على حسابات المدرسين اللي اتأكدنا منها.' },
  { icon: <CircleDollarSign size={20} />, title: 'دفع من خلال أنظمة رسمية', copy: 'المدفوعات بتتم من خلال المتجر أو بوابة الدفع — إحنا مش بنشوف بيانات كارتك.' },
  { icon: <LifeBuoy size={20} />, title: 'دعم لما تحتاجه', copy: 'عندك سؤال أو مشكلة؟ فريقنا موجود يساعدك.' },
];

export default function Home() {
  useSeo({
    title: routes.home.title,
    description: routes.home.description,
    path: routes.home.path,
    jsonLd: [organizationJsonLd(), websiteJsonLd()],
  });

  const [toast, setToast] = useState('');
  const [followed, setFollowed] = useState<Set<string>>(new Set());

  useEffect(() => {
    if (!toast) return;
    const timer = window.setTimeout(() => setToast(''), 3000);
    return () => window.clearTimeout(timer);
  }, [toast]);

  const notify = (message: string) => setToast(message);
  const toggleTeacher = (id: string, name: string) =>
    setFollowed((current) => {
      const next = new Set(current);
      if (next.has(id)) { next.delete(id); notify(`ألغيت متابعة ${name}`); } else { next.add(id); notify(`ستصلك حصص ${name} الجديدة`); }
      return next;
    });

  const premiereClass = upcomingClasses[0];

  return (
    <div className="app-shell landing-shell" dir="rtl">
      <Header />
      <main>
        {/* HERO */}
        <section className="landing-hero">
          <div className="hero-scribble landing-scribble" aria-hidden="true">∿</div>
          <div className="container-wide landing-hero-grid">
            <div className="landing-hero-copy fade-up">
              <div className="eyebrow"><span className="eyebrow-line" /> جاهز Live — مذاكرة على طريقتك <span className="eyebrow-dot" /></div>
              <h1>حصتك الجاية<br />ممكن تبدأ <em>دلوقتي.</em></h1>
              <p className="hero-copy">اكتشف حصص مباشرة، تابع المدرسين اللي بتحب شرحهم، واحجز حصتك في ثواني. مش لازم تستنى سنتر.</p>
              <div className="hero-actions">
                <Link href={routes.classes.path} className="button-primary" data-testid="link-hero-browse-classes"><CirclePlay size={18} /> تصفح الحصص</Link>
                <Link href={routes.forTeachers.path} className="button-secondary" data-testid="link-hero-for-teachers"><UserPlus size={17} /> ابدأ كمدرس</Link>
              </div>
              <div className="hero-proof landing-proof">
                <span className="proof-avatars"><i>نع</i><i>يح</i><i>لش</i></span>
                <span><b>مدرسون موثوقون</b> يشرحون لا يلقّنون</span>
                <span className="proof-separator" />
                <Link href={routes.teachers.path} className="proof-browse" data-testid="link-hero-teachers">تصفح المدرسين <ArrowLeft size={13} /></Link>
              </div>
            </div>
            <LandingSignalVisual />
          </div>
          <button className="scroll-cue" onClick={() => document.getElementById('live-now')?.scrollIntoView({ behavior: 'smooth' })} aria-label="اكتشف الحصص الشغالة دلوقتي" data-testid="button-scroll-story"><span>شوف اللي شغال دلوقتي</span><ArrowDown size={16} /></button>
        </section>

        {/* LIVE NOW */}
        <section className="section" id="live-now">
          <div className="container-wide">
            <SectionHeader kicker="الإشارة الآن" title="فيه حصص شغالة دلوقتي" index="01 / لايف" />
            <p className="section-lead">شوف مين بيشرح وابدأ حصتك في ثواني.</p>
            <div className="class-grid">
              {liveClasses.map((item) => (
                <ClassCard
                  key={item.id}
                  item={item}
                  followed={followed.has(item.teacherId)}
                  onFollow={() => toggleTeacher(item.teacherId, item.teacher)}
                  onAction={() => openWaitlist('student')}
                />
              ))}
            </div>
            <div className="section-cta-row">
              <Link href={routes.classes.path} className="text-link" data-testid="link-live-see-all">شوف كل الحصص <ArrowLeft size={15} /></Link>
            </div>
          </div>
        </section>

        {/* HOW IT WORKS */}
        <section className="steps-section">
          <div className="container-wide steps-layout">
            <div className="steps-intro">
              <p className="section-kicker">إزاي بتشتغل</p>
              <h2 className="section-title">الحكاية<br /><span className="title-accent">بسيطة.</span></h2>
              <p>مفيش تعقيد ومفيش خطوات زيادة — من أول ما تكتشف الحصة لحد ما تدخلها.</p>
              <Link href={routes.howItWorks.path} className="text-link" data-testid="link-steps-more">التفاصيل كاملة <ArrowLeft size={15} /></Link>
              <div className="steps-mascot" aria-hidden="true"><div data-gahez-mascot="desk" data-face="happy" data-dir="rtl" /></div>
            </div>
            <div className="steps-list">
              <StepCard number="١" title="اكتشف" copy="شوف الحصص والمدرسين اللي يناسبوك." icon={<Eye size={24} />} />
              <StepCard number="٢" title="اختار" copy="راجع تفاصيل الحصة والتقييمات قبل ما تقرر." icon={<Star size={24} />} />
              <StepCard number="٣" title="احجز" copy="ادفع قيمة الحصة وضمن مكانك." icon={<CalendarDays size={24} />} />
              <StepCard number="٤" title="ادخل" copy="لما الحصة تبدأ، ادخل واتعلم لايف." icon={<CirclePlay size={24} />} />
            </div>
          </div>
        </section>

        {/* PREMIERE */}
        {premiereClass && (
          <section className="premiere-section">
            <div className="container-wide premiere-grid">
              <div className="fade-up">
                <p className="section-kicker">حصص قادمة</p>
                <h2 className="section-title premiere-title">مش لازم تستنى<br />الحصة تبدأ.</h2>
                <p className="premiere-copy">المدرس يقدر يعلن عن حصته قبلها بأيام. شوف الميعاد، اعرف التفاصيل، واحجز بدري قبل ما الأماكن تخلص.</p>
                <Link href={routes.classes.path} className="button-secondary" data-testid="link-premiere-browse">شوف كل الحصص القادمة <ArrowLeft size={16} /></Link>
              </div>
              <div className="premiere-card fade-up delay-1" data-testid="card-premiere-featured">
                <div className="premiere-mascot" aria-hidden="true"><div data-gahez-mascot="perch" data-face="happy" data-dir="rtl" /></div>
                <span className="status-badge premiere-card-badge"><span className="premiere-dot" /> PREMIERE</span>
                <span className="premiere-card-date"><CalendarClock size={14} /> {premiereClass.date} — {premiereClass.time}</span>
                <h3>{premiereClass.title}</h3>
                <div className="upcoming-teacher"><span className={`teacher-avatar ${premiereClass.avatar}`}>{premiereClass.initials}</span><span>{premiereClass.teacher}</span></div>
                <div className="card-price-row">
                  <span className="card-price">{premiereClass.price}</span>
                  <button className="card-action" onClick={() => notify(`تم حفظ مقعدك في حصة ${premiereClass.teacher}`)} data-testid="button-premiere-reserve">احجز مقعدك الآن</button>
                </div>
              </div>
            </div>
          </section>
        )}

        {/* WHY LIVE CLASSES */}
        <section className="why-live-section">
          <div className="container-wide">
            <SectionHeader kicker="السبب" title="ليه حصة لايف؟" index="03 / السبب" />
            <div className="why-live-grid">
              {whyLiveItems.map((item) => (
                <div className="why-live-item hover-lift" key={item.title}>
                  <span className="why-live-icon">{item.icon}</span>
                  <div>
                    <h3>{item.title}</h3>
                    <p>{item.copy}</p>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* NO COMMUTE */}
        <section className="friction-section" id="why-live">
          <div className="container-wide">
            <div className="section-intro landing-section-intro"><div><p className="section-kicker">المذاكرة لا تحتاج كل هذا</p><h2 className="section-title">خلّ عنك طريق السنتر.<br /><span className="title-accent">خلّ المكان يشتغل لك.</span></h2></div><span className="section-index">04 / الراحة</span></div>
            <p className="friction-lead">زحمة الطريق، وقت المواصلات، صوت المكان، وشرودك بين كل هذا… ليست جزءاً من الدرس. في جاهز Live، الحصة تأتيك إلى مكان هادئ تعرفه.</p>
            <div className="friction-grid">
              <FeatureCard icon={<CarFront size={22} />} number="01" title="لا طريق ولا مواصلات" copy="وفّر وقت المشوار وابدأ الدرس في الدقيقة التي تناسبك." />
              <FeatureCard icon={<MonitorPlay size={22} />} number="02" title="حصتك، من بيتك" copy="لا سنتر. لا زحمة. افتح الشاشة واجلس في المكان الذي تشعر فيه بالراحة." featured underline="وقت أكثر للفهم" />
              <FeatureCard icon={<MessageCircle size={22} />} number="03" title="شرح بلا ضوضاء" copy="اسأل المدرس، تابع الفكرة، وركّز بعيداً عن زحمة الأصوات والمقاعد." />
              <FeatureCard icon={<Sparkles size={22} />} number="04" title="تركيز يشبهك" copy="أوقف ما يشتتك، ارجع للنقطة الصعبة، وكمل مع المدرس على إيقاعك." />
            </div>
          </div>
        </section>

        {/* FOR TEACHERS */}
        <section className="teacher-cta-section">
          <div className="container-wide teacher-cta-grid">
            <div className="fade-up">
              <p className="section-kicker">مدرس؟</p>
              <h2 className="section-title teacher-cta-title">اعمل مركزك<br />أونلاين.</h2>
              <p className="teacher-cta-copy">مش محتاج تبدأ من الصفر. افتح حصتك، حدد ميعادها وسعرها، وخلي الطلاب يكتشفوك ويحجزوا معاك.</p>
              <Link href={routes.forTeachers.path} className="button-primary" data-testid="link-teacher-cta-more"><UserPlus size={17} /> ابدأ كمدرس</Link>
              <div className="teacher-cta-mascot" aria-hidden="true"><div data-gahez-mascot="phone" data-face="talk" data-dir="rtl" /></div>
            </div>
            <ul className="teacher-cta-list">
              <li><Video size={17} /> افتح حصتك</li>
              <li><CircleDollarSign size={17} /> حدد السعر</li>
              <li><CalendarClock size={17} /> حدد الميعاد</li>
              <li><Users size={17} /> اجمع متابعين</li>
              <li><Star size={17} /> استقبل تقييمات</li>
              <li><TrendingUp size={17} /> تابع أرباحك</li>
            </ul>
          </div>
        </section>

        {/* DISCOVERY */}
        <section className="section">
          <div className="container-wide">
            <SectionHeader kicker="اكتشف بطريقتك" title="مش هتبص في حتة واحدة." index="06 / اكتشف" />
            <div className="discovery-tags">
              {['الأكثر مشاهدة', 'الأعلى تقييماً', 'حصص شغالة دلوقتي', 'حصص جاية', 'مدرسين جدد', 'المدرسين اللي بتتابعهم'].map((tag) => (
                <span className="discovery-tag" key={tag}>{tag}</span>
              ))}
            </div>
            <p className="section-lead discovery-note">الترتيب بياخد في الاعتبار أكتر من عامل — مش بس عدد المشاهدات — عشان يوصلك المدرس اللي فعلاً يناسبك.</p>
          </div>
        </section>

        {/* TEACHERS PROOF */}
        <section className="teacher-proof-section">
          <div className="container-wide">
            <div className="section-head"><div><p className="section-kicker">أصوات تستحق الثقة</p><h2 className="section-title">مدرسون يفتحون لك<br /><span className="title-accent">باب الفكرة.</span></h2></div><Link href={routes.teachers.path} className="text-link" data-testid="link-teacher-browse">استكشف المدرسين <ArrowLeft size={15} /></Link></div>
            <div className="proof-quote"><div className="quote-mark">"</div><blockquote>«أفضل شيء في الحصة المباشرة أن الطالب لا يظل وحده أمام السؤال. أراه يفكر، وأعرف أين أبدأ الشرح.»</blockquote><div className="quote-author"><span className="teacher-avatar avatar-a">نع</span><span><b>أ. نورة العتيبي</b><small>مدرسة رياضيات • موثقة على جاهز Live</small></span><ShieldCheck size={18} /></div></div>
            <div className="teacher-proof-cards">{teachers.slice(0, 3).map((teacher) => <article className="proof-teacher-card" key={teacher.id}><div className="proof-teacher-top"><span className={`teacher-avatar ${teacher.avatar}`}>{teacher.initials}</span>{teacher.verified && <span className="verified"><ShieldCheck size={13} /> موثّق</span>}</div><h3>{teacher.name}</h3><p>{teacher.specialty}</p><button className={`expert-follow ${followed.has(teacher.id) ? 'active' : ''}`} onClick={() => toggleTeacher(teacher.id, teacher.name)} data-testid={`button-landing-follow-${teacher.id}`}>{followed.has(teacher.id) ? 'تتابعه الآن' : 'تابع المعلم'}</button></article>)}</div>
          </div>
        </section>

        {/* TRUST */}
        <section className="trust-section">
          <div className="container-wide">
            <SectionHeader kicker="الثقة" title="ليه تطمن معانا؟" index="08 / ثقة" />
            <div className="trust-grid">
              {trustItems.map((item) => (
                <div className="trust-item" key={item.title}>
                  <span className="trust-icon">{item.icon}</span>
                  <h3>{item.title}</h3>
                  <p>{item.copy}</p>
                </div>
              ))}
            </div>
          </div>
        </section>

        <AppDownloadSection />

        {/* FINAL CTA */}
        <CTASection variant="landing" kicker="جاهز للحصة الأولى؟" title={<>جاهز تبدأ<br /><span>حصتك؟</span></>} copy={`التسجيل بيفتح يوم الإطلاق، ${LAUNCH_DATE}. احجز مكانك دلوقتي ونبلّغك قبل أي حد.`}>
          <div className="final-cta-actions">
            <Link href={routes.classes.path} className="button-secondary" data-testid="link-final-browse">تصفح الحصص</Link>
            <button className="button-secondary" onClick={() => openWaitlist()} data-testid="button-final-waitlist"><UserPlus size={16} /> احجز مكانك</button>
          </div>
          <div className="landing-cta-mascot" aria-hidden="true"><div data-gahez-mascot="dance" data-face="surprised" data-dir="rtl" /></div>
        </CTASection>
      </main>
      <Footer />
      {toast && <div className="toast" role="status" data-testid="status-toast">{toast}</div>}
    </div>
  );
}
