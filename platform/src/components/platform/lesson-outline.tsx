'use client';
import {useState} from 'react';
import {useLocale} from 'next-intl';
import {BookOpen, ChevronDown, CheckCircle2} from 'lucide-react';
import {Link} from '@/i18n/navigation';
export function LessonOutline({courseId, title, sections, currentId, completed, percentage, contentLanguage}: {courseId: string; title: string; sections: Array<{id: string; title: string; lessons: Array<{id: string; title: string}>}>; currentId: string; completed: string[]; percentage: number; contentLanguage: 'ar' | 'en'}) {
  const ar = useLocale() === 'ar';
  const [open, setOpen] = useState(false);
  return <aside className="min-w-0 lg:sticky lg:top-28 lg:self-start">
    <div className="card overflow-hidden"><div className="border-b border-line p-5"><h1 dir={contentLanguage === 'ar' ? 'rtl' : 'ltr'} className="break-words text-lg font-semibold">{title}</h1><p className="mt-3 text-sm text-muted">{ar ? 'تقدمك في الدورة' : 'Your course progress'} · {percentage}%</p><progress aria-label={ar ? 'تقدمك في الدورة' : 'Your course progress'} className="learning-progress mt-2 w-full" value={percentage} max={100}/></div>
      <button className="flex min-h-12 w-full items-center justify-between gap-3 p-4 font-semibold lg:hidden" aria-expanded={open} aria-controls="lesson-outline" onClick={() => setOpen(value => !value)}><span className="flex items-center gap-2"><BookOpen className="size-4"/>{ar ? 'قائمة الدروس' : 'Lesson list'}</span><ChevronDown className={`size-4 transition ${open ? 'rotate-180' : ''}`}/></button>
      <nav id="lesson-outline" aria-label={ar ? 'محتوى الدورة' : 'Course outline'} dir={contentLanguage === 'ar' ? 'rtl' : 'ltr'} className={`${open ? 'block' : 'hidden'} max-h-[60vh] space-y-5 overflow-y-auto p-4 lg:block lg:max-h-[65vh]`}>
        {sections.map(section => <section key={section.id}><h2 className="mb-2 break-words text-sm font-semibold text-muted">{section.title}</h2>{section.lessons.map(lesson => <Link key={lesson.id} href={`/learn/${courseId}/${lesson.id}`} onClick={() => setOpen(false)} aria-current={lesson.id === currentId ? 'page' : undefined} className={`mt-2 flex min-h-11 items-start gap-2 rounded-xl p-3 text-sm ${lesson.id === currentId ? 'bg-skysoft font-semibold' : 'hover:bg-canvas'}`}>{completed.includes(lesson.id) ? <CheckCircle2 className="mt-0.5 size-4 shrink-0 text-success" aria-label={ar ? 'مكتمل' : 'Completed'}/> : <span className="mt-1 size-3 shrink-0 rounded-full border border-line" aria-hidden="true"/>}<span className="break-words">{lesson.title}</span></Link>)}</section>)}
      </nav>
    </div>
    <Link href="/my-courses" className="button-secondary mt-4 inline-flex">{ar ? 'العودة إلى دوراتي' : 'Back to My Courses'}</Link>
  </aside>;
}
