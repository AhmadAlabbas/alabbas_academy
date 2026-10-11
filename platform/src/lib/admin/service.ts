import "server-only";
import { z } from "zod";
import { getDatabase } from "@/lib/db";
import { requireVerifiedUser } from "@/lib/auth/session";
import { AccountError } from "@/lib/auth/errors";
import { entities } from "./registry";
export async function requireAdmin() {
  const user = await requireVerifiedUser();
  if (!user.roles.includes("administrator"))
    throw new AccountError("FORBIDDEN", 403);
  return user;
}
type Row = Record<string, unknown>;
type Delegate = {
  findMany: (args: Row) => Promise<Row[]>;
  count: (args: Row) => Promise<number>;
  create: (args: Row) => Promise<Row>;
  update: (args: Row) => Promise<Row>;
  delete: (args: Row) => Promise<Row>;
};
function delegate(entity: string) {
  const config = entities[entity];
  if (!config) throw new AccountError("INVALID_INPUT", 404);
  return {
    config,
    db: (getDatabase() as unknown as Record<string, Delegate>)[config.model],
  };
}
export const serialize = (value: unknown): unknown =>
  JSON.parse(
    JSON.stringify(value, (_, v) => (typeof v === "bigint" ? String(v) : v)),
  );
export async function listAdmin(entity: string, query: URLSearchParams) {
  const { config, db } = delegate(entity);
  const page = Math.max(1, Math.min(10000, Number(query.get("page")) || 1));
  const q = (query.get("q") || "").slice(0, 120);
  const status = (query.get("status") || "").slice(0, 30);
  const where: Row = {
    ...(q
      ? { OR: config.search.map((field) => ({ [field]: { contains: q } })) }
      : {}),
    ...(status &&
    [
      "courses",
      "orders",
      "users",
      "reviews",
      "contacts",
      "jobs",
      "pages",
    ].includes(entity)
      ? { status }
      : {}),
  };
  const select =
    entity === "users"
      ? {
          id: true,
          name: true,
          email: true,
          emailVerified: true,
          status: true,
          preferredLocale: true,
          createdAt: true,
          roles: { select: { role: { select: { slug: true } } } },
        }
      : entity === "jobs"
        ? {
            id: true,
            kind: true,
            status: true,
            attempts: true,
            availableAt: true,
            lastError: true,
          }
        : undefined;
  const [rows, total] = await Promise.all([
    db.findMany({
      where,
      take: 25,
      skip: (page - 1) * 25,
      ...(select ? { select } : {}),
    }),
    db.count({ where }),
  ]);
  return { rows: serialize(rows), total, page };
}
export function entitySchema(entity: string, partial = false) {
  const config = entities[entity];
  if (!config || config.readonly) throw new AccountError("FORBIDDEN", 403);
  const shape: Record<string, z.ZodType> = {};
  for (const field of config.fields) {
    let value: z.ZodType =
      field.type === "boolean"
        ? z.boolean()
        : field.type === "number"
          ? z
              .number()
              .int()
              .min(0)
              .max(
                field.key === "passingBasisPoints" ||
                  field.key === "percentageBasisPoints"
                  ? 10000
                  : 2000000000,
              )
          : field.type === "date"
            ? z.iso.datetime().transform((v) => new Date(v))
            : field.type === "json"
              ? z.json()
              : field.type === "select"
                ? z.enum(field.options as [string, ...string[]])
                : z
                    .string()
                    .trim()
                    .min(field.required ? 1 : 0)
                    .max(field.type === "textarea" ? 12000 : 191);
    if (field.key === "slug_ar" || field.key === "slug_en")
      value = z
        .string()
        .normalize()
        .min(1)
        .max(128)
        .regex(/^[\p{L}\p{N}]+(?:[-_][\p{L}\p{N}]+)*$/u);
    if (["videoUrl", "previewUrl"].includes(field.key))
      value = z
        .string()
        .max(1000)
        .refine((v) => !v || Boolean(safeEmbed(v)), "Unsupported video URL");
    if (["thumbnailUrl", "imageUrl"].includes(field.key))
      value = z
        .string()
        .max(500)
        .refine(
          (v) => !v || /^\/api\/media\/[a-zA-Z0-9_-]+$/.test(v),
          "Use an uploaded image",
        );
    if (partial || !field.required) value = value.nullish();
    shape[field.key] = value;
  }
  return z.object(shape).strict();
}
import { safeEmbed } from "@/lib/media/video";
export async function mutateAdmin(
  entity: string,
  id: string | null,
  data: unknown,
  actorId: string,
  remove = false,
) {
  const { config, db } = delegate(entity);
  if (config.readonly) throw new AccountError("FORBIDDEN", 403);
  const identity = config.identity || "id";
  if (remove && !id) throw new AccountError("INVALID_INPUT", 400);
  const parsed = remove ? {} : entitySchema(entity, Boolean(id)).parse(data);
  if (entity === "settings" && !remove) {
    const key = String(parsed.key || id);
    const allowed = [
      "name_ar",
      "name_en",
      "logo",
      "contact_email",
      "contact_phone",
      "instagram",
      "x",
      "payments_enabled",
      "seo_ar",
      "seo_en",
      "home_content_ar",
      "home_content_en",
    ];
    if (!allowed.includes(key)) throw new AccountError("INVALID_INPUT", 400);
    const value = parsed.value;
    if (key === "payments_enabled" && typeof value !== "boolean")
      throw new AccountError("INVALID_INPUT", 400);
    if (
      key === "logo" &&
      (typeof value !== "string" ||
        !(
          value === "/logo.svg" || /^\/api\/media\/[a-zA-Z0-9_-]+$/.test(value)
        ))
    )
      throw new AccountError("INVALID_INPUT", 400);
    if (key === "contact_email" && !z.email().safeParse(value).success)
      throw new AccountError("INVALID_INPUT", 400);
    if (
      key.startsWith("home_content_") &&
      !z.record(z.string().max(100), z.string().max(4000)).safeParse(value)
        .success
    )
      throw new AccountError("INVALID_INPUT", 400);
    if (
      ["instagram", "x"].includes(key) &&
      value !== "" &&
      !z
        .url()
        .refine((v) => v.startsWith("https://"))
        .safeParse(value).success
    )
      throw new AccountError("INVALID_INPUT", 400);
  }
  const row = remove
    ? await db.delete({ where: { [identity]: id } })
    : id
      ? await db.update({ where: { [identity]: id }, data: parsed })
      : await db.create({ data: parsed });
  await getDatabase().auditLog.create({
    data: {
      actorId,
      action: remove ? "DELETE" : id ? "UPDATE" : "CREATE",
      entityType: entity,
      entityId: String(row[identity]),
      changes: { fields: Object.keys(parsed) },
    },
  });
  return serialize(row);
}

