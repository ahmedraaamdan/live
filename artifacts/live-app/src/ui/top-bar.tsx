import { AccountMenu, ThemeToggle } from '@/components/account-menu';
import { AccountSwitchTools } from '@/components/account-switch';
import { useLayoutEffect, useState, type ReactNode } from 'react';
import { ArrowRight } from 'lucide-react';
import { useLocation } from 'wouter';
import { cn } from '@/lib/cn';
import { IconButton } from './button';

/**
 * Top app bar: title is placed neatly right next to the back arrow so screen
 * real estate is not wasted with huge empty headings on mobile.
 */
export function TopBar({
  title,
  subtitle,
  back,
  actions,
  large,
  className,
}: {
  title: ReactNode;
  subtitle?: ReactNode;
  /** true = history back (or the fallback path); a string = go there. */
  back?: boolean | string;
  actions?: ReactNode;
  large?: boolean;
  className?: string;
}) {
  const [, navigate] = useLocation();
  const [scrolled, setScrolled] = useState(false);

  useLayoutEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > (large ? 40 : 4));
    onScroll();
    window.addEventListener('scroll', onScroll, { passive: true });
    return () => window.removeEventListener('scroll', onScroll);
  }, [large]);

  const goBack = () => {
    if (typeof back === 'string') navigate(back);
    else if (window.history.length > 1) window.history.back();
    else navigate('/');
  };

  return (
    <>
      <header
        className={cn(
          'gl-topbar sticky top-0 z-30 pt-safe transition-[background-color,box-shadow] duration-200',
          scrolled ? 'bg-surface-container/90 shadow-e1 backdrop-blur-xl' : 'bg-background',
          className,
        )}
      >
        <div className="mx-auto flex min-h-14 md:min-h-16 max-w-[var(--content-max)] items-center gap-1.5 px-3 py-2 md:gap-2 md:px-4">
          {back && (
            <IconButton label="رجوع" onClick={goBack} className="shrink-0">
              <ArrowRight />
            </IconButton>
          )}
          <div className="min-w-0 flex-1 pe-1">
            <h1 className="gl-collapsed-title line-clamp-2 md:truncate text-base md:text-title-lg font-bold leading-snug">{title}</h1>
            {subtitle && !scrolled && (
              <p className="mt-0.5 line-clamp-1 text-xs text-on-surface-variant md:text-body-sm">{subtitle}</p>
            )}
          </div>
          <div className="gl-topbar-actions flex shrink-0 items-center gap-1">
            {actions && <div className="flex items-center gap-1">{actions}</div>}
            <ThemeToggle /><AccountMenu /><AccountSwitchTools />
          </div>
        </div>
      </header>
    </>
  );
}

/** The scrolling body of a screen: centred, padded, clear of the nav bar. */
export function Page({ children, className, wide }: { children: ReactNode; className?: string; wide?: boolean }) {
  return (
    <main className={cn('gl-page mx-auto w-full px-4 pb-nav md:px-6 lg:pb-12', wide ? 'max-w-[var(--content-max)]' : 'max-w-3xl', className)}>
      {children}
    </main>
  );
}

/** Bottom action bar for a screen's main CTA (thumb zone), above the nav bar on phones. */
export function ActionBar({ children, className }: { children: ReactNode; className?: string }) {
  return (
    <div
      className={cn(
        'gl-actionbar fixed inset-x-0 bottom-0 z-40 border-t border-outline-variant bg-surface-container-low/95 px-4 pt-3 pb-[calc(var(--safe-bottom)+0.75rem)] backdrop-blur-xl',
        'lg:static lg:mt-6 lg:rounded-lg lg:border-0 lg:bg-transparent lg:p-0 lg:backdrop-blur-none',
        className,
      )}
    >
      <div className="mx-auto flex max-w-3xl items-center gap-3">{children}</div>
    </div>
  );
}
