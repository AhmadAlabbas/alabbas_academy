import { z } from "zod";
import { requireAdmin } from "@/lib/admin/service";
import { getDatabase } from "@/lib/db";
import { readJson, accountErrorResponse } from "@/lib/security/request";
import { confirmManualOrder, refundOrder } from "@/lib/commerce/orders";
import { sendPendingNotifications } from "@/lib/email/notifications";
import { deliverPendingAccountEmails } from "@/lib/email/worker";
import { AccountError } from "@/lib/auth/errors";
const schema = z
  .object({
    action: z.enum([
      "mark-paid",
      "refund",
      "enroll",
      "revoke",
      "ban",
      "unban",
      "role",
      "resend",
      "retry-email",
      "reorder",
      "move",
      "instructor",
      "tag",
    ]),
    id: z.string().min(1).max(191).optional(),
    userId: z.string().max(191).optional(),
    courseId: z.string().max(191).optional(),
    value: z.string().max(191).optional(),
    ids: z.array(z.string().max(191)).min(1).max(200).optional(),
    entity: z.enum(["sections", "lessons"]).optional(),
    reason: z.string().min(1).max(191).optional(),
  })
  .strict();
export async function POST(r: Request) {
  try {
    const admin = await requireAdmin(),
      b = await readJson(r, schema),
      db = getDatabase();
    if (b.action === "mark-paid") {
      if (!b.id) throw new AccountError("INVALID_INPUT", 400);
      await confirmManualOrder(b.id, admin.id);
    } else if (b.action === "refund") {
      if (!b.id || !b.reason) throw new AccountError("INVALID_INPUT", 400);
      await refundOrder(b.id, admin.id, b.reason);
    } else if (b.action === "retry-email") {
      await deliverPendingAccountEmails({ limit: 3 });
      await sendPendingNotifications(3);
      const { cleanAccountRecords } = await import("@/lib/auth/maintenance");
      await cleanAccountRecords();
    } else if (b.action === "resend") {
      if (!b.id) throw new AccountError("INVALID_INPUT", 400);
      const user = await db.user.findUniqueOrThrow({ where: { id: b.id } });
      const { resendAccountVerification } = await import("@/lib/auth/accounts");
      await resendAccountVerification(
        user.id,
        user.preferredLocale === "en" ? "en" : "ar",
      );
    } else if (b.action === "instructor" || b.action === "tag") {
      if (!b.courseId || !b.value) throw new AccountError("INVALID_INPUT", 400);
      if (b.action === "instructor")
        await db.courseInstructor.upsert({
          where: {
            courseId_instructorId: {
              courseId: b.courseId,
              instructorId: b.value,
            },
          },
          create: { courseId: b.courseId, instructorId: b.value },
          update: {},
        });
      else
        await db.courseTag.upsert({
          where: { courseId_tagId: { courseId: b.courseId, tagId: b.value } },
          create: { courseId: b.courseId, tagId: b.value },
          update: {},
        });
    } else if (b.action === "enroll" || b.action === "revoke") {
      if (!b.userId || !b.courseId)
        throw new AccountError("INVALID_INPUT", 400);
      const user = await db.user.findUniqueOrThrow({ where: { id: b.userId } });
      if (
        b.action === "enroll" &&
        (!user.emailVerified || user.status !== "ACTIVE")
      )
        throw new AccountError("FORBIDDEN", 403);
      await db.$transaction(async (tx) => {
        await tx.$queryRaw`SELECT id FROM users WHERE id=${b.userId} FOR UPDATE`;
        const where = {
          userId_courseId: { userId: b.userId!, courseId: b.courseId! },
        };
        if (b.action === "enroll")
          await tx.enrollment.upsert({
            where,
            create: {
              userId: b.userId!,
              courseId: b.courseId!,
              source: "admin",
            },
            update: {
              status: "ACTIVE",
              revokedAt: null,
              source: "admin",
              orderItemId: null,
            },
          });
        else {
          await tx.enrollment.update({
            where,
            data: { status: "REVOKED", revokedAt: new Date() },
          });
          await tx.certificate.updateMany({
            where: { enrollment: { userId: b.userId, courseId: b.courseId } },
            data: { revokedAt: new Date() },
          });
        }
      });
    } else if (b.action === "move") {
      if (!b.id || !b.entity || !["up", "down"].includes(b.value || ""))
        throw new AccountError("INVALID_INPUT", 400);
      await db.$transaction(async (tx) => {
        const item =
          b.entity === "sections"
            ? await tx.section.findUniqueOrThrow({ where: { id: b.id } })
            : await tx.lesson.findUniqueOrThrow({ where: { id: b.id } });
        const parent = "courseId" in item ? item.courseId : item.sectionId;
        if (b.entity === "sections")
          await tx.$queryRaw`SELECT id FROM courses WHERE id=${parent} FOR UPDATE`;
        else
          await tx.$queryRaw`SELECT id FROM sections WHERE id=${parent} FOR UPDATE`;
        const rows =
          b.entity === "sections"
            ? await tx.section.findMany({
                where: { courseId: parent },
                orderBy: { position: "asc" },
              })
            : await tx.lesson.findMany({
                where: { sectionId: parent },
                orderBy: { position: "asc" },
              });
        const index = rows.findIndex((x) => x.id === item.id),
          other = rows[index + (b.value === "up" ? -1 : 1)];
        if (!other) return;
        const change = async (id: string, position: number) =>
          b.entity === "sections"
            ? tx.section.update({ where: { id }, data: { position } })
            : tx.lesson.update({ where: { id }, data: { position } });
        await change(item.id, -1000000);
        await change(other.id, item.position);
        await change(item.id, other.position);
      });
    } else if (b.action === "reorder") {
      if (!b.id || !b.ids || !b.entity || new Set(b.ids).size !== b.ids.length)
        throw new AccountError("INVALID_INPUT", 400);
      const entity = b.entity,
        ids = b.ids,
        parent = b.id;
      await db.$transaction(async (tx) => {
        const rows =
          entity === "sections"
            ? await tx.section.findMany({ where: { courseId: parent } })
            : await tx.lesson.findMany({ where: { sectionId: parent } });
        if (rows.length !== ids.length || rows.some((x) => !ids.includes(x.id)))
          throw new AccountError("INVALID_INPUT", 400);
        for (let i = 0; i < ids.length; i++) {
          if (entity === "sections")
            await tx.section.update({
              where: { id: ids[i] },
              data: { position: -i - 100000 },
            });
          else
            await tx.lesson.update({
              where: { id: ids[i] },
              data: { position: -i - 100000 },
            });
        }
        for (let i = 0; i < ids.length; i++) {
          if (entity === "sections")
            await tx.section.update({
              where: { id: ids[i] },
              data: { position: i },
            });
          else
            await tx.lesson.update({
              where: { id: ids[i] },
              data: { position: i },
            });
        }
      });
    } else {
      if (!b.id || b.id === admin.id) throw new AccountError("FORBIDDEN", 403);
      await db.$transaction(async (tx) => {
        await tx.$queryRaw`SELECT \`key\` FROM settings WHERE \`key\`='academy_name_en' FOR UPDATE`;
        const target = await tx.user.findUniqueOrThrow({
          where: { id: b.id },
          include: { roles: { include: { role: true } } },
        });
        if (
          target.roles.some((x) => x.role.slug === "administrator") &&
          (b.action === "ban" || b.action === "role")
        ) {
          const count = await tx.user.count({
            where: {
              status: "ACTIVE",
              roles: { some: { role: { slug: "administrator" } } },
            },
          });
          if (count <= 1) throw new AccountError("FORBIDDEN", 403);
        }
        if (b.action === "role") {
          if (!["administrator", "support", "learner"].includes(b.value || ""))
            throw new AccountError("INVALID_INPUT", 400);
          const role = await tx.role.findUniqueOrThrow({
            where: { slug: b.value },
          });
          await tx.userRole.deleteMany({ where: { userId: b.id } });
          await tx.userRole.create({
            data: { userId: b.id!, roleId: role.id },
          });
        } else
          await tx.user.update({
            where: { id: b.id },
            data: { status: b.action === "ban" ? "BANNED" : "ACTIVE" },
          });
        await tx.user.update({
          where: { id: b.id },
          data: { sessionVersion: { increment: 1 } },
        });
        await tx.session.updateMany({
          where: { userId: b.id, revokedAt: null },
          data: { revokedAt: new Date() },
        });
      });
    }
    await db.auditLog.create({
      data: {
        actorId: admin.id,
        action: b.action,
        entityType: "AdminAction",
        entityId: b.id || b.courseId || "email",
      },
    });
    return Response.json({ ok: true });
  } catch (e) {
    return accountErrorResponse(e);
  }
}