export async function adminLookups() {
  const db = getDatabase();
  const [courses, categories, sections, exams, questions, files] =
    await Promise.all([
      db.course.findMany({
        take: 100,
        select: { id: true, title_ar: true, title_en: true },
      }),
      db.category.findMany({
        take: 100,
        select: { id: true, title_ar: true, title_en: true },
      }),
      db.section.findMany({
        take: 100,
        select: { id: true, title_ar: true, title_en: true },
      }),
      db.exam.findMany({
        take: 100,
        select: { id: true, title_ar: true, title_en: true },
      }),
      db.examQuestion.findMany({
        take: 100,
        select: { id: true, prompt_ar: true, prompt_en: true },
      }),
      db.mediaAsset.findMany({
        where: { status: "READY" },
        take: 100,
        orderBy: { createdAt: "desc" },
        select: { id: true, originalName: true },
      }),
    ]);
  return {
    courseId: courses,
    categoryId: categories,
    sectionId: sections,
    examId: exams,
    questionId: questions.map((q) => ({
      id: q.id,
      title_ar: q.prompt_ar,
      title_en: q.prompt_en,
    })),
    mediaAssetId: files.map((f) => ({
      id: f.id,
      title_ar: f.originalName,
      title_en: f.originalName,
    })),
    videoFileId: files.map((f) => ({
      id: f.id,
      title_ar: f.originalName,
      title_en: f.originalName,
    })),
  };
}
