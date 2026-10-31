import { isConfigured, siteConfig } from '@/lib/site-config';
import type { Crumb } from '@/components/marketing/breadcrumbs';
import type { FaqCategory } from '@/components/marketing/faq-accordion';
import { PROMO_VIDEO_ID, PROMO_VIDEO_POSTER, PROMO_VIDEO_TITLE } from '@/components/marketing/promo-video-section';

/**
 * Generic, truthful structured data only — no fabricated ratings, prices,
 * or org details. See DESIGN_SYSTEM.md marketing brief section 20.
 */

/** Gahez (gahez.space) is the organisation; Live is one of its products. */
export const ORGANIZATION_ID = 'https://gahez.space/#organization';

/** The company's own profiles elsewhere, beside its social accounts. */
const ORGANIZATION_PROFILES = ['https://www.linkedin.com/company/gahezspace', 'https://www.crunchbase.com/organization/gahez'];

export function organizationJsonLd() {
  const sameAs = [...Object.values(siteConfig.social).filter(isConfigured), ...ORGANIZATION_PROFILES];
  return {
    '@context': 'https://schema.org',
    '@type': 'Organization',
    '@id': ORGANIZATION_ID,
    name: 'Gahez',
    alternateName: 'جاهز',
    url: 'https://gahez.space/',
    foundingDate: '2026-07',
    logo: 'https://gahez.space/Assets/icon-512.png',
    ...(sameAs.length ? { sameAs } : {}),
  };
}

export function websiteJsonLd() {
  return {
    '@context': 'https://schema.org',
    '@type': 'WebSite',
    name: siteConfig.brandName,
    url: `${siteConfig.siteUrl}/`,
    inLanguage: 'ar',
    publisher: { '@id': ORGANIZATION_ID },
  };
}

export function promoVideoJsonLd() {
  return {
    '@context': 'https://schema.org',
    '@type': 'VideoObject',
    name: PROMO_VIDEO_TITLE,
    description: 'فيديو تعريفي بمنصة جاهز Live للمدرس والطالب وولي الأمر: الحصة والواجب والفلوس في مكان واحد.',
    thumbnailUrl: `${siteConfig.siteUrl}${PROMO_VIDEO_POSTER}`,
    uploadDate: '2026-10-31',
    duration: 'PT1M25S',
    embedUrl: `https://www.youtube-nocookie.com/embed/${PROMO_VIDEO_ID}`,
    publisher: { '@id': ORGANIZATION_ID },
  };
}

export function breadcrumbJsonLd(items: Crumb[]) {
  return {
    '@context': 'https://schema.org',
    '@type': 'BreadcrumbList',
    itemListElement: items.map((item, i) => ({
      '@type': 'ListItem',
      position: i + 1,
      name: item.label,
      ...(item.path ? { item: `${siteConfig.siteUrl}${item.path === '/' ? '/' : item.path}` } : {}),
    })),
  };
}

export function faqJsonLd(categories: FaqCategory[]) {
  return {
    '@context': 'https://schema.org',
    '@type': 'FAQPage',
    mainEntity: categories.flatMap((cat) =>
      cat.items.map((item) => ({
        '@type': 'Question',
        name: item.q,
        acceptedAnswer: { '@type': 'Answer', text: item.a },
      })),
    ),
  };
}
