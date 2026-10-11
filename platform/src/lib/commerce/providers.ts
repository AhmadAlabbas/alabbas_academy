import "server-only";
import { timingSafeEqual, createHash } from "node:crypto";
export type PaymentOrder = {
  id: string;
  number: string;
  totalHalalas: number;
  currency: string;
};
export type VerifiedPayment = {
  id: string;
  status: string;
  amount: number;
  currency: string;
  metadata?: Record<string, unknown>;
  refunded?: number;
};
export interface PaymentProvider {
  readonly name: "manual" | "moyasar";
  verify(id: string, order: PaymentOrder): Promise<VerifiedPayment>;
  refund(id: string, amount: number, key: string): Promise<VerifiedPayment>;
}
export class ManualProvider implements PaymentProvider {
  readonly name = "manual" as const;
  async verify(): Promise<VerifiedPayment> {
    throw new Error("MANUAL_CONFIRMATION_REQUIRED");
  }
  async refund(): Promise<VerifiedPayment> {
    throw new Error("MANUAL_REFUND_CONFIRMATION_REQUIRED");
  }
}
export function gatewayConfigured() {
  return (
    process.env.PAYMENTS_ENABLED === "true" &&
    Boolean(
      process.env.MOYASAR_SECRET_KEY &&
      process.env.NEXT_PUBLIC_MOYASAR_PUBLISHABLE_KEY &&
      process.env.MOYASAR_WEBHOOK_SECRET,
    )
  );
}
export function equalSecret(value: unknown, expected: string | undefined) {
  if (
    typeof value !== "string" ||
    !expected ||
    expected.length < 32 ||
    value.length > 512
  )
    return false;
  return timingSafeEqual(
    createHash("sha256").update(value).digest(),
    createHash("sha256").update(expected).digest(),
  );
}
export async function moyasarRequest(
  path: string,
  options: { method?: string; body?: unknown; key?: string } = {},
): Promise<VerifiedPayment> {
  if (!gatewayConfigured()) throw new Error("PAYMENTS_DISABLED");
  if (!/^\/payments\/[a-zA-Z0-9-]{8,100}(\/refund)?$/.test(path))
    throw new Error("INVALID_PAYMENT_ID");
  const response = await fetch(`https://api.moyasar.com/v1${path}`, {
    method: options.method || "GET",
    headers: {
      Authorization: `Basic ${Buffer.from(`${process.env.MOYASAR_SECRET_KEY}:`).toString("base64")}`,
      "Content-Type": "application/json",
      ...(options.key ? { "Idempotency-Key": options.key } : {}),
    },
    ...(options.body ? { body: JSON.stringify(options.body) } : {}),
    cache: "no-store",
    redirect: "error",
    signal: AbortSignal.timeout(10000),
  });
  if (!response.ok) throw new Error("PAYMENT_PROVIDER_UNAVAILABLE");
  const reader = response.body?.getReader();
  if (!reader) throw new Error("INVALID_PAYMENT_RESPONSE");
  let size = 0;
  const parts: Uint8Array[] = [];
  for (;;) {
    const { done, value } = await reader.read();
    if (done) break;
    size += value.byteLength;
    if (size > 65536) {
      await reader.cancel();
      throw new Error("INVALID_PAYMENT_RESPONSE");
    }
    parts.push(value);
  }
  const text = Buffer.concat(parts).toString("utf8");
  const data = JSON.parse(text) as VerifiedPayment;
  if (
    typeof data.id !== "string" ||
    typeof data.status !== "string" ||
    !Number.isSafeInteger(data.amount) ||
    typeof data.currency !== "string"
  )
    throw new Error("INVALID_PAYMENT_RESPONSE");
  return data;
}
export class MoyasarProvider implements PaymentProvider {
  readonly name = "moyasar" as const;
  async verify(id: string, order: PaymentOrder) {
    const payment = await moyasarRequest(`/payments/${id}`);
    if (
      payment.id !== id ||
      payment.status !== "paid" ||
      payment.amount !== order.totalHalalas ||
      payment.currency !== "SAR" ||
      payment.metadata?.order_id !== order.id
    )
      throw new Error("PAYMENT_NOT_VERIFIED");
    return payment;
  }
  async refund(id: string, amount: number, key: string) {
    if (!Number.isSafeInteger(amount) || amount <= 0)
      throw new Error("INVALID_REFUND");
    const receipt = await moyasarRequest(`/payments/${id}/refund`, {
      method: "POST",
      body: { amount },
      key,
    });
    if (
      receipt.id !== id ||
      receipt.status !== "refunded" ||
      receipt.refunded !== amount
    )
      throw new Error("REFUND_NOT_VERIFIED");
    return receipt;
  }
}
