/**
 * Native (Capacitor) vs web differences, in one place. Everything else in
 * the app is the same code on both.
 */
import { Capacitor } from '@capacitor/core';

export const isNative = () => Capacitor.isNativePlatform();
export const platform = () => Capacitor.getPlatform() as 'web' | 'ios' | 'android';

/**
 * Payment pages: in the shells they open in the system browser (Apple Pay
 * only works in Safari, not inside a WebView); on the web, a normal redirect.
 */
export async function openCheckout(url: string) {
  if (isNative()) {
    const { Browser } = await import('@capacitor/browser');
    await Browser.open({ url, presentationStyle: 'popover' });
  } else {
    window.location.assign(url);
  }
}

export async function shareLink(opts: { title: string; text: string; url: string }): Promise<'shared' | 'copied'> {
  if (navigator.share) {
    try {
      await navigator.share(opts);
      return 'shared';
    } catch {
      // Cancelled: fall through to copying.
    }
  }
  await navigator.clipboard?.writeText(opts.url);
  return 'copied';
}

export const whatsappUrl = (text: string) => `https://wa.me/?text=${encodeURIComponent(text)}`;

/** Public link students open; always the web origin, even inside the shells. */
export function publicUrl(path: string): string {
  const configured = import.meta.env.VITE_PUBLIC_APP_URL as string | undefined;
  const origin = configured ?? (isNative() ? 'https://app.live.gahez.space' : window.location.origin);
  return `${origin.replace(/\/$/, '')}${path}`;
}
