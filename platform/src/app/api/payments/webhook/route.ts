import { createHash } from "node:crypto";
import { getDatabase } from "@/lib/db";
import {
  equalSecret,
  gatewayConfigured,
  moyasarRequest,
} from "@/lib/commerce/providers";
import { verifyMoyasarOrder } from "@/lib/commerce/orders";
export async function POST(r: Request) {
  if (!gatewayConfigured()) return new Response("Unavailable", { status: 503 });
  try {
    if (Number(r.headers.get("content-length")) > 65536)
      return new Response("Too large", { status: 413 });
    const reader = r.body?.getReader();
    if (!reader) return new Response("Invalid", { status: 400 });
    let bytes = 0;
    const parts: Uint8Array[] = [];
    for (;;) {
      const { done, value } = await reader.read();
      if (done) break;
      bytes += value.byteLength;
      if (bytes > 65536) {
        await reader.cancel();
        return new Response("Too large", { status: 413 });
      }
      parts.push(value);
    }
    const body = JSON.parse(Buffer.concat(parts).toString("utf8"));
    const token =
      body.secret_token ||
      r.headers.get("authorization")?.replace(/^Bearer /, "");
    if (
      typeof token !== "string" ||
      !equalSecret(token, process.env.MOYASAR_WEBHOOK_SECRET || "")
    )
      return new Response("Forbidden", { status: 403 });
    const eventId = body.id,
      paymentId = body.data?.id;
    if (
      typeof eventId !== "string" ||
      eventId.length > 191 ||
      typeof paymentId !== "string"
    )
      return new Response("Invalid", { status: 400 });
    const db = getDatabase(),
      existing = await db.webhookEvent.findUnique({
        where: {
          provider_providerEventId: {
            provider: "moyasar",
            providerEventId: eventId,
          },
        },
      });
    if (existing?.processedAt) return Response.json({ ok: true });
    const payment = await moyasarRequest(`/payments/${paymentId}`),
      orderId = payment.metadata?.order_id;
    if (typeof orderId !== "string" || payment.status !== "paid")
      return Response.json({ ok: true, ignored: true });
    const event = await db.webhookEvent.upsert({
      where: {
        provider_providerEventId: {
          provider: "moyasar",
          providerEventId: eventId,
        },
      },
      update: { attempts: { increment: 1 } },
      create: {
        provider: "moyasar",
        providerEventId: eventId,
        eventType: "payment.paid",
        payloadHash: createHash("sha256")
          .update(JSON.stringify({ eventId, paymentId, orderId }))
          .digest("hex"),
        payload: { paymentId, orderId },
        verifiedAt: new Date(),
        attempts: 1,
      },
    });
    await verifyMoyasarOrder(orderId, paymentId);
    await db.webhookEvent.update({
      where: { id: event.id },
      data: { processedAt: new Date() },
    });
    return Response.json({ ok: true });
  } catch {
    return new Response("Verification failed", { status: 400 });
  }
}
