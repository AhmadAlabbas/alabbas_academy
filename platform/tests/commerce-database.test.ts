import { beforeAll, afterAll, describe, it, expect, vi } from "vitest";
import { randomUUID } from "node:crypto";
vi.mock("server-only", () => ({}));
import { getDatabase } from "@/lib/db";
import { updateAccountCart } from "@/lib/cart/service";
import {
  createOrder,
  confirmManualOrder,
  refundOrder,
  verifyMoyasarOrder,
} from "@/lib/commerce/orders";
import { MoyasarProvider } from "@/lib/commerce/providers";
import { mutateLearning, enrollmentFor } from "@/lib/learning/service";
import { calculateDiscount } from "@/lib/commerce/totals";
const configured = process.env.ACADEMY_TEST_DATABASE_URL;
describe.skipIf(!configured)("MySQL checkout and learning invariants", () => {
  let userId: string,
    courseId: string,
    courseKey: string,
    lessonId: string,
    examId: string,
    questionId: string,
    correctId: string,
    orderId: string;
  beforeAll(async () => {
    vi.stubEnv("DATABASE_URL", configured!);
    vi.stubEnv("AUTH_SECRET", "isolated-commerce-test-secret".repeat(3));
    vi.stubEnv("AUTH_URL", "http://localhost:3001");
    vi.stubEnv("NEXT_PUBLIC_APP_URL", "http://localhost:3001");
    vi.stubEnv("EMAIL_TRANSPORT", "outbox");
    vi.stubEnv("PAYMENTS_ENABLED", "false");
    const db = getDatabase();
    const user = await db.user.create({
      data: {
        email: `commerce-${randomUUID()}@example.com`,
        emailVerified: new Date(),
      },
    });
    userId = user.id;
    const cat = await db.category.create({
      data: { key: randomUUID(), title_ar: "تصنيف", title_en: "Category" },
    });
    const course = await db.course.create({
      data: {
        key: "test-" + randomUUID(),
        categoryId: cat.id,
        slug_ar: randomUUID(),
        slug_en: randomUUID(),
        title_ar: "دورة",
        title_en: "Course",
        status: "PUBLISHED",
        priceHalalas: 19900,
      },
    });
    courseId = course.id;
    courseKey = course.key;
    const s = await db.section.create({ data: { courseId, position: 0 } });
    lessonId = (
      await db.lesson.create({
        data: { sectionId: s.id, position: 0, isPublished: true },
      })
    ).id;
    const exam = await db.exam.create({
      data: {
        courseId,
        isPublished: true,
        isRequired: true,
        maximumAttempts: 2,
        passingBasisPoints: 10000,
        questions: {
          create: {
            position: 0,
            prompt_ar: "سؤال",
            prompt_en: "Question",
            options: {
              create: [
                {
                  position: 0,
                  label_ar: "نعم",
                  label_en: "Yes",
                  isCorrect: true,
                },
                { position: 1, label_ar: "لا", label_en: "No" },
              ],
            },
          },
        },
      },
      include: { questions: { include: { options: true } } },
    });
    examId = exam.id;
    questionId = exam.questions[0].id;
    correctId = exam.questions[0].options.find((o) => o.isCorrect)!.id;
    await db.coupon.create({
      data: {
        code: "TEST10",
        kind: "PERCENTAGE",
        percentageBasisPoints: 1000,
        perUserLimit: 1,
        usageLimit: 1,
      },
    });
  });
  afterAll(async () => {
    await getDatabase().$disconnect();
    vi.unstubAllEnvs();
  });
  it("merges concurrent carts into one row and uses database prices", async () => {
    await Promise.all([
      updateAccountCart(userId, { action: "merge", courseIds: [courseKey] }),
      updateAccountCart(userId, { action: "merge", courseIds: [courseKey] }),
    ]);
    const db = getDatabase();
    expect(await db.cart.count({ where: { userId } })).toBe(1);
    expect(await db.cartItem.count({ where: { cart: { userId } } })).toBe(1);
    expect(
      (await updateAccountCart(userId, { action: "read" })).cart.items[0]
        .priceHalalas,
    ).toBe(19900);
  });
  it("creates one pending order under retries without granting access or calling online payments", async () => {
    const key = randomUUID(),
      orders = await Promise.all([
        createOrder(userId, { locale: "ar", coupon: "TEST10", key }),
        createOrder(userId, { locale: "ar", coupon: "TEST10", key }),
      ]);
    orderId = orders[0].id;
    expect(orders[0].id).toBe(orders[1].id);
    expect(orders[0].provider).toBe("manual");
    expect(orders[0].status).toBe("PENDING");
    expect(orders[0].totalHalalas).toBe(17910);
    await expect(enrollmentFor(userId, courseId)).rejects.toMatchObject({
      status: 403,
    });
  });
  it("confirms manual payment idempotently with one enrollment, coupon redemption and queued receipt", async () => {
    await Promise.all([
      confirmManualOrder(orderId, userId),
      confirmManualOrder(orderId, userId),
    ]);
    const db = getDatabase();
    expect(await db.enrollment.count({ where: { userId, courseId } })).toBe(1);
    expect(await db.couponRedemption.count({ where: { orderId } })).toBe(1);
    expect(
      await db.backgroundJob.count({
        where: { deduplicationKey: `order-confirmation:${orderId}` },
      }),
    ).toBe(1);
    expect(
      (await db.order.findUniqueOrThrow({ where: { id: orderId } })).status,
    ).toBe("PAID");
    const cart = await updateAccountCart(userId, {
      action: "add",
      courseId: courseKey,
    });
    expect(cart.cart.items).toHaveLength(0);
  });
  it("requires actual lesson completion and a graded exam before issuing a certificate", async () => {
    await expect(
      mutateLearning(userId, { action: "certificate", courseId }),
    ).rejects.toMatchObject({ status: 403 });
    await mutateLearning(userId, {
      action: "progress",
      courseId,
      lessonId,
      completed: true,
      note: "private note",
    });
    await expect(
      mutateLearning(userId, { action: "certificate", courseId }),
    ).rejects.toMatchObject({ status: 403 });
    const attempt = (await mutateLearning(userId, {
      action: "start-exam",
      courseId,
      examId,
      locale: "en",
    })) as { id: string; questions: unknown };
    expect(JSON.stringify(attempt.questions)).not.toContain("isCorrect");
    await mutateLearning(userId, {
      action: "submit-exam",
      courseId,
      attemptId: attempt.id,
      answers: { [questionId]: correctId },
    });
    const certificate = (await mutateLearning(userId, {
      action: "certificate",
      courseId,
    })) as { id: string };
    expect(certificate.id).toBeTruthy();
    expect(
      (
        await getDatabase().enrollment.findUniqueOrThrow({
          where: { userId_courseId: { userId, courseId } },
        })
      ).status,
    ).toBe("COMPLETED");
  });
  it("revokes course access and certificates after a confirmed manual refund", async () => {
    await refundOrder(orderId, userId, "Test refund funds returned");
    await expect(enrollmentFor(userId, courseId)).rejects.toMatchObject({
      status: 403,
    });
    const db = getDatabase();
    expect(
      (
        await db.certificate.findFirstOrThrow({
          where: { enrollment: { userId, courseId } },
        })
      ).revokedAt,
    ).not.toBeNull();
    await refundOrder(orderId, userId, "Retry");
    expect(await db.refund.count({ where: { orderId } })).toBe(1);
  });
  it("caps fixed and percentage discounts at the authoritative subtotal", () => {
    expect(
      calculateDiscount(100, {
        kind: "FIXED_AMOUNT",
        amountHalalas: 999,
        minimumOrderHalalas: 0,
        percentageBasisPoints: null,
        maximumDiscountHalalas: null,
      }),
    ).toBe(100);
    expect(
      calculateDiscount(19900, {
        kind: "PERCENTAGE",
        percentageBasisPoints: 1000,
        minimumOrderHalalas: 0,
        amountHalalas: null,
        maximumDiscountHalalas: null,
      }),
    ).toBe(1990);
  });
  it("honors a verified payment that arrives after its coupon reservation expires", async () => {
    const db = getDatabase();
    await db.coupon.create({
      data: { code: "LATE10", kind: "PERCENTAGE", percentageBasisPoints: 1000 },
    });
    await updateAccountCart(userId, { action: "add", courseId: courseKey });
    const order = await createOrder(userId, {
      locale: "en",
      coupon: "LATE10",
      key: randomUUID(),
    });
    await db.order.update({
      where: { id: order.id },
      data: { provider: "moyasar", expiresAt: new Date(0) },
    });
    await db.paymentAttempt.updateMany({
      where: { orderId: order.id },
      data: { provider: "moyasar" },
    });
    await db.couponReservation.update({
      where: { orderId: order.id },
      data: { status: "EXPIRED", expiresAt: new Date(0) },
    });
    const verify = vi
      .spyOn(MoyasarProvider.prototype, "verify")
      .mockResolvedValue({ id: "late-paid-receipt" } as never);
    try {
      await verifyMoyasarOrder(order.id, "late-paid-receipt");
      expect(verify).toHaveBeenCalledOnce();
      expect(
        (await db.order.findUniqueOrThrow({ where: { id: order.id } })).status,
      ).toBe("PAID");
      expect(
        (
          await db.couponReservation.findUniqueOrThrow({
            where: { orderId: order.id },
          })
        ).status,
      ).toBe("REDEEMED");
      expect(
        await db.couponRedemption.count({ where: { orderId: order.id } }),
      ).toBe(1);
      expect((await enrollmentFor(userId, courseId)).status).toBe("ACTIVE");
    } finally {
      verify.mockRestore();
    }
  });
});
