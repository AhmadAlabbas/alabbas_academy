import { z } from "zod";
import { requireAdmin, listAdmin, mutateAdmin } from "@/lib/admin/service";
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
export async function GET(
  r: Request,
  c: { params: Promise<{ entity: string }> },
) {
  try {
    await requireAdmin();
    return Response.json(
      await listAdmin((await c.params).entity, new URL(r.url).searchParams),
      { headers: { "Cache-Control": "private, no-store" } },
    );
  } catch (e) {
    return accountErrorResponse(e);
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
    return accountErrorResponse(e);
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
    return accountErrorResponse(e);
  }
}
