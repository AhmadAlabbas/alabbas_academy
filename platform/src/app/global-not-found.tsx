import type {Metadata} from 'next';
import {ArrowUpRight, BookOpen} from 'lucide-react';
import Image from 'next/image';
import {hasLocale} from 'next-intl';
import {getTranslations} from 'next-intl/server';
import {headers} from 'next/headers';
import {routing} from '@/i18n/routing';
import {arabicFont, latinFont} from '@/lib/fonts';
import {siteOrigin, siteIcons} from '@/lib/seo';
import './globals.css';

async function getNotFoundLocale() {
  const requestedLocale = (await headers()).get('X-NEXT-INTL-LOCALE');
  return hasLocale(routing.locales, requestedLocale) ? requestedLocale : routing.defaultLocale;
}

export async function generateMetadata(): Promise<Metadata> {
  const locale = await getNotFoundLocale();
  const [t, common] = await Promise.all([
    getTranslations({locale, namespace: 'NotFound'}),
    getTranslations({locale, namespace: 'Common'}),
  ]);
  return {
    metadataBase: new URL(siteOrigin),
    title: `${t('title')} | ${common('academy')}`,
    description: t('description'),
    icons: siteIcons,
    robots: {index: false, follow: false},
  };
}

// This document bypasses the dynamic locale layout. Reading the locale header
// here keeps router-level 404s localized without making public pages dynamic.
export default async function GlobalNotFound() {
  const locale = await getNotFoundLocale();
  const [t, common] = await Promise.all([
    getTranslations({locale, namespace: 'NotFound'}),
    getTranslations({locale, namespace: 'Common'}),
  ]);

  return (
    <html lang={locale} dir={locale === 'ar' ? 'rtl' : 'ltr'} data-scroll-behavior="smooth" className={`${arabicFont.variable} ${latinFont.variable}`}>
      <body>
        <a href="#main-content" className="sr-only focus:not-sr-only focus:fixed focus:start-4 focus:top-4 focus:z-50 focus:rounded-xl focus:bg-[var(--navy)] focus:px-5 focus:py-3 focus:text-white">{common('skipToContent')}</a>
        <header className="border-b border-line bg-white">
          <div className="container-shell flex min-h-24 items-center justify-between gap-4 py-4">
            <a href={`/${locale}`} className="inline-flex items-center gap-3 font-semibold">
              <Image src="/logo.svg" width={330} height={425} alt="" className="h-auto w-9 object-contain" />
              <span className="text-lg">{common('academy')}</span>
            </a>
            <a href={`/${locale}/courses`} className="hidden items-center gap-2 text-sm font-medium text-[#22677f] sm:inline-flex">
              {common('allCourses')}<ArrowUpRight aria-hidden="true" className="logical-arrow size-4" />
            </a>
          </div>
        </header>
        <main id="main-content" tabIndex={-1} className="container-shell flex min-h-[calc(100dvh-6rem)] flex-col items-center justify-center py-20 text-center">
          <span aria-hidden="true" className="mb-7 flex size-24 items-center justify-center rounded-3xl bg-skysoft"><BookOpen className="size-11 stroke-[1.3] text-[#22677f]" /></span>
          <p aria-hidden="true" className="mb-3 text-sm font-medium text-muted">404</p>
          <h1 className="section-title mb-4">{t('title')}</h1>
          <p className="section-copy max-w-lg">{t('description')}</p>
          <div className="mt-8 flex flex-wrap justify-center gap-3">
            <a href={`/${locale}`} className="button-primary">{t('home')}</a>
            <a href={`/${locale}/courses`} className="button-secondary">{t('courses')}<ArrowUpRight aria-hidden="true" className="logical-arrow size-4" /></a>
          </div>
        </main>
      </body>
    </html>
  );
}
