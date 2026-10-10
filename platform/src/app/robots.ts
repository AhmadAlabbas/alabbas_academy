import type {MetadataRoute} from 'next';
import {siteOrigin} from '@/lib/seo';

export default function robots(): MetadataRoute.Robots {
  return {
    rules: {userAgent: '*', allow: '/', disallow: ['/api/', '/ar/admin', '/en/admin', '/ar/account', '/en/account', '/ar/cart', '/en/cart', '/ar/checkout', '/en/checkout']},
    sitemap: `${siteOrigin}/sitemap.xml`,
  };
}
