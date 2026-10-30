#!/usr/bin/env node
/**
 * Post-build step: writes a real, route-specific index.html for every
 * public route (dist/public/<route>/index.html), so crawlers and social
 * previews that don't execute JavaScript (Facebook/WhatsApp/X unfurls,
 * some search bots) see the correct <title>/description/OG tags, the
 * route's JSON-LD, and the page's real markup — not just the homepage's
 * metadata and an empty <div id="root">.
 *
 * How it works: the build's dist/public/index.html already has the correct
 * hashed asset URLs baked in by Vite. This script clones that file for each
 * route, swaps the block between the <!--seo:start--> / <!--seo:end-->
 * markers (see index.html) for that route's metadata, and fills
 * <div id="root" data-ssr> with the page rendered by the SSR bundle
 * (src/entry-server.tsx, built to dist/server/entry-server.js just before
 * this runs). main.tsx sees data-ssr and hydrates that markup. If the SSR
 * bundle is missing or a route fails to render, that route falls back to a
 * minimal static body (heading, summary, links) that main.tsx replaces with
 * createRoot instead.
 *
 * It also writes dist/public/404/index.html (served by server.mjs with a 404
 * status for unknown paths) and dist/public/sitemap.xml from the same list.
 *
 * Keep this route list in sync with src/lib/routes.ts. The JSON-LD reuses the
 * app's own helpers (src/lib/structured-data.ts) and FAQ content
 * (src/data/faq.ts), loaded through Vite so the TypeScript and "@/" imports
 * resolve — the static markup can never drift from what the pages emit.
 */
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { createServer } from 'vite';

const SITE_URL = 'https://live.gahez.space';
const BRAND = 'جاهز Live';
const OG_IMAGE = `${SITE_URL}/og.png`;
const OG_IMAGE_ALT = 'جاهز Live — مركزك التعليمي، أينما كنت.';
const HOME_CRUMB = { label: 'الرئيسية', path: '/' };

/**
 * h1 and crumb mirror each page's own heading and breadcrumb; jsonLd builds
 * exactly what the page passes to useSeo (sd = structured-data helpers).
 * Routes without jsonLd get the page's two-step BreadcrumbList.
 */
const routes = [
  { path: '/', h1: 'حصتك جاهزة؟ تعلّم من مكانك.', jsonLd: (sd) => [sd.organizationJsonLd(), sd.websiteJsonLd()] },
  { path: '/classes', h1: 'الحصص المباشرة عبر الإنترنت', crumb: 'الحصص' },
  { path: '/teachers', h1: 'اختر المدرس المناسب لك.', crumb: 'المدرسون' },
  { path: '/how-it-works', h1: 'الحجز بسيط.', crumb: 'كيف يعمل؟' },
  { path: '/for-students', h1: 'اختر مدرسك. وابدأ بما تحتاجه.', crumb: 'للطلاب' },
  { path: '/for-teachers', h1: 'ركّز على الشرح. ونظّم حصصك معنا.', crumb: 'للمدرسين' },
  { path: '/payments', h1: 'اعرف السعر قبل الحجز.', crumb: 'الدفع' },
  { path: '/about', h1: 'التعلّم يبدأ بمدرس يفهم سؤالك.', crumb: 'عن جاهز Live' },
  { path: '/faq', h1: 'الأسئلة الشائعة', crumb: 'الأسئلة الشائعة', jsonLd: (sd, data) => [sd.breadcrumbJsonLd([HOME_CRUMB, { label: 'الأسئلة الشائعة' }]), sd.faqJsonLd(data.faqCategories)] },
  { path: '/contact', h1: 'كيف يمكننا مساعدتك؟', crumb: 'تواصل معنا' },
  { path: '/privacy', h1: 'سياسة الخصوصية', crumb: 'سياسة الخصوصية' },
  { path: '/terms', h1: 'الشروط والأحكام', crumb: 'الشروط والأحكام' },
  { path: '/refund-policy', h1: 'سياسة الاسترداد', crumb: 'سياسة الاسترداد' },
];

/** Not in `routes`: no canonical, noindex, not in the sitemap. */
const notFound = {
  path: '/404',
  h1: 'الصفحة غير موجودة',
  title: 'الصفحة غير موجودة',
  description: 'قد يكون الرابط قد تغيّر أو لم تعد الصفحة متاحة. يمكنك متابعة التصفح من الرئيسية.',
  noindex: true,
};

