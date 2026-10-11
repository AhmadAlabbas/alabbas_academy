'use client';

import Image from 'next/image';
import {Menu, X} from 'lucide-react';
import {useTranslations} from 'next-intl';
import {useEffect, useRef, useState} from 'react';
import {Link, usePathname} from '@/i18n/navigation';
import type {Locale} from '@/i18n/routing';
import {LanguageSwitcher} from './language-switcher';
import {AccountNavigation} from './account-navigation';
import {CartLinkBadge} from '@/components/cart/cart-controls';
import {ThemeToggle} from './theme-toggle';

const routes = [
  {href: '/', label: 'home'},
  {href: '/courses', label: 'courses'},
  {href: '/about', label: 'about'},
  {href:'/my-courses',label:'myCourses'},
] as const;

type SiteHeaderProps = {
  courseSlugs: Array<Record<Locale, string>>;
  logo?:string;academyName?:string;
};

export function SiteHeader({courseSlugs,logo='/logo.svg',academyName}: SiteHeaderProps) {
  const t = useTranslations('Header');
  const pathname = usePathname();
  const [isOpen, setIsOpen] = useState(false);
  const toggleRef = useRef<HTMLButtonElement>(null);
  const menuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!isOpen) return;

    menuRef.current?.querySelector<HTMLAnchorElement>('a')?.focus();

    function onKeyDown(event: KeyboardEvent) {
      if (event.key === 'Escape') {
        setIsOpen(false);
        toggleRef.current?.focus();
      }
    }

    function onOutsideInteraction(event: PointerEvent | FocusEvent) {
      const target = event.target as Node;
      if (!menuRef.current?.contains(target) && !toggleRef.current?.contains(target)) {
        setIsOpen(false);
      }
    }

    const desktop = window.matchMedia('(min-width: 1280px)');
    function onScreenChange(event: MediaQueryListEvent) {
      if (event.matches) setIsOpen(false);
    }

    document.addEventListener('keydown', onKeyDown);
    document.addEventListener('pointerdown', onOutsideInteraction);
    document.addEventListener('focusin', onOutsideInteraction);
    desktop.addEventListener('change', onScreenChange);
    return () => {
      document.removeEventListener('keydown', onKeyDown);
      document.removeEventListener('pointerdown', onOutsideInteraction);
      document.removeEventListener('focusin', onOutsideInteraction);
      desktop.removeEventListener('change', onScreenChange);
    };
  }, [isOpen]);

  function isActive(href: string) {
    return href === '/' ? pathname === href : pathname.startsWith(href);
  }

  return (
    <header className="relative z-40 border-b border-[var(--line)] bg-surface/95">
      <div className="container-shell flex min-h-24 items-center justify-between gap-4 py-3">
        <Link href="/" className="flex min-w-0 items-center gap-3" aria-label={academyName || t('academy')}>
          <Image src={logo} unoptimized width={330} height={425} alt="" preload fetchPriority="high" className="academy-logo h-auto w-8 shrink-0 object-contain sm:w-10" />
          <span className="hidden min-w-0 min-[440px]:block">
            <span className="block text-base font-bold tracking-tight text-ink sm:text-lg">{academyName || t('academy')}</span>
            <span className="mt-0.5 hidden text-xs text-[var(--muted)] sm:block">{t('tagline')}</span>
          </span>
        </Link>

        <nav aria-label={t('navigation')} className="hidden items-center gap-5 xl:flex">
          {routes.map((route) => (
            <Link
              key={route.href}
              href={route.href}
              aria-current={isActive(route.href) ? 'page' : undefined}
              className={`rounded-sm py-2 text-sm font-semibold transition hover:text-ink ${isActive(route.href) ? 'text-ink underline decoration-[var(--blue)] decoration-4 underline-offset-8' : 'text-[var(--muted)]'}`}
            >
              {t(route.label)}
            </Link>
          ))}
        </nav>

        <div className="flex shrink-0 items-center gap-2 sm:gap-3">
          <ThemeToggle />
          <LanguageSwitcher courseSlugs={courseSlugs} />
          <CartLinkBadge />
          <AccountNavigation />
          <button
            ref={toggleRef}
            type="button"
            aria-controls="mobile-navigation"
            aria-expanded={isOpen}
            aria-label={t(isOpen ? 'closeMenu' : 'openMenu')}
            onClick={() => setIsOpen((value) => !value)}
            className="inline-flex h-11 w-11 items-center justify-center rounded-full border border-[var(--line)] text-ink xl:hidden"
          >
            {isOpen ? <X className="h-5 w-5" aria-hidden="true" /> : <Menu className="h-5 w-5" aria-hidden="true" />}
          </button>
        </div>
      </div>

      {isOpen && (
        <div
          id="mobile-navigation"
          ref={menuRef}
          className="absolute inset-x-0 top-full max-h-[calc(100dvh-6rem)] overflow-y-auto overscroll-contain border-b border-[var(--line)] bg-surface shadow-lg xl:hidden"
        >
          <nav className="container-shell flex flex-col gap-1 py-4" aria-label={t('navigation')}>
            {routes.map((route) => (
              <Link
                key={route.href}
                href={route.href}
                aria-current={isActive(route.href) ? 'page' : undefined}
                onClick={() => setIsOpen(false)}
                className={`rounded-xl px-4 py-3 text-base font-semibold ${isActive(route.href) ? 'bg-[var(--surface)] text-ink' : 'text-[var(--muted)] hover:bg-[var(--surface)]'}`}
              >
                {t(route.label)}
              </Link>
            ))}
            <Link href="/cart" onClick={() => setIsOpen(false)} className="rounded-xl px-4 py-3 text-base font-semibold text-[var(--muted)] hover:bg-[var(--surface)]">{t('cart')}</Link>
            <AccountNavigation mobile onNavigate={() => setIsOpen(false)} />
          </nav>
        </div>
      )}
    </header>
  );
}
