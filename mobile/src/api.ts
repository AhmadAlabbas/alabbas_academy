import AsyncStorage from '@react-native-async-storage/async-storage';

export type Locale = 'ar' | 'en';
export type LocalizedText = {ar: string; en: string};
export type Course = {
  id: string;
  title: LocalizedText;
  description: LocalizedText;
  slug: LocalizedText;
  categorySlug: string;
  instructorId: string;
  level: string;
  minutes: number;
  lessonCount: number;
  featured: boolean;
  thumbnailUrl: string | null;
};
export type Catalog = {
  version: number;
  courses: Course[];
  categories: {id: string; title: LocalizedText}[];
  instructors: {id: string; name: LocalizedText}[];
};
export type Syllabus = {
  id: string;
  title: LocalizedText;
  description: LocalizedText;
  sections: {
    id: string;
    title: LocalizedText;
    lessons: {id: string; title: LocalizedText; minutes: number}[];
  }[];
};

export const SITE_ORIGIN = 'https://alabbasacademy.com';
const CACHE_KEY = 'academy:public-catalog:v1';
export const SAVED_KEY = 'academy:saved-course-ids:v1';
export const LOCALE_KEY = 'academy:locale:v1';

function isLocalized(value: unknown): value is LocalizedText {
  return Boolean(value && typeof value === 'object' &&
    typeof (value as LocalizedText).ar === 'string' &&
    typeof (value as LocalizedText).en === 'string');
}
function isCourse(value: unknown): value is Course {
  const course = value as Course;
  return Boolean(value && typeof value === 'object' &&
    typeof course.id === 'string' && isLocalized(course.title) &&
    isLocalized(course.description) && isLocalized(course.slug) &&
    typeof course.categorySlug === 'string' && typeof course.instructorId === 'string' &&
    typeof course.level === 'string' && typeof course.minutes === 'number' &&
    typeof course.lessonCount === 'number' && typeof course.featured === 'boolean' &&
    (course.thumbnailUrl === null || typeof course.thumbnailUrl === 'string'));
}
export function isCatalog(value: unknown): value is Catalog {
  const data = value as Catalog;
  return Boolean(value && typeof value === 'object' && data.version === 1 &&
    Array.isArray(data.courses) && data.courses.every(isCourse) &&
    Array.isArray(data.categories) && data.categories.every((v: Catalog['categories'][number]) =>
      v && typeof v.id === 'string' && isLocalized(v.title)) &&
    Array.isArray(data.instructors) && data.instructors.every((v: Catalog['instructors'][number]) =>
      v && typeof v.id === 'string' && isLocalized(v.name)));
}
export function isSyllabus(value: unknown): value is Syllabus {
  const data = value as Syllabus;
  return Boolean(value && typeof value === 'object' &&
    typeof data.id === 'string' && isLocalized(data.title) &&
    isLocalized(data.description) && Array.isArray(data.sections) &&
    data.sections.every((section: Syllabus['sections'][number]) =>
      typeof section.id === 'string' && isLocalized(section.title) &&
      Array.isArray(section.lessons) &&
      section.lessons.every(lesson => typeof lesson.id === 'string' &&
        isLocalized(lesson.title) && typeof lesson.minutes === 'number')));
}
async function getJson(path: string): Promise<unknown> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 12000);
  try {
    const response = await fetch(SITE_ORIGIN + path, {
      headers: {Accept: 'application/json'},
      signal: controller.signal,
    });
    if (!response.ok) throw new Error('HTTP ' + response.status);
    return await response.json();
  } finally {
    clearTimeout(timer);
  }
}

export async function fetchCatalog(): Promise<Catalog> {
  const value = await getJson('/api/mobile/v1/catalog');
  if (!isCatalog(value)) throw new Error('Invalid catalog response');
  await AsyncStorage.setItem(CACHE_KEY, JSON.stringify(value)).catch(() => undefined);
  return value;
}
export async function cachedCatalog(): Promise<Catalog | null> {
  try {
    const raw = await AsyncStorage.getItem(CACHE_KEY);
    const value: unknown = raw && JSON.parse(raw);
    return isCatalog(value) ? value : null;
  } catch {return null;}
}
export async function fetchSyllabus(id: string): Promise<Syllabus> {
  if (!/^[a-zA-Z0-9_-]{1,120}$/.test(id)) throw new Error('Invalid course');
  const value = await getJson('/api/mobile/v1/courses/' + encodeURIComponent(id));
  if (!isSyllabus(value)) throw new Error('Invalid course response');
  return value;
}
export function readableMinutes(minutes: number, locale: Locale): string {
  if (!Number.isFinite(minutes) || minutes < 0) return '';
  const hrs = Math.floor(minutes / 60), mins = Math.round(minutes % 60);
  return locale === 'ar'
    ? (hrs ? `${hrs} س ` : '') + `${mins} د`
    : (hrs ? `${hrs}h ` : '') + `${mins}m`;
}
