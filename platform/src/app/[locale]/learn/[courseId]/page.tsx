import { requireVerifiedUser } from "@/lib/auth/session";
import { enrollmentFor } from "@/lib/learning/service";
import { redirect, notFound } from "next/navigation";
export const metadata = { robots: { index: false, follow: false } };
export default async function Page({
  params,
}: {
  params: Promise<{ locale: string; courseId: string }>;
}) {
  const { locale, courseId } = await params;
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
    latest = enrollment.progress
      .filter((p) => !p.completedAt)
      .sort((a, b) => b.updatedAt.getTime() - a.updatedAt.getTime())[0];
  const next =
    lessons.find((l) => l.id === latest?.lessonId) ||
    lessons.find(
      (l) =>
        !enrollment.progress.some((p) => p.lessonId === l.id && p.completedAt),
    ) ||
    lessons[0];
  if (!next) notFound();
  redirect(`/${locale}/learn/${courseId}/${next.id}`);
}
