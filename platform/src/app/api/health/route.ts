import { getDatabase } from "@/lib/db";
import { emailConfigurationReady } from "@/lib/email/config";
import { gatewayConfigured } from "@/lib/commerce/providers";
export const dynamic = "force-dynamic";
export async function GET() {
  let database = "unconfigured";
  if (process.env.DATABASE_URL) {
    try {
      await getDatabase().setting.findFirst({ select: { key: true } });
      database = "ready";
    } catch {
      database = "unavailable";
    }
  }
  return Response.json(
    {
      ok: database === "ready",
      database,
      emailConfigured: emailConfigurationReady(),
      paymentsEnabled: gatewayConfigured(),
    },
    {
      status: database === "ready" ? 200 : 503,
      headers: { "Cache-Control": "no-store" },
    },
  );
}
