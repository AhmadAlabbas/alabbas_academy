/** Keep account redirects on a known locale and never accept encoded destinations. */
export function safeAccountReturnPath(value: unknown, locale: string): string {
  const fallback = `/${locale}/account`;
  if (typeof value !== 'string' || value.length > 1024) return fallback;
  if (!value.startsWith(`/${locale}/`) || /[\\%\u0000-\u0020]/u.test(value)) return fallback;
  if (value.startsWith('//')) return fallback;
  const pathname = value.split(/[?#]/u)[0];
  if (/\/(?:api|login|signup|forgot-password|reset-password|verify-email)(?:\/|$)/u.test(pathname)) return fallback;
  if (pathname.split('/').some((segment) => segment === '.' || segment === '..')) return fallback;
  return value;
}
