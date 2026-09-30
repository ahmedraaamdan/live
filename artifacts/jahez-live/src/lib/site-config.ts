/**
 * Business details that aren't known yet. Every consumer must treat an
 * empty value as "not configured" and hide the related UI (button, link,
 * section) rather than rendering a fake number, email, or URL.
 *
 * Fill these in — and only these — once the real values exist. Nothing
 * else in the marketing site should need to change.
 */
export const siteConfig = {
  /** Canonical production origin, used for canonical URLs, OG tags, sitemap, robots.txt. */
  siteUrl: 'https://live.gahez.space',
  brandName: 'جاهز Live',

  /** The authenticated web/mobile app users land in after a marketing CTA. Same origin until a real app domain exists. */
  appUrl: '/',

  /** Support channels — leave empty until real ones exist; UI hides the ones that are empty. */
  supportEmail: '',
  whatsappNumber: '',

  /** Store listings — leave empty until the apps are actually published. */
  androidStoreUrl: '',
  iosStoreUrl: '',

  /** Social profiles — leave empty until they exist. */
  social: {
    instagram: 'https://www.instagram.com/gahez.space/',
    tiktok: 'https://www.tiktok.com/@gahez.space',
    x: '',
    youtube: 'https://www.youtube.com/@GahezSpace',
    facebook: 'https://www.facebook.com/gahez.space',
  },

  /** Legal/registration details for the legal pages — fill in once available. */
  legalEntityName: '',
  legalContactAddress: '',
} as const;

export function isConfigured(value: string): boolean {
  return value.trim().length > 0;
}
