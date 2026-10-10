import {describe, expect, it} from 'vitest';
import {parse} from '@formatjs/icu-messageformat-parser';
import {sampleCourses, type Course, type Locale} from '@/content/catalog';
import {filterCourses, findPublicCourse} from '@/lib/catalog';
import {formatSAR, MAX_HALALAS, sarToHalalas} from '@/lib/money';
import arabicMessages from '@/messages/ar.json';
import englishMessages from '@/messages/en.json';

describe('Saudi riyal amounts', () => {
  it.each([
    ['0', 0],
    ['0.05', 5],
    ['0.29', 29],
    ['13.37', 1337],
    ['15.5', 1550],
    [' 349.00 ', 34900],
    ['21474836.47', MAX_HALALAS],
  ])('converts %s SAR to exactly %i halalas', (input, expected) => {
    expect(sarToHalalas(input)).toBe(expected);
  });

  it.each(['', ' ', '-1', '+1', '.50', '1.', '1.001', '1,000.00', '1e3', 'NaN', 'Infinity', '12 34'])
    ('rejects ambiguous or invalid money input %j', (input) => {
      expect(() => sarToHalalas(input)).toThrow();
    });

  it.each(['21474836.48', '9999999999999999999999999999999999999'])
    ('rejects an amount exceeding the database integer limit: %s', (input) => {
      expect(() => sarToHalalas(input)).toThrow();
    });

  it('formats both languages with the same value in Saudi riyals', () => {
    expect(formatSAR(29995, 'en')).toContain('299.95');
    expect(formatSAR(29995, 'en')).toContain('SAR');
    expect(formatSAR(29995, 'ar')).toContain('٢٩٩٫٩٥');
    expect(formatSAR(29995, 'ar')).toMatch(/ر\.س|﷼|\u20c1/);
    expect(formatSAR(0, 'en')).toContain('0');
    expect(formatSAR(0, 'ar')).toContain('٠');
  });

  it.each([-1, 0.5, Number.NaN, Number.POSITIVE_INFINITY, MAX_HALALAS + 1, Number.MAX_SAFE_INTEGER])
    ('refuses to display an invalid halala amount %s', (amount) => {
      expect(() => formatSAR(amount, 'en')).toThrow();
      expect(() => formatSAR(amount, 'ar')).toThrow();
    });
});

function catalogFixture(): Course[] {
  const base = {minutes: 90, lessonCount: 5, instructorId: 'sample-instructor', featured: false} as const;
  const courses: Course[] = [
    {
      ...base, id: 'design-low', categorySlug: 'design', level: 'BEGINNER', priceHalalas: 34900, cover: 'design',
      slug: {ar: 'اساسيات-التصميم', en: 'visual-design'},
      title: {ar: 'أَسَاسِيَّات التَّصْمِيم', en: 'Visual design foundations'},
      description: {ar: 'ابدأ بالألوان والأفكار العملية.', en: 'Start with color and practical ideas.'},
    },
    {
      ...base, id: 'design-advanced', categorySlug: 'design', level: 'INTERMEDIATE', priceHalalas: 69950, cover: 'design',
      slug: {ar: 'استراتيجية-العلامة', en: 'brand-strategy'},
      title: {ar: 'استراتيجية العلامة التجارية', en: 'Brand strategy'},
      description: {ar: 'طوّر هوية بصرية للمشروع.', en: 'Practice visual design for your business.'},
    },
    {
      ...base, id: 'web-course', categorySlug: 'technology', level: 'BEGINNER', priceHalalas: 49900, cover: 'code',
      slug: {ar: 'واجهات-الويب', en: 'web-interfaces'},
      title: {ar: 'واجهات الويب', en: 'Web interfaces'},
      description: {ar: 'ابنِ موقعًا باستخدام JavaScript.', en: 'Build an accessible website using JavaScript.'},
    },
    {
      ...base, id: 'business-course', categorySlug: 'business', level: 'ALL_LEVELS', priceHalalas: 39900, cover: 'business',
      slug: {ar: 'خطة-المشروع', en: 'business-plan'},
      title: {ar: 'خطّة المشروع', en: 'A business plan'},
      description: {ar: 'اختبر فكرتك واحسب تكاليفك.', en: 'Test your idea and calculate your costs.'},
    },
  ];

  for (const course of courses) {
    Object.freeze(course.title);
    Object.freeze(course.description);
    Object.freeze(course.slug);
    Object.freeze(course);
  }
  Object.freeze(courses);
  return courses;
}

const ids = (courses: Course[]) => courses.map((course) => course.id);

