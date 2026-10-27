import { lazy, Suspense, useEffect, type ReactNode } from 'react';
import { Redirect, Route, Switch, useLocation } from 'wouter';
import type { Role } from '@workspace/live-core';
import { AppShell } from '@/layouts/app-shell';
import { homePath, useSession } from '@/lib/session';
import { PageSpinner } from '@/ui';
import { ForgotPassword, JoinParent, Login, ResetPassword, Signup, Welcome } from '@/pages/auth';
import { Checkout, DevPay } from '@/pages/checkout';
import { PublicLecture } from '@/pages/public-lecture';
import { LectureDetail } from '@/pages/lecture-detail';
import { LectureForm } from '@/pages/lecture-form';
import { TeacherHome } from '@/pages/teacher-home';
import { LectureList } from '@/pages/lecture-list';
import { AssignmentDetail, AssignmentList } from '@/pages/assignments';
import { WalletPage } from '@/pages/wallet';
import { StudentHome } from '@/pages/student-home';
import { ChildDetail, ParentHome } from '@/pages/parent';
import { AdminOverview, AdminPayouts, AdminUsers } from '@/pages/admin';
import { Account, Notifications } from '@/pages/account';
import { NotFound } from '@/pages/not-found';

// Heavy and only needed in their own screens.
const LiveRoom = lazy(() => import('@/pages/live').then((m) => ({ default: m.LiveRoom })));
const DesignSystem = lazy(() => import('@/pages/design-system').then((m) => ({ default: m.DesignSystem })));

function Authed({ roles, shell = true, children }: { roles?: Role[]; shell?: boolean; children: ReactNode }) {
  const { me, loading } = useSession();
  const [loc] = useLocation();
  if (loading) return <PageSpinner />;
  if (!me) return <Redirect to={`/login?next=${encodeURIComponent(loc + window.location.search)}`} />;
  if (roles && !roles.includes(me.user.role)) return <Redirect to={homePath(me.user.role)} />;
  return shell ? <AppShell>{children}</AppShell> : <>{children}</>;
}

function Home() {
  const { me, loading } = useSession();
  if (loading) return <PageSpinner />;
  return <Redirect to={me ? homePath(me.user.role) : '/welcome'} />;
}

function ScrollToTop() {
  const [loc] = useLocation();
  useEffect(() => {
    window.scrollTo(0, 0);
  }, [loc]);
  return null;
}

export function App() {
  return (
    <Suspense fallback={<PageSpinner />}>
      <ScrollToTop />
      <Switch>
        <Route path="/" component={Home} />
        <Route path="/welcome" component={Welcome} />
        <Route path="/login" component={Login} />
        <Route path="/signup" component={Signup} />
        <Route path="/forgot-password" component={ForgotPassword} />
        <Route path="/reset-password" component={ResetPassword} />
        <Route path="/join/parent" component={JoinParent} />
        <Route path="/l/:code" component={PublicLecture} />
        <Route path="/design" component={DesignSystem} />

        <Route path="/checkout/:id">{(p) => <Authed shell={false}><Checkout id={p.id} /></Authed>}</Route>
        <Route path="/dev/pay/:id">{(p) => <Authed shell={false}><DevPay id={p.id} /></Authed>}</Route>
        <Route path="/live/:id">{(p) => <Authed shell={false}><LiveRoom id={p.id} /></Authed>}</Route>

        <Route path="/t">{() => <Authed roles={['teacher']}><TeacherHome /></Authed>}</Route>
        <Route path="/t/lectures">{() => <Authed roles={['teacher']}><LectureList /></Authed>}</Route>
        <Route path="/t/lectures/new">{() => <Authed roles={['teacher']}><LectureForm /></Authed>}</Route>
        <Route path="/t/lectures/:id/edit">{(p) => <Authed roles={['teacher']}><LectureForm id={p.id} /></Authed>}</Route>
        <Route path="/t/assignments">{() => <Authed roles={['teacher']}><AssignmentList /></Authed>}</Route>
        <Route path="/t/assignments/:id">{(p) => <Authed roles={['teacher']}><AssignmentDetail id={p.id} /></Authed>}</Route>
        <Route path="/t/wallet">{() => <Authed roles={['teacher']}><WalletPage /></Authed>}</Route>

        <Route path="/s">{() => <Authed roles={['student']}><StudentHome /></Authed>}</Route>
        <Route path="/s/lectures">{() => <Authed roles={['student']}><LectureList /></Authed>}</Route>
        <Route path="/s/assignments">{() => <Authed roles={['student']}><AssignmentList /></Authed>}</Route>
        <Route path="/s/assignments/:id">{(p) => <Authed roles={['student']}><AssignmentDetail id={p.id} /></Authed>}</Route>

        <Route path="/p">{() => <Authed roles={['parent']}><ParentHome /></Authed>}</Route>
        <Route path="/p/children/:id">{(p) => <Authed roles={['parent']}><ChildDetail id={p.id} /></Authed>}</Route>

        <Route path="/admin">{() => <Authed roles={['admin']}><AdminOverview /></Authed>}</Route>
        <Route path="/admin/payouts">{() => <Authed roles={['admin']}><AdminPayouts /></Authed>}</Route>
        <Route path="/admin/users">{() => <Authed roles={['admin']}><AdminUsers /></Authed>}</Route>

        <Route path="/lectures/:id">{(p) => <Authed><LectureDetail id={p.id} /></Authed>}</Route>
        <Route path="/me">{() => <Authed><Account /></Authed>}</Route>
        <Route path="/notifications">{() => <Authed><Notifications /></Authed>}</Route>

        <Route component={NotFound} />
      </Switch>
    </Suspense>
  );
}
