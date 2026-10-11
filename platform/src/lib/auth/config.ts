export function configuredAuthOrigin():string|null {
  const raw = process.env.AUTH_URL || process.env.NEXT_PUBLIC_APP_URL || (process.env.VERCEL_URL ? `https://${process.env.VERCEL_URL}` : '');
  try {
    const url = new URL(raw);
    if (url.username || url.password || !['http:','https:'].includes(url.protocol)) return null;
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
