import type {Metadata} from 'next';
import {ArrowDown, ArrowUpRight, BookOpen, ChevronDown, Clock3, ClipboardCheck, Globe2, Sparkles} from 'lucide-react';
import {hasLocale} from 'next-intl';
import {getTranslations, setRequestLocale} from 'next-intl/server';
import {notFound} from 'next/navigation';
import {CourseCard} from '@/components/ui/course-card';
import {CourseCover} from '@/components/ui/course-cover';
import {categories, instructors, sampleCourses, sampleCurricula} from '@/content/catalog';
import {Link} from '@/i18n/navigation';
import {routing, type Locale} from '@/i18n/routing';
import {formatSAR} from '@/lib/money';
import {findPublicCourse} from '@/lib/catalog';
import {pageMetadata} from '@/lib/seo';
import {AddToCartButton} from '@/components/cart/cart-controls';

type CoursePageProps = {params: Promise<{locale: string; slug: string}>};

// The sample catalog is generated in both languages. Unknown slugs must reach
// the router's global 404 rather than throwing while streaming this page.
export const dynamicParams = false;

export function generateStaticParams() {
  return routing.locales.flatMap((locale) => sampleCourses.map((course) => ({locale, slug: course.slug[locale]})));
}

function findCourse(locale: Locale, slug: string) {
  const course = findPublicCourse(sampleCourses, locale, slug);
  if (!course) notFound();
  return course;
}

export async function generateMetadata({params}: CoursePageProps): Promise<Metadata> {
  const {locale, slug} = await params;
  if (!hasLocale(routing.locales, locale)) notFound();
  const course = findPublicCourse(sampleCourses, locale, slug);
  if (!course) {
    const t = await getTranslations({locale, namespace: 'NotFound'});
    return {title: t('title'), description: t('description'), robots: {index: false, follow: false}};
  }
  const otherLocale = locale === 'ar' ? 'en' : 'ar';
  return pageMetadata(locale, `/courses/${course.slug[locale]}`, course.title[locale], course.description[locale], `/courses/${course.slug[otherLocale]}`);
}

