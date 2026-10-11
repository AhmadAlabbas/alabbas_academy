import type {Metadata} from 'next';
import {hasLocale, NextIntlClientProvider} from 'next-intl';
import {getMessages, getTranslations, setRequestLocale} from 'next-intl/server';
import {notFound} from 'next/navigation';
import {SiteFooter} from '@/components/layout/site-footer';
import {SiteHeader} from '@/components/layout/site-header';
import {siteOrigin, siteIcons} from '@/lib/seo';
import {publicCatalog,siteSettings} from '@/lib/public-data';
import {routing} from '@/i18n/routing';
import {arabicFont, latinFont} from '@/lib/fonts';
import {CartProvider} from '@/components/cart/cart-provider';
import '../globals.css';

export const dynamic = 'force-dynamic';

type LocaleLayoutProps = {
  children: React.ReactNode;
  params: Promise<{locale: string}>;
};

export function generateStaticParams() {
  return routing.locales.map((locale) => ({locale}));
}

export async function generateMetadata({params}: Omit<LocaleLayoutProps, 'children'>): Promise<Metadata> {
  const {locale} = await params;
  if (!hasLocale(routing.locales, locale)) notFound();
  const t = await getTranslations({locale, namespace: 'Common'});const settings=await siteSettings();const academy=String(settings[`name_${locale}`]||t('academy')),description=String(settings[`seo_${locale}`]||t('siteDescription'));

  return {
    metadataBase: new URL(process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3001'),
    title: {default:academy,template:`%s | ${academy}`},
    description,
    icons: siteIcons,
    openGraph: {
      siteName:academy,
      locale: locale === 'ar' ? 'ar_SA' : 'en_US',
      type: 'website',
    },
  };
}

export default async function LocaleLayout({children, params}: LocaleLayoutProps) {
  const {locale} = await params;
  if (!hasLocale(routing.locales, locale)) notFound();
  setRequestLocale(locale);
  const [messages, t, catalog, settings] = await Promise.all([getMessages(), getTranslations('Common'),publicCatalog(),siteSettings()]);

  return (
    <html lang={locale} dir={locale === 'ar' ? 'rtl' : 'ltr'} data-scroll-behavior="smooth" className={`${arabicFont.variable} ${latinFont.variable}`}>
      <body><script type="application/ld+json" dangerouslySetInnerHTML={{__html:JSON.stringify([{'@context':'https://schema.org','@type':'Organization',name:String(settings[`name_${locale}`]||t('academy')),url:siteOrigin,logo:siteOrigin+String(settings.logo||'/logo.svg')},{'@context':'https://schema.org','@type':'WebSite',name:String(settings[`name_${locale}`]||t('academy')),url:siteOrigin,inLanguage:['ar','en']}]).replace(/</g,'\\u003c')}}/>
        <NextIntlClientProvider messages={messages}>
          <CartProvider catalog={catalog.courses}>
          <a href="#main-content" className="sr-only focus:not-sr-only focus:fixed focus:start-4 focus:top-4 focus:z-50 focus:rounded-xl focus:bg-[var(--navy)] focus:px-5 focus:py-3 focus:text-white">
            {t('skipToContent')}
          </a>
          <SiteHeader courseSlugs={catalog.courses.map((course) => course.slug)} logo={typeof settings.logo === 'string' ? settings.logo : '/logo.svg'} academyName={typeof settings[`name_${locale}`] === 'string' ? String(settings[`name_${locale}`]) : undefined} />
          <main id="main-content" tabIndex={-1}>{children}</main>
          <SiteFooter />
          </CartProvider>
        </NextIntlClientProvider>
      </body>
    </html>
  );
}
