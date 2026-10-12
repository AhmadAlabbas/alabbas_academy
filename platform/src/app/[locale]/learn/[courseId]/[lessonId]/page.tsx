import {contentText, contentLocale} from '@/lib/course-content';
import {learningProgress} from '@/lib/learning/progress';
import {LessonOutline} from '@/components/platform/lesson-outline';
import { requireVerifiedUser } from "@/lib/auth/session";
import { enrollmentFor } from "@/lib/learning/service";
import { redirect, notFound } from "next/navigation";
import { Link } from "@/i18n/navigation";
import {
  LessonControls,
  Exam,
  CertificateButton,
  ReviewForm,
} from "@/components/platform/player";
export const metadata = { robots: { index: false, follow: false } };
export default async function Page({
  params,
}: {
  params: Promise<{ locale: string; courseId: string; lessonId: string }>;
}) {
  const { locale, courseId, lessonId } = await params,
    ar = locale === "ar";
  let user;
  try {
    user = await requireVerifiedUser();
  } catch {
    redirect(`/${locale}/account`);
  }
  let enrollment;
  try {
    enrollment = await enrollmentFor(user.id, courseId);
  } catch {
    notFound();
  }
  const lessons = enrollment.course.sections.flatMap((s) => s.lessons),
    lesson = lessons.find((l) => l.id === lessonId);
  if (!lesson) notFound();
  const language = contentLocale(enrollment.course.languages, locale);
  const progress = enrollment.progress.find((p) => p.lessonId === lessonId),
    index = lessons.findIndex((l) => l.id === lessonId);
  return (
    <div className="container-shell grid gap-8 py-10 lg:grid-cols-[280px_minmax(0,1fr)]">
      <LessonOutline contentLanguage={language} courseId={courseId} title={contentText(enrollment.course, 'title', locale)} currentId={lesson.id} percentage={learningProgress(lessons, enrollment.progress).percentage} completed={enrollment.progress.filter(item => item.completedAt).map(item => item.lessonId)} sections={enrollment.course.sections.map(section => ({id: section.id, title: contentText(section, 'title', language), lessons: section.lessons.map(item => ({id: item.id, title: contentText(item, 'title', language)}))}))}/>

      <main className="min-w-0 space-y-6">
        <h2 dir={language === 'ar' ? 'rtl' : 'ltr'} className="text-3xl font-semibold">
          {contentText(lesson, 'title', language)}
        </h2>
        <LessonControls
          key={lesson.id}
          courseId={courseId}
          notesEnabled={lesson.notesEnabled}
          lessonId={lessonId}
          completed={Boolean(progress?.completedAt)}
          note={progress?.note ?? ""}
          position={progress?.lastPositionSeconds ?? 0}
          url={lesson.videoUrl}
          fileId={lesson.videoFileId}
          title={contentText(lesson, 'title', language)}
        />
        {contentText(lesson, 'body', language) && <div dir={language === 'ar' ? 'rtl' : 'ltr'} className="card whitespace-pre-wrap p-6 leading-8">
          {contentText(lesson, 'body', language)}
        </div>}
        {lesson.attachments.length > 0 && (
          <section className="card p-6">
            <h3 className="mb-4 font-semibold">
              {ar ? "ملفات الدرس" : "Lesson files"}
            </h3>
            {lesson.attachments.map((a) => (
              <a
                href={`/api/media/${a.mediaAssetId}`}
                className="mb-3 block text-accent underline"
                key={a.id}
              >
                {language === 'ar' ? a.labelAr || a.labelEn : a.labelEn || a.labelAr}
              </a>
            ))}
          </section>
        )}
        <nav className="flex flex-wrap justify-between gap-4">
          {index > 0 && (
            <Link
              className="button-secondary"
              href={`/learn/${courseId}/${lessons[index - 1].id}`}
            >
              {ar ? "الدرس السابق" : "Previous lesson"}
            </Link>
          )}
          {index < lessons.length - 1 && (
            <Link
              className="button-primary min-h-12"
              href={`/learn/${courseId}/${lessons[index + 1].id}`}
            >
              {ar ? "الدرس التالي" : "Next lesson"}
            </Link>
          )}
        </nav>
        {enrollment.course.exams.map((exam) => (
          <Exam
            courseId={courseId}
            examId={exam.id}
            title={contentText(exam, 'title', language)}
            contentLanguage={contentLocale(enrollment.course.languages, locale)}
            key={exam.id}
          />
        ))}
        <section className="card p-6">
          <CertificateButton courseId={courseId} />
        </section>
        <ReviewForm courseId={courseId} />
      </main>
    </div>
  );
}
