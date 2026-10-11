import {registrationSchema} from '@/lib/auth/schemas';
import {registerAccount} from '@/lib/auth/accounts';
import {readJson, accountResponse, accountErrorResponse} from '@/lib/security/request';
import {limitAccountRequest} from '@/lib/security/rate-limit';
import {scheduleAccountEmailDelivery} from '@/lib/auth/mail';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function POST(request:Request) {
  try {
    const input = await readJson(request, registrationSchema);
    await limitAccountRequest(request, 'register', input.email, 3, 3600);
    await registerAccount(input);
    scheduleAccountEmailDelivery();
    return accountResponse('CHECK_EMAIL');
  } catch (error) { return accountErrorResponse(error); }
}
