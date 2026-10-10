'use client';
import {useMemo,useState} from 'react';
import {Search,SlidersHorizontal,X} from 'lucide-react';
import {useLocale,useTranslations} from 'next-intl';
import type {Course,Category,Instructor,Locale} from '@/content/catalog';
import {filterCourses} from '@/lib/catalog';
import {CourseCard} from './course-card';
export function CatalogBrowser({courses,categories,instructors,initialCategory=''}:{courses:Course[];categories:Category[];instructors:Instructor[];initialCategory?:string}){
 const locale=useLocale() as Locale,t=useTranslations('Catalog'),common=useTranslations('Common');
 const [query,setQuery]=useState(''),[category,setCategory]=useState(initialCategory),[level,setLevel]=useState(''),[sort,setSort]=useState('recommended');
 const results=useMemo(()=>filterCourses(courses,locale,{query,category,level,sort}),[courses,locale,query,category,level,sort]);
 const levelText=(value:string)=>common(value==='BEGINNER'?'beginner':value==='INTERMEDIATE'?'intermediate':'allLevels');
 return <>
  <div className="card mb-8 p-5 sm:p-6"><div className="mb-5 flex items-center gap-2 text-xs font-medium text-muted"><SlidersHorizontal className="size-4"/>{t('filters')}</div><div className="grid gap-4 md:grid-cols-[1.5fr_1fr_1fr]">
   <div><label htmlFor="search" className="mb-2 block text-xs font-medium">{t('searchLabel')}</label><div className="relative"><Search className="pointer-events-none absolute start-4 top-3.5 size-4 text-muted"/><input id="search" value={query} onChange={e=>setQuery(e.target.value)} placeholder={t('searchPlaceholder')} className="min-h-12 w-full rounded-xl border border-line bg-canvas py-3 pe-4 ps-11 text-sm"/></div></div>
   <div><label htmlFor="level" className="mb-2 block text-xs font-medium">{t('levelLabel')}</label><select id="level" value={level} onChange={e=>setLevel(e.target.value)} className="min-h-12 w-full rounded-xl border border-line bg-canvas px-4 py-3 text-sm"><option value="">{t('allLevels')}</option>{['BEGINNER','INTERMEDIATE','ALL_LEVELS'].map(l=><option key={l} value={l}>{levelText(l)}</option>)}</select></div>
   <div><label htmlFor="sort" className="mb-2 block text-xs font-medium">{t('sortLabel')}</label><select id="sort" value={sort} onChange={e=>setSort(e.target.value)} className="min-h-12 w-full rounded-xl border border-line bg-canvas px-4 py-3 text-sm">{['recommended','priceLow','priceHigh'].map(s=><option value={s} key={s}>{t(s)}</option>)}</select></div>
  </div><div className="mt-5 flex flex-wrap gap-2" role="group" aria-label={t('categoryLabel')}>{[{slug:'',title:{ar:t('allCategories'),en:t('allCategories')}},...categories].map(c=><button key={c.slug} onClick={()=>setCategory(c.slug)} aria-pressed={category===c.slug} className={`rounded-full border px-4 py-2.5 text-xs transition ${category===c.slug?'border-navy bg-navy text-white':'border-line bg-white hover:bg-skysoft'}`}>{c.title[locale]}</button>)}</div></div>
  <div className="mb-6 flex items-center justify-between gap-4"><p className="text-sm text-muted" role="status" aria-live="polite">{t('showingResults',{count:results.length})}</p>{(query||category||level)&&<button className="flex items-center gap-1.5 text-xs text-[#22677f]" onClick={()=>{setQuery('');setCategory('');setLevel('');setSort('recommended')}}><X className="size-4"/>{t('clearFilters')}</button>}</div>
  <div className="grid gap-6 sm:grid-cols-2 xl:grid-cols-4" aria-label={t('results')}>{results.map(c=><CourseCard key={c.id} course={c} locale={locale} category={categories.find(x=>x.slug===c.categorySlug)} instructor={instructors.find(i=>i.id===c.instructorId)} labels={{view:common('viewCourse'),sample:common('sampleCourse'),lessons:common('lessonCount',{count:c.lessonCount}),duration:common('durationMinutes',{count:c.minutes}),level:levelText(c.level)}}/>)}</div>
  {!results.length&&<div className="card flex flex-col items-center px-6 py-16 text-center"><Search className="mb-5 size-10 text-blue"/><h2 className="mb-3 text-2xl font-semibold">{t('noResultsTitle')}</h2><p className="max-w-md text-sm leading-7 text-muted">{t('noResultsDescription')}</p><button className="button-primary mt-6" onClick={()=>{setQuery('');setCategory('');setLevel('')}}>{t('clearFilters')}</button></div>}
 </>;
}
