import { requireVerifiedUser } from "@/lib/auth/session";
import { getDatabase } from "@/lib/db";
import { verifyMoyasarOrder } from "@/lib/commerce/orders";
import { gatewayConfigured } from "@/lib/commerce/providers";
import { siteOrigin } from "@/lib/seo";
export async function GET(r: Request) {
  const q = new URL(r.url).searchParams,
    orderId = q.get("order") || "",
    paymentId = q.get("id") || "";
  let locale = "ar";
  try {
    if (!gatewayConfigured()) throw Error();
    const user = await requireVerifiedUser(),
      order = await getDatabase().order.findFirst({
        where: { id: orderId, userId: user.id },
      });
    if (!order) throw Error();
    locale = order.locale === "en" ? "en" : "ar";
    await verifyMoyasarOrder(order.id, paymentId);
    return Response.redirect(`${siteOrigin}/${locale}/orders/${order.id}`);
  } catch {
    return Response.redirect(
      `${siteOrigin}/${locale}/my-courses?payment=unconfirmed`,
    );
  }
}
