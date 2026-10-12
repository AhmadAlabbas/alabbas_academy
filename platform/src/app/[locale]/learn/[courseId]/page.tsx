import {learningProgress} from '@/lib/learning/progress';
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
  const lessons = enrollment.course.sections.flatMap(section => section.lessons);
  const {next} = learningProgress(lessons, enrollment.progress);
  if (!next) notFound();
  redirect(`/${locale}/learn/${courseId}/${next.id}`);
}
