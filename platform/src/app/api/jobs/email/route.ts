import {createHash, timingSafeEqual} from "node:crypto";
import {NextResponse} from "next/server";
import {deliverPendingAccountEmails, emailConfigurationReady} from "@/lib/email";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 60;

function authorized(request: Request): boolean {
  const configured = process.env.JOB_WORKER_SECRET;
  const presented = request.headers.get("authorization");
  if (!configured || configured.length < 32 || configured.trim() !== configured || !presented?.startsWith("Bearer ") || presented.length > 1024) return false;
  const expected = createHash("sha256").update(configured).digest();
  const received = createHash("sha256").update(presented.slice(7)).digest();
  return timingSafeEqual(expected, received);
}

export async function POST(request: Request): Promise<NextResponse> {
  const headers = {"Cache-Control": "no-store"};
  if (!authorized(request)) return NextResponse.json({error: "Unauthorized"}, {status: 401, headers});
  if (!emailConfigurationReady()) return NextResponse.json({error: "Email service unavailable"}, {status: 503, headers});
  try {
    const result = await deliverPendingAccountEmails({limit: 5});
    return NextResponse.json(result, {headers});
  } catch {
    return NextResponse.json({error: "Email service unavailable"}, {status: 503, headers});
  }
}
