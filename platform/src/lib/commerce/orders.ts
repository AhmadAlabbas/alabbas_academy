import "server-only";
import { randomUUID } from "node:crypto";
import { getDatabase } from "@/lib/db";
import {checkoutCart, checkoutCoupon, CheckoutError} from "./checkout-quote";
import { gatewayConfigured, MoyasarProvider } from "./providers";
import {
  queueNotification,
  sendPendingNotifications,
} from "@/lib/email/notifications";
import type { Prisma } from "@/generated/prisma/client";
export async function createOrder(
  userId: string,
  input: { locale: "ar" | "en"; coupon?: string; key: string },
) {
  return getDatabase().$transaction(
    async (tx) => {
      await tx.$queryRaw`SELECT id FROM users WHERE id=${userId} FOR UPDATE`;
      const user = await tx.user.findUniqueOrThrow({ where: { id: userId } });
      if (user.status !== "ACTIVE" || !user.emailVerified)
        throw new CheckoutError("VERIFICATION_REQUIRED", 403);
      const existing = await tx.order.findUnique({
        where: { checkoutKey: input.key },
        include: { items: true },
      });
      if (existing) {
        if (existing.userId !== userId) throw new CheckoutError("ORDER_CONFLICT", 409);
        return existing;
      }
      const {cart, subtotal} = await checkoutCart(tx, userId);
      const {coupon, discount} = await checkoutCoupon(tx, userId, input.coupon, cart.items.map(item => item.courseId), subtotal, true);
      const settings = await tx.setting.findUnique({
          where: { key: "payments_enabled" },
        });
      const provider =
        gatewayConfigured() && settings?.value !== false && subtotal > discount ? "moyasar" : "manual";
      const expires = new Date(Date.now() + 86400000);
      let cumulativePrice = 0, allocatedDiscount = 0;
      const items = cart.items.map((item) => {
        cumulativePrice += item.course.priceHalalas;
        const cumulativeDiscount = Number(BigInt(discount) * BigInt(cumulativePrice) / BigInt(Math.max(1, subtotal)));
        const d = cumulativeDiscount - allocatedDiscount;
        allocatedDiscount = cumulativeDiscount;
        return {
          courseId: item.courseId,
          titleAr: item.course.title_ar,
          titleEn: item.course.title_en,
          unitPriceHalalas: item.course.priceHalalas,
          discountHalalas: d,
          totalHalalas: item.course.priceHalalas - d,
        };
      });
      const order = await tx.order.create({
        data: {
          number:
            "AA-" +
            Date.now().toString(36).toUpperCase() +
            "-" +
            randomUUID().slice(0, 8).toUpperCase(),
          userId,
          provider,
          status: "PENDING",
          subtotalHalalas: subtotal,
          discountHalalas: discount,
          totalHalalas: subtotal - discount,
          buyerEmail: user.email,
          buyerName: user.name || user.email,
          locale: input.locale,
          checkoutKey: input.key,
          couponCodeSnapshot: coupon?.code,
          expiresAt: expires,
          items: { create: items },
        },
        include: { items: true },
      });
      if (coupon)
        await tx.couponReservation.create({
          data: {
            couponId: coupon.id,
            userId,
            orderId: order.id,
            discountHalalas: discount,
            expiresAt: expires,
          },
        });
      await tx.paymentAttempt.create({
        data: {
          orderId: order.id,
          provider,
          amountHalalas: order.totalHalalas,
          status: "PENDING",
          idempotencyKey: `order:${order.id}`,
        },
      });
      await tx.cartItem.deleteMany({ where: { cartId: cart.id } });
      return order;
    },
    // Coupon limits must see the previous customer's committed reservation
    // after acquiring the coupon lock, rather than an earlier snapshot.
    { timeout: 15000, isolationLevel: 'ReadCommitted' },
  );
}
async function fulfill(
  tx: Prisma.TransactionClient,
  orderId: string,
  provider: string,
  paymentId?: string,
  actorId?: string,
) {
  await tx.$queryRaw`SELECT id FROM orders WHERE id=${orderId} FOR UPDATE`;
  const order = await tx.order.findUniqueOrThrow({
    where: { id: orderId },
    include: { items: true, couponReservation: true },
  });
  if (order.status === "PAID") return order;
  if (
    order.status !== "PENDING" ||
    order.provider !== provider ||
    (provider === "manual" && order.expiresAt && order.expiresAt <= new Date())
  )
    throw new Error("ORDER_UNAVAILABLE");
  if (order.couponReservation) {
    const r = order.couponReservation;
    await tx.$queryRaw`SELECT id FROM coupons WHERE id=${r.couponId} FOR UPDATE`;
    if (
      provider === "manual" &&
      (r.status !== "RESERVED" || r.expiresAt <= new Date())
    )
      throw new Error("ORDER_EXPIRED");
    // A gateway receipt can arrive after checkout reservations expire. The
    // provider already verified the captured amount against this order; honor
    // that paid snapshot rather than denying access after accepting money.
    if (
      r.status !== "RESERVED" &&
      !(provider === "moyasar" && r.status === "EXPIRED")
    )
      throw new Error("COUPON_RESERVATION_UNAVAILABLE");
    await tx.couponReservation.update({
      where: { id: r.id },
      data: { status: "REDEEMED" },
    });
    await tx.couponRedemption.upsert({
      where: { orderId: order.id },
      update: {},
      create: {
        couponId: r.couponId,
        orderId: order.id,
        userId: order.userId,
        discountHalalas: r.discountHalalas,
      },
    });
  }
  for (const item of order.items) {
    const existing = await tx.enrollment.findUnique({
      where: {
        userId_courseId: { userId: order.userId, courseId: item.courseId },
      },
    });
    if (existing && existing.status !== "REVOKED") continue;
    await tx.enrollment.upsert({
      where: {
        userId_courseId: { userId: order.userId, courseId: item.courseId },
      },
      create: {
        userId: order.userId,
        courseId: item.courseId,
        orderItemId: item.id,
        source: "purchase",
      },
      update: {
        status: "ACTIVE",
        revokedAt: null,
        completedAt: null,
        orderItemId: item.id,
        source: "purchase",
      },
    });
  }
  await tx.order.update({
    where: { id: order.id },
    data: { status: "PAID", paidAt: new Date() },
  });
  await tx.paymentAttempt.updateMany({
    where: { orderId: order.id },
    data: {
      status: "CAPTURED",
      providerPaymentId: paymentId,
      verifiedAt: new Date(),
      capturedAt: new Date(),
    },
  });
  await tx.auditLog.create({
    data: {
      actorId,
      action:
        provider === "manual" ? "ORDER_MANUALLY_PAID" : "PAYMENT_VERIFIED",
      entityType: "Order",
      entityId: order.id,
      changes: { provider },
    },
  });
  await confirmEmail(order, tx);
  return order;
}
export async function confirmManualOrder(orderId: string, actorId: string) {
  const order = await getDatabase().$transaction(
    (tx) => fulfill(tx, orderId, "manual", undefined, actorId),
    { timeout: 15000 },
  );
  await sendPendingNotifications().catch(() => undefined);
  return order;
}
export async function verifyMoyasarOrder(orderId: string, paymentId: string) {
  const order = await getDatabase().order.findUniqueOrThrow({
    where: { id: orderId },
  });
  if (order.provider !== "moyasar") throw new Error("INVALID_PROVIDER");
  await new MoyasarProvider().verify(paymentId, order);
  const fulfilled = await getDatabase().$transaction(
    (tx) => fulfill(tx, orderId, "moyasar", paymentId),
    { timeout: 15000 },
  );
  await sendPendingNotifications().catch(() => undefined);
  return fulfilled;
}
async function confirmEmail(
  order: { id: string; number: string; buyerEmail: string; locale: string },
  tx: Prisma.TransactionClient,
) {
  await queueNotification(
    `order-confirmation:${order.id}`,
    {
      to: order.buyerEmail,
      subject:
        order.locale === "ar"
          ? "تم تأكيد تسجيلك — أكاديمية العباس"
          : "Your enrollment is confirmed — Alabbas Academy",
      text:
        order.locale === "ar"
          ? `تم تأكيد الطلب ${order.number}. يمكنك الآن متابعة دوراتك من صفحة دوراتي.`
          : `Order ${order.number} is confirmed. Your courses are available in My Courses.`,
    },
    tx,
  );
}
export async function refundOrder(
  orderId: string,
  actorId: string,
  reason: string,
) {
  const db = getDatabase(),
    order = await db.order.findUniqueOrThrow({
      where: { id: orderId },
      include: { paymentAttempts: true },
    });
  if (order.status === "REFUNDED") return order;
  if (order.status !== "PAID") throw new Error("ORDER_UNAVAILABLE");
  const attempt = order.paymentAttempts.find((x) => x.status === "CAPTURED");
  if (!attempt) throw new Error("PAYMENT_UNAVAILABLE");
  const key = `full-refund:${order.id}`;
  const receipt = await db.refund.upsert({
    where: { idempotencyKey: key },
    update: {},
    create: {
      orderId,
      paymentAttemptId: attempt.id,
      idempotencyKey: key,
      amountHalalas: order.totalHalalas,
      reason,
    },
  });
  if (order.provider === "moyasar") {
    if (!attempt.providerPaymentId) throw new Error("PAYMENT_UNAVAILABLE");
    const { moyasarRequest } = await import("./providers");
    const payment = await moyasarRequest(
      `/payments/${attempt.providerPaymentId}`,
    );
    if (payment.status !== "refunded") {
      const claimed = await db.refund.updateMany({
        where: { id: receipt.id, status: "PENDING", providerRefundId: null },
        data: { providerRefundId: "REQUESTED" },
      });
      if (!claimed.count) throw new Error("REFUND_NEEDS_RECONCILIATION");
      await new MoyasarProvider().refund(
        attempt.providerPaymentId,
        order.totalHalalas,
        key,
      );
    } else if (payment.refunded !== order.totalHalalas)
      throw new Error("REFUND_NOT_VERIFIED");
  }
  return db.$transaction(async (tx) => {
    await tx.$queryRaw`SELECT id FROM orders WHERE id=${orderId} FOR UPDATE`;
    await tx.refund.update({
      where: { id: receipt.id },
      data: { status: "SUCCEEDED", verifiedAt: new Date() },
    });
    await tx.order.update({
      where: { id: orderId },
      data: { status: "REFUNDED" },
    });
    await tx.paymentAttempt.update({
      where: { id: attempt.id },
      data: { status: "REFUNDED" },
    });
    const itemIds = (
      await tx.orderItem.findMany({ where: { orderId }, select: { id: true } })
    ).map((x) => x.id);
    await tx.enrollment.updateMany({
      where: { orderItemId: { in: itemIds } },
      data: { status: "REVOKED", revokedAt: new Date() },
    });
    await tx.certificate.updateMany({
      where: { enrollment: { orderItemId: { in: itemIds } } },
      data: { revokedAt: new Date() },
    });
    await tx.auditLog.create({
      data: {
        actorId,
        action: "ORDER_REFUNDED",
        entityType: "Order",
        entityId: orderId,
        changes: { provider: order.provider },
      },
    });
    return tx.order.findUniqueOrThrow({ where: { id: orderId } });
  });
}
