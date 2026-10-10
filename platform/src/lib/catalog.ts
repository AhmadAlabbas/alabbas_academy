import type {Course,Locale} from '@/content/catalog';
import {normalizeSearch} from './utils';
// Next routing can supply an encoded Arabic segment during static/dev rendering.
// Decode once; malformed or double-encoded paths must never select a course.
export function findPublicCourse(courses: Course[], locale: Locale, slug: string) {
 let decoded: string;
 try { decoded = decodeURIComponent(slug).normalize('NFC'); } catch { return undefined; }
 return courses.find(course => course.slug[locale].normalize('NFC') === decoded);
}
export type CatalogFilters={query?:string;category?:string;level?:string;sort?:string};
export function filterCourses(courses:Course[],locale:Locale,filters:CatalogFilters){
 const query=normalizeSearch(filters.query||'');
 const result=courses.filter(c=>(!filters.category||c.categorySlug===filters.category)&&(!filters.level||c.level===filters.level)&&(!query||normalizeSearch(`${c.title[locale]} ${c.description[locale]}`).includes(query)));
 if(filters.sort==='priceLow')result.sort((a,b)=>a.priceHalalas-b.priceHalalas);
 if(filters.sort==='priceHigh')result.sort((a,b)=>b.priceHalalas-a.priceHalalas);
 return result;
}
