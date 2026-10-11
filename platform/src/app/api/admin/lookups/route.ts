import {adminLookups, requireAdmin} from '@/lib/admin/service';
import {accountErrorResponse} from '@/lib/security/request';

export async function GET() {
  try {
    await requireAdmin();
    return Response.json(await adminLookups(), {headers: {'Cache-Control': 'private, no-store'}});
  } catch (error) {return accountErrorResponse(error);}
}
