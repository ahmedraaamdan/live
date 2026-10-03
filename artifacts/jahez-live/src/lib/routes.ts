/**
 * Single source of truth for every public route: its path, nav/footer
 * labels, and SEO metadata. Consumed by:
 *  - App.tsx (the wouter <Switch>)
 *  - Header / Footer (nav links)
 *  - useSeo (per-route <title>/meta/canonical/OG)
 *  - scripts/generate-seo-html.mjs (prerendered per-route index.html)
 *  - dist/public/sitemap.xml (written by the same build script)
 *
 * Add a page by adding one entry here plus the page component — nothing
 * else needs to know a new route exists.
 */

export type RouteKey =
  | 'home'
  | 'classes'
  | 'teachers'
  | 'howItWorks'
  | 'forStudents'
  | 'forTeachers'
  | 'payments'
  | 'about'
  | 'faq'
  | 'contact'
  | 'privacy'
  | 'terms'
  | 'refundPolicy';

export interface RouteMeta {
  path: string;
  navLabel?: string;
  footerLabel?: string;
  /** Which footer column this link appears in. */
  footerGroup?: 'platform' | 'help' | 'legal';
  title: string;
  description: string;
  /** Included in sitemap.xml / prerendered — false for the two legacy-safe redirects. */
  indexable?: boolean;
}

export const routes: Record<RouteKey, RouteMeta> = {
  home: {
    path: '/',
    navLabel: 'الرئيسية',
    footerLabel: 'الرئيسية',
    footerGroup: 'platform',
    title: 'حصص أونلاين مباشرة مع مدرسين | جاهز Live',
    description:
      'اكتشف حصص مباشرة، قارن بين المدرسين، واحجز حصتك في ثواني. جاهز Live للتعليم الأونلاين المباشر في مصر.',
    indexable: true,
  },
  classes: {
    path: '/classes',
    navLabel: 'تصفح الحصص',
    footerLabel: 'تصفح الحصص',
    footerGroup: 'platform',
    title: 'حصص أونلاين مباشرة | اكتشف واحجز حصتك — جاهز Live',
    description:
      'تصفح الحصص المباشرة والحصص الجاية في كل المواد والمراحل الدراسية. فلتر حسب المادة، الصف، السعر، والتقييم، واحجز حصتك في ثواني.',
    indexable: true,
  },
  teachers: {
    path: '/teachers',
    navLabel: 'المدرسين',
    footerLabel: 'المدرسين',
    footerGroup: 'platform',
    title: 'مدرسين أونلاين | اكتشف المدرس المناسب ليك — جاهز Live',
    description:
      'قارن بين المدرسين، شوف التقييمات وعدد المتابعين، وتابع اللي يناسب أسلوبك في المذاكرة.',
    indexable: true,
  },
  howItWorks: {
    path: '/how-it-works',
    navLabel: 'إزاي بيشتغل',
    footerLabel: 'إزاي بيشتغل',
    footerGroup: 'platform',
    title: 'إزاي تحجز وتحضر حصص أونلاين؟ | جاهز Live',
    description: 'خطوة بخطوة: إزاي تكتشف الحصة وتحجزها كطالب، وإزاي تفتح حصتك كمدرس على جاهز Live.',
    indexable: true,
  },
  forStudents: {
    path: '/for-students',
    navLabel: 'للطلاب',
    footerLabel: 'للطلاب',
    footerGroup: 'platform',
    title: 'حصص أونلاين للطلاب | اختار مدرسك وحصتك — جاهز Live',
    description: 'مش مربوط بسنتر واحد ولا مدرس واحد. اختار من مدرسين متعددين، شوف التقييمات، وتابع اللي يناسبك.',
    indexable: true,
  },
  forTeachers: {
    path: '/for-teachers',
    navLabel: 'للمدرسين',
    footerLabel: 'للمدرسين',
    footerGroup: 'platform',
    title: 'للمدرسين | افتح حصتك وابدأ التدريس أونلاين — جاهز Live',
    description: 'حوّل شرحك لمركز أونلاين: افتح حصصك، حدد ميعادها وسعرها، وخلي الطلاب يكتشفوك ويحجزوا معاك.',
    indexable: true,
  },
  payments: {
    path: '/payments',
    navLabel: 'الأسعار / الدفع',
    footerLabel: undefined,
    title: 'طرق الدفع والحجز | جاهز Live',
    description: 'إزاي الدفع بيشتغل على أندرويد، آيفون، والويب، وإيه اللي بيحصل بعد ما تدفع قيمة الحصة.',
    indexable: true,
  },
  about: {
    path: '/about',
    footerLabel: undefined,
    title: 'عن جاهز Live | منصة الحصص الأونلاين',
    description: 'بنحاول نخلي الوصول لمدرس كويس أسهل. تعرف على فكرة جاهز Live وليه بنبنيها.',
    indexable: true,
  },
  faq: {
    path: '/faq',
    navLabel: 'أسئلة',
    footerLabel: 'الأسئلة الشائعة',
    footerGroup: 'help',
    title: 'الأسئلة الشائعة عن الحصص الأونلاين | جاهز Live',
    description: 'إجابات على أكتر الأسئلة اللي بتوصلنا من الطلاب والمدرسين عن الحجز، الدفع، والحصص المباشرة.',
    indexable: true,
  },
  contact: {
    path: '/contact',
    footerLabel: 'تواصل معنا',
    footerGroup: 'help',
    title: 'تواصل معنا | جاهز Live',
    description: 'محتاج مساعدة أو عندك استفسار؟ تواصل مع فريق جاهز Live.',
    indexable: true,
  },
  privacy: {
    path: '/privacy',
    footerLabel: 'سياسة الخصوصية',
    footerGroup: 'legal',
    title: 'سياسة الخصوصية | جاهز Live',
    description: 'إزاي جاهز Live بيتعامل مع بياناتك الشخصية.',
    indexable: true,
  },
  terms: {
    path: '/terms',
    footerLabel: 'الشروط والأحكام',
    footerGroup: 'legal',
    title: 'الشروط والأحكام | جاهز Live',
    description: 'الشروط والأحكام الخاصة باستخدام منصة جاهز Live.',
    indexable: true,
  },
  refundPolicy: {
    path: '/refund-policy',
    footerLabel: 'سياسة الاسترجاع',
    footerGroup: 'help',
    title: 'سياسة الاسترجاع | جاهز Live',
    description: 'إزاي وإمتى تقدر تسترجع قيمة حصة على جاهز Live.',
    indexable: true,
  },
};

export const routeList = Object.values(routes);
/**
 * Header nav order per the approved copy: browse-first, then teachers,
 * students, teachers-recruitment, how it works, payments, FAQ. Home is
 * reachable via the logo (see Header), so it isn't repeated here.
 */
export const primaryNav: RouteMeta[] = [
  routes.classes,
  routes.teachers,
  routes.forStudents,
  routes.forTeachers,
  routes.howItWorks,
  routes.payments,
  routes.faq,
];

export function footerGroup(group: RouteMeta['footerGroup']): RouteMeta[] {
  return routeList.filter((r) => r.footerGroup === group && r.footerLabel);
}
