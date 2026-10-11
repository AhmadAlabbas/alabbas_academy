import { requireAdmin } from "@/lib/admin/service";
import { assertSameOrigin, accountErrorResponse } from "@/lib/security/request";
import { saveUpload } from "@/lib/media/files";
import { AccountError } from "@/lib/auth/errors";
export async function POST(r: Request) {
  try {
    assertSameOrigin(r);
    const user = await requireAdmin();
    const length = Number(r.headers.get("content-length"));
    if (!length || length > 26 * 1024 * 1024)
      throw new AccountError("INVALID_INPUT", 413);
    const reader = r.body?.getReader();
    if (!reader) throw new AccountError("INVALID_INPUT", 400);
    let size = 0;
    const chunks: Uint8Array[] = [];
    for (;;) {
      const item = await reader.read();
      if (item.done) break;
      size += item.value.byteLength;
      if (size > 26 * 1024 * 1024) {
        await reader.cancel();
        throw new AccountError("INVALID_INPUT", 413);
      }
      chunks.push(item.value);
    }
    const data = await new Response(Buffer.concat(chunks), {
        headers: { "Content-Type": r.headers.get("content-type") || "" },
      }).formData(),
      file = data.get("file");
    if (!(file instanceof File)) throw new AccountError("INVALID_INPUT", 400);
    const asset = await saveUpload(file, user.id);
    return Response.json({ id: asset.id, url: `/api/media/${asset.id}` });
  } catch (e) {
    return accountErrorResponse(e);
  }
}
