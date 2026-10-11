import 'server-only';
import {createHmac} from 'node:crypto';
import {getDatabase} from '@/lib/db';
import {AccountError} from '@/lib/auth/errors';
import {authConfigurationReady} from '@/lib/auth/config';

export async function consumeRateLimit(scope: string, identity: string, maximum: number, windowSeconds: number): Promise<void> {
  if (!authConfigurationReady()) throw new AccountError('SERVICE_UNAVAILABLE', 503);
  const key = createHmac('sha256', process.env.AUTH_SECRET!).update(`${scope}\0${identity}`).digest('hex');
  const rows = await getDatabase().$queryRaw<Array<{attempts:number}>>`
    INSERT INTO auth_rate_limits (key, attempts, "expiresAt", "updatedAt")
    VALUES (${key}, 1, NOW() + ${windowSeconds} * INTERVAL '1 second', NOW())
    ON CONFLICT (key) DO UPDATE SET
      attempts = CASE WHEN auth_rate_limits."expiresAt" <= NOW() THEN 1 ELSE auth_rate_limits.attempts + 1 END,
      "expiresAt" = CASE WHEN auth_rate_limits."expiresAt" <= NOW() THEN NOW() + ${windowSeconds} * INTERVAL '1 second' ELSE auth_rate_limits."expiresAt" END,
      "updatedAt" = NOW()
    RETURNING attempts`;
  if (!rows[0] || rows[0].attempts > maximum) throw new AccountError('RATE_LIMITED', 429);
}

/** Only Vercel's platform-controlled address header is trusted automatically. */
export function clientRateIdentity(request: Request): string {
  if (process.env.VERCEL === '1') return request.headers.get('x-vercel-forwarded-for')?.split(',')[0].trim().slice(0,80) || 'unknown';
  if (process.env.AUTH_TRUSTED_PROXY === '1') return request.headers.get('x-forwarded-for')?.split(',')[0].trim().slice(0,80) || 'unknown';
  return 'local-or-untrusted-proxy';
}

export async function limitAccountRequest(request: Request, scope: string, identity: string, maximum = 5, windowSeconds = 900): Promise<void> {
  await consumeRateLimit(`${scope}:source`, clientRateIdentity(request), 100, windowSeconds);
  await consumeRateLimit(`${scope}:identity`, identity, maximum, windowSeconds);
}
