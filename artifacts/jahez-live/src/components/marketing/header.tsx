import { useState } from 'react';
import { Link, useLocation } from 'wouter';
import { LogIn, Menu, UserPlus, X } from 'lucide-react';
import { Logo } from '@/components/marketing/signal-mark';
import { primaryNav } from '@/lib/routes';
import { siteConfig } from '@/lib/site-config';

export function Header() {
  const [location] = useLocation();
  const [menuOpen, setMenuOpen] = useState(false);

  const isActive = (path: string) => (path === '/' ? location === '/' : location.startsWith(path));

  return (
    <>
      <header className="topbar">
        <div className="container-wide topbar-inner">
          <Link href="/" className="brand-link" data-testid="link-brand-home">
            <Logo />
          </Link>
          <nav className="nav-links" aria-label="التنقل الرئيسي">
            {primaryNav.map((item) => (
              <Link
                key={item.path}
                href={item.path}
                className={`nav-link ${isActive(item.path) ? 'active' : ''}`}
                data-testid={`link-nav-${item.path.replace(/\//g, '') || 'home'}`}
              >
                {item.navLabel}
              </Link>
            ))}
          </nav>
          <div className="topbar-actions">
            <a className="header-login desktop-only" href={`${siteConfig.appUrl}/login`} data-testid="link-header-login">
              <LogIn size={15} /> دخول
            </a>
            <a className="header-signup" href={`${siteConfig.appUrl}/welcome`} data-testid="link-header-signup">
              <UserPlus size={15} /> اعمل حساب
            </a>
            <button
              className="icon-button mobile-menu"
              aria-label={menuOpen ? 'إغلاق القائمة' : 'فتح القائمة'}
              aria-expanded={menuOpen}
              onClick={() => setMenuOpen((v) => !v)}
              data-testid="button-mobile-menu"
            >
              {menuOpen ? <X size={20} /> : <Menu size={20} />}
            </button>
          </div>
        </div>
        {menuOpen && (
          <div className="mobile-panel" role="dialog" aria-label="قائمة التنقل">
            {primaryNav.map((item) => (
              <Link
                key={item.path}
                href={item.path}
                onClick={() => setMenuOpen(false)}
                data-testid={`mobile-link-${item.path.replace(/\//g, '') || 'home'}`}
              >
                {item.navLabel}
              </Link>
            ))}
            <div className="mobile-auth">
              <a className="header-login" href={`${siteConfig.appUrl}/login`} data-testid="mobile-link-login">
                دخول
              </a>
              <a className="header-signup" href={`${siteConfig.appUrl}/welcome`} data-testid="mobile-link-signup">
                اعمل حساب
              </a>
            </div>
          </div>
        )}
      </header>
    </>
  );
}
