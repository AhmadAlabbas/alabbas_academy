import type {Locale} from '@/i18n/routing';
import {safeAccountReturnPath} from '@/components/account/return-path';

const publicPaths = new Set(['/', '/courses', '/about', '/cart', '/login', '/signup', '/forgot-password', '/reset-password', '/verify-email', '/account']);

function translatedPath(pathname: string, locale: Locale, nextLocale: Locale, courseSlugs: Array<Record<Locale, string>>, fallback: string): string {
  if (publicPaths.has(pathname) || /^\/(?:my-courses|learn|admin|orders)(?:\/|$)/u.test(pathname)) return pathname;
  if (!pathname.startsWith('/courses/')) return fallback;
  try {
    const slug = decodeURIComponent(pathname.slice('/courses/'.length)).normalize('NFC');
    const course = courseSlugs.find((item) => item[locale].normalize('NFC') === slug);
    return course ? (course[nextLocale] ? `/courses/${course[nextLocale]}` : '/courses') : fallback;
  } catch {
    return fallback;
  }
}

/** Preserve the requested course/cart and email-link query when changing language. */
export function languageDestination({pathname, search, hash, locale, nextLocale, courseSlugs}: {
  pathname: string;
  search: string;
  hash: string;
  locale: Locale;
  nextLocale: Locale;
  courseSlugs: Array<Record<Locale, string>>;
}): string {
  const nextPath = translatedPath(pathname, locale, nextLocale, courseSlugs, '/');
  const query = new URLSearchParams(search);
  for (const key of ['callbackUrl', 'returnTo']) {
    const values = query.getAll(key);
    if (!values.length) continue;
    const safePath = safeAccountReturnPath(values.length === 1 ? values[0] : undefined, locale);
    const delimiter = safePath.search(/[?#]/u);
    const callbackPath = delimiter < 0 ? safePath : safePath.slice(0, delimiter);
    const suffix = delimiter < 0 ? '' : safePath.slice(delimiter);
    const translated = translatedPath(callbackPath.slice(locale.length + 1), locale, nextLocale, courseSlugs, '/account');
    query.set(key, `/${nextLocale}${translated}${suffix}`);
  }
  const nextSearch = query.toString();
  return nextPath + (nextSearch ? `?${nextSearch}` : '') + hash;
}
