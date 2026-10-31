import { ErrorBoundary } from '@/components/error-boundary';
import { AccountSwitchBanner } from '@/components/account-switch';
import { QueryError } from '@/components/query-error';
import { lazy, Suspense, useLayoutEffect, type ReactNode } from 'react';
import { Redirect, Route, Switch, useLocation } from 'wouter';
import type { Role } from '@workspace/live-core';
import { AppShell } from '@/layouts/app-shell';
import { homePath, useSession } from '@/lib/session';
import { Page, PageSpinner, TopBar } from '@/ui';
import { ForgotPassword, JoinParent, Login, ResetPassword, Signup, Welcome } from '@/pages/auth';

const AdminMfaGate = lazy(() => import('@/components/admin-mfa-gate').then(m => ({ default: m.AdminMfaGate })));
const Checkout = lazy(() => import('@/pages/checkout').then(m => ({ default: m.Checkout })));
const DevPay = lazy(() => import('@/pages/checkout').then(m => ({ default: m.DevPay })));
const TeacherVerification = lazy(() => import('@/pages/teacher-verification').then(m => ({ default: m.TeacherVerification })));
const VerificationQueue = lazy(() => import('@/pages/verification-admin').then(m => ({ default: m.VerificationQueue })));
const VerificationReview = lazy(() => import('@/pages/verification-admin').then(m => ({ default: m.VerificationReview })));
const TeacherProfile = lazy(() => import('@/pages/teacher-profile').then(m => ({ default: m.TeacherProfile })));
const PublicLecture = lazy(() => import('@/pages/public-lecture').then(m => ({ default: m.PublicLecture })));
const LectureDetail = lazy(() => import('@/pages/lecture-detail').then(m => ({ default: m.LectureDetail })));
const LectureForm = lazy(() => import('@/pages/lecture-form').then(m => ({ default: m.LectureForm })));
const TeacherHome = lazy(() => import('@/pages/teacher-home').then(m => ({ default: m.TeacherHome })));
const LectureList = lazy(() => import('@/pages/lecture-list').then(m => ({ default: m.LectureList })));
const AssignmentDetail = lazy(() => import('@/pages/assignments').then(m => ({ default: m.AssignmentDetail })));
const AssignmentList = lazy(() => import('@/pages/assignments').then(m => ({ default: m.AssignmentList })));
const WalletPage = lazy(() => import('@/pages/wallet').then(m => ({ default: m.WalletPage })));
const StudentHome = lazy(() => import('@/pages/student-home').then(m => ({ default: m.StudentHome })));
const ChildDetail = lazy(() => import('@/pages/parent').then(m => ({ default: m.ChildDetail })));
const ParentHome = lazy(() => import('@/pages/parent').then(m => ({ default: m.ParentHome })));
const AdminOverview = lazy(() => import('@/pages/admin').then(m => ({ default: m.AdminOverview })));
const AdminPayouts = lazy(() => import('@/pages/admin').then(m => ({ default: m.AdminPayouts })));
const AdminUsers = lazy(() => import('@/pages/admin').then(m => ({ default: m.AdminUsers })));
const AdminTickets = lazy(() => import('@/pages/support').then(m => ({ default: m.AdminTickets })));
const SupportList = lazy(() => import('@/pages/support').then(m => ({ default: m.SupportList })));
const TicketThread = lazy(() => import('@/pages/support').then(m => ({ default: m.TicketThread })));
const Account = lazy(() => import('@/pages/account').then(m => ({ default: m.Account })));
const Notifications = lazy(() => import('@/pages/account').then(m => ({ default: m.Notifications })));
const NotFound = lazy(() => import('@/pages/not-found').then(m => ({ default: m.NotFound })));

// Heavy and only needed in their own screens.
const LiveRoom = lazy(() => import('@/pages/live').then((m) => ({ default: m.LiveRoom })));

