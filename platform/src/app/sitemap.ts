import {courseLanguages} from '@/lib/catalog';
import type {MetadataRoute} from 'next';
import {publicCatalog} from '@/lib/public-data';
import {siteOrigin} from '@/lib/seo';
export const dynamic='force-dynamic';
export default async function sitemap():Promise<MetadataRoute.Sitemap>{const {courses}=await publicCatalog(),result:MetadataRoute.Sitemap=[];for(const path of ['','/courses','/about','/instructors','/contact','/privacy','/terms','/refund-policy'])for(const locale of ['ar','en'])result.push({url:`${siteOrigin}/${locale}${path}`,alternates:{languages:{ar:`${siteOrigin}/ar${path}`,en:`${siteOrigin}/en${path}`,'x-default':`${siteOrigin}/ar${path}`}}});for(const c of courses){const languages={ar:`${siteOrigin}/ar/courses/${encodeURIComponent(c.slug.ar)}`,en:`${siteOrigin}/en/courses/${encodeURIComponent(c.slug.en)}`};const available=courseLanguages(c.languages);const alternates=Object.fromEntries(available.map(locale=>[locale,languages[locale]]));for(const locale of available)result.push({url:languages[locale],alternates:{languages:{...alternates,'x-default':languages[available[0]]}}});}return result;}
