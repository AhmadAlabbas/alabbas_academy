import {courseLanguages} from './catalog';
import type {Locale} from '@/i18n/routing';

export function contentLocale(languages: string | undefined, preferred: string): Locale {
  const available = courseLanguages(languages);
  return available.includes(preferred as Locale) ? preferred as Locale : available[0] || (preferred === 'en' ? 'en' : 'ar');
}
export function contentText(row: Record<string, unknown>, field: string, preferred: string): string {
  preferred = row.languages ? contentLocale(String(row.languages), preferred) : preferred;
  const other = preferred === 'en' ? 'ar' : 'en';
  return String(row[`${field}_${preferred}`] || row[`${field}_${other}`] || '');
}
export const courseEntities = new Set(['courses', 'sections', 'lessons', 'exams', 'questions', 'options', 'attachments']);
export function fieldLocale(key: string): Locale | undefined {
  return key.endsWith('_ar') || key === 'labelAr' ? 'ar' : key.endsWith('_en') || key === 'labelEn' ? 'en' : undefined;
}
export function contentFieldRequired(entity: string, key: string, kind?: unknown) {
  return ({courses: ['title', 'description', 'slug'], sections: ['title'], lessons: kind === 'ARTICLE' ? ['title', 'body'] : ['title'], exams: ['title'], questions: ['prompt'], options: ['label'], attachments: ['label']} as Record<string, string[]>)[entity]?.includes(key.replace(/_(ar|en)$/, '').replace(/(Ar|En)$/, '')) || false;
}
export function missingContentFields(entity: string, data: Record<string, unknown>, languages: string) {
  const locales = courseLanguages(languages);
  const prefixes = ({courses: ['title', 'description', 'slug'], sections: ['title'], lessons: data.kind === 'ARTICLE' ? ['title', 'body'] : ['title'], exams: ['title'], questions: ['prompt'], options: ['label'], attachments: ['label']} as Record<string, string[]>)[entity] || [];
  return prefixes.flatMap(prefix => locales.map(locale => entity === 'attachments' ? 'label' + (locale === 'ar' ? 'Ar' : 'En') : prefix + '_' + locale)).filter(key => !String(data[key] || '').trim());
}
