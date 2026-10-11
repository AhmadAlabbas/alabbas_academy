import {resendVerificationSchema} from '@/lib/auth/schemas';
import {resendAccountVerification} from '@/lib/auth/accounts';
import {readJson, accountResponse, accountErrorResponse} from '@/lib/security/request';
import {limitAccountRequest} from '@/lib/security/rate-limit';
import {requireUser} from '@/lib/auth/session';
import {scheduleAccountEmailDelivery} from '@/lib/auth/mail';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function POST(request:Request) {
  try {
    const input = await readJson(request, resendVerificationSchema);
    const user = await requireUser();
    await limitAccountRequest(request, 'resend-verification', user.id, 3, 3600);
    await resendAccountVerification(user.id, input.locale);
    scheduleAccountEmailDelivery();
    return accountResponse('CHECK_EMAIL');
  } catch (error) { return accountErrorResponse(error); }
}
