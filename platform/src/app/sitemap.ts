import type {MetadataRoute} from 'next';
import {sampleCourses} from '@/content/catalog';
import {routing} from '@/i18n/routing';
import {siteOrigin} from '@/lib/seo';

export default function sitemap(): MetadataRoute.Sitemap {
  const pages: MetadataRoute.Sitemap = [];
  for (const path of ['', '/courses', '/about']) {
    for (const locale of routing.locales) {
      pages.push({url: `${siteOrigin}/${locale}${path}`, alternates: {languages: {ar: `${siteOrigin}/ar${path}`, en: `${siteOrigin}/en${path}`}}});
    }
  }
  for (const course of sampleCourses) {
    const languages = {ar: `${siteOrigin}/ar/courses/${encodeURIComponent(course.slug.ar)}`, en: `${siteOrigin}/en/courses/${course.slug.en}`};
    for (const locale of routing.locales) pages.push({url: languages[locale], alternates: {languages}});
  }
  return pages;
}
