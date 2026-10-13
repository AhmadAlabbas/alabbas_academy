import { getDatabase } from "@/lib/db";
import { requireAdmin } from "@/lib/admin/service";
import { entities } from "@/lib/admin/registry";
import { Link } from "@/i18n/navigation";
import {Price} from '@/components/ui/price';
function currentTime() {
  return Date.now();
}
export default async function Page({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  await requireAdmin();
  const { locale } = await params,
    ar = locale === "ar",
    db = getDatabase();
  const [users, courses, pending, revenue, orders] = await Promise.all([
    db.user.count(),
    db.course.count(),
    db.order.count({ where: { status: "PENDING" } }),
    db.order.aggregate({
      where: { status: "PAID" },
      _sum: { totalHalalas: true },
    }),
    db.order.findMany({
      where: { createdAt: { gte: new Date(currentTime() - 7 * 86400000) } },
      select: { createdAt: true, status: true },
    }),
  ]);
  const days = Array.from({ length: 7 }, (_, i) => {
    const date = new Date(currentTime() - (6 - i) * 86400000);
    const key = date.toLocaleDateString("en-CA", { timeZone: "Asia/Riyadh" });
    return {
      date,
      count: orders.filter(
        (o) =>
          o.createdAt.toLocaleDateString("en-CA", {
            timeZone: "Asia/Riyadh",
          }) === key,
      ).length,
    };
  });
  const max = Math.max(1, ...days.map((d) => d.count));
  return (
    <>
      <h1 className="mb-8 text-3xl font-semibold">
        {ar ? "إدارة أكاديمية العباس" : "Manage Alabbas Academy"}
      </h1>
      <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-4">
        {[
          [ar ? "المستخدمون" : "Users", users],
          [ar ? "الدورات" : "Courses", courses],
          [ar ? "طلبات تنتظر التأكيد" : "Pending orders", pending],
          [
            ar ? "الإيرادات المؤكدة" : "Confirmed revenue",
            revenue._sum.totalHalalas ?? 0,
          ],
        ].map(([label, value], index) => (
          <div className="card p-6" key={label}>
            <p className="text-sm text-muted">{label}</p>
            <b className="mt-4 block text-3xl">{index === 3 ? <Price amount={Number(value)} locale={ar ? 'ar' : 'en'} /> : value}</b>
          </div>
        ))}
      </div>
      <section className="card my-6 p-6">
        <h2 className="mb-5 text-xl font-semibold">
          {ar ? "الطلبات خلال 7 أيام" : "Orders in the last 7 days"}
        </h2>
        <div className="flex h-44 items-end gap-3">
          {days.map((d) => (
            <div
              className="flex flex-1 flex-col justify-end text-center"
              key={d.date.toISOString()}
            >
              <span className="text-sm">{d.count}</span>
              <div
                className="mt-2 rounded-t-xl bg-[#7bcce7]"
                style={{ height: Math.max(5, (d.count / max) * 100) }}
              />
              <span className="mt-3 text-xs">
                {d.date.toLocaleDateString(ar ? "ar-SA" : "en-GB", {
                  day: "numeric",
                  month: "short",
                  timeZone: "Asia/Riyadh",
                })}
              </span>
            </div>
          ))}
        </div>
      </section>
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {Object.entries(entities).map(([key, e]) => (
          <Link
            className="card p-6 text-lg font-semibold hover:bg-skysoft"
            key={key}
            href={`/admin/${key}`}
          >
            {ar ? e.ar : e.en}
          </Link>
        ))}
      </div>
      <p className="mt-6 text-sm text-muted">
        {ar
          ? "الدفع الإلكتروني معطل افتراضيًا. الدورات التجريبية قابلة للتعديل."
          : "Online payments are disabled by default. Sample courses are editable."}
      </p>
    </>
  );
}
