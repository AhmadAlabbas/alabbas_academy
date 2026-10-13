import { z } from "zod";
import {CourseDeletionBlocked} from '@/lib/admin/deletion';
import { requireAdmin, listAdmin, mutateAdmin, adminLookups } from "@/lib/admin/service";
import {
  accountErrorResponse,
  readJson,
  assertSameOrigin,
} from "@/lib/security/request";
const input = z
  .object({
    id: z.string().max(191).nullable(),
    data: z.record(z.string(), z.unknown()).optional(),
  })
  .strict();
function adminError(error: unknown) {
  if (error instanceof CourseDeletionBlocked) return Response.json({ok: false, code: 'COURSE_IN_USE', blockers: error.blockers}, {status: 409, headers: {'Cache-Control': 'private, no-store'}});
  if (error instanceof z.ZodError) return Response.json({ok: false, code: 'INVALID_INPUT', fieldErrors: z.flattenError(error).fieldErrors}, {status: 400});
  if (error && typeof error === 'object' && 'code' in error && error.code === 'P2002') return Response.json({ok: false, code: 'DUPLICATE_VALUE'}, {status: 409});
  if (error && typeof error === 'object' && 'code' in error && error.code === 'P2003') return Response.json({ok: false, code: 'INVALID_RELATION'}, {status: 400});
  return accountErrorResponse(error);
}
export async function GET(
  r: Request,
  c: { params: Promise<{ entity: string }> },
) {
  try {
    await requireAdmin();
    const query = new URL(r.url).searchParams;
    return Response.json(
      {...await listAdmin((await c.params).entity, query),
        ...(query.get('includeLookups') === '1' ? {lookups: await adminLookups()} : {})},
      { headers: { "Cache-Control": "private, no-store" } },
    );
  } catch (e) {
    return adminError(e);
  }
}
export async function POST(
  r: Request,
  c: { params: Promise<{ entity: string }> },
) {
  try {
    const user = await requireAdmin();
    const body = await readJson(r, input, 32768);
    return Response.json(
      await mutateAdmin((await c.params).entity, body.id, body.data, user.id),
    );
  } catch (e) {
    return adminError(e);
  }
}
export async function DELETE(
  r: Request,
  c: { params: Promise<{ entity: string }> },
) {
  try {
    assertSameOrigin(r);
    const user = await requireAdmin();
    const body = await readJson(r, input, 32768);
    return Response.json(
      await mutateAdmin((await c.params).entity, body.id, {}, user.id, true),
    );
  } catch (e) {
    return adminError(e);
  }
}
