import {resetPasswordSchema} from '@/lib/auth/schemas';
import {resetAccountPassword} from '@/lib/auth/accounts';
import {readJson, accountResponse, accountErrorResponse} from '@/lib/security/request';
import {limitAccountRequest} from '@/lib/security/rate-limit';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function POST(request:Request) {
  try {
    const input = await readJson(request, resetPasswordSchema);
    await limitAccountRequest(request, 'reset-password', input.token, 10, 900);
    await resetAccountPassword(input);
    return accountResponse('PASSWORD_RESET');
  } catch (error) { return accountErrorResponse(error); }
}
