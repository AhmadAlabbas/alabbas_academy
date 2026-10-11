import { afterEach, describe, expect, it, vi } from "vitest";
vi.mock("server-only", () => ({}));
import {
  MoyasarProvider,
  gatewayConfigured,
  equalSecret,
  moyasarRequest,
} from "@/lib/commerce/providers";
import { checkoutSchema, calculateDiscount } from "@/lib/commerce/totals";
import { safeEmbed } from "@/lib/media/video";
import { byteRange, sniffFile } from "@/lib/media/files";
const order = {
    id: "owned-order",
    number: "AA-TEST",
    totalHalalas: 19900,
    currency: "SAR",
  },
  payment = {
    id: "payment-12345678",
    status: "paid",
    amount: 19900,
    currency: "SAR",
    metadata: { order_id: order.id },
  };
function configure() {
  vi.stubEnv("PAYMENTS_ENABLED", "true");
  vi.stubEnv("MOYASAR_SECRET_KEY", "private-test-key");
  vi.stubEnv("NEXT_PUBLIC_MOYASAR_PUBLISHABLE_KEY", "public-test-key");
  vi.stubEnv("MOYASAR_WEBHOOK_SECRET", "test-secret".repeat(5));
}
afterEach(() => {
  vi.unstubAllEnvs();
  vi.unstubAllGlobals();
});
describe("payment verification boundaries", () => {
  it("never contacts Moyasar while the environment gate is false", async () => {
    configure();
    vi.stubEnv("PAYMENTS_ENABLED", "false");
    const fetcher = vi.fn();
    vi.stubGlobal("fetch", fetcher);
    expect(gatewayConfigured()).toBe(false);
    await expect(
      new MoyasarProvider().verify(payment.id, order),
    ).rejects.toThrow("PAYMENTS_DISABLED");
    expect(fetcher).not.toHaveBeenCalled();
  });
  it.each([
    { status: "initiated" },
    { amount: 1 },
    { currency: "USD" },
    { id: "another-payment" },
    { metadata: { order_id: "another-order" } },
  ])("rejects mismatched remote receipt %j", async (difference) => {
    configure();
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue(Response.json({ ...payment, ...difference })),
    );
    await expect(
      new MoyasarProvider().verify(payment.id, order),
    ).rejects.toThrow("PAYMENT_NOT_VERIFIED");
  });
  it("accepts only an API-confirmed exact paid receipt", async () => {
    configure();
    const fetcher = vi.fn().mockResolvedValue(Response.json(payment));
    vi.stubGlobal("fetch", fetcher);
    expect((await new MoyasarProvider().verify(payment.id, order)).status).toBe(
      "paid",
    );
    expect(fetcher.mock.calls[0][0]).toBe(
      "https://api.moyasar.com/v1/payments/payment-12345678",
    );
    expect(fetcher.mock.calls[0][1].redirect).toBe("error");
  });
  it("rejects gateway path injection and oversized streaming replies", async () => {
    configure();
    const fetcher = vi.fn().mockResolvedValue(new Response("x".repeat(70000)));
    vi.stubGlobal("fetch", fetcher);
    await expect(moyasarRequest("/payments/../../secrets")).rejects.toThrow(
      "INVALID_PAYMENT_ID",
    );
    expect(fetcher).not.toHaveBeenCalled();
    await expect(moyasarRequest("/payments/payment-12345678")).rejects.toThrow(
      "INVALID_PAYMENT_RESPONSE",
    );
  });
  it("verifies full refund status, amount and payment ID", async () => {
    configure();
    vi.stubGlobal(
      "fetch",
      vi
        .fn()
        .mockResolvedValue(
          Response.json({ ...payment, status: "refunded", refunded: 19900 }),
        ),
    );
    expect(
      (await new MoyasarProvider().refund(payment.id, 19900, "refund-once"))
        .status,
    ).toBe("refunded");
    vi.stubGlobal(
      "fetch",
      vi
        .fn()
        .mockResolvedValue(
          Response.json({ ...payment, status: "refunded", refunded: 500 }),
        ),
    );
    await expect(
      new MoyasarProvider().refund(payment.id, 19900, "refund-once"),
    ).rejects.toThrow("REFUND_NOT_VERIFIED");
  });
  it("uses bounded constant-time secret checks and rejects absent/short secrets", () => {
    const secret = "random-example".repeat(4);
    expect(equalSecret(secret, secret)).toBe(true);
    expect(equalSecret(secret + "x", secret)).toBe(false);
    expect(equalSecret(undefined, secret)).toBe(false);
    expect(equalSecret("short", "short")).toBe(false);
  });
  it("refuses client-owned totals or enrollment flags in checkout", () => {
    expect(
      checkoutSchema.safeParse({
        locale: "ar",
        key: crypto.randomUUID(),
        totalHalalas: 1,
      }).success,
    ).toBe(false);
    expect(
      checkoutSchema.safeParse({
        locale: "en",
        key: crypto.randomUUID(),
        paid: true,
      }).success,
    ).toBe(false);
  });
  it("uses integer halalas and caps discounts to subtotal", () => {
    expect(
      calculateDiscount(19999, {
        kind: "PERCENTAGE",
        percentageBasisPoints: 1000,
        amountHalalas: null,
        maximumDiscountHalalas: null,
        minimumOrderHalalas: 0,
      }),
    ).toBe(1999);
    expect(() => calculateDiscount(-1, null)).toThrow();
  });
});
describe("protected media boundaries", () => {
  it.each([
    "javascript:alert(1)",
    "https://evil.example/embed/123",
    "http://youtube.com/watch?v=PkZNo7MFNFg",
    "https://youtube.com.evil.example/watch?v=PkZNo7MFNFg",
  ])("rejects unsafe embeds %s", (value) =>
    expect(safeEmbed(value)).toBeNull(),
  );
  it("normalizes only approved YouTube, Vimeo and Bunny embeds", () => {
    expect(safeEmbed("https://youtu.be/PkZNo7MFNFg")).toBe(
      "https://www.youtube-nocookie.com/embed/PkZNo7MFNFg",
    );
    expect(safeEmbed("https://vimeo.com/12345")).toBe(
      "https://player.vimeo.com/video/12345",
    );
    expect(
      safeEmbed("https://iframe.mediadelivery.net/embed/12/uuid-123"),
    ).toContain("mediadelivery.net");
  });
  it("parses safe bounded MP4 ranges and rejects malformed/multipart ranges", () => {
    expect(byteRange("bytes=10-20", 100)).toEqual({ start: 10, end: 20 });
    expect(byteRange("bytes=-10", 100)).toEqual({ start: 90, end: 99 });
    expect(() => byteRange("bytes=100-", 100)).toThrow();
    expect(() => byteRange("bytes=0-10,20-30", 100)).toThrow();
    expect(() => byteRange("bytes=20-10", 100)).toThrow();
  });
  it("sniffs file signatures rather than trusting a client extension", () => {
    expect(sniffFile(Buffer.from("%PDF-1.7"))?.mime).toBe("application/pdf");
    expect(
      sniffFile(Buffer.from([137, 80, 78, 71, 13, 10, 26, 10, 0, 0, 0, 0]))
        ?.mime,
    ).toBe("image/png");
    expect(sniffFile(Buffer.from([0, 0, 0]))).toBeNull();
  });
});
