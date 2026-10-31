import { useState } from "react";
import { Link } from "wouter";
import {
  ArrowDown,
  ArrowDownLeft,
  ArrowLeft,
  ArrowUpLeft,
  BookOpen,
  CalendarDays,
  Check,
  CirclePlay,
  GraduationCap,
  MessageCircle,
  Plus,
  Radio,
  ShieldCheck,
  Users,
} from "lucide-react";
import { AnimatePresence, motion, useReducedMotion } from "framer-motion";
import { Header } from "@/components/marketing/header";
import { Footer } from "@/components/marketing/footer";
import { ClassCard } from "@/components/marketing/class-card";
import { ClassCarousel } from "@/components/marketing/class-carousel";
import { AppDownloadSection } from "@/components/marketing/app-download-section";
import { PromoVideoSection } from "@/components/marketing/promo-video-section";
import { FaqAccordion } from "@/components/marketing/faq-accordion";
import {
  Reveal,
  TiltSurface,
  ReadingProgress,
  HeroScene,
} from "@/components/marketing/studio-motion";
import { HeroArtwork } from "@/components/marketing/hero-artwork";
import { TeacherPhoto } from "@/components/marketing/teacher-photo";
import { InquirySection } from "@/components/marketing/inquiry-section";
import { useSeo } from "@/hooks/use-seo";
import { routes } from "@/lib/routes";
import { openSignup } from "@/lib/signup";
import { organizationJsonLd, promoVideoJsonLd, websiteJsonLd } from "@/lib/structured-data";
import { classes, subjects, teachers } from "@/data/classes";
import { faqCategories } from "@/data/faq";

const journey = [
  {
    number: "01",
    word: "اختر.",
    title: "البداية من احتياجك.",
    copy: "مادة تحتاج إلى مراجعتها؟ فكرة توقفت عندها؟ تصفح الحصص وتعرّف إلى من يشرحها، ثم اختر ما يناسبك.",
    icon: BookOpen,
    detail: "المادة · المدرس · أسلوب الشرح",
  },
  {
    number: "02",
    word: "احجز.",
    title: "كل التفاصيل أمامك.",
    copy: "راجع موعد الحصة وسعرها وتقييمات المدرس. أكمل الحجز، وستجد تفاصيل الدخول في حسابك.",
    icon: CalendarDays,
    detail: "موعد واضح · سعر محدد · حجز من حسابك",
  },
  {
    number: "03",
    word: "اسأل.",
    title: "هنا تتضح الفكرة.",
    copy: "انضم في الموعد، وتابع الشرح، واطرح سؤالك حين تحتاج إلى توضيح. فالسؤال جزء من الحصة.",
    icon: MessageCircle,
    detail: "شرح مباشر · سؤال · مناقشة",
  },
];