function Authed({ roles, children }: { roles?: Role[]; shell?: boolean; children: ReactNode }) {
  const { me, loading, error, retry } = useSession();
  const [loc] = useLocation();
  if (loading) return <PageSpinner />;
  if (error) return <><TopBar title="تعذر تحميل حسابك" /><Page><QueryError error={error} retry={retry} /></Page></>;
  if (!me) return <Redirect to={`/login?next=${encodeURIComponent(loc + window.location.search)}`} />;
  if (roles && !roles.includes(me.user.role)) return <Redirect to={homePath(me.user.role)} />;
  return <>{children}</>;
}

function Home() {
  const { me, loading, error, retry } = useSession();
  if (loading) return <PageSpinner />;
  if (error) return <><TopBar title="تعذر تحميل حسابك" /><Page><QueryError error={error} retry={retry} /></Page></>;
  return <Redirect to={me ? homePath(me.user.role) : '/welcome'} />;
}

function ScrollToTop() {
  const [loc] = useLocation();
  useLayoutEffect(() => {
    window.scrollTo({ top: 0, left: 0, behavior: 'instant' });
  }, [loc]);
  return null;
}

export function App() {
  const { me } = useSession();
  const [loc] = useLocation();
  // Keep navigation outside Suspense: a cold page chunk must never replace
  // the rail/bottom bar with a full-screen loading state.
  const inShell = loc === '/' || /^\/(?:t|s|p|admin)(?:\/|$)/.test(loc) || /^\/(?:me|notifications|support)$/.test(loc) || /^\/(?:lectures|teachers|support)\/[^/]+$/.test(loc);
  const routes = (
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
        <Route path="/teachers/:id">{p => <TeacherProfile id={p.id} />}</Route>

        <Route path="/checkout/:id">{(p) => <Authed shell={false}><Checkout id={p.id} /></Authed>}</Route>
        <Route path="/dev/pay/:id">{(p) => <Authed shell={false}><DevPay id={p.id} /></Authed>}</Route>
        <Route path="/live/:id">{(p) => <Authed shell={false}><LiveRoom id={p.id} /></Authed>}</Route>

        <Route path="/t">{() => <Authed roles={['teacher']}><TeacherHome /></Authed>}</Route>
        <Route path="/t/verification">{() => <Authed roles={['teacher']}><TeacherVerification /></Authed>}</Route>
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
        <Route path="/admin/teacher-verifications">{() => <Authed roles={['admin']}><VerificationQueue /></Authed>}</Route>
        <Route path="/admin/teacher-verifications/:id">{p => <Authed roles={['admin']}><VerificationReview id={p.id} /></Authed>}</Route>
        <Route path="/admin/payouts">{() => <Authed roles={['admin']}><AdminPayouts /></Authed>}</Route>
        <Route path="/admin/tickets">{() => <Authed roles={['admin']}><AdminTickets /></Authed>}</Route>
        <Route path="/admin/users">{() => <Authed roles={['admin']}><AdminUsers /></Authed>}</Route>

        <Route path="/lectures/:id">{(p) => <Authed><LectureDetail id={p.id} /></Authed>}</Route>
        <Route path="/me">{() => <Authed><Account /></Authed>}</Route>
        <Route path="/notifications">{() => <Authed><Notifications /></Authed>}</Route>
        <Route path="/support">{() => <Authed><SupportList /></Authed>}</Route>
        <Route path="/support/:id">{(p) => <Authed><TicketThread id={p.id} /></Authed>}</Route>

        <Route component={NotFound} />
      </Switch>
    </Suspense>
  );
  const content = me && inShell ? <AppShell><ErrorBoundary key={loc}>{routes}</ErrorBoundary></AppShell> : routes;
  return <div className={me?.impersonation ? 'gl-impersonating' : undefined}><AccountSwitchBanner />{me?.user.role === 'admin' ? <Suspense fallback={<PageSpinner />}><AdminMfaGate>{content}</AdminMfaGate></Suspense> : content}</div>;
}
