export function configuredAuthOrigin():string|null {
  // Auth.js honors an explicitly configured AUTH_URL, including an empty value.
  // Do not silently replace a broken primary URL with a different origin.
  const raw = process.env.AUTH_URL ?? process.env.NEXT_PUBLIC_APP_URL ?? (process.env.VERCEL_URL ? `https://${process.env.VERCEL_URL}` : '');
  try {
    const url = new URL(raw);
    if (url.username || url.password || !['http:','https:'].includes(url.protocol)) return null;
    // A path changes Auth.js's API base path; query/fragment delimiters also
    // interfere with generated action URLs. Accept only an origin/root URL.
    if (url.href !== `${url.origin}/`) return null;
    // Auth.js also honors this legacy alias when AUTH_URL is absent. It must
    // agree with the documented application origin rather than override it.
    if (process.env.AUTH_URL === undefined && process.env.NEXTAUTH_URL !== undefined && new URL(process.env.NEXTAUTH_URL).href !== url.href) return null;
    if (process.env.NODE_ENV === 'production' && url.protocol !== 'https:' && !['localhost','127.0.0.1','[::1]'].includes(url.hostname)) return null;
    return url.origin;
  } catch { return null; }
}

export function secureAuthCookies():boolean {
  const origin = configuredAuthOrigin();
  return Boolean(origin && new URL(origin).protocol === 'https:');
}

export function authConfigurationReady(): boolean {
  return Boolean(configuredAuthOrigin() && process.env.DATABASE_URL && (process.env.AUTH_SECRET?.length ?? 0) >= 32);
}

export function googleConfigurationReady(): boolean {
  return authConfigurationReady() && Boolean(process.env.GOOGLE_CLIENT_ID && process.env.GOOGLE_CLIENT_SECRET);
}
