import { z } from "zod";
import { getDatabase } from "@/lib/db";
import { readJson, accountErrorResponse } from "@/lib/security/request";
import {
  consumeRateLimit,
  clientRateIdentity,
} from "@/lib/security/rate-limit";
import {
  queueNotification,
  sendPendingNotifications,
} from "@/lib/email/notifications";
const schema = z
  .object({
    name: z.string().trim().min(1).max(80),
    email: z.email().max(191),
    subject: z.string().trim().min(1).max(191),
    body: z.string().trim().min(10).max(5000),
    website: z.string().max(500).optional(),
    locale: z.enum(["ar", "en"]),
  })
  .strict();
export async function POST(r: Request) {
  try {
    const b = await readJson(r, schema);
    if (b.website) return Response.json({ ok: true });
    await consumeRateLimit("contact-source", clientRateIdentity(r), 10, 3600);
    await consumeRateLimit("contact-email", b.email.toLowerCase(), 3, 3600);
    const db = getDatabase(),
      contact = await db.contactMessage.create({
        data: {
          name: b.name,
          email: b.email.toLowerCase(),
          subject: b.subject,
          body: b.body,
          locale: b.locale,
        },
      });
    const setting = await db.setting.findUnique({
      where: { key: "contact_email" },
    });
    const to = process.env.ADMIN_EMAIL || String(setting?.value || "");
    if (to) {
      await queueNotification(`contact:${contact.id}`, {
        to,
        subject:
          b.locale === "ar"
            ? "رسالة جديدة — أكاديمية العباس"
            : "New message — Alabbas Academy",
        text: `${b.name}\n${b.email}\n${b.subject}\n\n${b.body}`,
      });
      await sendPendingNotifications(1).catch(() => undefined);
    }
    return Response.json({ ok: true });
  } catch (e) {
    return accountErrorResponse(e);
  }
}
