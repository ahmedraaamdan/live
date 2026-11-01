/** The app a page is open inside, if any. Google refuses to sign in from these embedded browsers. */
export function inAppBrowserName(userAgent = typeof navigator === 'undefined' ? '' : navigator.userAgent): string | null {
  if (/FBAN|FBAV|FB_IAB|FBIOS/i.test(userAgent)) return 'فيسبوك';
  if (/instagram/i.test(userAgent)) return 'إنستجرام';
  if (/whatsapp/i.test(userAgent)) return 'واتساب';
  if (/tiktok|musical_ly|bytedancewebview/i.test(userAgent)) return 'تيك توك';
  if (/telegram/i.test(userAgent)) return 'تليجرام';
  if (/; wv\)/i.test(userAgent)) return 'تطبيق';
  return null;
}
