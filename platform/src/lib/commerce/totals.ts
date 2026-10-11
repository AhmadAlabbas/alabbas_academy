import { z } from "zod";
export const checkoutSchema = z
  .object({
    locale: z.enum(["ar", "en"]),
    coupon: z.string().trim().toUpperCase().max(40).optional(),
    key: z.uuid(),
  })
  .strict();
export function calculateDiscount(
  subtotal: number,
  coupon: {
    kind: string;
    percentageBasisPoints: number | null;
    amountHalalas: number | null;
    maximumDiscountHalalas: number | null;
    minimumOrderHalalas: number;
  } | null,
) {
  if (
    !Number.isSafeInteger(subtotal) ||
    subtotal < 0 ||
    subtotal > 2_000_000_000
  )
    throw new Error("INVALID_TOTAL");
  if (!coupon) return 0;
  if (subtotal < coupon.minimumOrderHalalas) throw new Error("COUPON_MINIMUM");
  const amount =
    coupon.kind === "PERCENTAGE"
      ? Math.floor(
          (subtotal *
            Math.max(0, Math.min(10000, coupon.percentageBasisPoints || 0))) /
            10000,
        )
      : coupon.kind === "FIXED_AMOUNT"
        ? coupon.amountHalalas || 0
        : 0;
  return Math.max(
    0,
    Math.min(subtotal, coupon.maximumDiscountHalalas ?? subtotal, amount),
  );
}
