#!/usr/bin/env node
/**
 * Post-build step: writes a real, route-specific index.html for every
 * public route (dist/public/<route>/index.html), so crawlers and social
 * previews that don't execute JavaScript (Facebook/WhatsApp/X unfurls,
 * some search bots) see the correct <title>/description/OG tags — not just
 * the homepage's, or nothing.
 *
 * How it works: the build's dist/public/index.html already has the correct
 * hashed asset URLs baked in by Vite. This script clones that file for each
 * route and swaps only the block between the <!--seo:start--> / <!--seo:end-->
 * markers (see index.html) for that route's metadata. The app still boots
 * and client-side-routes normally — this only changes what's in the raw
 * HTML before React mounts.
 *
 * Keep this route list in sync with src/lib/routes.ts (kept as a plain JS
 * list here, not imported, so this script has no TypeScript/bundler
 * dependency and can run as a plain post-build Node step).
 */
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const SITE_URL = 'https://live.gahez.space';
const BRAND = 'جاهز Live';

const routes = [
  { path: '/', title: 'حصص أونلاين مباشرة مع مدرسين | جاهز Live', description: 'اكتشف حصص مباشرة، تابع المدرسين اللي بتحب شرحهم، واحجز حصتك في ثواني. منصة جاهز Live للتعليم الأونلاين المباشر في مصر.' },
  { path: '/classes', title: 'حصص أونلاين مباشرة | اكتشف واحجز حصتك — جاهز Live', description: 'تصفح الحصص المباشرة والحصص الجاية في كل المواد والمراحل الدراسية. فلتر حسب المادة، الصف، السعر، والتقييم، واحجز حصتك في ثواني.' },
  { path: '/teachers', title: 'مدرسين أونلاين | اكتشف المدرس المناسب ليك — جاهز Live', description: 'قارن بين المدرسين، شوف التقييمات وعدد المتابعين، وتابع اللي يناسب أسلوبك في المذاكرة.' },
  { path: '/how-it-works', title: 'إزاي تحجز وتحضر حصص أونلاين؟ | جاهز Live', description: 'خطوة بخطوة: إزاي تكتشف الحصة وتحجزها كطالب، وإزاي تفتح حصتك كمدرس على جاهز Live.' },
  { path: '/for-students', title: 'حصص أونلاين للطلاب | اختار مدرسك وحصتك — جاهز Live', description: 'مش مربوط بسنتر واحد ولا مدرس واحد. اختار من مدرسين متعددين، شوف التقييمات، وتابع اللي يناسبك.' },
  { path: '/for-teachers', title: 'للمدرسين | افتح حصتك وابدأ التدريس أونلاين — جاهز Live', description: 'حوّل شرحك لمركز أونلاين: افتح حصصك، حدد ميعادها وسعرها، وخلي الطلاب يكتشفوك ويحجزوا معاك.' },
  { path: '/payments', title: 'طرق الدفع والحجز | جاهز Live', description: 'إزاي الدفع بيشتغل على أندرويد، آيفون، والويب، وإيه اللي بيحصل بعد ما تدفع قيمة الحصة.' },
  { path: '/about', title: 'عن جاهز Live | منصة الحصص الأونلاين', description: 'بنحاول نخلي الوصول لمدرس كويس أسهل. تعرف على فكرة جاهز Live وليه بنبنيها.' },
  { path: '/faq', title: 'الأسئلة الشائعة عن الحصص الأونلاين | جاهز Live', description: 'إجابات على أكتر الأسئلة اللي بتوصلنا من الطلاب والمدرسين عن الحجز، الدفع، والحصص المباشرة.' },
  { path: '/contact', title: 'تواصل معنا | جاهز Live', description: 'محتاج مساعدة أو عندك استفسار؟ تواصل مع فريق جاهز Live.' },
  { path: '/privacy', title: 'سياسة الخصوصية | جاهز Live', description: 'إزاي جاهز Live بيتعامل مع بياناتك الشخصية.' },
  { path: '/terms', title: 'الشروط والأحكام | جاهز Live', description: 'الشروط والأحكام الخاصة باستخدام منصة جاهز Live.' },
  { path: '/refund-policy', title: 'سياسة الاسترجاع | جاهز Live', description: 'إزاي وإمتى تقدر تسترجع قيمة حصة على جاهز Live.' },
];

function escapeHtml(s) {
  return s.replace(/&/g, '&amp;').replace(/"/g, '&quot;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}

// One product among five (see gahez.space); no ratings/review counts here —
// none are published anywhere on the site, so none are claimed in schema.
const JSON_LD = {
  '@context': 'https://schema.org',
  '@graph': [
    {
      '@type': 'Organization',
      '@id': 'https://gahez.space/#organization',
      name: 'Gahez',
      alternateName: 'جاهز',
      url: 'https://gahez.space/',
      sameAs: [
        'https://www.instagram.com/gahez.space/',
        'https://www.tiktok.com/@gahez.space',
        'https://www.youtube.com/@GahezSpace',
        'https://www.facebook.com/gahez.space',
      ],
    },
    {
      '@type': 'Service',
      name: BRAND,
      serviceType: 'Live online classes',
      provider: { '@id': 'https://gahez.space/#organization' },
      areaServed: 'EG',
      url: SITE_URL,
    },
  ],
};

function seoBlock({ path, title, description }) {
  const url = `${SITE_URL}${path === '/' ? '/' : path}`;
  const t = escapeHtml(title);
  const d = escapeHtml(description);
  return `<!--seo:start-->
    <title>${t}</title>
    <meta name="description" content="${d}" />
    <link rel="canonical" href="${url}" />
    <meta property="og:title" content="${t}" />
    <meta property="og:description" content="${d}" />
    <meta property="og:url" content="${url}" />
    <meta property="og:type" content="website" />
    <meta property="og:site_name" content="${BRAND}" />
    <meta name="twitter:card" content="summary" />
    <meta name="twitter:title" content="${t}" />
    <meta name="twitter:description" content="${d}" />
    <script type="application/ld+json">${JSON.stringify(JSON_LD)}</script>
    <!--seo:end-->`;
}

function main() {
  const here = dirname(fileURLToPath(import.meta.url));
  const distDir = join(here, '..', 'dist', 'public');
  const template = readFileSync(join(distDir, 'index.html'), 'utf8');
  const markerRe = /<!--seo:start-->[\s\S]*?<!--seo:end-->/;

  if (!markerRe.test(template)) {
    console.error('generate-seo-html: could not find <!--seo:start--> / <!--seo:end--> markers in dist/public/index.html — skipping.');
    process.exit(1);
  }

  for (const route of routes) {
    const html = template.replace(markerRe, seoBlock(route));
    const outDir = route.path === '/' ? distDir : join(distDir, route.path.slice(1));
    mkdirSync(outDir, { recursive: true });
    writeFileSync(join(outDir, 'index.html'), html);
  }

  console.log(`generate-seo-html: wrote ${routes.length} route-specific index.html files.`);
}

main();
