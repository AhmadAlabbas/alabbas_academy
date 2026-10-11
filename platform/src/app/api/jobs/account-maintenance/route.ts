import {NextResponse} from "next/server";
import {cleanAccountRecords} from "@/lib/auth/maintenance";
import {authorizedWorkerRequest} from "@/lib/jobs/authorization";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 30;

export async function POST(request: Request): Promise<NextResponse> {
  const headers = {"Cache-Control": "no-store"};
  if (!authorizedWorkerRequest(request)) return NextResponse.json({error: "Unauthorized"}, {status: 401, headers});
  if (!process.env.DATABASE_URL) return NextResponse.json({error: "Account maintenance unavailable"}, {status: 503, headers});
  try {
    return NextResponse.json(await cleanAccountRecords(), {headers});
  } catch {
    return NextResponse.json({error: "Account maintenance unavailable"}, {status: 503, headers});
  }
}
