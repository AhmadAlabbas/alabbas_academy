import {notFound} from 'next/navigation';
import {BookOpen, Film, FileText, ClipboardList, Plus, ArrowUpRight, Pencil, CheckCircle2} from 'lucide-react';
import {requireAdmin} from '@/lib/admin/service';
import {getDatabase} from '@/lib/db';
import {Link} from '@/i18n/navigation';
import {adminValueLabel} from '@/lib/admin/registry';
import {Price} from "@/components/ui/price";

export default async function CourseContentPage({params}: {params: Promise<{locale: string; courseId: string}>}) {
  await requireAdmin();
  const {locale, courseId} = await params;
  const ar = locale === 'ar';
  const text = (arabic: string, english: string) => ar ? arabic : english;
  const course = await getDatabase().course.findUnique({where: {id: courseId}, include: {
    sections: {orderBy: {position: 'asc'}, include: {lessons: {orderBy: {position: 'asc'}, include: {_count: {select: {attachments: true}}}}}},
    exams: {orderBy: {position: 'asc'}, include: {questions: {orderBy: {position: 'asc'}, include: {options: {select: {isCorrect: true}}}}}},
    instructors: {include: {instructor: {select: {name_ar: true, name_en: true}}}},
  }});
  if (!course) notFound();
  const title = ar ? course.title_ar : course.title_en;
  const lessons = course.sections.flatMap(section => section.lessons);
  const fileCount = lessons.reduce((count, lesson) => count + lesson._count.attachments, 0);
  return <div className="space-y-7">
    <nav aria-label={text('مسار التنقل', 'Breadcrumb')} className="flex flex-wrap items-center gap-2 text-sm text-muted"><Link href="/admin/courses" className="text-accent">{text('الدورات', 'Courses')}</Link><span aria-hidden="true">/</span><span>{title}</span></nav>
    <header className="card overflow-hidden">
      <div className="flex flex-wrap items-start justify-between gap-6 border-b border-line bg-skysoft p-6 sm:p-8">
        <div className="min-w-0 flex-1"><span className="mb-3 inline-flex rounded-full border border-line bg-surface px-3 py-1 text-xs font-semibold">{adminValueLabel(course.status, ar)}</span>
          <h1 className="break-words text-3xl font-semibold">{title}</h1>
          <p className="mt-3 text-sm text-muted">{text('ابنِ محتوى الدورة: أقسام، دروس، ملفات، واختبارات.', 'Build your course with sections, lessons, files and exams.')}</p>
          <p className="mt-3 font-semibold text-accent"><Price amount={course.priceHalalas} locale={ar ? 'ar' : 'en'} /></p>
        </div>
        <div className="flex flex-wrap gap-3"><Link className="button-primary gap-2" href={`/admin/courses?edit=${course.id}`}><Pencil className="size-4" aria-hidden="true" />{text('تعديل تفاصيل الدورة', 'Edit course details')}</Link>
          {course.status === 'PUBLISHED' && <Link href={`/courses/${ar ? course.slug_ar : course.slug_en}`} className="button-secondary gap-2">{text('عرض صفحة الدورة', 'View course page')}<ArrowUpRight className="size-4 logical-arrow" aria-hidden="true" /></Link>}
        </div>
      </div>
      <div className="grid grid-cols-2 gap-4 p-6 sm:grid-cols-4">
        {[
          [BookOpen, text('الأقسام', 'Sections'), course.sections.length],
          [Film, text('الدروس', 'Lessons'), lessons.length],
          [FileText, text('الملفات', 'Files'), fileCount],
          [ClipboardList, text('الاختبارات', 'Exams'), course.exams.length],
        ].map(([Icon, label, count]) => {const Glyph = Icon as typeof BookOpen; return <div key={String(label)} className="flex items-center gap-3 rounded-xl bg-canvas p-3"><Glyph className="size-5 shrink-0 text-accent" aria-hidden="true" /><div><p className="text-xl font-semibold">{String(count)}</p><p className="text-xs text-muted">{String(label)}</p></div></div>;})}
      </div>
    </header>
    <div className="grid min-w-0 items-start gap-7 lg:grid-cols-[minmax(0,1.5fr)_minmax(0,1fr)]">
      <section className="min-w-0 space-y-4" aria-labelledby="course-sections-title">
        <div className="flex flex-wrap items-center justify-between gap-3"><h2 id="course-sections-title" className="text-2xl font-semibold">{text('محتوى الدورة', 'Course content')}</h2><Link href={`/admin/sections?courseId=${course.id}&create=1`} className="button-primary gap-2"><Plus className="size-4" aria-hidden="true" />{text('إضافة قسم', 'Add section')}</Link></div>
        {!course.sections.length && <div className="card p-7"><BookOpen className="mb-4 size-8 text-accent" aria-hidden="true" /><p className="font-semibold">{text('ابدأ بالقسم الأول', 'Start with your first section')}</p><p className="mt-2 text-sm text-muted">{text('أضف قسمًا، ثم أضف دروس الفيديو أو المقالات بداخله.', 'Add a section, then add its video or article lessons.')}</p></div>}
        {course.sections.map((section, index) => <article key={section.id} className="card min-w-0 overflow-hidden">
          <div className="flex flex-wrap items-center justify-between gap-3 border-b border-line bg-canvas p-5"><div className="min-w-0"><p className="text-xs text-muted">{text('القسم', 'Section')} {index + 1}</p><h3 className="mt-1 break-words text-lg font-semibold">{ar ? section.title_ar : section.title_en}</h3></div>
            <Link className="button-secondary" href={`/admin/sections?courseId=${course.id}&edit=${section.id}`}>{text('تعديل القسم', 'Edit section')}</Link></div>
          <div className="divide-y divide-line">{section.lessons.map(lesson => <div key={lesson.id} className="flex flex-wrap items-start justify-between gap-3 p-5">
            <div className="min-w-0 flex-1"><Link href={`/admin/lessons?sectionId=${section.id}&edit=${lesson.id}`} className="flex items-start gap-3 font-medium">{lesson.kind === 'VIDEO' ? <Film className="mt-0.5 size-4 shrink-0 text-accent" aria-hidden="true" /> : <FileText className="mt-0.5 size-4 shrink-0 text-accent" aria-hidden="true" />}<span className="break-words">{ar ? lesson.title_ar : lesson.title_en}</span></Link>
              <p className="mt-2 text-xs text-muted">{lesson.isPublished ? text('منشور', 'Published') : text('مسودة', 'Draft')} · {lesson.minutes} {text('دقيقة', 'min')} · {lesson._count.attachments} {text('ملفات', 'files')}</p></div>
            <Link className="button-secondary" href={`/admin/attachments?lessonId=${lesson.id}`}>{text('ملفات الدرس', 'Lesson files')}</Link>
          </div>)}</div>
          <div className="flex flex-wrap gap-3 p-5"><Link href={`/admin/lessons?sectionId=${section.id}&create=1`} className="button-primary gap-2"><Plus className="size-4" aria-hidden="true" />{text('إضافة درس', 'Add lesson')}</Link><Link href={`/admin/lessons?sectionId=${section.id}`} className="button-secondary">{text('إدارة وترتيب الدروس', 'Manage and reorder lessons')}</Link></div>
        </article>)}
        {course.sections.length > 0 && <Link href={`/admin/sections?courseId=${course.id}`} className="button-secondary">{text('إدارة وترتيب الأقسام', 'Manage and reorder sections')}</Link>}
      </section>
      <aside className="min-w-0 space-y-5">
        <section className="space-y-4" aria-labelledby="course-exams-title"><div className="flex flex-wrap items-center justify-between gap-3"><h2 id="course-exams-title" className="text-2xl font-semibold">{text('الاختبارات', 'Exams')}</h2><Link href={`/admin/exams?courseId=${course.id}&create=1`} className="button-primary gap-2"><Plus className="size-4" aria-hidden="true" />{text('إضافة اختبار', 'Add exam')}</Link></div>
          {!course.exams.length && <div className="card p-6"><ClipboardList className="mb-4 size-8 text-warning" aria-hidden="true" /><p className="text-sm text-muted">{text('أضف اختبارًا لقياس فهم المتعلم، واجعله مطلوبًا للشهادة إذا أردت.', 'Add an exam to check understanding, and optionally require it for the certificate.')}</p></div>}
          {course.exams.map(exam => {
            const ready = exam.questions.length > 0 && exam.questions.every(question => question.options.length >= 2 && question.options.filter(option => option.isCorrect).length === 1);
            return <article key={exam.id} className="card p-5"><h3 className="break-words text-lg font-semibold">{ar ? exam.title_ar : exam.title_en}</h3>
              <p className="mt-2 text-sm text-muted">{exam.questions.length} {text('أسئلة', 'questions')} · {text('درجة النجاح', 'Pass mark')} {exam.passingBasisPoints / 100}%</p>
              <div className="mt-3 flex flex-wrap gap-2 text-xs"><span className="rounded-full bg-canvas px-3 py-1">{exam.isPublished ? text('منشور', 'Published') : text('مسودة', 'Draft')}</span>{exam.isRequired && <span className="rounded-full bg-goldsoft px-3 py-1 text-warning">{text('مطلوب للشهادة', 'Required for certificate')}</span>}</div>
              <p className={`mt-4 flex items-start gap-2 text-sm ${ready ? 'text-success' : 'text-muted'}`}>{ready && <CheckCircle2 className="mt-0.5 size-4 shrink-0" aria-hidden="true" />}{ready ? text('الأسئلة والإجابات جاهزة', 'Questions and answers are ready') : text('أضف الأسئلة واختر إجابة صحيحة واحدة لكل سؤال.', 'Add questions and choose one correct answer for each question.')}</p>
              <div className="mt-4 flex flex-wrap gap-2"><Link className="button-primary" href={`/admin/questions?examId=${exam.id}`}>{text('إدارة الأسئلة', 'Manage questions')}</Link><Link className="button-secondary" href={`/admin/exams?courseId=${course.id}&edit=${exam.id}`}>{text('تعديل الاختبار', 'Edit exam')}</Link></div>
            </article>;
          })}
        </section>
        <section className="card p-5"><h2 className="font-semibold">{text('المدربون', 'Instructors')}</h2><p className="mt-3 text-sm text-muted">{course.instructors.map(({instructor}) => ar ? instructor.name_ar : instructor.name_en).join('، ') || text('لم تتم إضافة مدرب بعد.', 'No instructor assigned yet.')}</p><Link href="/admin/courses" className="button-secondary mt-4">{text('اختيار المدربين من قائمة الدورات', 'Assign instructors from Courses')}</Link></section>
      </aside>
    </div>
  </div>;
}
