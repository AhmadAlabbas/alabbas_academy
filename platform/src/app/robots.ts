import type {MetadataRoute} from 'next';
import {siteOrigin} from '@/lib/seo';
import {isStaging} from '@/lib/deployment';

export const dynamic = 'force-dynamic';

export default function robots(): MetadataRoute.Robots {
  if (isStaging()) return {rules: {userAgent: '*', disallow: '/'}};
  return {
    rules: {userAgent: '*', allow: '/', disallow: ['/api/', ...['ar', 'en'].flatMap(locale => ['admin', 'account', 'cart', 'checkout', 'login', 'signup', 'forgot-password', 'reset-password', 'verify-email', 'my-courses', 'orders', 'learn'].map(path => `/${locale}/${path}`))]},
    sitemap: `${siteOrigin}/sitemap.xml`,
  };
}
