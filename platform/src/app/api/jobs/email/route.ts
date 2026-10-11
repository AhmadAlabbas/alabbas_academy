import {NextResponse} from "next/server";
import {deliverPendingAccountEmails, emailConfigurationReady} from "@/lib/email";
import {authorizedWorkerRequest} from "@/lib/jobs/authorization";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 60;

export async function POST(request: Request): Promise<NextResponse> {
  const headers = {"Cache-Control": "no-store"};
  if (!authorizedWorkerRequest(request)) return NextResponse.json({error: "Unauthorized"}, {status: 401, headers});
  if (!emailConfigurationReady()) return NextResponse.json({error: "Email service unavailable"}, {status: 503, headers});
  try {
    const result = await deliverPendingAccountEmails({limit: 5});
    return NextResponse.json(result, {headers});
  } catch {
    return NextResponse.json({error: "Email service unavailable"}, {status: 503, headers});
  }
}