export default function Home() {
  useSeo({
    title: routes.home.title,
    description: routes.home.description,
    path: routes.home.path,
    jsonLd: [organizationJsonLd(), websiteJsonLd(), promoVideoJsonLd()],
  });
  const [subject, setSubject] = useState("الكل");
  const [followed, setFollowed] = useState<Set<string>>(new Set());
  const reduce = useReducedMotion();
  const selected = classes.filter((item) => item.subject === subject);
  const follow = (id: string) =>
    setFollowed((current) => {
      const next = new Set(current);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });

  return (
    <div className="app-shell studio-home" dir="rtl">
      <ReadingProgress />
      <Header />
      <main>
        <section className="studio-hero">
          <div className="container-wide studio-hero-top">
            <span className="studio-kicker">
              <i /> حصص ودورات مباشرة عبر الإنترنت
            </span>
            <span className="studio-edition" dir="ltr">
              A SPACE TO UNDERSTAND.
            </span>
          </div>
          <div className="container-wide studio-hero-grid">
            <div className="studio-hero-copy">
              <p className="hero-prelude">من مكانك، إلى ما تريد تعلّمه.</p>
              <h1>
                <span className="hero-line">
                  <motion.span
                    initial={reduce ? false : { y: "105%" }}
                    animate={{ y: 0 }}
                    transition={{ duration: 0.85, ease: [0.16, 1, 0.3, 1] }}
                  >
                    حصتك جاهزة؟
                  </motion.span>
                </span>
                <span className="hero-line hero-accent">
                  <motion.span
                    initial={reduce ? false : { y: "105%" }}
                    animate={{ y: 0 }}
                    transition={{
                      duration: 1,
                      delay: 0.12,
                      ease: [0.16, 1, 0.3, 1],
                    }}
                  >
                    تعلّم من مكانك<span className="hero-period">.</span>
                  </motion.span>
                </span>
              </h1>
              <Reveal delay={0.2}>
                <p className="studio-hero-description">
                  اختر ما تريد تعلّمه، وتعرّف إلى المدرس، واحجز حصتك. تعلّم معه
                  مباشرة، واسأله حين تحتاج إلى شرح أوضح.
                </p>
                <div className="studio-hero-actions">
                  <Link
                    href={routes.classes.path}
                    className="button-primary studio-button"
                    data-testid="link-hero-browse-classes"
                  >
                    اكتشف حصتك <ArrowUpLeft size={22} />
                  </Link>
                  <Link
                    href={routes.forTeachers.path}
                    className="studio-underlink"
                  >
                    هل ترغب في التدريس؟ <ArrowLeft size={16} />
                  </Link>
                </div>
              </Reveal>
              <div className="studio-hero-note">
                <span className="note-line" />
                <span>
                  مدرس تختاره.
                  <br />
                  <b>وحوار تتعلّم منه.</b>
                </span>
                <ArrowDownLeft size={34} strokeWidth={1.2} />
              </div>
            </div>
            <Reveal delay={0.12} className="studio-lab-wrap">
              <HeroScene>
                <HeroArtwork />
              </HeroScene>
            </Reveal>
          </div>
          <div className="container-wide studio-hero-bottom">
            <a href="#discover" className="studio-scroll">
              استكشف مساحتك <ArrowDown size={16} />
            </a>
            <span>شرح مباشر. مساحة للسؤال. وقت أكثر للفهم.</span>
            <span className="studio-page-number" dir="ltr">
              01 — GAHEZ LIVE
            </span>
          </div>
        </section>

        <section className="studio-subject-strip" aria-label="استكشف المواد">
          <div className="container-wide">
            <span>ما الذي يثير فضولك؟</span>
            <div>
              {subjects
                .filter((item) => item !== "الكل")
                .map((item, index) => (
                  <a
                    key={item}
                    href="#discover"
                    onClick={() => setSubject(item)}
                  >
                    <span dir="ltr">0{index + 1}</span>
                    {item}
                    <ArrowUpLeft size={17} />
                  </a>
                ))}
            </div>
          </div>
        </section>

        <PromoVideoSection />

        <section className="studio-section studio-discover" id="discover">
          <div className="container-wide">
            <Reveal className="studio-section-head">
              <div>
                <span className="studio-kicker">اختر بدايتك</span>
                <h2>
                  فكرة جديدة.
                  <br />
                  <span>حصة تستحق وقتك.</span>
                </h2>
              </div>
              <div className="studio-head-aside">
                <p>
                  تعرّف إلى موضوع الحصة ومدرسها.
                  <br />
                  واختر ما تحتاج إلى فهمه اليوم.
                </p>
                <Link href={routes.classes.path} className="studio-underlink">
                  جميع الحصص <ArrowLeft size={19} />
                </Link>
              </div>
            </Reveal>
            <div
              className="studio-filter-row"
              role="group"
              aria-label="تصفية الحصص حسب المادة"
            >
              {subjects.map((item) => (
                <button
                  key={item}
                  aria-pressed={subject === item}
                  onClick={() => setSubject(item)}
                  className={subject === item ? "selected" : ""}
                >
                  {item}
                  {subject === item && <span className="filter-dot" />}
                </button>
              ))}
            </div>
            <p className="studio-demo-note">
              <Radio size={13} /> نماذج توضيحية للحصص والمدرسين. التسجيل متاح
              قبل الإطلاق.
            </p>
            {subject === "الكل" ? (
              <ClassCarousel>
                {classes.map((item) => (
                  <div key={item.id}>
                    <ClassCard
                      item={item}
                      followed={followed.has(item.teacherId)}
                      onFollow={() => follow(item.teacherId)}
                      onAction={() => openSignup("student")}
                    />
                  </div>
                ))}
              </ClassCarousel>
            ) : (
              <motion.div
                layout={!reduce}
                className="class-grid studio-class-grid"
              >
                <AnimatePresence mode="popLayout" initial={false}>
                  {selected.map((item, i) => (
                    <motion.div
                      key={item.id}
                      layout={!reduce}
                      initial={reduce ? false : { opacity: 0, y: 28 }}
                      animate={{ opacity: 1, y: 0 }}
                      exit={{ opacity: 0, scale: 0.96 }}
                      transition={{ duration: 0.35, delay: i * 0.04 }}
                    >
                      <ClassCard
                        item={item}
                        followed={followed.has(item.teacherId)}
                        onFollow={() => follow(item.teacherId)}
                        onAction={() => openSignup("student")}
                      />
                    </motion.div>
                  ))}
                </AnimatePresence>
              </motion.div>
            )}
          </div>
        </section>

        <section className="studio-section studio-journey" id="how-it-works">
          <div className="container-wide studio-journey-layout">
            <div className="studio-journey-intro">
              <span className="studio-kicker">ثلاث خطوات وبداية جديدة</span>
              <h2>
                من «كيف؟»
                <br />
                إلى <span>«فهمت».</span>
              </h2>
              <p>
                ثلاث خطوات تفصل بينك
                <br />
                وبين حصتك الأولى.
              </p>
              <Link
                href={routes.howItWorks.path}
                className="studio-round-link"
                aria-label="تعرّف إلى خطوات الحجز"
              >
                <ArrowDownLeft size={32} />
              </Link>
              <span className="journey-annotation">
                السؤال بداية، وليس عائقًا.
              </span>
            </div>
            <div className="studio-journey-stack">
              {journey.map((item, index) => (
                <Reveal
                  className={`studio-journey-step step-${index}`}
                  key={item.number}
                >
                  <div className="journey-step-top">
                    <span dir="ltr">{item.number} / 03</span>
                    <item.icon size={27} strokeWidth={1.4} />
                  </div>
                  <div className="journey-word">{item.word}</div>
                  <h3>{item.title}</h3>
                  <p>{item.copy}</p>
                  <span className="journey-detail">{item.detail}</span>
                </Reveal>
              ))}
            </div>
          </div>
        </section>

        <section className="studio-section studio-teachers">
          <div className="container-wide">
            <Reveal className="studio-section-head">
              <div>
                <span className="studio-kicker">تعرّف إلى مدرّسيك</span>
                <h2>
                  لكل مدرس أسلوب.
                  <br />
                  <span>اختر ما يناسبك.</span>
                </h2>
              </div>
              <Link href={routes.teachers.path} className="studio-underlink">
                تعرّف إلى المدرسين <ArrowLeft size={19} />
              </Link>
            </Reveal>
            <div className="studio-teacher-list">
              {teachers.slice(0, 3).map((teacher, index) => (
                <Reveal key={teacher.id} delay={index * 0.05}>
                  <article className="studio-teacher-row">
                    <span className="teacher-index" dir="ltr">
                      0{index + 1}
                    </span>
                    <TeacherPhoto
                      id={teacher.id}
                      name={teacher.name}
                      className={`teacher-avatar ${teacher.avatar}`}
                    />
                    <div className="studio-teacher-name">
                      <h3>{teacher.name}</h3>
                      <span>
                        <ShieldCheck size={13} /> شخصية تعليمية توضيحية
                      </span>
                    </div>
                    <span className="teacher-subject-label">
                      {teacher.subject}
                    </span>
                    <button
                      className={`studio-follow ${followed.has(teacher.id) ? "is-followed" : ""}`}
                      onClick={() => follow(teacher.id)}
                      aria-pressed={followed.has(teacher.id)}
                      aria-label={`${followed.has(teacher.id) ? "إلغاء متابعة" : "متابعة"} ${teacher.name}`}
                    >
                      {followed.has(teacher.id) ? (
                        <Check size={19} />
                      ) : (
                        <Plus size={19} />
                      )}
                      <span>
                        {followed.has(teacher.id) ? "تتابعه الآن" : "متابعة"}
                      </span>
                    </button>
                  </article>
                </Reveal>
              ))}
            </div>
          </div>
        </section>

        <section className="studio-section studio-teach">
          <div className="container-wide studio-teach-grid">
            <Reveal>
              <span className="studio-kicker">للمدرّسين</span>
              <h2>
                لديك ما تشرحه.
                <br />
                <span>ولنا مكان يجمعكم.</span>
              </h2>
              <p>
                أضف حصصك ومواعيدها وأسعارها. يجد الطلاب تفاصيلها، ويتعرّفون إلى
                ما تقدمه، ويحجزون معك عبر المنصة.
              </p>
              <Link
                href={routes.forTeachers.path}
                className="button-primary studio-button"
              >
                ابدأ كمدرس <ArrowUpLeft size={21} />
              </Link>
            </Reveal>
            <TiltSurface className="studio-teacher-desk teacher-workflow-board">
              <div className="teacher-board-heading"><GraduationCap size={26}/><span>مساحتك لتصنع فرقًا.</span><Radio size={20}/></div>
              <div className="teacher-board-body"><div className="teacher-board-art"><img src={`${import.meta.env.BASE_URL}images/teacher-studio.webp`} width={1024} height={1024} loading="lazy" alt="مدرس يشرح الفيزياء على سبورة رقمية"/></div><ol><li><b>01</b><div><strong>حضّر حصتك</strong><p>اختر الموضوع والموعد، وأضف غلافك.</p></div></li><li><b>02</b><div><strong>شارك رابطك</strong><p>ملفك وحصصك وتقييمك أمام طلابك.</p></div></li><li><b>03</b><div><strong>اشرح. واسمع أسئلتهم.</strong><p>بث وسبورة وواجب، في مساحة واحدة.</p></div></li></ol></div>
              <Link className="teacher-board-footer" href={routes.forTeachers.path}>تعرّف إلى أدوات المدرس <ArrowLeft size={20}/></Link>
            </TiltSurface>
          </div>
        </section>

        <div className="studio-app-wrap">
          <AppDownloadSection />
        </div>

        <section className="studio-section studio-faq">
          <div className="container-wide studio-faq-grid">
            <Reveal>
              <span className="studio-kicker">قبل أن تبدأ</span>
              <h2>
                لديك سؤال؟
                <br />
                <span>لنبدأ به.</span>
              </h2>
              <Link href={routes.faq.path} className="studio-underlink">
                جميع الأسئلة <ArrowLeft size={19} />
              </Link>
            </Reveal>
            <FaqAccordion
              categories={[
                {
                  id: "home-faq",
                  label: "",
                  items: [
                    faqCategories[0].items[0],
                    faqCategories[0].items[4],
                    faqCategories[1].items[0],
                    faqCategories[3].items[3],
                  ],
                },
              ]}
            />
          </div>
        </section>

        <InquirySection />

        <section className="studio-final">
          <div className="container-wide">
            <Reveal>
              <span className="studio-kicker">البداية سؤال. والخطوة لك.</span>
              <h2>
                جاهز <span>لتفهم؟</span>
                <ArrowDownLeft className="final-arrow" strokeWidth={1} />
              </h2>
              <div className="studio-final-bottom">
                <p>
                  اختر ما تريد تعلّمه.
                  <br />
                  وابدأ من مكانك.
                </p>
                <Link
                  href={routes.classes.path}
                  className="studio-final-link"
                  data-testid="link-final-browse"
                >
                  اكتشف حصتك <ArrowUpLeft size={30} />
                </Link>
              </div>
            </Reveal>
            <span className="studio-final-footnote">
              <CirclePlay size={15} /> جاهز Live · مركزك التعليمي، أينما كنت.
            </span>
          </div>
        </section>
      </main>
      <Footer />
    </div>
  );
}
