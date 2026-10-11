import { requireAdmin } from "@/lib/admin/service";
import { getDatabase } from "@/lib/db";
import { accountErrorResponse } from "@/lib/security/request";
const cell = (v: unknown) =>
  '"' +
  String(v ?? "")
    .replace(/^[=+@-]/, "'$&")
    .replaceAll('"', '""') +
  '"';
export async function GET(r: Request) {
  try {
    await requireAdmin();
    const status = new URL(r.url).searchParams.get("status");
    const rows = await getDatabase().order.findMany({
      where:
        status && ["PENDING", "PAID", "REFUNDED", "CANCELLED"].includes(status)
          ? { status }
          : {},
      take: 10000,
      orderBy: { createdAt: "desc" },
      select: {
        number: true,
        buyerName: true,
        buyerEmail: true,
        status: true,
        provider: true,
        totalHalalas: true,
        createdAt: true,
      },
    });
    const text = [
      [
        "Order",
        "Name",
        "Email",
        "Status",
        "Provider",
        "Total SAR",
        "Created Asia/Riyadh",
      ]
        .map(cell)
        .join(","),
      ...rows.map((o) =>
        [
          o.number,
          o.buyerName,
          o.buyerEmail,
          o.status,
          o.provider,
          (o.totalHalalas / 100).toFixed(2),
          o.createdAt.toLocaleString("en-GB", { timeZone: "Asia/Riyadh" }),
        ]
          .map(cell)
          .join(","),
      ),
    ].join("\r\n");
    return new Response("\uFEFF" + text, {
      headers: {
        "Content-Type": "text/csv; charset=utf-8",
        "Content-Disposition": 'attachment; filename="orders.csv"',
        "Cache-Control": "private, no-store",
        "X-Content-Type-Options": "nosniff",
      },
    });
  } catch (e) {
    return accountErrorResponse(e);
  }
}
