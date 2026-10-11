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
  const progress = enrollment.progress.find((p) => p.lessonId === lessonId),
    index = lessons.findIndex((l) => l.id === lessonId);
  return (
    <div className="container-shell grid gap-8 py-10 lg:grid-cols-[280px_minmax(0,1fr)]">
      <aside className="space-y-4">
        <h1 className="text-xl font-semibold">
          {ar ? enrollment.course.title_ar : enrollment.course.title_en}
        </h1>
        {enrollment.course.sections.map((s) => (
          <section className="card p-4" key={s.id}>
            <h2 className="mb-3 font-semibold">
              {ar ? s.title_ar : s.title_en}
            </h2>
            {s.lessons.map((l) => (
              <Link
                className={`mb-2 block rounded-xl p-3 text-sm ${l.id === lessonId ? "bg-skysoft font-semibold" : "hover:bg-skysoft"}`}
                aria-current={l.id === lessonId ? "page" : undefined}
                href={`/learn/${courseId}/${l.id}`}
                key={l.id}
              >
                {enrollment.progress.some(
                  (p) => p.lessonId === l.id && p.completedAt,
                )
                  ? "✓ "
                  : ""}
                {ar ? l.title_ar : l.title_en}
              </Link>
            ))}
          </section>
        ))}
      </aside>
      <main className="min-w-0 space-y-6">
        <h2 className="text-3xl font-semibold">
          {ar ? lesson.title_ar : lesson.title_en}
        </h2>
        <LessonControls
          key={lesson.id}
          courseId={courseId}
          lessonId={lessonId}
          completed={Boolean(progress?.completedAt)}
          note={progress?.note ?? ""}
          position={progress?.lastPositionSeconds ?? 0}
          url={lesson.videoUrl}
          fileId={lesson.videoFileId}
          title={ar ? lesson.title_ar : lesson.title_en}
        />
        <div className="card whitespace-pre-wrap p-6 leading-8">
          {ar ? lesson.body_ar : lesson.body_en}
        </div>
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
                {ar ? a.labelAr : a.labelEn}
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
              className="button-primary"
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
            title={ar ? exam.title_ar : exam.title_en}
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
