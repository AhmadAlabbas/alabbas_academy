import {CourseNotReady} from '@/lib/admin/readiness';
import { z } from "zod";
import {CourseDeletionBlocked, CourseCleanupUnavailable, CourseDeletionChanged} from '@/lib/admin/deletion';
import {courseDeletionPreview} from '@/lib/admin/course-deletion';
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
const deleteInput = input.extend({testData: z.object({confirmedTestData: z.literal(true), previewToken: z.string().regex(/^[a-f0-9]{64}$/)}).strict().optional()});
function adminError(error: unknown) {
  if (error instanceof CourseNotReady) return Response.json({ok: false, code: 'COURSE_NOT_READY', checks: error.checks}, {status: 400});
  if (error instanceof CourseCleanupUnavailable) return Response.json({ok: false, code: 'COURSE_CLEANUP_UNAVAILABLE', reason: error.reason}, {status: 409});
  if (error instanceof CourseDeletionChanged) return Response.json({ok: false, code: 'COURSE_DELETE_CHANGED'}, {status: 409});
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
    if (query.has('deletionPreview')) {
      if ((await c.params).entity !== 'courses') return Response.json({ok: false, code: 'INVALID_INPUT'}, {status: 400});
      const id = z.string().min(1).max(191).parse(query.get('deletionPreview'));
      return Response.json(await courseDeletionPreview(id), {headers: {'Cache-Control': 'private, no-store'}});
    }
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
    const body = await readJson(r, deleteInput, 32768);
    return Response.json(
      await mutateAdmin((await c.params).entity, body.id, {}, user.id, true, body.testData),
    );
  } catch (e) {
    return adminError(e);
  }
}
