"use client";
import { useLocale } from "next-intl";
import { useState } from "react";
import { useCart } from "@/components/cart/cart-provider";
import { useRouter } from "@/i18n/navigation";
import { formatSAR } from "@/lib/money";
export function Checkout({
  onlinePayments = false,
}: {
  onlinePayments?: boolean;
}) {
  const locale = useLocale() as "ar" | "en",
    ar = locale === "ar",
    cart = useCart(),
    router = useRouter(),
    [coupon, setCoupon] = useState(""),
    [error, setError] = useState(""),
    [busy, setBusy] = useState(false),
    [key] = useState(() => crypto.randomUUID());
  async function submit() {
    setBusy(true);
    setError("");
    try {
      const r = await fetch("/api/orders", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          locale,
          coupon: coupon.trim() || undefined,
          key,
        }),
      });
      if (!r.ok) throw Error();
      const b = await r.json();
      await cart.refresh();
      router.push(`/orders/${b.id}`);
    } catch {
      setError(
        ar
          ? "تعذر إنشاء الطلب. تحقق من القسيمة والدورات وحاول مرة أخرى."
          : "Unable to create the order. Check your coupon and courses, then retry.",
      );
    } finally {
      setBusy(false);
    }
  }
  return (
    <div className="container-shell max-w-3xl py-12">
      <h1 className="mb-8 text-3xl font-semibold">
        {ar ? "إتمام الطلب" : "Checkout"}
      </h1>
      <div className="card space-y-5 p-6">
        {cart.items.map((i) => (
          <div className="flex justify-between gap-4" key={i.courseId}>
            <span>{i.title[locale]}</span>
            <b>{formatSAR(i.priceHalalas, locale)}</b>
          </div>
        ))}
        <label className="block">
          {ar ? "رمز الخصم" : "Coupon code"}
          <input
            className="field"
            maxLength={40}
            value={coupon}
            onChange={(e) => setCoupon(e.target.value.toUpperCase())}
          />
        </label>
        <p className="flex justify-between">
          <span>{ar ? "المجموع قبل الخصم" : "Subtotal before discount"}</span>
          <b>{formatSAR(cart.subtotalHalalas, locale)}</b>
        </p>
        <p className="rounded-xl bg-goldsoft p-4 text-sm leading-7">
          {onlinePayments
            ? ar
              ? "راجع طلبك، ثم تابع إلى صفحة الدفع الآمنة. يتم التحقق من الخصم في ملخص الطلب، وتتاح الدورات بعد تأكيد الدفع."
              : "Review your order, then continue to secure payment. Discounts are validated in your order summary and courses unlock after payment confirmation."
            : ar
              ? "الدفع سيكون متاحًا قريبًا. يمكنك إرسال طلبك بحالة قيد الانتظار. لن يُخصم أي مبلغ ولن تُفتح الدورات حتى تأكيد الدفع. يتم تطبيق الخصم والتحقق منه في ملخص الطلب."
              : "Payments will be available soon. Submit a pending order. No money is charged and courses stay locked until payment is confirmed. Discounts are validated and shown in your order summary."}
        </p>
        <button
          className="button-primary w-full"
          disabled={busy || cart.loading || !cart.count}
          onClick={() => void submit()}
        >
          {busy
            ? ar
              ? "جارٍ الإرسال…"
              : "Submitting…"
            : onlinePayments
              ? ar
                ? "المتابعة إلى الدفع"
                : "Continue to payment"
              : ar
                ? "إرسال الطلب"
                : "Submit order"}
        </button>
        <p role="alert" className="text-sm">
          {error}
        </p>
      </div>
    </div>
  );
}
