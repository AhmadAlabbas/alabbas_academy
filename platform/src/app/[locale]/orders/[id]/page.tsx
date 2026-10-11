import { requireVerifiedUser } from "@/lib/auth/session";
import { getDatabase } from "@/lib/db";
import { redirect, notFound } from "next/navigation";
import { formatSAR } from "@/lib/money";
import { Link } from "@/i18n/navigation";
import { gatewayConfigured } from "@/lib/commerce/providers";
import { PaymentForm } from "@/components/platform/payment-form";
import { siteSettings } from "@/lib/public-data";
export const metadata = { robots: { index: false, follow: false } };
export default async function Page({
  params,
}: {
  params: Promise<{ locale: string; id: string }>;
}) {
  const { locale, id } = await params,
    ar = locale === "ar";
  let user;
  try {
    user = await requireVerifiedUser();
  } catch {
    redirect(`/${locale}/login`);
  }
  const order = await getDatabase().order.findFirst({
    where: { id, userId: user.id },
    include: { items: true },
  });
  if (!order) notFound();
  const settings = await siteSettings();
  return (
    <div className="container-shell max-w-3xl py-12">
      <h1 className="mb-6 text-3xl font-semibold">
        {ar ? "ملخص الطلب" : "Order summary"}
      </h1>
      <div className="card space-y-5 p-6">
        <p className="text-sm text-muted">{order.number}</p>
        <h2 className="text-xl font-semibold">
          {order.status === "PAID"
            ? ar
              ? "تم تأكيد الطلب"
              : "Order confirmed"
            : order.status === "REFUNDED"
              ? ar
                ? "تم الاسترداد"
                : "Refunded"
              : ar
                ? "الطلب قيد الانتظار"
                : "Order pending"}
        </h2>
        {order.items.map((i) => (
          <div className="flex justify-between gap-4" key={i.id}>
            <span>{ar ? i.titleAr : i.titleEn}</span>
            <b>{formatSAR(i.totalHalalas, ar ? "ar" : "en")}</b>
          </div>
        ))}
        {order.discountHalalas > 0 && (
          <p>
            {ar ? "الخصم" : "Discount"}:{" "}
            {formatSAR(order.discountHalalas, ar ? "ar" : "en")}
          </p>
        )}
        <p className="border-t border-line pt-5 text-xl font-semibold">
          {ar ? "الإجمالي" : "Total"}:{" "}
          {formatSAR(order.totalHalalas, ar ? "ar" : "en")}
        </p>
        {order.status === "PENDING" &&
          (order.provider === "manual" ||
          !gatewayConfigured() ||
          settings.payments_enabled === false ? (
            <p className="rounded-xl bg-goldsoft p-5 leading-8">
              {ar
                ? "الدفع سيكون متاحًا قريبًا. تم استلام طلبك، وستتاح الدورات بعد تأكيد الإدارة. لم يُخصم أي مبلغ."
                : "Payments will be available soon. Your order was received. Courses become available after administrator confirmation. No money has been charged."}
            </p>
          ) : (
            <PaymentForm
              orderId={order.id}
              number={order.number}
              amount={order.totalHalalas}
              locale={ar ? "ar" : "en"}
            />
          ))}
        <Link href="/my-courses" className="button-primary inline-block">
          {ar ? "دوراتي وطلباتي" : "My courses and orders"}
        </Link>
      </div>
    </div>
  );
}
