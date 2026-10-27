import type { ReactNode } from 'react';
import {
  Bell,
  CalendarDays,
  Home,
  LayoutDashboard,
  NotebookPen,
  ShieldCheck,
  UserRound,
  Users,
  Wallet,
  type LucideIcon,
} from 'lucide-react';
import { Link, useLocation } from 'wouter';
import type { Role } from '@workspace/live-core';
import { cn } from '@/lib/cn';
import { useMe } from '@/lib/session';
import { CountDot, GahezMark } from '@/ui';

interface NavItem {
  href: string;
  label: string;
  icon: LucideIcon;
  /** Matches sub-pages too (e.g. /t/lectures/123). */
  prefix?: boolean;
}

const NAV: Record<Role, NavItem[]> = {
  teacher: [
    { href: '/t', label: 'الرئيسية', icon: LayoutDashboard },
    { href: '/t/lectures', label: 'الحصص', icon: CalendarDays, prefix: true },
    { href: '/t/assignments', label: 'الواجبات', icon: NotebookPen, prefix: true },
    { href: '/t/wallet', label: 'المحفظة', icon: Wallet },
    { href: '/me', label: 'حسابي', icon: UserRound },
  ],
  student: [
    { href: '/s', label: 'الرئيسية', icon: Home },
    { href: '/s/lectures', label: 'حصصي', icon: CalendarDays, prefix: true },
    { href: '/s/assignments', label: 'الواجبات', icon: NotebookPen, prefix: true },
    { href: '/me', label: 'حسابي', icon: UserRound },
  ],
  parent: [
    { href: '/p', label: 'أولادي', icon: Users, prefix: true },
    { href: '/notifications', label: 'التنبيهات', icon: Bell },
    { href: '/me', label: 'حسابي', icon: UserRound },
  ],
  admin: [
    { href: '/admin', label: 'نظرة عامة', icon: LayoutDashboard },
    { href: '/admin/payouts', label: 'السحوبات', icon: Wallet },
    { href: '/admin/users', label: 'المستخدمين', icon: ShieldCheck },
    { href: '/me', label: 'حسابي', icon: UserRound },
  ],
};

function useActive() {
  const [loc] = useLocation();
  return (item: NavItem) => loc === item.href || (item.prefix && loc.startsWith(item.href + '/'));
}

/**
 * Navigation by window size (M3): a bottom navigation bar on phones, a
 * navigation rail from 840px. Same destinations either way.
 */
export function AppShell({ children }: { children: ReactNode }) {
  const me = useMe();
  const items = NAV[me.user.role];
  const isActive = useActive();
  const unread = me.unreadNotifications;

  return (
    <div className="min-h-dvh lg:ps-[var(--rail-width)]">
      {/* Rail: expanded windows */}
      <nav aria-label="التنقل" className="fixed inset-y-0 start-0 z-40 hidden w-[var(--rail-width)] flex-col items-center gap-2 border-e border-outline-variant bg-surface-container-low py-6 lg:flex">
        <Link href="/" className="mb-6 grid size-12 place-items-center rounded-md bg-primary text-on-primary" aria-label="Gahez Live">
          <GahezMark className="h-5" />
        </Link>
        {items.map((item) => {
          const on = isActive(item);
          return (
            <Link key={item.href} href={item.href} className="group flex w-full flex-col items-center gap-1 py-1" aria-current={on ? 'page' : undefined}>
              <span className={cn('state-layer relative grid h-8 w-14 place-items-center rounded-full transition-colors', on ? 'bg-secondary-container text-on-secondary-container' : 'text-on-surface-variant')}>
                <item.icon className="size-6" strokeWidth={on ? 2.4 : 2} />
                {item.href === '/notifications' && <CountDot count={unread} />}
              </span>
              <span className={cn('text-label-md', on ? 'text-on-surface' : 'text-on-surface-variant')}>{item.label}</span>
            </Link>
          );
        })}
      </nav>

      {children}

      {/* Navigation bar: compact and medium windows */}
      <nav
        aria-label="التنقل"
        className="fixed inset-x-0 bottom-0 z-40 border-t border-outline-variant bg-surface-container-low/95 pb-safe backdrop-blur-xl lg:hidden"
      >
        <div className="mx-auto flex h-[var(--nav-height)] max-w-xl items-stretch">
          {items.map((item) => {
            const on = isActive(item);
            return (
              <Link key={item.href} href={item.href} className="flex flex-1 flex-col items-center justify-center gap-1" aria-current={on ? 'page' : undefined}>
                <span
                  className={cn(
                    'state-layer relative grid h-8 w-16 place-items-center rounded-full transition-[background-color,width] duration-300 ease-standard',
                    on ? 'bg-secondary-container text-on-secondary-container' : 'w-12 text-on-surface-variant',
                  )}
                >
                  <item.icon className="size-6" strokeWidth={on ? 2.4 : 2} />
                  {item.href === '/notifications' && <CountDot count={unread} />}
                </span>
                <span className={cn('text-label-md', on ? 'text-on-surface' : 'text-on-surface-variant')}>{item.label}</span>
              </Link>
            );
          })}
        </div>
      </nav>
    </div>
  );
}

/** The bell in a page's top bar, with the unread count. */
export function NotificationsButton() {
  const me = useMe();
  return (
    <Link href="/notifications" className="state-layer relative grid size-11 place-items-center rounded-full text-on-surface-variant" aria-label="التنبيهات">
      <Bell className="size-6" />
      <CountDot count={me.unreadNotifications} />
    </Link>
  );
}
