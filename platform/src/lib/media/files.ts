import "server-only";
import { resolve, relative } from "node:path";
import { constants } from "node:fs";
import { mkdir, open, realpath, unlink } from "node:fs/promises";
import { randomUUID, createHash } from "node:crypto";
import { getDatabase } from "@/lib/db";
import { AccountError } from "@/lib/auth/errors";
export function uploadDirectory() {
  const dir = resolve(
    /* turbopackIgnore: true */ process.env.UPLOAD_DIR || ".local/uploads",
  );
  for (const denied of [".next", "public"])
    if (
      dir === resolve(/* turbopackIgnore: true */ denied) ||
      dir.startsWith(resolve(/* turbopackIgnore: true */ denied) + "/")
    )
      throw Error("UPLOAD_DIR must be outside public and build output");
  return dir;
}
export function sniffFile(
  buffer: Buffer,
): { mime: string; ext: string; kind: string; max: number } | null {
  if (
    buffer.length >= 12 &&
    buffer.subarray(0, 8).equals(Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]))
  )
    return {
      mime: "image/png",
      ext: "png",
      kind: "IMAGE",
      max: 5 * 1024 * 1024,
    };
  if (buffer[0] === 255 && buffer[1] === 216 && buffer[2] === 255)
    return {
      mime: "image/jpeg",
      ext: "jpg",
      kind: "IMAGE",
      max: 5 * 1024 * 1024,
    };
  if (
    buffer.subarray(0, 4).toString() === "RIFF" &&
    buffer.subarray(8, 12).toString() === "WEBP"
  )
    return {
      mime: "image/webp",
      ext: "webp",
      kind: "IMAGE",
      max: 5 * 1024 * 1024,
    };
  if (buffer.subarray(0, 5).toString() === "%PDF-")
    return {
      mime: "application/pdf",
      ext: "pdf",
      kind: "DOCUMENT",
      max: 10 * 1024 * 1024,
    };
  if (buffer.subarray(4, 8).toString() === "ftyp")
    return {
      mime: "video/mp4",
      ext: "mp4",
      kind: "VIDEO",
      max: 25 * 1024 * 1024,
    };
  if (
    buffer.length &&
    !buffer.includes(0) &&
    !buffer.subarray(0, 1024).toString("utf8").includes("\uFFFD")
  )
    return {
      mime: "text/plain",
      ext: "txt",
      kind: "DOCUMENT",
      max: 10 * 1024 * 1024,
    };
  return null;
}
export async function saveUpload(file: File, userId: string) {
  if (file.size > 25 * 1024 * 1024 || !file.size)
    throw new AccountError("INVALID_INPUT", 413);
  const buffer = Buffer.from(await file.arrayBuffer()),
    type = sniffFile(buffer);
  if (!type || buffer.length > type.max || file.type !== type.mime)
    throw new AccountError("INVALID_INPUT", 400);
  const dir = uploadDirectory();
  await mkdir(dir, { recursive: true, mode: 0o700 });
  const name = randomUUID() + "." + type.ext,
    path = resolve(dir, name),
    handle = await open(
      /* turbopackIgnore: true */ path,
      constants.O_CREAT |
        constants.O_EXCL |
        constants.O_WRONLY |
        constants.O_NOFOLLOW,
      0o600,
    );
  try {
    await handle.writeFile(buffer);
  } finally {
    await handle.close();
  }
  try {
    return await getDatabase().mediaAsset.create({
      data: {
        storageKey: name,
        originalName:
          file.name.replace(/[^\p{L}\p{N} ._-]/gu, "").slice(0, 150) || name,
        mimeType: type.mime,
        kind: type.kind,
        status: "READY",
        isPublic: type.kind === "IMAGE",
        bytes: BigInt(buffer.length),
        checksumSha256: createHash("sha256").update(buffer).digest("hex"),
        uploadedById: userId,
      },
    });
  } catch (e) {
    await unlink(path);
    throw e;
  }
}
export async function safeFilePath(key: string) {
  if (!/^[a-zA-Z0-9_.-]+$/.test(key) || key.includes(".."))
    throw new AccountError("FORBIDDEN", 403);
  const root = await realpath(/* turbopackIgnore: true */ uploadDirectory()),
    path = await realpath(/* turbopackIgnore: true */ resolve(root, key));
  if (relative(root, path).startsWith(".."))
    throw new AccountError("FORBIDDEN", 403);
  return path;
}
export function byteRange(
  header: string | null,
  size: number,
): { start: number; end: number } | null {
  if (!header) return null;
  const m = /^bytes=(\d*)-(\d*)$/.exec(header);
  if (!m || (!m[1] && !m[2])) throw new AccountError("INVALID_INPUT", 416);
  const start = m[1] ? Number(m[1]) : Math.max(0, size - Number(m[2])),
    end = m[1] && m[2] ? Number(m[2]) : size - 1;
  if (
    !Number.isSafeInteger(start) ||
    !Number.isSafeInteger(end) ||
    start < 0 ||
    end < start ||
    start >= size
  )
    throw new AccountError("INVALID_INPUT", 416);
  return { start, end: Math.min(end, size - 1) };
}
