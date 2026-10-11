import type {Metadata} from 'next';
import {hasLocale} from 'next-intl';
import {getTranslations} from 'next-intl/server';
import {notFound} from 'next/navigation';
import {routing} from '@/i18n/routing';

export type AccountPageProps = {
  params: Promise<{locale: string}>;
  searchParams: Promise<Record<string, string | string[] | undefined>>;
};

export function firstQueryValue(value: string | string[] | undefined) {
  return typeof value === 'string' ? value : undefined;
}

export async function accountPageMetadata(params: AccountPageProps['params'], key: string): Promise<Metadata> {
  const {locale} = await params;
  if (!hasLocale(routing.locales, locale)) notFound();
  const t = await getTranslations({locale, namespace: 'Account'});
  return {title: t(`${key}Title`), description: t(`${key}Description`), robots: {index: false, follow: false}};
}
