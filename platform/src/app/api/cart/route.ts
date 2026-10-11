import { getCurrentUser, requireUser } from '@/lib/auth/session';
import { accountErrorResponse, readJson } from '@/lib/security/request';
import { cartMutationSchema, cartRemovalSchema } from '@/lib/cart/schemas';
import { updateAccountCart } from '@/lib/cart/service';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
const headers = { 'Cache-Control': 'private, no-store', Vary: 'Cookie' };
function response(user: { id: string; emailVerified: Date | null }, result: Awaited<ReturnType<typeof updateAccountCart>>) {
  return Response.json({ authenticated: true, user: { id: user.id, emailVerified: Boolean(user.emailVerified) }, ...result }, { headers });
}

export async function GET() {
  try {
    const user = await getCurrentUser();
    if (!user) return Response.json({ authenticated: false, user: null, cart: null, rejected: [] }, { headers });
    return response(user, await updateAccountCart(user.id, { action: 'read' }));
  } catch (error) { return accountErrorResponse(error); }
}

export async function POST(request: Request) {
  try {
    const input = await readJson(request, cartMutationSchema);
    const user = await requireUser();
    return response(user, await updateAccountCart(user.id, input));
  } catch (error) { return accountErrorResponse(error); }
}

export async function DELETE(request: Request) {
  try {
    const input = await readJson(request, cartRemovalSchema);
    const user = await requireUser();
    return response(user, await updateAccountCart(user.id, { action: 'remove', courseId: input.courseId }));
  } catch (error) { return accountErrorResponse(error); }
}
