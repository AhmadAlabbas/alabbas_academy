import { requireVerifiedUser } from "@/lib/auth/session";
import { getDatabase } from "@/lib/db";
import { redirect } from "next/navigation";
import { Link } from "@/i18n/navigation";
export const metadata = { robots: { index: false, follow: false } };
export default async function Page({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params,
    ar = locale === "ar";
  let user;
  try {
    user = await requireVerifiedUser();
  } catch {
    redirect(`/${locale}/account`);
  }
  const [enrollments, orders] = await Promise.all([
    getDatabase().enrollment.findMany({
      where: {
        userId: user.id,
        status: { in: ["ACTIVE", "COMPLETED"] },
        revokedAt: null,
      },
      include: {
        course: {
          include: {
            sections: {
              include: {
                lessons: { where: { isPublished: true }, select: { id: true } },
              },
            },
          },
        },
        progress: {
          where: { completedAt: { not: null } },
          select: { lessonId: true },
        },
      },
      orderBy: { enrolledAt: "desc" },
    }),
    getDatabase().order.findMany({
      where: { userId: user.id },
      orderBy: { createdAt: "desc" },
      take: 20,
    }),
  ]);
  return (
    <div className="container-shell py-12">
      <h1 className="mb-8 text-3xl font-semibold">
        {ar ? "دوراتي" : "My Courses"}
      </h1>
      <div className="grid gap-5 md:grid-cols-2 lg:grid-cols-3">
        {enrollments.map((e) => {
          const ids = e.course.sections.flatMap((s) =>
              s.lessons.map((l) => l.id),
            ),
            percentage = ids.length
              ? Math.round(
                  (e.progress.filter((p) => ids.includes(p.lessonId)).length /
                    ids.length) *
                    100,
                )
              : 0;
          return (
            <article className="card p-6" key={e.id}>
              <p className="mb-3 text-xs text-muted">
                {ar ? "تعلم على وتيرتك" : "Learn at your own pace"}
              </p>
              <h2 className="mb-5 text-xl font-semibold">
                {ar ? e.course.title_ar : e.course.title_en}
              </h2>
              <progress
                className="h-3 w-full accent-[#28778e]"
                value={percentage}
                max={100}
              />
              <p className="mb-5 mt-2 text-sm">{percentage}%</p>
              <Link
                className="button-primary inline-block"
                href={`/learn/${e.courseId}`}
              >
                {ar ? "متابعة التعلم" : "Continue learning"}
              </Link>
            </article>
          );
        })}
      </div>
      {!enrollments.length && (
        <div className="card p-10">
          <p className="mb-5">
            {ar
              ? "لم تسجل في دورة بعد. الطلبات المعلقة تحتاج إلى تأكيد الإدارة."
              : "You are not enrolled yet. Pending orders need administrator confirmation."}
          </p>
          <Link href="/courses" className="button-primary inline-block">
            {ar ? "اكتشف الدورات" : "Explore courses"}
          </Link>
        </div>
      )}
      <h2 className="mb-5 mt-12 text-2xl font-semibold">
        {ar ? "طلباتي" : "My orders"}
      </h2>
      <div className="space-y-3">
        {orders.map((o) => (
          <Link
            href={`/orders/${o.id}`}
            className="card flex flex-wrap justify-between gap-3 p-5"
            key={o.id}
          >
            <span>{o.number}</span>
            <span>
              {ar
                ? (
                    {
                      PENDING: "قيد الانتظار",
                      PAID: "مدفوع",
                      REFUNDED: "مسترد",
                      CANCELLED: "ملغي",
                    } as Record<string, string>
                  )[o.status] || o.status
                : o.status}
            </span>
          </Link>
        ))}
      </div>
      {user.roles.includes("administrator") && (
        <Link className="button-secondary mt-8 inline-block" href="/admin">
          {ar ? "لوحة الإدارة" : "Admin dashboard"}
        </Link>
      )}
    </div>
  );
}
