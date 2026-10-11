'use client';

import {Languages} from 'lucide-react';
import {useLocale, useTranslations} from 'next-intl';
import {useTransition} from 'react';
import {usePathname, useRouter} from '@/i18n/navigation';
import type {Locale} from '@/i18n/routing';

type LanguageSwitcherProps = {
  courseSlugs: Array<Record<Locale, string>>;
};

export function LanguageSwitcher({courseSlugs}: LanguageSwitcherProps) {
  const locale = useLocale() as Locale;
  const nextLocale: Locale = locale === 'ar' ? 'en' : 'ar';
  const pathname = usePathname();
  const router = useRouter();
  const t = useTranslations('Header');
  const [isPending, startTransition] = useTransition();

  function switchLanguage() {
    let nextPath = pathname;

    if (pathname.startsWith('/courses/')) {
      const currentSlug = decodeURIComponent(pathname.slice('/courses/'.length));
      const courseSlug = courseSlugs.find((item) => item[locale] === currentSlug);
      nextPath = courseSlug ? `/courses/${courseSlug[nextLocale]}` : '/';
    } else if (!['/', '/courses', '/about', '/cart', '/login', '/signup', '/forgot-password', '/reset-password', '/verify-email', '/account'].includes(pathname)) {
      nextPath = '/';
    }

    const suffix = window.location.search + window.location.hash;
    startTransition(() => {
      router.replace(nextPath + suffix, {locale: nextLocale});
    });
  }

  return (
    <button
      type="button"
      onClick={switchLanguage}
      disabled={isPending}
      aria-label={t(nextLocale === 'en' ? 'switchToEnglish' : 'switchToArabic')}
      className="inline-flex min-h-11 items-center justify-center gap-2 rounded-full border border-[var(--line)] bg-white px-3 text-sm font-semibold text-[var(--navy)] transition hover:bg-[var(--surface)] disabled:cursor-wait disabled:opacity-60"
    >
      <Languages className="h-4 w-4" aria-hidden="true" />
      <span lang={nextLocale} dir={nextLocale === 'ar' ? 'rtl' : 'ltr'}>
        {nextLocale === 'en' ? 'English' : 'العربية'}
      </span>
    </button>
  );
}
