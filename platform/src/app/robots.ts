import type {MetadataRoute} from 'next';
import {siteOrigin} from '@/lib/seo';

export default function robots(): MetadataRoute.Robots {
  return {
    rules: {userAgent: '*', allow: '/', disallow: ['/api/', ...['ar', 'en'].flatMap(locale => ['admin', 'account', 'cart', 'checkout', 'login', 'signup', 'forgot-password', 'reset-password', 'verify-email', 'my-courses', 'orders', 'learn'].map(path => `/${locale}/${path}`))]},
    sitemap: `${siteOrigin}/sitemap.xml`,
  };
}
