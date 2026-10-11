"use client";
import Script from "next/script";
import "moyasar-payment-form/dist/moyasar.css";
import { useState } from "react";
declare global {
  interface Window {
    Moyasar?: { init: (config: Record<string, unknown>) => void };
  }
}
export function PaymentForm({
  orderId,
  number,
  amount,
  locale,
}: {
  orderId: string;
  number: string;
  amount: number;
  locale: "ar" | "en";
}) {
  const [failed, setFailed] = useState(false);
  return (
    <div>
      <div className="moyasar-form" />
      <Script
        src="/vendor/moyasar.js"
        onError={() => setFailed(true)}
        onReady={() => {
          try {
            window.Moyasar?.init({
              element: ".moyasar-form",
              amount,
              currency: "SAR",
              description: number,
              publishable_api_key:
                process.env.NEXT_PUBLIC_MOYASAR_PUBLISHABLE_KEY,
              callback_url: `${window.location.origin}/api/payments/return?order=${orderId}`,
              methods: ["creditcard"],
              metadata: { order_id: orderId },
              language: locale,
            });
          } catch {
            setFailed(true);
          }
        }}
      />
      {failed && (
        <p role="alert">
          {locale === "ar"
            ? "تعذر تحميل نموذج الدفع. حاول مرة أخرى لاحقًا."
            : "Unable to load the payment form. Try again later."}
        </p>
      )}
    </div>
  );
}
