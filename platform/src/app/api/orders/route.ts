import { requireVerifiedUser } from "@/lib/auth/session";
import { checkoutSchema } from "@/lib/commerce/totals";
import { createOrder } from "@/lib/commerce/orders";
import {CheckoutError} from '@/lib/commerce/checkout-quote';
import { readJson, accountErrorResponse } from "@/lib/security/request";
export async function POST(r: Request) {
  try {
    const user = await requireVerifiedUser(),
      b = await readJson(r, checkoutSchema),
      order = await createOrder(user.id, b);
    return Response.json(
      { id: order.id },
      { headers: { "Cache-Control": "private, no-store" } },
    );
  } catch (e) {
    if (e instanceof CheckoutError) return Response.json({ok: false, code: e.code, minimumOrderHalalas: e.minimumOrderHalalas}, {status: e.status, headers: {'Cache-Control': 'private, no-store'}});
    return accountErrorResponse(e);
  }
}
