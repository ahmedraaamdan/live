import { useEffect, useState } from "react";
import { Link, useLocation } from "wouter";
import { LogIn, Menu, Moon, Sun, UserPlus, X } from "lucide-react";
import { Logo } from "@/components/marketing/signal-mark";
import { primaryNav } from "@/lib/routes";
import { siteConfig } from "@/lib/site-config";

function ThemeToggle() {
  const [theme, setTheme] = useState<string>("light");
  useEffect(() => {
    try {
      const saved = localStorage.getItem("gahez-live-theme");
      if (saved === "light" || saved === "dark") {
        document.documentElement.dataset.theme = saved;
        setTheme(saved);
      }
    } catch {
      /* The control still works when storage is unavailable. */
    }
  }, []);
  const toggle = () => {
    const isDark =
      theme === "dark";
    const next = isDark ? "light" : "dark";
    document.documentElement.dataset.theme = next;
    setTheme(next);
    try {
      localStorage.setItem("gahez-live-theme", next);
    } catch {
      /* optional preference */
    }
  };
  return (
    <button
      className="icon-button studio-theme-toggle"
      onClick={toggle}
      aria-label="تبديل المظهر الفاتح والداكن"
    >
      <Sun size={17} className="theme-sun" />
      <Moon size={17} className="theme-moon" />
    </button>
  );
}

export function Header() {
  const [location] = useLocation();
  const [menuOpen, setMenuOpen] = useState(false);
  useEffect(() => {
    if (!menuOpen) return;
    const closeOnEscape = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        setMenuOpen(false);
        document
          .querySelector<HTMLButtonElement>(
            '[data-testid="button-mobile-menu"]',
          )
          ?.focus();
      }
    };
    window.addEventListener("keydown", closeOnEscape);
    return () => window.removeEventListener("keydown", closeOnEscape);
  }, [menuOpen]);

  const isActive = (path: string) =>
    path === "/" ? location === "/" : location.startsWith(path);

  return (
    <>
      <header className="topbar">
        <div className="container-wide topbar-inner">
          <Link href="/" className="brand-link" data-testid="link-brand-home" onClick={() => {
            if (location === '/') window.scrollTo({ top: 0, behavior: window.matchMedia('(prefers-reduced-motion: reduce)').matches ? 'auto' : 'smooth' });
          }}>
            <Logo />
          </Link>
          <nav className="nav-links" aria-label="التنقل الرئيسي">
            {primaryNav.map((item) => (
              <Link
                key={item.path}
                href={item.path}
                className={`nav-link ${isActive(item.path) ? "active" : ""}`}
                data-testid={`link-nav-${item.path.replace(/\//g, "") || "home"}`}
              >
                {item.navLabel}
              </Link>
            ))}
          </nav>
          <div className="topbar-actions">
            <ThemeToggle />
            <a
              className="header-login desktop-only"
              href={`${siteConfig.appUrl}/login`}
              data-testid="link-header-login"
            >
              <LogIn size={15} /> دخول
            </a>
            <a
              className="header-signup"
              href={`${siteConfig.appUrl}/welcome`}
              data-testid="link-header-signup"
            >
              <UserPlus size={15} /> إنشاء حساب
            </a>
            <button
              className="icon-button mobile-menu"
              aria-label={menuOpen ? "إغلاق القائمة" : "فتح القائمة"}
              aria-expanded={menuOpen}
              aria-controls={menuOpen ? "studio-mobile-nav" : undefined}
              onClick={() => setMenuOpen((v) => !v)}
              data-testid="button-mobile-menu"
            >
              {menuOpen ? <X size={20} /> : <Menu size={20} />}
            </button>
          </div>
        </div>
        {menuOpen && (
          <div
            className="mobile-panel"
            id="studio-mobile-nav"
            role="dialog"
            aria-label="قائمة التنقل"
          >
            {primaryNav.map((item) => (
              <Link
                key={item.path}
                href={item.path}
                onClick={() => setMenuOpen(false)}
                data-testid={`mobile-link-${item.path.replace(/\//g, "") || "home"}`}
              >
                {item.navLabel}
              </Link>
            ))}
            <div className="mobile-auth">
              <a
                className="header-login"
                href={`${siteConfig.appUrl}/login`}
                data-testid="mobile-link-login"
              >
                دخول
              </a>
              <a
                className="header-signup"
                href={`${siteConfig.appUrl}/welcome`}
                data-testid="mobile-link-signup"
              >
                إنشاء حساب
              </a>
            </div>
          </div>
        )}
      </header>
    </>
  );
}
