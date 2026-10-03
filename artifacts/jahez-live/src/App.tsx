import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { type ReactNode, useEffect } from 'react';
import { Redirect, Route, Router as WouterRouter, Switch, useLocation } from 'wouter';
import { ErrorBoundary } from '@/components/error-boundary';
import { WaitlistDialog } from '@/components/marketing/waitlist-dialog';
import { Toaster } from '@/components/ui/toaster';
import { TooltipProvider } from '@/components/ui/tooltip';

import Home from '@/pages/home';
import Classes from '@/pages/classes';
import Teachers from '@/pages/teachers';
import HowItWorks from '@/pages/how-it-works';
import ForStudents from '@/pages/for-students';
import ForTeachers from '@/pages/for-teachers';
import Payments from '@/pages/payments';
import About from '@/pages/about';
import Faq from '@/pages/faq';
import Contact from '@/pages/contact';
import Privacy from '@/pages/privacy';
import Terms from '@/pages/terms';
import RefundPolicy from '@/pages/refund-policy';
import StyleGuide from '@/pages/style-guide';
import NotFound from '@/pages/not-found';

const queryClient = new QueryClient();

function ScrollToTop() {
  const [location] = useLocation();
  useEffect(() => {
    window.scrollTo({ top: 0 });
  }, [location]);
  return null;
}

function Router() {
  return (
    <RoutedErrorBoundary>
      <ScrollToTop />
      <Switch>
        <Route path="/" component={Home} />
        <Route path="/classes" component={Classes} />
        {/* legacy path from an earlier build — keep working, point people at the new one */}
        <Route path="/browse"><Redirect to="/classes" /></Route>
        <Route path="/teachers" component={Teachers} />
        <Route path="/how-it-works" component={HowItWorks} />
        <Route path="/for-students" component={ForStudents} />
        <Route path="/for-teachers" component={ForTeachers} />
        <Route path="/payments" component={Payments} />
        <Route path="/about" component={About} />
        <Route path="/faq" component={Faq} />
        <Route path="/contact" component={Contact} />
        <Route path="/privacy" component={Privacy} />
        <Route path="/terms" component={Terms} />
        <Route path="/refund-policy" component={RefundPolicy} />
        <Route path="/style-guide" component={StyleGuide} />
        <Route component={NotFound} />
      </Switch>
    </RoutedErrorBoundary>
  );
}

function RoutedErrorBoundary({ children }: { children: ReactNode }) {
  const [location] = useLocation();
  return <ErrorBoundary resetKey={location}>{children}</ErrorBoundary>;
}

/** ssrPath: the route to render during the build-time prerender (entry-server.tsx). */
function App({ ssrPath }: { ssrPath?: string } = {}) {
  return (
    <QueryClientProvider client={queryClient}>
      <TooltipProvider>
        <WouterRouter base={import.meta.env.BASE_URL.replace(/\/$/, '')} ssrPath={ssrPath}>
          <Router />
        </WouterRouter>
        <WaitlistDialog />
        <Toaster />
      </TooltipProvider>
    </QueryClientProvider>
  );
}

export default App;
