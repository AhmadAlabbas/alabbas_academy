import {requireVerifiedUser} from '@/lib/auth/session';
import {quoteSchema} from '@/lib/commerce/totals';
import {quoteCheckout, CheckoutError} from '@/lib/commerce/checkout-quote';
import {readJson, accountErrorResponse} from '@/lib/security/request';
export async function POST(request: Request) {
  try {
    const user = await requireVerifiedUser();
    const input = await readJson(request, quoteSchema);
    return Response.json(await quoteCheckout(user.id, input), {headers: {'Cache-Control': 'private, no-store'}});
  } catch (error) {
    if (error instanceof CheckoutError) return Response.json({ok: false, code: error.code, minimumOrderHalalas: error.minimumOrderHalalas}, {status: error.status, headers: {'Cache-Control': 'private, no-store'}});
    return accountErrorResponse(error);
  }
}