export default async function CoursePage({params}: CoursePageProps) {
  const {locale, slug} = await params;
  if (!hasLocale(routing.locales, locale)) notFound();
  setRequestLocale(locale);
  const course = findCourse(locale, slug);
  const [t, common, catalog] = await Promise.all([getTranslations('Course'), getTranslations('Common'), getTranslations('Catalog')]);
  const category = categories.find((item) => item.slug === course.categorySlug);
  const instructor = instructors.find((item) => item.id === course.instructorId);
  const sections = sampleCurricula[course.id] ?? [];
  const lessons = sections.flatMap((section) => section.lessons);
  const previewLesson = lessons.find((lesson) => lesson.preview && lesson.body);
  const levelText = (level: string) => common(level === 'BEGINNER' ? 'beginner' : level === 'INTERMEDIATE' ? 'intermediate' : 'allLevels');
  const related = sampleCourses.filter((item) => item.id !== course.id).slice(0, 3);

  return (
    <div className="container-shell pb-20 pt-8 sm:pb-24 sm:pt-10">
      <nav aria-label={common('breadcrumbs')} className="mb-8 text-xs text-muted">
        <ol className="flex flex-wrap items-center gap-x-3 gap-y-2">
          <li><Link href="/" className="hover:text-navy">{common('home')}</Link></li>
          <li aria-hidden="true">/</li>
          <li><Link href="/courses" className="hover:text-navy">{common('allCourses')}</Link></li>
          <li aria-hidden="true">/</li>
          <li aria-current="page" className="text-navy">{course.title[locale]}</li>
        </ol>
      </nav>

      <div className="grid items-start gap-8 lg:grid-cols-[minmax(0,1fr)_360px] lg:gap-12">
        <div className="min-w-0">
          <header className="pb-8">
            <div className="mb-5 flex flex-wrap items-center gap-3 text-xs font-medium">
              <Link href={{pathname: '/courses', query: {category: course.categorySlug}}} className="rounded-full bg-skysoft px-4 py-2 text-[#22677f]">{category?.title[locale]}</Link>
              <span className="rounded-full bg-goldsoft px-4 py-2">{t('sampleLabel')}</span>
            </div>
            <h1 className="mb-5 text-[clamp(2rem,4vw,3.2rem)] font-semibold leading-[1.4] tracking-tight">{course.title[locale]}</h1>
            <p className="section-copy max-w-2xl">{course.description[locale]}</p>
            <div className="mt-6 flex flex-wrap items-center gap-x-6 gap-y-3 text-xs text-muted">
              <span className="flex items-center gap-2"><BookOpen aria-hidden="true" className="size-4" />{common('lessonCount', {count: lessons.length})}</span>
              <span className="flex items-center gap-2"><Clock3 aria-hidden="true" className="size-4" />{common('durationMinutes', {count: course.minutes})}</span>
              <span className="flex items-center gap-2"><Globe2 aria-hidden="true" className="size-4" />{t('arabicEnglish')}</span>
            </div>
          </header>

          <section aria-labelledby="course-overview" className="card mb-6 p-6 sm:p-8">
            <p className="eyebrow mb-2">{t('overview')}</p>
            <h2 id="course-overview" className="mb-5 text-xl font-semibold">{t('whatYouLearn')}</h2>
            <ul className="grid gap-4 sm:grid-cols-2">
              {sections.flatMap((section) => section.lessons.slice(-2)).map((lesson) => (
                <li key={lesson.id} className="flex gap-3 text-sm leading-7"><span className="mt-1 flex size-6 shrink-0 items-center justify-center rounded-full bg-skysoft"><Sparkles aria-hidden="true" className="size-3.5 text-[#22677f]" /></span>{lesson.title[locale]}</li>
              ))}
            </ul>
          </section>

          {previewLesson?.body && (
            <section aria-labelledby="preview-heading" className="mb-6 rounded-3xl border border-[#d1e8f1] bg-[#eef8fc] p-6 sm:p-8">
              <span className="mb-4 inline-flex rounded-full bg-white px-3 py-1.5 text-xs font-medium text-[#22677f]">{t('freePreview')}</span>
              <h2 id="preview-heading" className="mb-3 text-xl font-semibold">{previewLesson.title[locale]}</h2>
              <p className="text-sm leading-8 text-[#456176]">{previewLesson.body[locale]}</p>
            </section>
          )}

          <section id="curriculum" aria-labelledby="curriculum-heading" className="card scroll-mt-28 p-6 sm:p-8">
            <div className="mb-6 flex flex-wrap items-end justify-between gap-4">
              <h2 id="curriculum-heading" className="text-2xl font-semibold">{t('curriculum')}</h2>
              <p className="text-xs text-muted">{t('sectionCount', {count: sections.length})} · {common('lessonCount', {count: lessons.length})} · {t('examCount', {count: sections.length})}</p>
            </div>
            <div className="space-y-3">
              {sections.map((section, index) => (
                <details key={section.id} open={index === 0} className="group overflow-hidden rounded-2xl border border-line">
                  <summary className="flex min-h-20 cursor-pointer list-none items-center gap-4 bg-canvas px-4 py-4 text-sm font-medium sm:px-5 [&::-webkit-details-marker]:hidden">
                    <span className="flex size-9 shrink-0 items-center justify-center rounded-xl bg-white text-xs text-muted">{new Intl.NumberFormat(locale).format(index + 1)}</span>
                    <span className="flex-1 leading-7">{section.title[locale]}</span>
                    <ChevronDown aria-hidden="true" className="size-4 shrink-0 transition-transform group-open:rotate-180" />
                  </summary>
                  <ol className="divide-y divide-line px-4 sm:px-5">
                    {section.lessons.map((lesson) => (
                      <li key={lesson.id} className="flex items-start gap-3 py-4 text-xs">
                        <BookOpen aria-hidden="true" className="mt-1 size-4 shrink-0 text-muted" />
                        <div className="min-w-0 flex-1"><p className="leading-6">{lesson.title[locale]}</p>{lesson.preview && <span className="mt-1 inline-block text-[11px] text-[#22677f]">{t('freePreview')}</span>}</div>
                        <span className="pt-1 text-[11px] text-muted">{common('durationMinutes', {count: lesson.minutes})}</span>
                      </li>
                    ))}
                    <li className="flex items-start gap-3 py-4 text-xs">
                      <ClipboardCheck aria-hidden="true" className="mt-1 size-4 shrink-0 text-[#22677f]" />
                      <div className="min-w-0 flex-1"><p className="leading-6">{section.exam.title[locale]}</p><span className="mt-1 inline-block text-[11px] text-muted">{t('exam')}</span></div>
                      <span className="pt-1 text-[11px] text-muted">{t('questionCount', {count: section.exam.questionCount})}</span>
                    </li>
                  </ol>
                </details>
              ))}
            </div>
          </section>

          {instructor && (
            <section aria-labelledby="instructor-heading" className="card mt-6 p-6 sm:p-8">
              <h2 id="instructor-heading" className="mb-6 text-xl font-semibold">{t('instructor')}</h2>
              <div className="flex items-start gap-5">
                <span aria-hidden="true" className="flex size-16 shrink-0 items-center justify-center rounded-2xl bg-goldsoft text-xl font-semibold">{instructor.name[locale].slice(0, 1)}</span>
                <div><h3 className="mb-2 font-semibold">{instructor.name[locale]}</h3><p className="text-sm leading-8 text-muted">{instructor.bio[locale]}</p></div>
              </div>
            </section>
          )}
        </div>

        <aside aria-labelledby="course-details-heading" className="card overflow-hidden lg:sticky lg:top-28">
          <CourseCover cover={course.cover} className="h-60" />
          <div className="p-6">
            <h2 id="course-details-heading" className="sr-only">{t('details')}</h2>
            <p className="mb-2 text-xs text-muted">{t('priceLabel')}</p>
            <p className="mb-6 text-3xl font-semibold tracking-tight">{formatSAR(course.priceHalalas, locale)}</p>
            <AddToCartButton courseId={course.id} className="w-full" />
            <a href="#curriculum" className="button-secondary mt-3 w-full">{t('viewCurriculum')}<ArrowDown aria-hidden="true" className="size-4" /></a>
            <p className="mt-4 text-xs leading-7 text-muted">{t('sampleDescription')}</p>
            <dl className="mt-6 space-y-4 border-t border-line pt-6 text-xs">
              <div className="flex justify-between gap-4"><dt className="text-muted">{t('levelLabel')}</dt><dd className="text-end font-medium">{levelText(course.level)}</dd></div>
              <div className="flex justify-between gap-4"><dt className="text-muted">{t('durationLabel')}</dt><dd className="text-end font-medium">{common('durationMinutes', {count: course.minutes})}</dd></div>
              <div className="flex justify-between gap-4"><dt className="text-muted">{t('lessons')}</dt><dd className="text-end font-medium">{common('lessonCount', {count: lessons.length})}</dd></div>
              <div className="flex justify-between gap-4"><dt className="text-muted">{t('quizzes')}</dt><dd className="text-end font-medium">{t('examCount', {count: sections.length})}</dd></div>
              <div className="flex justify-between gap-4"><dt className="text-muted">{t('languageLabel')}</dt><dd className="text-end font-medium">{t('arabicEnglish')}</dd></div>
            </dl>
            <Link href="/courses" className="mt-6 flex items-center justify-center gap-2 text-xs font-medium text-[#22677f]">{common('backToCourses')}<ArrowUpRight aria-hidden="true" className="logical-arrow size-4" /></Link>
          </div>
        </aside>
      </div>

      <section aria-labelledby="related-heading" className="pt-16 sm:pt-20">
        <div className="mb-8 flex flex-wrap items-end justify-between gap-5">
          <div><p className="eyebrow mb-2">{catalog('eyebrow')}</p><h2 id="related-heading" className="section-title">{t('relatedTitle')}</h2><p className="section-copy mt-3">{t('relatedDescription')}</p></div>
          <Link href="/courses" className="button-secondary">{common('allCourses')}<ArrowUpRight aria-hidden="true" className="logical-arrow size-4" /></Link>
        </div>
        <div className="grid gap-6 sm:grid-cols-2 xl:grid-cols-3">
          {related.map((item) => <CourseCard key={item.id} course={item} locale={locale} category={categories.find((category) => category.slug === item.categorySlug)} instructor={instructors.find((person) => person.id === item.instructorId)} labels={{view: common('viewCourse'), sample: common('sampleCourse'), lessons: common('lessonCount', {count: item.lessonCount}), duration: common('durationMinutes', {count: item.minutes}), level: levelText(item.level)}} />)}
        </div>
      </section>
    </div>
  );
}
