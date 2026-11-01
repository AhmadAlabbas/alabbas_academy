import '@/app/globals.css';
import '@/code/code.css';
import {notFound} from 'next/navigation';
import {arabicFont, latinFont} from '@/lib/fonts';

export const dynamic = 'force-dynamic';

export default async function CodeLayout({
  children, params,
}: {
  children: React.ReactNode;
  params: Promise<{locale: string}>;
}) {
  const {locale} = await params;
  if (locale !== 'en' && locale !== 'ar') notFound();
  return <html lang={locale} dir={locale === 'ar' ? 'rtl' : 'ltr'}
      className={`${arabicFont.variable} ${latinFont.variable}`}>
    <body>{children}</body>
  </html>;
}