/** Links in the static fallback nav: the main routes, then the Gahez home. */
const NAV = [
  ['/', 'الرئيسية'],
  ['/classes', 'تصفح الحصص'],
  ['/teachers', 'المدرسين'],
  ['/for-students', 'للطلاب'],
  ['/for-teachers', 'للمدرسين'],
  ['/how-it-works', 'كيف يعمل؟'],
  ['/payments', 'الدفع'],
  ['/faq', 'الأسئلة الشائعة'],
  ['/about', 'عن جاهز Live'],
  ['/contact', 'تواصل معنا'],
  ['https://gahez.space/', 'جاهز Gahez'],
];

function escapeHtml(s) {
  return s.replace(/&/g, '&amp;').replace(/"/g, '&quot;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}

/** JSON for inside <script>: no "</script>" or "<!--" can break out. */
function scriptJson(value) {
  return JSON.stringify(value).replace(/</g, '\\u003c');
}

function urlFor(path) {
  return `${SITE_URL}${path === '/' ? '/' : path}`;
}

function seoBlock(route, siteJsonLd) {
  const { path, title, description, noindex } = route;
  const url = urlFor(path);
  const t = escapeHtml(title);
  const d = escapeHtml(description);
  const lines = [
    `<title>${t}</title>`,
    `<meta name="description" content="${d}" />`,
    `<meta name="robots" content="${noindex ? 'noindex, follow' : 'index, follow'}" />`,
    noindex ? '' : `<link rel="canonical" href="${url}" />`,
    `<meta property="og:title" content="${t}" />`,
    `<meta property="og:description" content="${d}" />`,
    noindex ? '' : `<meta property="og:url" content="${url}" />`,
    `<meta property="og:type" content="website" />`,
    `<meta property="og:site_name" content="${BRAND}" />`,
    `<meta property="og:locale" content="ar_EG" />`,
    `<meta property="og:image" content="${OG_IMAGE}" />`,
    `<meta property="og:image:width" content="1200" />`,
    `<meta property="og:image:height" content="630" />`,
    `<meta property="og:image:alt" content="${escapeHtml(OG_IMAGE_ALT)}" />`,
    `<meta name="twitter:card" content="summary_large_image" />`,
    `<meta name="twitter:title" content="${t}" />`,
    `<meta name="twitter:description" content="${d}" />`,
    `<meta name="twitter:image" content="${OG_IMAGE}" />`,
    `<script type="application/ld+json">${scriptJson(siteJsonLd)}</script>`,
    // Same id useSeo uses, so the page swaps this for its own copy on mount
    // instead of duplicating it.
    route.jsonLdData ? `<script type="application/ld+json" id="route-jsonld">${scriptJson(route.jsonLdData)}</script>` : '',
  ].filter(Boolean);
  return `<!--seo:start-->\n    ${lines.join('\n    ')}\n    <!--seo:end-->`;
}

function fallbackBody({ path, h1, description }) {
  const links = NAV.map(([href, label]) => {
    const current = href === path ? ' aria-current="page"' : '';
    return `<li><a href="${href}"${current}>${escapeHtml(label)}</a></li>`;
  }).join('');
  return '<div id="root"><main style="max-width:720px;margin:0 auto;padding:48px 16px;font-family:Cairo,sans-serif;line-height:1.9">'
    + `<h1>${escapeHtml(h1)}</h1>`
    + `<p>${escapeHtml(description)}</p>`
    + `<nav aria-label="روابط ${BRAND}"><ul>${links}</ul></nav>`
    + '</main></div>';
}

/** The SSR bundle's render(path), or null when it wasn't built. */
async function loadSsrRenderer(root) {
  const entry = join(root, 'dist', 'server', 'entry-server.js');
  try {
    const mod = await import(pathToFileURL(entry).href);
    return mod.render;
  } catch (error) {
    console.warn(`generate-seo-html: no SSR bundle at ${entry} (${error.message}); using the static fallback body.`);
    return null;
  }
}

function sitemap(lastmod) {
  const urls = routes.map((r) => `  <url><loc>${urlFor(r.path)}</loc><lastmod>${lastmod}</lastmod></url>`).join('\n');
  return `<?xml version="1.0" encoding="UTF-8"?>
<!-- Generated at build time by scripts/generate-seo-html.mjs from its route list. -->
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
${urls}
</urlset>
`;
}

/** Loads the app's own TypeScript modules (with their "@/" imports) via Vite. */
async function loadAppModules(root) {
  const vite = await createServer({
    configFile: false,
    root,
    logLevel: 'error',
    appType: 'custom',
    server: { middlewareMode: true, hmr: false, ws: false },
    resolve: { alias: { '@': join(root, 'src') } },
    optimizeDeps: { noDiscovery: true, include: [] },
  });
  try {
    const sd = await vite.ssrLoadModule('/src/lib/structured-data.ts');
    const { faqCategories } = await vite.ssrLoadModule('/src/data/faq.ts');
    const { routes: routeMetadata } = await vite.ssrLoadModule('/src/lib/routes.ts');
    return { sd, data: { faqCategories }, routeMetadata };
  } finally {
    await vite.close();
  }
}

async function main() {
  const here = dirname(fileURLToPath(import.meta.url));
  const root = resolve(here, '..');
  const distDir = join(root, 'dist', 'public');
  const template = readFileSync(join(distDir, 'index.html'), 'utf8');
  const markerRe = /<!--seo:start-->[\s\S]*?<!--seo:end-->/;
  const rootDiv = '<div id="root"></div>';

  if (!markerRe.test(template) || !template.includes(rootDiv)) {
    console.error('generate-seo-html: missing <!--seo:start-->/<!--seo:end--> markers or an empty <div id="root"></div> in dist/public/index.html.');
    process.exit(1);
  }

  const { sd, data, routeMetadata } = await loadAppModules(root);
  // The browser and generated HTML must use the same title and description.
  for (const route of routes) {
    const meta = Object.values(routeMetadata).find((item) => item.path === route.path);
    if (!meta) throw new Error(`Missing metadata for ${route.path}`);
    route.title = meta.title;
    route.description = meta.description;
  }
  const renderPage = await loadSsrRenderer(root);
  const prerendered = [];
  const { '@context': _context, ...organization } = sd.organizationJsonLd();
  // Site-wide: who runs this (Gahez) and what this site is (one of its services).
  const siteJsonLd = {
    '@context': 'https://schema.org',
    '@graph': [
      organization,
      {
        '@type': 'Service',
        name: BRAND,
        serviceType: 'Live online classes',
        provider: { '@id': sd.ORGANIZATION_ID },
        areaServed: 'EG',
        url: `${SITE_URL}/`,
      },
    ],
  };

  const body = (route) => {
    if (renderPage) {
      try {
        const markup = renderPage(route.path);
        if (markup.includes('<h1')) {
          prerendered.push(route.path);
          return `<div id="root" data-ssr>${markup}</div>`;
        }
        console.warn(`generate-seo-html: ${route.path} rendered without an <h1>; using the static fallback body.`);
      } catch (error) {
        console.warn(`generate-seo-html: ${route.path} failed to prerender (${error.message}); using the static fallback body.`);
      }
    }
    return fallbackBody(route);
  };

  const write = (route) => {
    const html = template
      .replace(markerRe, () => seoBlock(route, siteJsonLd))
      .replace(rootDiv, () => body(route));
    const outDir = route.path === '/' ? distDir : join(distDir, route.path.slice(1));
    mkdirSync(outDir, { recursive: true });
    writeFileSync(join(outDir, 'index.html'), html);
  };

  for (const route of routes) {
    route.jsonLdData = route.jsonLd
      ? route.jsonLd(sd, data)
      : sd.breadcrumbJsonLd([HOME_CRUMB, { label: route.crumb }]);
    write(route);
  }
  write(notFound);

  const lastmod = new Date().toISOString().slice(0, 10);
  writeFileSync(join(distDir, 'sitemap.xml'), sitemap(lastmod));

  console.log(`generate-seo-html: wrote ${routes.length} route pages, 404/index.html and sitemap.xml (lastmod ${lastmod}); prerendered ${prerendered.length}: ${prerendered.join(' ')}.`);
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
