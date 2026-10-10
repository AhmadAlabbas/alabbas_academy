import createMiddleware from 'next-intl/middleware';
import {hasLocale} from 'next-intl';
import {NextRequest, NextResponse} from 'next/server';
import {routing} from './i18n/routing';

const handleLocaleRouting = createMiddleware(routing);

export default function proxy(request: NextRequest) {
  const {pathname} = request.nextUrl;
  const pathLocale = pathname.split('/')[1];

  // A fresh visitor starts in Arabic. An explicitly selected language is
  // retained by the locale cookie, independently of browser preferences.
  if (!hasLocale(routing.locales, pathLocale)) {
    const savedLocale = request.cookies.get('ALABBAS_LOCALE')?.value;
    const locale = hasLocale(routing.locales, savedLocale) ? savedLocale : routing.defaultLocale;
    const destination = request.nextUrl.clone();
    destination.pathname = `/${locale}${pathname === '/' ? '' : pathname}`;
    return NextResponse.redirect(destination);
  }

  return handleLocaleRouting(request);
}

export const config = {
  matcher: ['/ar/:path*', '/en/:path*', '/((?!api|_next|_vercel|.*\\..*).*)'],
};
