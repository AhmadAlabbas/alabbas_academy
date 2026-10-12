import type {Metadata} from 'next';
import type {Locale} from '@/i18n/routing';
export const siteOrigin = (process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3001').replace(/\/$/,'');
export const siteIcons: Metadata['icons'] = {
  icon: [
    {url: '/favicon.ico?v=1', type: 'image/x-icon', sizes: '16x16 32x32 48x48'},
    {url: '/favicon.svg?v=1', type: 'image/svg+xml', sizes: 'any'},
  ],
  apple: [{url: '/apple-touch-icon.png?v=1', sizes: '180x180', type: 'image/png'}],
};
export function pageMetadata(locale: Locale, path: string, title: string, description: string, alternatePath: string | null = path): Metadata {
  const other = locale === 'ar' ? 'en' : 'ar';
  const localized = `/${locale}${path === '/' ? '' : path}`;
  return {title,description,alternates:{canonical:localized,languages:alternatePath === null ? {[locale]:localized,'x-default':localized} : {[locale]:localized,[other]:`/${other}${alternatePath === '/' ? '' : alternatePath}`,'x-default':locale === 'ar' ? localized : `/ar${alternatePath === '/' ? '' : alternatePath}`} },openGraph:{title,description,url:localized,locale:locale==='ar'?'ar_SA':'en_US',alternateLocale:locale==='ar'?'en_US':'ar_SA',images:[`/api/og?locale=${locale}&title=${encodeURIComponent(title)}`]},twitter:{card:'summary_large_image',title,description,images:[`/api/og?locale=${locale}&title=${encodeURIComponent(title)}`]}};
}
