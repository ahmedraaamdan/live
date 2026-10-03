import { useEffect } from 'react';
import { siteConfig } from '@/lib/site-config';

export interface SeoInput {
  title: string;
  description: string;
  /** App-relative path, e.g. "/classes" or "/" — combined with siteConfig.siteUrl for canonical/OG URLs. */
  path: string;
  /** Absolute URL of the share image; defaults to the site-wide /og.png (1200x630). */
  image?: string;
  /** Raw JSON-LD object(s) to embed as <script type="application/ld+json">. */
  jsonLd?: object | object[];
}

function upsertMeta(attr: 'name' | 'property', key: string, content: string) {
  let el = document.head.querySelector<HTMLMetaElement>(`meta[${attr}="${key}"]`);
  if (!el) {
    el = document.createElement('meta');
    el.setAttribute(attr, key);
    document.head.appendChild(el);
  }
  el.setAttribute('content', content);
}

function upsertLink(rel: string, href: string) {
  let el = document.head.querySelector<HTMLLinkElement>(`link[rel="${rel}"]`);
  if (!el) {
    el = document.createElement('link');
    el.setAttribute('rel', rel);
    document.head.appendChild(el);
  }
  el.setAttribute('href', href);
}

const JSON_LD_ID = 'route-jsonld';

/** Site-wide share card, public/og.png. Keep in step with scripts/generate-seo-html.mjs. */
export const DEFAULT_OG_IMAGE = `${siteConfig.siteUrl}/og.png`;
const DEFAULT_OG_IMAGE_ALT = 'جاهز Live — حصص أونلاين مباشرة مع مدرسين حقيقيين';

/**
 * Sets document.title, meta description, canonical, and Open Graph/Twitter
 * tags for the current route. Runs client-side (this is a Vite SPA), and is
 * mirrored statically per-route at build time by
 * scripts/generate-seo-html.mjs so crawlers that don't execute JS — and
 * social-share unfurls — see the same metadata without waiting on React.
 */
export function useSeo({ title, description, path, image = DEFAULT_OG_IMAGE, jsonLd }: SeoInput) {
  useEffect(() => {
    const url = `${siteConfig.siteUrl}${path === '/' ? '/' : path}`;

    document.title = title;
    upsertMeta('name', 'description', description);
    upsertLink('canonical', url);

    upsertMeta('property', 'og:title', title);
    upsertMeta('property', 'og:description', description);
    upsertMeta('property', 'og:url', url);
    upsertMeta('property', 'og:type', 'website');
    upsertMeta('property', 'og:site_name', siteConfig.brandName);
    upsertMeta('property', 'og:locale', 'ar_EG');
    upsertMeta('property', 'og:image', image);
    if (image === DEFAULT_OG_IMAGE) {
      upsertMeta('property', 'og:image:width', '1200');
      upsertMeta('property', 'og:image:height', '630');
      upsertMeta('property', 'og:image:alt', DEFAULT_OG_IMAGE_ALT);
    }

    upsertMeta('name', 'twitter:card', 'summary_large_image');
    upsertMeta('name', 'twitter:title', title);
    upsertMeta('name', 'twitter:description', description);
    upsertMeta('name', 'twitter:image', image);

    document.getElementById(JSON_LD_ID)?.remove();
    if (jsonLd) {
      const script = document.createElement('script');
      script.id = JSON_LD_ID;
      script.type = 'application/ld+json';
      script.textContent = JSON.stringify(jsonLd);
      document.head.appendChild(script);
    }

    return () => {
      document.getElementById(JSON_LD_ID)?.remove();
    };
  }, [title, description, path, image, jsonLd]);
}
