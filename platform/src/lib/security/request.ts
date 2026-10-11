import type {ZodType} from 'zod';
import {AccountError} from '@/lib/auth/errors';

const defaultMaximumBytes = 8192;

/** Own JSON mutations require an explicit same-origin browser request. */
export function assertSameOrigin(request: Request): void {
  const supplied = request.headers.get('origin');
  if (!supplied || supplied === 'null') throw new AccountError('FORBIDDEN', 403);
  const allowed = new Set<string>();
  for (const value of [process.env.AUTH_URL, process.env.NEXT_PUBLIC_APP_URL, process.env.VERCEL_URL ? `https://${process.env.VERCEL_URL}` : undefined]) {
    if (value) {
      try { allowed.add(new URL(value).origin); } catch { /* Invalid configuration never widens access. */ }
    }
  }
  if (!allowed.size && process.env.NODE_ENV !== 'production') allowed.add(new URL(request.url).origin);
  let origin: string;
  try { origin = new URL(supplied).origin; } catch { throw new AccountError('FORBIDDEN', 403); }
  if (origin !== supplied || !allowed.has(origin)) throw new AccountError('FORBIDDEN', 403);
  const fetchSite = request.headers.get('sec-fetch-site');
  if (fetchSite && !['same-origin', 'none'].includes(fetchSite)) throw new AccountError('FORBIDDEN', 403);
}

export async function readJson<T>(request: Request, schema: ZodType<T>, maximumBytes = defaultMaximumBytes): Promise<T> {
  assertSameOrigin(request);
  if (request.headers.get('content-type')?.split(';')[0].trim().toLowerCase() !== 'application/json') throw new AccountError('INVALID_INPUT', 400);
  const declared = request.headers.get('content-length');
  if (declared && (!/^\d+$/.test(declared) || Number(declared) > maximumBytes)) throw new AccountError('INVALID_INPUT', 413);
  const reader = request.body?.getReader();
  if (!reader) throw new AccountError('INVALID_INPUT', 400);
  let total = 0;
  const chunks: Uint8Array[] = [];
  try {
    for (;;) {
      const {done, value} = await reader.read();
      if (done) break;
      total += value.byteLength;
      if (total > maximumBytes) { await reader.cancel(); throw new AccountError('INVALID_INPUT', 413); }
      chunks.push(value);
    }
  } finally { reader.releaseLock(); }
  let value: unknown;
  try { value = JSON.parse(Buffer.concat(chunks).toString('utf8')); } catch { throw new AccountError('INVALID_INPUT', 400); }
  const result = schema.safeParse(value);
  if (!result.success) {
    const fieldErrors: Record<string,string[]> = {};
    for (const issue of result.error.issues) {
      const field = String(issue.path[0] ?? 'form');
      (fieldErrors[field] ??= []).push(issue.message);
    }
    throw new AccountError('INVALID_INPUT', 400, fieldErrors);
  }
  return result.data;
}

export function accountResponse(code: string, status = 200, extras: Record<string,unknown> = {}): Response {
  return Response.json({ok:true, code, ...extras}, {status, headers:{'Cache-Control':'no-store'}});
}

export function accountErrorResponse(error: unknown): Response {
  const known = error instanceof AccountError ? error : new AccountError('SERVICE_UNAVAILABLE', 503);
  return Response.json({ok:false, code:known.code, ...(known.fieldErrors ? {fieldErrors:known.fieldErrors} : {})}, {status:known.status, headers:{'Cache-Control':'no-store', ...(known.code === 'RATE_LIMITED' ? {'Retry-After':'60'} : {})}});
}
