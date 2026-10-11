import {ArrowUpRight, BookOpen, Clock3} from 'lucide-react';
import type {Course, Locale, Category, Instructor} from '@/content/catalog';
import {Link} from '@/i18n/navigation';
import {formatSAR} from '@/lib/money';
import {AddToCartButton} from '@/components/cart/cart-controls';
import {CourseCover} from './course-cover';

export type CourseCardLabels = {view: string; sample: string; lessons: string; duration: string; level: string};

export function CourseCard({course, locale, category, instructor, labels}: {
  course: Course; locale: Locale; category?: Category; instructor?: Instructor; labels: CourseCardLabels;
}) {
  return <article className="card course-card group">
    <Link href={`/courses/${course.slug[locale]}`} className="flex flex-1 flex-col" aria-label={`${labels.view}: ${course.title[locale]}`}>
      <div className="relative">
        <CourseCover cover={course.cover} />
        <span className="absolute start-4 top-4 rounded-full bg-white/90 px-3 py-1.5 text-[11px] font-medium text-navy">{labels.level}</span>
      </div>
      <div className="flex flex-1 flex-col p-5 pb-4">
        <div className="mb-3 flex items-center justify-between gap-3 text-xs"><span className="font-medium text-[#22677f]">{category?.title[locale]}</span><span className="text-muted">{labels.sample}</span></div>
        <h3 className="mb-3 min-h-14 text-xl font-semibold leading-relaxed tracking-tight">{course.title[locale]}</h3>
        <p className="mb-5 line-clamp-2 text-sm leading-7 text-muted">{course.description[locale]}</p>
        <div className="mb-4 flex items-center gap-2.5 text-xs text-muted"><span className="flex size-8 items-center justify-center rounded-full bg-goldsoft font-medium text-navy">{instructor?.name[locale].slice(0, 1)}</span>{instructor?.name[locale]}</div>
        <div className="mb-5 flex flex-wrap gap-x-4 gap-y-2 text-[11px] text-muted">
          <span className="flex items-center gap-1.5"><BookOpen aria-hidden="true" className="size-3.5" />{labels.lessons}</span>
          <span className="flex items-center gap-1.5"><Clock3 aria-hidden="true" className="size-3.5" />{labels.duration}</span>
        </div>
        <div className="mt-auto flex items-center justify-between gap-3 border-t border-line pt-5">
          <span className="text-lg font-semibold">{formatSAR(course.priceHalalas, locale)}</span>
          <span className="flex items-center gap-1.5 text-xs font-medium text-[#22677f]">{labels.view}<ArrowUpRight aria-hidden="true" className="logical-arrow size-4 transition-transform group-hover:-translate-y-0.5" /></span>
        </div>
      </div>
    </Link>
    <div className="px-5 pb-5"><AddToCartButton courseId={course.id} className="w-full" /></div>
  </article>;
}
