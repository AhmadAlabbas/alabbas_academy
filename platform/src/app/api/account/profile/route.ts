import {profileSchema} from '@/lib/auth/schemas';
import {updateAccountProfile} from '@/lib/auth/accounts';
import {readJson, accountResponse, accountErrorResponse} from '@/lib/security/request';
import {limitAccountRequest} from '@/lib/security/rate-limit';
import {requireUser} from '@/lib/auth/session';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function PATCH(request:Request) {
  try {
    const input = await readJson(request, profileSchema);
    const user = await requireUser();
    await limitAccountRequest(request, 'profile', user.id, 30, 3600);
    await updateAccountProfile(user.id, user.sessionVersion, input);
    return accountResponse('PROFILE_UPDATED');
  } catch (error) { return accountErrorResponse(error); }
}
