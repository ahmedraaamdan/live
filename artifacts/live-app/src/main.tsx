import './lib/content-protection';
import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { Router } from 'wouter';
import '@fontsource-variable/space-grotesk';
import './styles/app.css';
import './styles/playful.css';
import './styles/teacher-tools.css';
import { App } from './App';
import { ApiError } from './lib/api';
import { initNative } from './lib/native';
import { SessionProvider } from './lib/session';
import { ErrorBoundary } from './components/error-boundary';
import { Toaster } from './ui';

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 15_000,
      retry: (count, err) => !(err instanceof ApiError && err.status >= 400 && err.status < 500) && count < 2,
      refetchOnWindowFocus: true,
    },
  },
});

void initNative();

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <QueryClientProvider client={queryClient}>
      <Router base={import.meta.env.BASE_URL.replace(/\/$/, '')}>
        <SessionProvider>
          <ErrorBoundary>
            <App />
          </ErrorBoundary>
          <Toaster />
        </SessionProvider>
      </Router>
    </QueryClientProvider>
  </StrictMode>,
);
