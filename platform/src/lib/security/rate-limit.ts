import 'server-only';
import {createHmac} from 'node:crypto';
import {getDatabase} from '@/lib/db';
import {AccountError} from '@/lib/auth/errors';
import {authConfigurationReady} from '@/lib/auth/config';

export async function consumeRateLimit(scope: string, identity: string, maximum: number, windowSeconds: number): Promise<void> {
  if (!authConfigurationReady()) throw new AccountError('SERVICE_UNAVAILABLE', 503);
  const key = createHmac('sha256', process.env.AUTH_SECRET!).update(`${scope}\0${identity}`).digest('hex');
  const attempts = await getDatabase().$transaction(async tx => {
    await tx.$executeRaw`INSERT INTO auth_rate_limits (\`key\`, attempts, \`expiresAt\`, \`updatedAt\`)
      VALUES (${key}, 1, DATE_ADD(NOW(3), INTERVAL ${windowSeconds} SECOND), NOW(3))
      ON DUPLICATE KEY UPDATE attempts = IF(\`expiresAt\` <= NOW(3), 1, attempts + 1),
      \`expiresAt\` = IF(\`expiresAt\` <= NOW(3), VALUES(\`expiresAt\`), \`expiresAt\`), \`updatedAt\` = NOW(3)`;
    return (await tx.authRateLimit.findUniqueOrThrow({where:{key}})).attempts;
  });
  if (attempts > maximum) throw new AccountError('RATE_LIMITED', 429);
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