describe('Discovering courses', () => {
  it('finds an Arabic title despite vowel marks, alif variants, and decorative stretching', () => {
    expect(ids(filterCourses(catalogFixture(), 'ar', {query: '  اَساـسِياَت  '}))).toEqual(['design-low']);
  });

  it('searches descriptions as well as titles and ignores English case', () => {
    expect(ids(filterCourses(catalogFixture(), 'en', {query: '  JAVASCRIPT  '}))).toEqual(['web-course']);
    expect(ids(filterCourses(catalogFixture(), 'en', {query: 'visual design'}))).toEqual(['design-low', 'design-advanced']);
  });

  it('combines topic, level, and search criteria', () => {
    expect(ids(filterCourses(catalogFixture(), 'en', {category: 'design', level: 'BEGINNER', query: 'visual'})))
      .toEqual(['design-low']);
    expect(ids(filterCourses(catalogFixture(), 'en', {category: 'design', level: 'ALL_LEVELS'})))
      .toEqual([]);
  });

  it('shows the chosen category or level without leaking other matches', () => {
    expect(ids(filterCourses(catalogFixture(), 'en', {category: 'design'}))).toEqual(['design-low', 'design-advanced']);
    expect(ids(filterCourses(catalogFixture(), 'en', {level: 'BEGINNER'}))).toEqual(['design-low', 'web-course']);
    expect(filterCourses(catalogFixture(), 'ar', {query: 'غير-موجود'})).toEqual([]);
  });

  it('orders by the full halala price in both directions and leaves the source catalog unchanged', () => {
    const courses = catalogFixture();
    const original = structuredClone(courses);

    expect(ids(filterCourses(courses, 'en', {sort: 'priceLow'})))
      .toEqual(['design-low', 'business-course', 'web-course', 'design-advanced']);
    expect(ids(filterCourses(courses, 'ar', {sort: 'priceHigh'})))
      .toEqual(['design-advanced', 'web-course', 'business-course', 'design-low']);
    expect(ids(filterCourses(courses, 'en', {category: 'design', sort: 'priceHigh'})))
      .toEqual(['design-advanced', 'design-low']);
    expect(courses).toEqual(original);
  });

  it('keeps the original editorial order when no filters or sorting are selected', () => {
    const courses = catalogFixture();
    expect(ids(filterCourses(courses, 'ar', {})))
      .toEqual(['design-low', 'design-advanced', 'web-course', 'business-course']);
  });
});

type TranslationTree = {[key: string]: string | TranslationTree};

function translationEntries(tree: TranslationTree, prefix = ''): Array<[string, string]> {
  return Object.entries(tree).flatMap(([key, value]) => {
    const path = `${prefix}${key}`;
    return typeof value === 'string' ? [[path, value]] : translationEntries(value, `${path}.`);
  });
}

describe('Bilingual public content', () => {
  it('provides the same recursive translation keys for Arabic and English', () => {
    const arKeys = translationEntries(arabicMessages).map(([key]) => key).sort();
    const enKeys = translationEntries(englishMessages).map(([key]) => key).sort();
    expect(arKeys).toEqual(enKeys);
    expect(arKeys.length).toBeGreaterThan(0);
  });

  it.each([
    ['ar', arabicMessages],
    ['en', englishMessages],
  ] as const)('contains nonempty, valid ICU messages for %s', (_locale, messages) => {
    for (const [key, message] of translationEntries(messages)) {
      expect(message.trim(), `Empty translation: ${key}`).not.toBe('');
      expect(() => parse(message), `Invalid ICU translation: ${key}`).not.toThrow();
    }
  });

  it.each(['ar', 'en'] as const)('has unique, URL-safe public course slugs in %s', (locale: Locale) => {
    const slugs = sampleCourses.map((course) => course.slug[locale]);
    expect(new Set(slugs.map((slug) => slug.normalize('NFC').toLowerCase())).size).toBe(sampleCourses.length);

    for (const course of sampleCourses) {
      const slug = course.slug[locale];
      expect(slug).not.toBe('');
      expect(slug).not.toMatch(/[\s/?#%]/);
      expect(decodeURIComponent(encodeURIComponent(slug))).toBe(slug);
      expect(sampleCourses.filter((item) => item.slug[locale] === slug).map((item) => item.id)).toEqual([course.id]);
      expect(course.slug[locale === 'ar' ? 'en' : 'ar']).not.toBe('');
    }
  });

  it.each(['ar', 'en'] as const)('finds a course from either a plain or once-encoded %s slug', (locale: Locale) => {
    const course = sampleCourses[0];
    const slug = course.slug[locale];
    const encodedSlug = locale === 'ar' ? encodeURIComponent(slug) : slug.replace('-', '%2D');
    expect(findPublicCourse(sampleCourses, locale, slug)?.id).toBe(course.id);
    expect(findPublicCourse(sampleCourses, locale, encodedSlug)?.id).toBe(course.id);
  });

  it('accepts canonically equivalent decomposed Arabic Unicode', () => {
    const course = sampleCourses[0];
    const decomposed = course.slug.ar.normalize('NFD');
    expect(decomposed).not.toBe(course.slug.ar);
    expect(findPublicCourse(sampleCourses, 'ar', decomposed)?.id).toBe(course.id);
    expect(findPublicCourse(sampleCourses, 'ar', encodeURIComponent(decomposed))?.id).toBe(course.id);
  });

  it.each(['%', '%2', '%GG', '%E0%A4%A', 'unknown-course', ''])
    ('returns no course for an invalid or unknown slug %j', (slug) => {
      expect(findPublicCourse(sampleCourses, 'ar', slug)).toBeUndefined();
      expect(findPublicCourse(sampleCourses, 'en', slug)).toBeUndefined();
    });

  it('does not resolve a slug belonging to the other language', () => {
    const course = sampleCourses[0];
    expect(findPublicCourse(sampleCourses, 'ar', course.slug.en)).toBeUndefined();
    expect(findPublicCourse(sampleCourses, 'en', course.slug.ar)).toBeUndefined();
  });

  it('does not repeatedly decode a double-encoded URL segment', () => {
    const course = sampleCourses[0];
    expect(findPublicCourse(sampleCourses, 'ar', encodeURIComponent(encodeURIComponent(course.slug.ar)))).toBeUndefined();
    const encodedEnglish = course.slug.en.replace('-', '%2D');
    expect(findPublicCourse(sampleCourses, 'en', encodeURIComponent(encodedEnglish))).toBeUndefined();
  });
});
