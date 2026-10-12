import {entities, type Field} from './registry';
import {sarToHalalas} from '@/lib/money';
import {courseEntities, fieldLocale, contentLocale} from '@/lib/course-content';
import {courseLanguages} from '@/lib/catalog';

export type AdminRow = Record<string, unknown>;
export type AdminDraft = Record<string, string | boolean>;
export type LookupItem = {id: string; title_ar: string; title_en: string; courseId?: string; languages?: string};
export type AdminLookups = Record<string, LookupItem[]>;
export const parentFields: Record<string, string> = {
  sections: 'courseId', lessons: 'sectionId', attachments: 'lessonId',
  exams: 'courseId', questions: 'examId', options: 'questionId', blocks: 'pageId',
};
const defaults: AdminRow = {
  minutes: 0, points: 1, perUserLimit: 1, languages: 'ar',
  passingBasisPoints: 7000, notesEnabled: true, isActive: true,
};
const nullableStrings = new Set(['videoFileId', 'videoUrl', 'previewUrl', 'thumbnailUrl', 'imageUrl']);
export const uploadFields: Record<string, {accept: string; asUrl?: boolean}> = {
  thumbnailUrl: {accept: 'image/png,image/jpeg,image/webp', asUrl: true},
  imageUrl: {accept: 'image/png,image/jpeg,image/webp', asUrl: true},
  videoFileId: {accept: 'video/mp4'},
  mediaAssetId: {accept: 'application/pdf,text/plain'},
};

export function slugFromTitle(title: string) {
  return title.normalize('NFKD').replace(/\p{M}/gu, '').toLowerCase().trim()
    .replace(/[^\p{L}\p{N}]+/gu, '-').replace(/^-+|-+$/g, '').slice(0, 128).replace(/-+$/g, '');
}

export function displayField(field: Field, value: unknown): string | boolean {
  if (field.key === 'languages') return courseLanguages(value == null ? undefined : String(value)).join(',');
  if (field.type === 'boolean') return Boolean(value);
  if (field.type === 'json') return JSON.stringify(value ?? {});
  if (field.type === 'money' || field.type === 'percentage') {
    if (value === null || value === undefined || value === '') return '';
    const amount = Number(value);
    return `${Math.floor(amount / 100)}.${String(amount % 100).padStart(2, '0')}`;
  }
  if (field.type === 'date') {
    if (!value) return '';
    const date = new Date(String(value));
    const shifted = new Date(date.getTime() - date.getTimezoneOffset() * 60000);
    return shifted.toISOString().slice(0, 16);
  }
  return String(value ?? '');
}

export function initialDraft(entity: string, row: AdminRow, parentValue = ''): AdminDraft {
  const config = entities[entity];
  const creating = !row[config.identity || 'id'];
  const data: AdminDraft = {};
  for (const field of config.fields) {
    const value = row[field.key] ?? (creating ? defaults[field.key] : undefined);
    data[field.key] = displayField(field, value ?? (field.type === 'select' ? field.options?.[0] : undefined));
  }
  if (creating) {
    if (parentFields[entity] && parentValue) data[parentFields[entity]] = parentValue;
    if (['courses', 'categories', 'instructors', 'tags', 'faqs'].includes(entity) && !data.key) {
      data.key = `${entity}-${crypto.randomUUID().slice(0, 12)}`;
    }
    if (entity === 'courses') data.priceHalalas = '0.00';
    if (entity === 'lessons') data.kind = 'VIDEO';
  }
  return data;
}

export function serializeDraft(entity: string, draft: AdminDraft, languages = String(draft.languages || 'ar,en')): AdminRow {
  const data: AdminRow = {};
  for (const field of entities[entity].fields) {
    const language = fieldLocale(field.key);
    if (courseEntities.has(entity) && language && !courseLanguages(languages).includes(language)) continue;
    const value = String(draft[field.key] ?? '').trim();
    if (field.key === 'position' && !value) continue;
    if (field.type === 'boolean') data[field.key] = draft[field.key] === true;
    else if (field.type === 'money' || field.type === 'percentage') {
      if (!value && !field.required) {data[field.key] = null; continue;}
      const amount = sarToHalalas(value);
      if (field.type === 'percentage' && amount > 10000) throw new Error(field.key);
      data[field.key] = amount;
    } else if (field.type === 'number') {
      data[field.key] = !value ? defaults[field.key] ?? null : Number(value);
      if (typeof data[field.key] === 'number' && !Number.isSafeInteger(data[field.key])) throw new Error(field.key);
    } else if (field.type === 'json') data[field.key] = JSON.parse(String(draft[field.key] || '{}'));
    else if (field.type === 'date') data[field.key] = value ? new Date(value).toISOString() : null;
    else data[field.key] = value || (nullableStrings.has(field.key) ? null : '');
  }
  return data;
}

export function recordTitle(row: AdminRow, arabic: boolean) {
  const preferred = row.languages ? contentLocale(String(row.languages), arabic ? 'ar' : 'en') : arabic ? 'ar' : 'en', other = preferred === 'ar' ? 'en' : 'ar';
  return String(row['title_' + preferred] || row['prompt_' + preferred] || row['label_' + preferred] || row['name_' + preferred]
    || row['title_' + other] || row['prompt_' + other] || row['label_' + other] || row['name_' + other]
    || row[preferred === 'ar' ? 'labelAr' : 'labelEn'] || row.labelAr || row.labelEn || row.name || row.number || row.email || row.key || '');
}
