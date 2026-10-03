/**
 * Build-time prerender entry. `vite build --ssr src/entry-server.tsx` turns
 * this into dist/server/entry-server.js, and scripts/generate-seo-html.mjs
 * calls render(path) for each public route to put the page's real markup
 * inside <div id="root">. main.tsx then hydrates that markup in the browser.
 *
 * Only what the client renders on its first pass belongs here: effects
 * (useSeo, the mascot embed, timers) never run during renderToString.
 */
import { renderToString } from 'react-dom/server';

import App from './App';
import { ErrorBoundary } from '@/components/error-boundary';

export function render(path: string): string {
  return renderToString(
    <ErrorBoundary>
      <App ssrPath={path} />
    </ErrorBoundary>,
  );
}
