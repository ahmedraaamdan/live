/**
 * Chrome and Edge offer installing once, early in the page's life, often before
 * the install page has loaded. Imported from main.tsx so the offer is never missed.
 */
type InstallEvent = Event & { prompt: () => Promise<void>; userChoice: Promise<{ outcome: 'accepted' | 'dismissed' }> };

let offer: InstallEvent | null = null;
let installed = false;
const listeners = new Set<() => void>();
const changed = () => listeners.forEach((l) => l());

if (typeof window !== 'undefined') {
  window.addEventListener('beforeinstallprompt', (e) => {
    e.preventDefault();
    offer = e as InstallEvent;
    changed();
  });
  window.addEventListener('appinstalled', () => {
    offer = null;
    installed = true;
    changed();
  });
}

export const subscribeInstall = (listener: () => void) => {
  listeners.add(listener);
  return () => void listeners.delete(listener);
};
export const canPromptInstall = () => offer !== null;
export const justInstalled = () => installed;

export async function promptInstall() {
  if (!offer) return false;
  const current = offer;
  offer = null;
  await current.prompt();
  const { outcome } = await current.userChoice;
  changed();
  return outcome === 'accepted';
}

export type Device = 'android' | 'ios' | 'desktop';

export function detectDevice(): Device {
  const ua = navigator.userAgent;
  if (/iPhone|iPad|iPod/.test(ua) || (/Macintosh/.test(ua) && navigator.maxTouchPoints > 1)) return 'ios';
  if (/Android/.test(ua)) return 'android';
  return 'desktop';
}

/** Facebook, Instagram and the like open links in a browser that cannot install anything. */
export const inAppBrowser = () => /FBAN|FBAV|FB_IAB|Instagram|TikTok|Snapchat|Line\//.test(navigator.userAgent);

export const runningInstalled = () => window.matchMedia('(display-mode: standalone)').matches || (navigator as Navigator & { standalone?: boolean }).standalone === true;
