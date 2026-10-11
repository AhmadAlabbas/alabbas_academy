import {verifyEmailSchema} from '@/lib/auth/schemas';
import {verifyAccountEmail} from '@/lib/auth/accounts';
import {readJson, accountResponse, accountErrorResponse} from '@/lib/security/request';
import {limitAccountRequest} from '@/lib/security/rate-limit';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function POST(request:Request) {
  try {
    const input = await readJson(request, verifyEmailSchema);
    await limitAccountRequest(request, 'verify-email', input.token, 10, 900);
    await verifyAccountEmail(input.token);
    return accountResponse('EMAIL_VERIFIED');
  } catch (error) { return accountErrorResponse(error); }
}
