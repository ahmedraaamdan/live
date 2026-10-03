import { createRoot, hydrateRoot } from 'react-dom/client';

import App from './App';
import { ErrorBoundary } from '@/components/error-boundary';

import './index.css';

const container = document.getElementById('root')!;
const app = (
  <ErrorBoundary>
    <App />
  </ErrorBoundary>
);
const options = {
  // Keeps caught errors off reportError(), which would raise the dev overlay.
  onCaughtError: (error: unknown, errorInfo: { componentStack?: string }) => {
    console.error(error, errorInfo.componentStack);
  },
};

// The public routes ship prerendered by scripts/generate-seo-html.mjs, marked
// with data-ssr on #root: hydrate that markup. Anything else (the dev server,
// the 404 page's static fallback) starts from scratch.
if (container.hasAttribute('data-ssr')) {
  hydrateRoot(container, app, options);
} else {
  createRoot(container, options).render(app);
}
