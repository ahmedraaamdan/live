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
    title: 'جاهز Live | مركزك للحصص والدورات المباشرة عبر الإنترنت',
    description: 'اختر حصتك ومدرسك مع جاهز Live. تصفح الحصص والدورات المباشرة عبر الإنترنت، وقارن المواعيد والأسعار، وتعلّم من مكانك مع فرصة للسؤال والمناقشة.',
    indexable: true,
  },
  classes: {
    path: '/classes',
    navLabel: 'تصفح الحصص',
    footerLabel: 'تصفح الحصص',
    footerGroup: 'platform',
    title: 'حصص مباشرة عبر الإنترنت | المواعيد والحجز — جاهز Live',
    description: 'تصفح الحصص المباشرة والقادمة على جاهز Live. ابحث حسب المادة والمرحلة الدراسية، وراجع المدرس والموعد والسعر قبل اختيار حصتك.',
    indexable: true,
  },
  teachers: {
    path: '/teachers',
    navLabel: 'المدرسون',
    footerLabel: 'المدرسون',
    footerGroup: 'platform',
    title: 'اختر مدرسك للحصص المباشرة | جاهز Live',
    description: 'تعرّف إلى مدرسي جاهز Live وتخصصاتهم وحصصهم. اطّلع على تقييمات الطلاب، وقارن الخيارات، وتابع المدرس المناسب لاحتياجك.',
    indexable: true,
  },
  howItWorks: {
    path: '/how-it-works',
    navLabel: 'كيف يعمل؟',
    footerLabel: 'كيف يعمل؟',
    footerGroup: 'platform',
    title: 'كيف تحجز حصتك وتحضرها؟ | جاهز Live',
    description: 'تعرّف إلى خطوات حضور حصة على جاهز Live: اختيار الحصة، ومراجعة تفاصيلها، وإتمام الدفع، ثم الانضمام في الموعد المحدد.',
    indexable: true,
  },
  forStudents: {
    path: '/for-students',
    navLabel: 'للطلاب',
    footerLabel: 'للطلاب',
    footerGroup: 'platform',
    title: 'للطلاب | تعلّم مباشرة مع مدرس تختاره — جاهز Live',
    description: 'ابحث عن المادة التي تحتاجها، وقارن المدرسين والمواعيد، واحجز حصة مباشرة عبر الإنترنت. تعرّف إلى تجربة الطالب على جاهز Live.',
    indexable: true,
  },
  forTeachers: {
    path: '/for-teachers',
    navLabel: 'للمدرسين',
    footerLabel: 'للمدرسين',
    footerGroup: 'platform',
    title: 'للمدرسين | قدّم حصصك عبر الإنترنت — جاهز Live',
    description: 'قدّم حصصك المباشرة على جاهز Live. أضف الموضوع والموعد والسعر، واعرض حصصك للطلاب، وتابع الحجوزات والأرباح من حسابك.',
    indexable: true,
  },
  payments: {
    path: '/payments',
    navLabel: 'الحجز والدفع',
    footerLabel: undefined,
    title: 'الدفع وحجز الحصص | جاهز Live',
    description: 'تعرّف إلى طرق الدفع على الموقع والتطبيق، وكيفية تأكيد الحجز والوصول إلى حصتك، وما يمكنك فعله عند تعذّر إتمام عملية الدفع.',
    indexable: true,
  },
  about: {
    path: '/about',
    footerLabel: undefined,
    title: 'عن جاهز Live | مركز للتعلّم المباشر عبر الإنترنت',
    description: 'تعرّف إلى فكرة جاهز Live: جمع الطلاب والمدرسين في حصص مباشرة، مع تفاصيل واضحة تساعد على الاختيار والحجز والحضور من أي مكان.',
    indexable: true,
  },
  faq: {
    path: '/faq',
    navLabel: 'الأسئلة الشائعة',
    footerLabel: 'الأسئلة الشائعة',
    footerGroup: 'help',
    title: 'الأسئلة الشائعة | الحجز والحصص والحساب — جاهز Live',
    description: 'ابحث عن إجابات لأسئلتك حول جاهز Live، من اختيار المدرس وحجز الحصة إلى الدفع والحضور وإدارة حساب الطالب أو المدرس.',
    indexable: true,
  },
  contact: {
    path: '/contact',
    footerLabel: 'تواصل معنا',
    footerGroup: 'help',
    title: 'تواصل مع فريق جاهز Live',
    description: 'لديك استفسار عن حسابك أو حجزك أو عملية دفع؟ أرسل رسالتك إلى فريق جاهز Live عبر نموذج التواصل، مع التفاصيل التي تساعدنا على مراجعتها.',
    indexable: true,
  },
  privacy: {
    path: '/privacy',
    footerLabel: 'سياسة الخصوصية',
    footerGroup: 'legal',
    title: 'سياسة الخصوصية | جاهز Live',
    description: 'اطّلع على البيانات التي يجمعها جاهز Live، وكيفية استخدامها ومشاركتها، وطرق طلب مراجعة بياناتك أو تعديلها أو حذفها.',
    indexable: true,
  },
  terms: {
    path: '/terms',
    footerLabel: 'الشروط والأحكام',
    footerGroup: 'legal',
    title: 'الشروط والأحكام | جاهز Live',
    description: 'اقرأ شروط استخدام جاهز Live، ومسؤوليات الحسابات والمحتوى التعليمي، والقواعد المتعلقة بالمدفوعات واستخدام المنصة.',
    indexable: true,
  },
  refundPolicy: {
    path: '/refund-policy',
    footerLabel: 'سياسة الاسترداد',
    footerGroup: 'help',
    title: 'سياسة الاسترداد | جاهز Live',
    description: 'تعرّف إلى حالات استرداد قيمة الحصص على جاهز Live، وكيفية تقديم الطلب ومعالجته وإعادة المبلغ إلى وسيلة الدفع الأصلية.',
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
