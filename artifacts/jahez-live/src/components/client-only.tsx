import { type ReactNode, useEffect, useState } from 'react';

/**
 * Renders its children only after mount, never in the build-time prerender
 * or during hydration. For DOM that something outside React rewrites, such
 * as the GAHEZ Agent mascot slots that embed.js upgrades as soon as it
 * loads: prerendered, embed.js can fill them before React hydrates them, and
 * React then throws a hydration mismatch and re-renders the whole page.
 */
export function ClientOnly({ children }: { children: ReactNode }) {
  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);
  return mounted ? <>{children}</> : null;
}
