import "server-only";
import {createHash, timingSafeEqual} from "node:crypto";

/** Worker credentials stay in a private header, never in a request URL. */
export function authorizedWorkerRequest(request: Request): boolean {
  const configured = process.env.JOB_WORKER_SECRET;
  const presented = request.headers.get("authorization");
  if (!configured || configured.length < 32 || configured.trim() !== configured || !presented?.startsWith("Bearer ") || presented.length > 1024) return false;
  const expected = createHash("sha256").update(configured).digest();
  const received = createHash("sha256").update(presented.slice(7)).digest();
  return timingSafeEqual(expected, received);
}
