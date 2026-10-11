'use client';

import {Languages} from 'lucide-react';
import {useLocale, useTranslations} from 'next-intl';
import {useTransition} from 'react';
import {usePathname, useRouter} from '@/i18n/navigation';
import type {Locale} from '@/i18n/routing';
import {languageDestination} from './language-destination';

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
    const nextPath = languageDestination({pathname, search: window.location.search, hash: window.location.hash, locale, nextLocale, courseSlugs});
    startTransition(() => {
      router.replace(nextPath, {locale: nextLocale});
    });
  }

  return (
    <button
      type="button"
      onClick={switchLanguage}
      disabled={isPending}
      aria-label={`${nextLocale === 'en' ? 'English' : 'العربية'} — ${t(nextLocale === 'en' ? 'switchToEnglish' : 'switchToArabic')}`}
      className="inline-flex min-h-11 items-center justify-center gap-2 rounded-full border border-[var(--line)] bg-surface px-3 text-sm font-semibold text-ink transition hover:bg-[var(--surface)] disabled:cursor-wait disabled:opacity-60"
    >
      <Languages className="h-4 w-4" aria-hidden="true" />
      <span className="hidden sm:inline" lang={nextLocale} dir={nextLocale === 'ar' ? 'rtl' : 'ltr'}>
        {nextLocale === 'en' ? 'English' : 'العربية'}
      </span>
    </button>
  );
}
