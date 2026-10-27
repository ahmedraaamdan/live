/**
 * Shell-only wiring: deep links (gahezlive://… and https://app.live.gahez.space/…)
 * open the matching screen, and the payment browser closes itself when the
 * gateway sends the student back.
 */
import { isNative } from './platform';

export async function initNative() {
  if (!isNative()) return;
  const { App } = await import('@capacitor/app');
  const { Browser } = await import('@capacitor/browser');
  await App.addListener('appUrlOpen', ({ url }) => {
    try {
      const u = new URL(url);
      // gahezlive://checkout/123 → host "checkout", path "/123".
      const path = u.protocol.startsWith('http') ? u.pathname + u.search : `/${u.host}${u.pathname}${u.search}`;
      void Browser.close().catch(() => undefined);
      window.history.pushState(null, '', path);
      window.dispatchEvent(new PopStateEvent('popstate'));
    } catch {
      // Not a URL we handle.
    }
  });
}
