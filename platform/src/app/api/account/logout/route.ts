import {z} from 'zod';
import {getToken} from 'next-auth/jwt';
import {authConfigurationReady,secureAuthCookies} from '@/lib/auth/config';
import {AccountError} from '@/lib/auth/errors';
import {revokeSessionToken} from '@/lib/auth/session-records';
import {readJson,accountResponse,accountErrorResponse} from '@/lib/security/request';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

/** Revoke first. The client only clears its Auth.js cookie after this succeeds. */
export async function POST(request:Request) {
  try {
    await readJson(request,z.object({}).strict());
    if (!authConfigurationReady()) throw new AccountError('SERVICE_UNAVAILABLE',503);
    const token = await getToken({req:request,secret:process.env.AUTH_SECRET!,secureCookie:secureAuthCookies()});
    await revokeSessionToken(token);
    return accountResponse('SIGNED_OUT');
  } catch (error) { return accountErrorResponse(error); }
}
