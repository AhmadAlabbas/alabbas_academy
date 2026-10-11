import {handlers} from '@/auth';
import {authConfigurationReady,secureAuthCookies} from '@/lib/auth/config';
import {AccountError} from '@/lib/auth/errors';
import {accountErrorResponse,assertSameOrigin} from '@/lib/security/request';
import type {NextRequest} from 'next/server';
import {getToken} from 'next-auth/jwt';
import {revokeSessionToken} from '@/lib/auth/session-records';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function GET(request:NextRequest) {
  if (!authConfigurationReady()) {
    if (new URL(request.url).pathname.endsWith('/session')) return Response.json(null,{headers:{'Cache-Control':'no-store'}});
    return accountErrorResponse(new AccountError('SERVICE_UNAVAILABLE',503));
  }
  return handlers.GET(request);
}

export async function POST(request:NextRequest) {
  if (!authConfigurationReady()) return accountErrorResponse(new AccountError('SERVICE_UNAVAILABLE',503));
  if (new URL(request.url).pathname.endsWith('/signout')) {
    try {
      assertSameOrigin(request);
      const token = await getToken({req:request,secret:process.env.AUTH_SECRET!,secureCookie:secureAuthCookies()});
      // Auth.js swallows event failures; require durable revocation before it clears cookies.
      await revokeSessionToken(token);
    } catch (error) { return accountErrorResponse(error); }
  }
  return handlers.POST(request);
}
