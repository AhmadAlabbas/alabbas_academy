import type {Metadata} from 'next';
import {hasLocale} from 'next-intl';
import {getTranslations, setRequestLocale} from 'next-intl/server';
import {notFound} from 'next/navigation';
import {CatalogBrowser} from '@/components/ui/catalog-browser';
import {publicCatalog} from '@/lib/public-data';
import {routing} from '@/i18n/routing';
import {pageMetadata} from '@/lib/seo';

type CoursesPageProps = {
  params: Promise<{locale: string}>;
  searchParams: Promise<{category?: string | string[]; language?: string | string[]}>;
};

export async function generateMetadata({params}: CoursesPageProps): Promise<Metadata> {
  const {locale} = await params;
  if (!hasLocale(routing.locales, locale)) notFound();
  const t = await getTranslations({locale, namespace: 'Catalog'});
  return pageMetadata(locale, '/courses', t('title'), t('description'));
}

export default async function CoursesPage({params, searchParams}: CoursesPageProps) {
  const {locale} = await params;
  if (!hasLocale(routing.locales, locale)) notFound();
  setRequestLocale(locale);
  const {categories,instructors,courses:sampleCourses}=await publicCatalog();
  const [t, search] = await Promise.all([getTranslations('Catalog'), searchParams]);
  const initialCategory = typeof search.category === 'string' && categories.some((category) => category.slug === search.category)
    ? search.category
    : '';
  const initialLanguage = search.language === 'ar' || search.language === 'en' ? search.language : '';

  return (
    <div className="container-shell pb-20 pt-10 sm:pb-24 sm:pt-16">
      <header className="relative mb-10 overflow-hidden rounded-3xl border border-line bg-surface px-6 py-10 sm:px-10 sm:py-14">
        <div aria-hidden="true" className="pointer-events-none absolute -end-10 -top-14 size-64 rounded-full border-[38px] border-skysoft opacity-80" />
        <div aria-hidden="true" className="pointer-events-none absolute bottom-5 end-20 size-12 rounded-2xl bg-goldsoft" />
        <div className="relative max-w-2xl">
          <p className="eyebrow mb-3">{t('eyebrow')}</p>
          <h1 className="section-title mb-4">{t('title')}</h1>
          <p className="section-copy max-w-xl">{t('description')}</p>
          <p className="mt-6 inline-flex rounded-full bg-skysoft px-4 py-2 text-xs font-medium text-accent">{t('sampleNotice')}</p>
        </div>
      </header>
      <CatalogBrowser courses={sampleCourses} categories={categories} instructors={instructors} initialCategory={initialCategory} initialLanguage={initialLanguage} />
    </div>
  );
}
