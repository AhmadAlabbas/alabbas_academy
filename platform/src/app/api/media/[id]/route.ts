import { createReadStream } from "node:fs";
import { Readable } from "node:stream";
import { stat } from "node:fs/promises";
import { getDatabase } from "@/lib/db";
import { requireVerifiedUser } from "@/lib/auth/session";
import { accountErrorResponse } from "@/lib/security/request";
import { safeFilePath, byteRange } from "@/lib/media/files";
import { AccountError } from "@/lib/auth/errors";
export async function GET(
  r: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const { id } = await params,
      db = getDatabase(),
      asset = await db.mediaAsset.findUnique({ where: { id } });
    if (!asset || asset.status !== "READY")
      throw new AccountError("INVALID_INPUT", 404);
    const publicImage =
      asset.isPublic &&
      asset.kind === "IMAGE" &&
      ["image/png", "image/jpeg", "image/webp"].includes(asset.mimeType);
    if (!publicImage) {
      const user = await requireVerifiedUser();
      if (!user.roles.includes("administrator")) {
        const lesson = await db.lesson.findFirst({
          where: {
            isPublished: true,
            OR: [
              { videoFileId: id },
              { attachments: { some: { mediaAssetId: id } } },
            ],
            section: {
              course: {
                enrollments: {
                  some: {
                    userId: user.id,
                    status: { in: ["ACTIVE", "COMPLETED"] },
                    revokedAt: null,
                  },
                },
              },
            },
          },
        });
        if (!lesson) throw new AccountError("FORBIDDEN", 403);
      }
    }
    const path = await safeFilePath(asset.storageKey),
      info = await stat(path),
      range =
        asset.mimeType === "video/mp4"
          ? byteRange(r.headers.get("range"), info.size)
          : null;
    const headers: Record<string, string> = {
      "Content-Type": asset.mimeType,
      "Content-Length": String(range ? range.end - range.start + 1 : info.size),
      "X-Content-Type-Options": "nosniff",
      "Content-Security-Policy": "default-src 'none'; sandbox",
      "Cache-Control": publicImage
        ? "public, max-age=86400"
        : "private, no-store",
      Vary: "Cookie",
    };
    if (asset.mimeType === "video/mp4") {
      headers["Accept-Ranges"] = "bytes";
      if (range)
        headers["Content-Range"] =
          `bytes ${range.start}-${range.end}/${info.size}`;
    } else if (!publicImage)
      headers["Content-Disposition"] =
        `attachment; filename="download.${asset.mimeType === "application/pdf" ? "pdf" : "txt"}"; filename*=UTF-8''${encodeURIComponent(asset.originalName)}`;
    return new Response(
      Readable.toWeb(createReadStream(path, range ?? {})) as ReadableStream,
      { status: range ? 206 : 200, headers },
    );
  } catch (e) {
    return accountErrorResponse(e);
  }
}
