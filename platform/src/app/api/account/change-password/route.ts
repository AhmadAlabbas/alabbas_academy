import {changePasswordSchema} from '@/lib/auth/schemas';
import {changeAccountPassword} from '@/lib/auth/accounts';
import {readJson, accountResponse, accountErrorResponse} from '@/lib/security/request';
import {limitAccountRequest} from '@/lib/security/rate-limit';
import {requireUser} from '@/lib/auth/session';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function POST(request:Request) {
  try {
    const input = await readJson(request, changePasswordSchema);
    const user = await requireUser();
    await limitAccountRequest(request, 'change-password', user.id, 5, 3600);
    await changeAccountPassword(user.id, user.sessionVersion, input);
    return accountResponse('PASSWORD_CHANGED');
  } catch (error) { return accountErrorResponse(error); }
}
